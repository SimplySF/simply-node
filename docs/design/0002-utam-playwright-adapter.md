# 0002 — UTAM on Playwright

**Status:** Draft — research only, no implementation proposed for this repo
**Package:** none in this repo. The deliverable would be a standalone package (working name
`playwright-utam`), the peer of `wdio-utam-service`.
**Date:** 2026-08-23

> This doc doesn't fit the usual shape — it isn't a `packages/*` feature, so there's no command, no
> flags, and no `messages/*.md` to update. It's recorded here because it's a design decision with a
> real "why", and `docs/design/` is where those live. Published version with diagrams:
> <https://claude.ai/code/artifact/65821a9a-13ba-4412-99aa-59f75c4aec23>

## Problem

Salesforce's UI Test Automation Model (UTAM) compiles JSON page objects into JavaScript page
objects, and ships a WebdriverIO adapter — `wdio-utam-service` — as the only supported way to drive
them from a JS test. Teams standardising on Playwright therefore can't use the
`salesforce-pageobjects` catalog (1,685 generated page objects, maintained per Salesforce release)
without also running a second, WebdriverIO-shaped test stack alongside their Playwright one.

The question is whether UTAM can be driven by Playwright instead, and what that would cost.

## Decision

**It's feasible, and it's a new ~650-line package rather than a fork of UTAM.**

UTAM's JavaScript runtime is already framework-agnostic by construction. `@utam/core` declares the
browser contract as two interfaces — `Driver` (22 methods) and `Element` (27 methods) — and has
**zero dependencies**. `@utam/loader` depends only on core. `@utam/compiler` depends on
`jsonc-parser` and `@utam/diagnostics`. All WebdriverIO coupling lives in one leaf package that
nothing else depends on.

The entire integration surface is a single constructor call, from `wdio-utam-service/service.js`:

```js
driver = new DriverWdioAdapter(browser, mergeDriverConfig(config?.driverConfig));
elementAdapter = (raw) => new ElementWdioAdapter(raw, driver);

const loader = new UtamLoader(driver, { elementAdapter, injectionConfigs });
```

Implement `Driver` and `Element` against Playwright, pass them to that same `UtamLoader`, and the
compiler, the loader, the profile/injection-config machinery, and every generated page object work
unchanged.

### Evidence

Measured against `@utam/core` 3.3.0, `wdio-utam-service` 3.3.0, and `salesforce-pageobjects` 12.0.0.

| Claim                                                                                                               | Measured   |
| ------------------------------------------------------------------------------------------------------------------- | ---------- |
| WebdriverIO references across all generated page objects in `salesforce-pageobjects`                                | 0 of 1,685 |
| Dependencies declared by `@utam/core`                                                                               | 0          |
| `wdio-utam-service` total LOC                                                                                       | 1,227      |
| …of which is Appium/mobile                                                                                          | 373        |
| …of which is dead code (`monkeyPatchShadow` / `monkeyPatchBrowserObject`, exported but never called)                | 140        |
| …leaving live web adapter code                                                                                      | 714        |
| Constructor calls binding a driver to the framework                                                                 | 1          |
| `driver.executeScript` call sites in `@utam/core`, all passing **functions** (not WebDriver `arguments[0]` strings) | 9          |

## The constraint that shapes everything

UTAM's compiler does not emit shadow-piercing selectors. It emits explicit, hop-by-hop traversal —
one `ShadowRoot` wrapper per boundary. Real output from `lightning/accordionSection`:

```js
async function _utam_get_section(driver, root) {
  let _element = root;
  const _locator = _By.css('section.slds-accordion__section');
  _element = new _ShadowRoot(driver, _element); // <-- one boundary
  return _element.findElement(_locator);
}
```

`ShadowRoot.findElement` calls `driver.executeScript(fn, element, selector, REIFY_SHADOW_ELEMENT_CONSTANT)`
and expects a **live DOM node** back, which the adapter must convert into a framework element. The
trailing `__$UTAM_REIFY_SHADOW$__` sentinel exists precisely to tell the adapter that a node is
coming.

**This forces the adapter onto Playwright's `ElementHandle` API** (`evaluateHandle` → `asElement()`
/ `getProperties()`), not `Locator`. Playwright's docs call `ElementHandle` _discouraged_ in favour
of `Locator`, because auto-waiting and auto-retry are Locator features.

So: adopting Playwright buys the runner, the tooling (trace viewer, parallelism, browser
management), and the CDP transport. It does **not** buy Playwright's reliability model. That's not a
regression — WebdriverIO gives UTAM the same resolved-reference semantics today, and UTAM ships its
own polling `waitFor` to compensate — but it should be stated plainly to anyone expecting otherwise.

The upside sits in the same mechanism: every shadow hop is a protocol round trip, and CDP avoids
WebDriver's HTTP request-per-command. On deeply nested Lightning components that's where a real
speedup would come from, and it's the one number worth measuring before committing.

## What the adapter must implement

Effort key: **Direct** = 1:1 call · **Free** = already handled by core · **Rewrite** = port logic ·
**Emulate** = compose from primitives · **Drop** = throw as unsupported.

### `Driver` — 22 methods

| Method                                                   | Playwright                        | Effort  | Note                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `executeScript`                                          | `frame.evaluateHandle`            | Rewrite | The core piece (~60 LOC). Unwrap handle args, run, then `asElement()` or `getProperties()` for NodeLists.                             |
| `findElement` / `findElements`                           | `frame.$$`                        | Direct  | CSS only, which is all UTAM web uses.                                                                                                 |
| `waitFor`                                                | `utam.wait`                       | Free    | Reuse UTAM's own polling helper verbatim.                                                                                             |
| `getUrl` / `back` / `forward`                            | `page.url`, `goBack`, `goForward` | Direct  | —                                                                                                                                     |
| `enterFrame` / `exitFrame` / `exitToParentFrame`         | `contentFrame`, `parentFrame`     | Emulate | UTAM is stateful, Playwright is frame-scoped. Track a current `Frame`; route `findElement` and `executeScript` through it (~30 LOC).  |
| `getWindowHandle(s)` / `switchTo` / `close`              | `context.pages()`                 | Emulate | Playwright has no handle concept. Mint synthetic ids over a `Map<string, Page>`; listen on `context.on('page')` for popups (~40 LOC). |
| `press`                                                  | `keyboard.press` / `type`         | Rewrite | Needs a WebDriver→Playwright key-name map.                                                                                            |
| `getRect` / `setRect`                                    | `viewportSize`                    | Partial | **Genuine gap.** Playwright controls viewport, not OS window position; report `x`/`y` as 0. Zero generated page objects call this.    |
| `setPageContext*` / `isNativeContext` / `getPageContext` | —                                 | Drop    | Appium-only. Playwright can't drive native mobile.                                                                                    |

### `Element` — 27 methods

| Method                                                           | Playwright                                             | Effort  | Note                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAttribute`                                                   | `evaluate` + `getAttribute`                            | Rewrite | **Biggest single chunk (~150 LOC).** WebDriver merges attribute-and-property semantics across boolean attrs, `style`, `selected`, `src`, `href`, `spellcheck`. The wdio adapter does this with `arguments[0]`-style script strings, which Playwright does not accept — each must become a function. |
| `click` / `doubleClick` / `rightClick`                           | `click`, `dblclick`, `click({button})`                 | Direct  | —                                                                                                                                                                                                                                                                                                   |
| `setValue` / `addValue` / `clearValue`                           | `fill`, `type`, `fill('')`                             | Direct  | —                                                                                                                                                                                                                                                                                                   |
| `getText` / `getValue` / `getRect` / `getScreenshot`             | `innerText`, `inputValue`, `boundingBox`, `screenshot` | Direct  | —                                                                                                                                                                                                                                                                                                   |
| `isDisplayed` / `isEnabled`                                      | `isVisible`, `isEnabled`                               | Direct  | —                                                                                                                                                                                                                                                                                                   |
| `isExisting`                                                     | —                                                      | Free    | Core's `isElementAttachedToDom` walks the DOM through shadow roots via `executeScript`.                                                                                                                                                                                                             |
| `findElement(s)` / `containsElement(s)`                          | `handle.$$`                                            | Direct  | Simpler than wdio, which drops to raw `findElementFromElement` protocol calls.                                                                                                                                                                                                                      |
| `hasFocus` / `blur` / `focus` / `getCssValue` / `scrollIntoView` | `evaluate`                                             | Rewrite | Small script functions. `scrollIntoView` must accept UTAM's `{block:'center'}` form.                                                                                                                                                                                                                |
| `moveTo` / `clickAndHold` / `dragAndDrop`                        | `mouse.move` / `down` / `up`                           | Emulate | Compose from `boundingBox()` plus mouse primitives, honouring the duration argument.                                                                                                                                                                                                                |
| `flick`                                                          | —                                                      | Drop    | Mobile gesture.                                                                                                                                                                                                                                                                                     |

### Test integration

`wdio-utam-service` assigns `global.utam` in a `before` hook. A Playwright fixture is the better fit
and gives per-worker isolation for free:

```ts
export const test = base.extend<{ utam: UtamLoader<ElementHandle> }>({
  utam: async ({ page }, use) => {
    const driver = new DriverPlaywrightAdapter(page, driverConfig);
    const loader = new UtamLoader(driver, {
      elementAdapter: (raw) => new ElementPlaywrightAdapter(raw, driver),
      injectionConfigs: ['salesforce-pageobjects/ui-global-components.config.json'],
    });
    loader.setProfile('platform', 'web');
    await use(loader);
  },
});
```

Existing UTAM specs call a bare `utam.load(...)`. Also assigning `globalThis.utam` inside the
fixture lets them port unchanged. Ship both; recommend the fixture for new tests.

`injectionConfigs` — how UTAM resolves interface implementations by profile — is handled entirely
inside `@utam/loader`, so it carries over untouched.

## Alternatives considered

**Fork UTAM and add a Playwright target to the compiler.** Rejected: unnecessary and impossible.
Unnecessary because the compiler emits zero framework-specific code — 0 of 1,685 generated page
objects reference WebdriverIO, so there is nothing to re-target. Impossible in practice because the
UTAM JS source is not public (see risks).

**Build on Playwright `Locator` instead of `ElementHandle`.** Rejected: incompatible with UTAM's
design. `ShadowRoot.findElement` hands the adapter a live DOM node and expects an element object
back; a `Locator` is a deferred query, not a resolved reference, and can't be constructed from a
node. Choosing Locator would mean changing `@utam/core` — which is the fork we just rejected.

**Intercept the `__$UTAM_REIFY_SHADOW$__` sentinel and substitute Playwright's native
shadow-piercing CSS.** Deferred to a hypothetical v2, not rejected. The sentinel exists so an
adapter can recognise a shadow lookup, and swapping in one piercing query would replace an
evaluate-and-reify round trip. But the semantics differ subtly — Playwright's CSS pierces through
_all_ descendant shadow roots, whereas `element.shadowRoot.querySelector(sel)` scopes to exactly one
level — so it needs validating rather than assuming. Not in a first version.

**Do nothing; keep WebdriverIO for Salesforce UI tests.** Still the right answer if the phase-1
spike shows no performance win, given that the Locator model is off the table either way.

## Implementation plan

Sized for one engineer. Genuinely sequential — each phase is only worth starting if the previous one
held up.

| #   | Phase                           | Est.      | What it settles                                                                                                                                                                                                                                                           |
| --- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Spike `executeScript` alone** | 2–3 days  | Pass an `ElementHandle` into `evaluateHandle`, return a node from inside a shadow root, recover it via `asElement()`, recover a NodeList via `getProperties()`. Local fixture page, four nested shadow roots. Benchmark against wdio here, while the comparison is cheap. |
| 2   | **Driver adapter**              | 3–4 days  | All 22 methods, including the stateful current-frame pointer and the synthetic window-handle map. Unit-tested against local fixture pages — no org required.                                                                                                              |
| 3   | **Element adapter**             | 4–5 days  | All 27 methods. Most of the budget goes to porting the WebDriver attribute-and-property semantics from script strings into functions.                                                                                                                                     |
| 4   | **Fixture, packaging, config**  | 2–3 days  | Playwright fixture, loader factory, timeout mapping into `DriverConfig`, TS types, dual ESM/CJS output to match how `wdio-utam-service` ships.                                                                                                                            |
| 5   | **Validate against a real org** | 2–3 weeks | **The long pole.** Port the `utam-js-recipes` suite, run against a live org using the unmodified `salesforce-pageobjects` catalog.                                                                                                                                        |

**Recommendation: time-box phase 1 and decide.** Three days settles the only hard technical question
and produces the number that justifies or kills the project. If the round trip is awkward or no
faster, three days were spent instead of six weeks.

## Testing

Nothing here runs in this repo's `pnpm test`; this is what the standalone package would need.

- **Shadow-DOM fixture page** — four nested open shadow roots. Pins down the `executeScript` round
  trip, `ShadowRoot.findElement`/`findElements`, and `isElementAttachedToDom` staleness detection.
- **Attribute fixture page** — one element per branch of the WebDriver attribute algorithm: boolean
  attrs, `style` as object vs. string, `selected` on `<option>` / checkbox / radio, relative `src`
  on `<img>`, relative `href` on `<a>`, `spellcheck` in all three states. This is where behavioural
  drift will hide, and it must pass before touching an org.
- **Frame fixture page** — nested iframes, exercising `enterFrame` → `findElement` → `executeScript`
  → `exitToParentFrame` to confirm the current-frame pointer routes every call.
- **Popup/window fixture** — confirms synthetic handles survive `context.on('page')` and that
  `switchTo` + `close` leave the map consistent.
- **Port of `utam-js-recipes`** against a live org — the acceptance gate. Unit tests can't catch
  timing, staleness, or attribute drift on real Lightning components.

## Risks

| Risk                                    | Severity      | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maintained alone, forever**           | High, certain | The UTAM JS source is **not public** — both `salesforce/utam-js` and the `salesforce-experience-platform-emu/utam-js` repo named in the package manifests return 404. Only the MIT-licensed npm artifacts are available (`utam-java` _is_ public). You can't read the adapter's TypeScript source, and there's no path to upstreaming. Mitigated by not needing a fork: the package consumes published interfaces. But there's no warning when internals shift. |
| **Behavioural drift in `getAttribute`** | Medium        | The WebDriver attribute-and-property algorithm is subtle and the page objects depend on it. Mitigated by the attribute fixture page above.                                                                                                                                                                                                                                                                                                                      |
| **Frame state model mismatch**          | Medium        | Easy to get _almost_ right. Blast radius is small — only 3 `enterFrame` uses across 1,685 generated page objects.                                                                                                                                                                                                                                                                                                                                               |
| **`ElementHandle` is "discouraged"**    | Low           | Discouraged is not deprecated, and the four APIs needed (`evaluateHandle`, `$$`, `asElement`, `getProperties`) are stable Puppeteer-lineage primitives. Exposure is a few dozen lines in one file.                                                                                                                                                                                                                                                              |
| **Mobile permanently out of scope**     | Low, accepted | ~373 LOC of `wdio-utam-service` is Appium. Playwright can't drive native mobile apps. Any Salesforce mobile-app suite stays on WebdriverIO.                                                                                                                                                                                                                                                                                                                     |

## Open questions

- **Is there a performance win at all?** Unanswered until the phase-1 benchmark. It's the deciding
  input, and nothing else should start before it.
- **Does this belong to this project?** Nothing in `packages/*` consumes UTAM today. Recorded here
  as research; whether it becomes a repo — or a package in this monorepo — is undecided.
- **Which Playwright version to pin as the floor?** Depends on `getProperties`/`asElement` behaviour
  confirmed during the spike.
