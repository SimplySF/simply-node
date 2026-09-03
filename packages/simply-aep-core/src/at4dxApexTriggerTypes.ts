/*
 * Copyright (c) 2026, Clay Chipps.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * One Apex trigger, normalized from either local source (`at4dxApexTriggerLocalScan.ts`) or a
 * target org's Tooling API (`at4dxApexTriggerOrgScan.ts`). This is the data `missing-domain-trigger`
 * (`at4dxValidate.ts`) cross-references against `Domain`-type bindings — see
 * docs/design/0036-at4dx-domain-binding-trigger-validate.md.
 */
export type RawApexTriggerRecord = {
  /** The trigger's own name, e.g. `AccountTrigger`. */
  name: string;
  /** The SObject this trigger fires on, parsed from its `trigger X on <SObject> (...)` header. */
  sobject: string;
  /**
   * Every class named inside an `fflib_SObjectDomain.triggerHandler(<Class>.class)` call found in
   * this trigger's body, in source order. Empty when the trigger never calls it.
   */
  triggerHandlerClasses: string[];
  /**
   * `false` when this trigger's Status (org: `ApexTrigger.Status`; local: its `.trigger-meta.xml`
   * `<status>`) is `Inactive` — an inactive trigger never runs, so it can't satisfy
   * `missing-domain-trigger` even if it calls the right class.
   */
  active: boolean;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.trigger` file. Local scans only. */
  filePath?: string;
};

/**
 * Matches an Apex trigger's declaration header — `trigger <Name> on <SObject> (<events>)` — tolerant
 * of the whitespace/newlines Apex allows between tokens. Used to recover a trigger's target SObject
 * without trusting `ApexTrigger.TableEnumOrId`'s inconsistent custom-object representation; the header
 * line is unambiguous for both local source and an org's Tooling API `Body`, so there's no need to
 * trust (or special-case) `TableEnumOrId` at all. Not anchored to the start of `body` — a trigger's
 * header is never the first token (comments, or an API version pragma-like construct, may precede it).
 */
const TRIGGER_HEADER_PATTERN = /\btrigger\s+\w+\s+on\s+([\w.]+)\s*\(/i;

/**
 * Matches an `fflib_SObjectDomain.triggerHandler(<Class>.class)` call — the one convention this
 * package checks for (see docs/design/0036's Open questions for why a custom wrapper isn't
 * recognized). Tolerant of an optional single leading namespace/alias segment
 * (`ns.fflib_SObjectDomain.triggerHandler(...)`) and of whitespace around each `.`/`(`/`)`. Global, so
 * every call in one trigger body is found, not just the first.
 */
const TRIGGER_HANDLER_CALL_PATTERN =
  /(?:\w+\s*\.\s*)?fflib_SObjectDomain\s*\.\s*triggerHandler\s*\(\s*([\w.]+)\s*\.\s*class\s*\)/gi;

/** @returns The SObject `body` (a trigger's source/`Body`) declares itself `on`, or `undefined` if it doesn't parse as a trigger header at all. */
export function parseTriggerSObject(body: string): string | undefined {
  return TRIGGER_HEADER_PATTERN.exec(body)?.[1];
}

/** @returns Every class named inside an `fflib_SObjectDomain.triggerHandler(<Class>.class)` call in `body`, in source order. Empty if none. */
export function parseTriggerHandlerClasses(body: string): string[] {
  return [...body.matchAll(TRIGGER_HANDLER_CALL_PATTERN)].map((match) => match[1]);
}
