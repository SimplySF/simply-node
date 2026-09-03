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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges `template` under `target`: the target's existing values win on any conflict
 * (including when both sides are arrays — arrays are never merged element-wise, only kept-or-
 * replaced-outright, since element identity/ordering is too format-specific to guess at), and a
 * key present only in `template` is added to the result. Only recurses when a key is a plain
 * object on *both* sides; a type mismatch (e.g. template has an object, target has a string) also
 * resolves to the target's value outright, no recursion attempted.
 */
export function mergeJsonPreservingTarget(template: unknown, target: unknown): unknown {
  if (!isPlainObject(template) || !isPlainObject(target)) {
    return target;
  }

  const merged: Record<string, unknown> = { ...target };
  for (const [key, templateValue] of Object.entries(template)) {
    if (!(key in target)) {
      merged[key] = templateValue;
    } else if (isPlainObject(templateValue) && isPlainObject(target[key])) {
      merged[key] = mergeJsonPreservingTarget(templateValue, target[key]);
    }
  }
  return merged;
}
