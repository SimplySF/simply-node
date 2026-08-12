/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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

import { z } from 'zod';

export const FilterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE']),
  value: z.unknown(),
});

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

export type FilterGroup = {
  logic: 'AND' | 'OR';
  filters: Array<FilterCondition | FilterGroup>;
};

// Filter groups nest arbitrarily (a group's `filters` array can itself contain groups), so the
// schema has to reference itself. z.lazy() defers evaluation of the inner schema until it's
// actually used, which is what makes the self-reference possible.
export const FilterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(['AND', 'OR', 'and', 'or']).transform((value) => value.toUpperCase() as 'AND' | 'OR'),
    filters: z.array(z.union([FilterConditionSchema, FilterGroupSchema])),
  }),
);

export type FilterConfig = FilterGroup;

export const FilterConfigSchema = FilterGroupSchema;
