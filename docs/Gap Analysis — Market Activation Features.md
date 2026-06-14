# Opla — Gap Analysis & Implementation Plan
## Supporting the "Market Activation & Sales Tracking" Project

> This document compares every requirement in the [sample questionnaire](file:///c:/Users/kings/Dev%20Projects/opla/docs/Market%20Activation%20%26%20Sales%20Tracking%20Questionnaire.md) against the current Opla codebase, lists every missing feature, and provides detailed step-by-step implementation instructions.
>
> **Rules Engine Reference**: [opla_rules_engine_builder.tsx](file:///c:/Users/kings/Dev%20Projects/opla/docs/opla_rules_engine_builder.tsx) — UI prototype for the centralized rules builder.

---

## Summary Matrix — What Exists vs What's Missing

| Questionnaire Requirement | Required Feature | Current Status | Gap ID |
|:---|:---|:---|:---|
| Region → Dropdown | Static dropdown | ✅ EXISTS — `dropdown` field type | — |
| Market → Filtered Dropdown (based on Region) | Cascading / filtered dropdown | ✅ IMPLEMENTED | GAP-1 |
| GPS Coordinates → Auto-capture | GPS auto-capture | ✅ EXISTS — `gps_capture` field | — |
| Store Name → Text Input | Text input | ✅ EXISTS — `input_text` field | — |
| Store Owner Name → Text Input | Text input | ✅ EXISTS | — |
| Store Contact Number → Phone Input (validated) | Phone input with format validation | ✅ IMPLEMENTED | GAP-2 |
| Store Type → Dropdown | Static dropdown | ✅ EXISTS | — |
| Operating Hours → Time Range (Open + Close) | Time range (two-time compound field) | ✅ IMPLEMENTED | GAP-3 |
| Storefront Photo → Camera | Photo capture | ✅ EXISTS — `photo_capture` field | — |
| Store Barcode/QR → Scanner | Barcode scanner | ✅ EXISTS — `barcode_scanner` field | — |
| SKU Categories → Multi-select | Multi-select dropdown | ✅ IMPLEMENTED | GAP-4 |
| Available SKUs → Filtered List (based on Categories) | Cascading / filtered lookup list | ✅ IMPLEMENTED | GAP-1 |
| Inventory Check → Numerical qty per SKU | Object collection with number input | ✅ EXISTS — `object_collection` + `input_number` | — |
| Store Layout Photo → Camera | Photo capture | ✅ EXISTS | — |
| Expiry Date Capture → Date Picker per SKU | Date picker inside object_collection | ✅ EXISTS — `date_picker` type in object properties | — |
| SKU Selection → Select Category → Select SKU | Cascading dropdowns | ✅ IMPLEMENTED | GAP-1 |
| Transaction Qty → Input Number | Number input | ✅ EXISTS | — |
| Auto-Calculation (Qty × MSRP) | Formula / computed field | ✅ EXISTS — `formula` on fields + `evaluateFormFormula` | — |
| Reason for Non-Purchase (if qty=0, mandatory) | Conditional required | ✅ IMPLEMENTED — rules engine `REQUIRE` action | GAP-9 |
| Amount Paid → Decimal input | Decimal / currency input | ✅ IMPLEMENTED | GAP-5 |
| Payment Date → Auto-populated timestamp | Auto-timestamp field | ✅ IMPLEMENTED | GAP-6 |
| Payment Method → Dropdown | Static dropdown | ✅ EXISTS | — |
| Agent ID → System metadata | Submission metadata user_id | ✅ EXISTS — `user_id` on Submission model | — |
| Submission Date → System metadata | Submission created_at | ✅ EXISTS | — |
| Form Version → System metadata | form_version_number on Submission | ✅ EXISTS | — |
| Section skip based on activity type | Section-level skip/visibility logic | ✅ IMPLEMENTED | GAP-7 |
| Sales auto-calc using MSRP from catalog | Computed field referencing catalog pricing | ✅ IMPLEMENTED | GAP-8 |
| **Centralized form-level rules engine** | **Nested rule tree with rich actions** | ✅ IMPLEMENTED | **GAP-9** |
| **Multi-form launcher / menu hub** | **Form link field with parameter passing** | ✅ IMPLEMENTED | **GAP-10** |
| **Conditional section jumps in rules** | **JUMP_TO_SECTION rule action** | ✅ IMPLEMENTED | **GAP-11** |

---

## Architecture Decision: Centralized Rules Engine (GAP-9)

> [!IMPORTANT]
> GAP-9 is the **architectural foundation** for this entire plan. It replaces the current flat `LogicRule[]` system with a centralized, hierarchical rules engine that lives in its own `rules` section of the blueprint. **Implement GAP-9 first**, then GAP-1 (cascading) and GAP-7 (section skip) become simple rule configurations rather than custom code.

### Why a Centralized Rules Section?

The current system scatters logic across individual fields and uses a flat list of rules with simple `AND`/`OR` at the top level. The rules builder prototype demonstrates a much more powerful approach:

| Aspect | Current System (`logic[]`) | New Rules Engine (`rules[]`) |
|:---|:---|:---|
| **Structure** | Flat array of `LogicRule` objects | Hierarchical tree: groups can nest groups recursively |
| **Combinators** | Single `logic_operator` per rule (AND/OR over its conditions) | Per-group `combinator` (AND/OR) at every nesting level |
| **Actions** | `show`, `hide`, `skip`, `jump_to` | `SHOW`, `HIDE`, `REQUIRE`, `UNREQUIRE`, `DISABLE_NAV`, `ENABLE_NAV`, `FILTER_OPTIONS`, `SET_VALUE`, `VALIDATE`, `JUMP_TO_SECTION` |
| **Operators** | `eq`, `neq`, `contains`, `gt`, `lt` | All of those + `empty`, `not_empty`, `contains`, `not_contains`, `gte`, `lte`, `between` |
| **Target scope** | Field-level or section-level visibility | Fields, sections, navigation, option filtering, computed value injection |
| **Location** | `blueprint.logic` — flat list mixed with field/section references | `blueprint.rules` — separate top-level section, form-scoped |
| **Evaluation timing** | Implicit (on render) | Explicit: `pre` (before field/section renders) or `post` (after user interaction) |

### Design: How Rules and the Current System Coexist

1. **The existing `blueprint.logic` array continues to work** — no breaking change. The runtime evaluates both `logic` and `rules`.
2. **New rules go into `blueprint.rules`** — a new top-level key in `FormBlueprint`.
3. **The Studio UI gets a new "Rules" tab** (the rules builder) where form designers create all rules centrally.
4. **The mobile runtime evaluates `rules[]` on every field change**, applying actions in priority order.
5. Over time, designers migrate from the old per-field `logic[]` to the centralized `rules[]`.

---

## Feature Gaps — Detailed Implementation Guide

> [!IMPORTANT]
> Each gap below is self-contained. An agent should be able to implement them independently in any order. However, **GAP-9 (Rules Engine) should be done first** as it provides the foundation for GAP-1 (cascading) and GAP-7 (section skip). The remaining gaps (2-6, 8) are independent field-type additions.

---

### GAP-9: Centralized Rules Engine (THE FOUNDATION)

**What the questionnaire needs**: "If Quantity = 0, the field 'Reason for Non-Purchase' becomes mandatory." Also: section-level visibility based on activity type, cascading dropdown filtering, and navigation blocking.

**What exists today**: A flat `LogicRule[]` in `blueprint.logic` with basic field visibility (`show`/`hide`) using flat conditions. No conditional required, no navigation control, no option filtering. The [rules builder prototype](file:///c:/Users/kings/Dev%20Projects/opla/docs/opla_rules_engine_builder.tsx) demonstrates the target architecture.

**Reference prototype**: The rules builder TSX shows:
- A recursive nested rule tree with `group` nodes (having `combinator: 'AND' | 'OR'` and `children[]`) and `rule` leaf nodes (having `field`, `operator`, `value`)
- An action block: `{ effect: 'SHOW' | 'HIDE' | 'REQUIRE' | 'DISABLE_NAV' | 'FILTER_OPTIONS', target: string }`
- A runtime evaluator that recursively evaluates the tree against live form data
- AST JSON compilation and JS runtime compilation

#### Step 1: Define the Rule Tree Type System

**File to modify**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts)

Add these new types **after** the existing `LogicRule` interface (after line 239). Do NOT remove the existing types — they stay for backward compatibility.

```typescript
// ─── Centralized Rules Engine (v2) ──────────────────────────────────────────

/**
 * Comparison operators available in rule conditions.
 * The runtime picks which operators are valid based on the source field type.
 */
export type RuleOperator =
  | '=='       // equals (works on all types)
  | '!='       // not equals
  | '>'        // greater than (number, date)
  | '<'        // less than (number, date)
  | '>='       // greater than or equal
  | '<='       // less than or equal
  | 'contains'     // array/string contains value
  | 'not_contains' // array/string does not contain value
  | 'empty'        // field is null, undefined, or empty string/array
  | 'not_empty'    // field has a meaningful value
  | 'between';     // value is between two bounds (for number/date)

/**
 * A leaf rule node — a single condition comparing a field value to a target.
 */
export interface RuleConditionNode {
  id: string;
  type: 'rule';
  /** The field ID whose value to evaluate */
  field: string;
  /** The comparison operator */
  operator: RuleOperator;
  /** The target value to compare against. For 'between', use "min,max" string. For 'empty'/'not_empty', this is ignored. */
  value: any;
}

/**
 * A group node — combines child nodes (rules or sub-groups) with AND/OR.
 * This is the recursive building block that allows arbitrary nesting.
 */
export interface RuleGroupNode {
  id: string;
  type: 'group';
  /** How to combine children results: AND = all must pass, OR = any must pass */
  combinator: 'AND' | 'OR';
  /** Child nodes — can be leaf rules or nested groups */
  children: RuleNode[];
}

/** A node in the rule tree is either a leaf condition or a group. */
export type RuleNode = RuleConditionNode | RuleGroupNode;

/**
 * The actions that a rule can trigger when its condition tree evaluates to true.
 */
export type RuleActionEffect =
  | 'SHOW'            // Make target field/section visible
  | 'HIDE'            // Hide target field/section
  | 'REQUIRE'         // Make target field required
  | 'UNREQUIRE'       // Make target field optional
  | 'DISABLE_NAV'     // Block the "Next" button with a message
  | 'ENABLE_NAV'      // Unblock the "Next" button
  | 'FILTER_OPTIONS'  // Filter the options of a target dropdown/lookup based on a mapping
  | 'SET_VALUE'       // Set a field to a specific value
  | 'VALIDATE';       // Run custom validation with an error message

/**
 * The action consequence when a rule's conditions are met.
 */
export interface RuleAction {
  /** What effect to apply */
  effect: RuleActionEffect;
  /** The field ID or section ID this action targets */
  target_id: string;
  /** Whether target is a field or section */
  target_type: 'field' | 'section' | 'navigation';
  /** Extra config depending on effect:
   * - FILTER_OPTIONS: { filter_key: string, filter_map?: Record<string, FieldOption[]> }
   * - DISABLE_NAV: { message: string }
   * - SET_VALUE: { value: any }
   * - VALIDATE: { error_message: string }
   */
  config?: Record<string, any>;
}

/**
 * A complete rule definition — one entry in blueprint.rules[].
 * Pattern: IF [condition_tree evaluates true] THEN [apply actions].
 * When condition_tree evaluates false, the inverse is implicitly applied
 * (e.g., SHOW→HIDE, REQUIRE→UNREQUIRE).
 */
export interface FormRule {
  id: string;
  /** Human-readable name shown in Studio (e.g., "Show reason when qty is 0") */
  name: string;
  /** Optional description for documentation */
  description?: string;
  /** Whether this rule is active — allows toggling without deleting */
  enabled: boolean;
  /** The nested condition tree (root is always a group node) */
  condition: RuleGroupNode;
  /** The actions to execute when condition evaluates to true */
  actions: RuleAction[];
  /** Evaluation priority — lower numbers run first. Default 0. */
  priority?: number;
}
```

##### Update FormBlueprint

In the same file, update the `FormBlueprint` interface (around line 257) to add the `rules` key:

```typescript
export interface FormBlueprint {
  meta: FormBlueprintMeta;
  schema: FormSchemaField[];
  ui: FormSection[];
  logic: LogicRule[];       // KEEP — backward compat
  rules: FormRule[];        // NEW — centralized rules engine
}
```

##### Operator-by-Field-Type Mapping

Also add a helper constant (can go in a separate file or at end of types):

```typescript
/**
 * Maps field/schema types to the operators that make sense for them.
 * Used by the Studio rules builder to show relevant operators.
 */
export const RULE_OPERATORS_BY_FIELD_TYPE: Record<string, RuleOperator[]> = {
  string:           ['==', '!=', 'contains', 'not_contains', 'empty', 'not_empty'],
  number:           ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  integer:          ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  decimal:          ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  boolean:          ['==', '!='],
  date:             ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  datetime:         ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  time:             ['==', '!=', '>', '<', 'empty', 'not_empty'],
  select:           ['==', '!=', 'empty', 'not_empty'],
  dropdown:         ['==', '!=', 'empty', 'not_empty'],
  radio_group:      ['==', '!=', 'empty', 'not_empty'],
  checkbox_group:   ['contains', 'not_contains', 'empty', 'not_empty'],
  multi_select_dropdown: ['contains', 'not_contains', 'empty', 'not_empty'],
  toggle:           ['==', '!='],
  input_text:       ['==', '!=', 'contains', 'not_contains', 'empty', 'not_empty'],
  input_number:     ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
};
```

#### Step 2: Build the Rules Runtime Evaluator

**New file to create**: `opla-frontend/apps/mobile/src/utils/rulesEngine.ts`

This is the core runtime that the mobile FormRenderer calls on every form data change. It evaluates all enabled rules and returns the set of active effects.

```typescript
import {
  FormRule,
  RuleNode,
  RuleConditionNode,
  RuleGroupNode,
  RuleAction,
  RuleActionEffect,
} from '@opla/types';

// ─── Types for evaluation results ───────────────────────────────────────────

export interface ActiveEffect {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
}

export interface RulesEvaluationResult {
  /** All effects currently active (conditions evaluated to true) */
  activeEffects: ActiveEffect[];
  /** Lookup: field_id → array of active effects targeting it */
  fieldEffects: Record<string, ActiveEffect[]>;
  /** Lookup: section_id → array of active effects targeting it */
  sectionEffects: Record<string, ActiveEffect[]>;
  /** Whether navigation is currently blocked */
  navigationBlocked: boolean;
  /** Message to show when navigation is blocked */
  navigationBlockMessage?: string;
}

// ─── Condition Evaluator (recursive) ────────────────────────────────────────

/**
 * Evaluates a single leaf condition against the current form responses.
 * Returns true if the condition passes.
 *
 * HOW TO TEST: Call with a simple RuleConditionNode and a responses object.
 * Example:
 *   evaluateConditionNode({ id:'r1', type:'rule', field:'qty', operator:'==', value:'0' }, { qty: '0' })
 *   → returns true
 */
function evaluateConditionNode(
  node: RuleConditionNode,
  responses: Record<string, any>
): boolean {
  const currentVal = responses[node.field];
  const targetVal = node.value;

  // Handle empty/not_empty operators first — they ignore the value
  if (node.operator === 'empty') {
    if (Array.isArray(currentVal)) return currentVal.length === 0;
    return currentVal === undefined || currentVal === null || String(currentVal).trim() === '';
  }
  if (node.operator === 'not_empty') {
    if (Array.isArray(currentVal)) return currentVal.length > 0;
    return currentVal !== undefined && currentVal !== null && String(currentVal).trim() !== '';
  }

  // Handle array operators (for multi-select, checkbox_group)
  if (node.operator === 'contains') {
    if (Array.isArray(currentVal)) return currentVal.includes(targetVal);
    return String(currentVal ?? '').toLowerCase().includes(String(targetVal).toLowerCase());
  }
  if (node.operator === 'not_contains') {
    if (Array.isArray(currentVal)) return !currentVal.includes(targetVal);
    return !String(currentVal ?? '').toLowerCase().includes(String(targetVal).toLowerCase());
  }

  // Handle between (expects value as "min,max")
  if (node.operator === 'between') {
    const parts = String(targetVal).split(',').map(Number);
    if (parts.length !== 2) return false;
    const numCur = Number(currentVal);
    return !isNaN(numCur) && numCur >= parts[0] && numCur <= parts[1];
  }

  // Handle standard comparison operators
  const curStr = String(currentVal ?? '').toLowerCase();
  const tarStr = String(targetVal ?? '').toLowerCase();

  switch (node.operator) {
    case '==':
      return curStr === tarStr;
    case '!=':
      return curStr !== tarStr;
    case '>': {
      const a = Number(currentVal), b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a > b;
    }
    case '<': {
      const a = Number(currentVal), b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a < b;
    }
    case '>=': {
      const a = Number(currentVal), b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a >= b;
    }
    case '<=': {
      const a = Number(currentVal), b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a <= b;
    }
    default:
      return false;
  }
}

/**
 * Recursively evaluates a rule tree node (group or leaf).
 * Groups combine children with AND/OR.
 * Returns true if the node's condition is satisfied.
 *
 * HOW TO TEST: Build a small RuleGroupNode with 2 leaf children and call this.
 */
function evaluateNode(
  node: RuleNode,
  responses: Record<string, any>
): boolean {
  if (node.type === 'rule') {
    return evaluateConditionNode(node as RuleConditionNode, responses);
  }

  const group = node as RuleGroupNode;
  const children = group.children || [];

  if (children.length === 0) return true; // Empty group = always true

  if (group.combinator === 'AND') {
    return children.every(child => evaluateNode(child, responses));
  } else {
    return children.some(child => evaluateNode(child, responses));
  }
}

// ─── Main Evaluator ─────────────────────────────────────────────────────────

/**
 * Evaluates ALL rules in the blueprint against current form responses.
 * Returns a structured result containing all active effects, indexed by target.
 *
 * This is the MAIN FUNCTION called by FormRenderer on every data change.
 *
 * HOW TO USE IN FormRenderer:
 *   const rulesResult = evaluateAllRules(blueprint.rules || [], responses);
 *   // Then use rulesResult.fieldEffects[fieldId] to check effects on each field
 *
 * @param rules - The blueprint.rules array
 * @param responses - The current form data (field_id → value)
 * @returns RulesEvaluationResult
 */
export function evaluateAllRules(
  rules: FormRule[],
  responses: Record<string, any>
): RulesEvaluationResult {
  const activeEffects: ActiveEffect[] = [];
  const fieldEffects: Record<string, ActiveEffect[]> = {};
  const sectionEffects: Record<string, ActiveEffect[]> = {};
  let navigationBlocked = false;
  let navigationBlockMessage: string | undefined;

  // Sort rules by priority (lower = runs first), then by array order
  const sortedRules = [...rules]
    .filter(r => r.enabled !== false)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  for (const rule of sortedRules) {
    const conditionMet = evaluateNode(rule.condition, responses);

    if (conditionMet) {
      for (const action of rule.actions) {
        const effect: ActiveEffect = {
          ruleId: rule.id,
          ruleName: rule.name,
          action,
        };
        activeEffects.push(effect);

        // Index by target
        if (action.target_type === 'field') {
          if (!fieldEffects[action.target_id]) fieldEffects[action.target_id] = [];
          fieldEffects[action.target_id].push(effect);
        } else if (action.target_type === 'section') {
          if (!sectionEffects[action.target_id]) sectionEffects[action.target_id] = [];
          sectionEffects[action.target_id].push(effect);
        } else if (action.target_type === 'navigation' && action.effect === 'DISABLE_NAV') {
          navigationBlocked = true;
          navigationBlockMessage = action.config?.message || 'Please complete required fields';
        }
      }
    }
  }

  return {
    activeEffects,
    fieldEffects,
    sectionEffects,
    navigationBlocked,
    navigationBlockMessage,
  };
}

// ─── Helper functions for consuming results in FormRenderer ─────────────────

/**
 * Check if a field should be visible based on active rules.
 * Convention: if any HIDE effect is active → hidden.
 * If any SHOW effect is active AND no HIDE → shown.
 * If no effects → use default (visible).
 */
export function isFieldVisibleByRules(
  fieldId: string,
  result: RulesEvaluationResult
): boolean | null {
  const effects = result.fieldEffects[fieldId] || [];
  const hasHide = effects.some(e => e.action.effect === 'HIDE');
  const hasShow = effects.some(e => e.action.effect === 'SHOW');
  if (hasHide) return false;
  if (hasShow) return true;
  return null; // No rule applies — caller uses default
}

/**
 * Check if a field is forced required by rules.
 * Returns true if REQUIRE is active, false if UNREQUIRE is active, null if no rule.
 */
export function isFieldRequiredByRules(
  fieldId: string,
  result: RulesEvaluationResult
): boolean | null {
  const effects = result.fieldEffects[fieldId] || [];
  const hasRequire = effects.some(e => e.action.effect === 'REQUIRE');
  const hasUnrequire = effects.some(e => e.action.effect === 'UNREQUIRE');
  if (hasRequire) return true;
  if (hasUnrequire) return false;
  return null; // Use field.required default
}

/**
 * Check if a section should be visible based on active rules.
 */
export function isSectionVisibleByRules(
  sectionId: string,
  result: RulesEvaluationResult
): boolean | null {
  const effects = result.sectionEffects[sectionId] || [];
  const hasHide = effects.some(e => e.action.effect === 'HIDE');
  const hasShow = effects.some(e => e.action.effect === 'SHOW');
  if (hasHide) return false;
  if (hasShow) return true;
  return null;
}

/**
 * Get filtered options for a dropdown/lookup field if a FILTER_OPTIONS rule is active.
 * Returns the filtered FieldOption[] array, or null if no filter rule applies.
 */
export function getFilteredOptionsByRules(
  fieldId: string,
  result: RulesEvaluationResult,
  responses: Record<string, any>
): any[] | null {
  const effects = result.fieldEffects[fieldId] || [];
  const filterEffect = effects.find(e => e.action.effect === 'FILTER_OPTIONS');
  if (!filterEffect) return null;

  const config = filterEffect.action.config;
  if (!config) return null;

  // If filter_map is provided, use the parent field's value to look up filtered options
  if (config.filter_map && config.parent_field_id) {
    const parentValue = responses[config.parent_field_id];
    if (parentValue && config.filter_map[parentValue]) {
      return config.filter_map[parentValue];
    }
    return []; // Parent not selected yet — show nothing
  }

  return null;
}
```

#### Step 3: Integrate Rules Engine into FormRenderer

**File to modify**: [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx)

##### 3a. Add imports (at top of file, after existing imports)

```typescript
import {
  evaluateAllRules,
  isFieldVisibleByRules,
  isFieldRequiredByRules,
  isSectionVisibleByRules,
  getFilteredOptionsByRules,
  RulesEvaluationResult,
} from '../utils/rulesEngine';
```

##### 3b. Add rules evaluation state (inside the FormRenderer component, after line 256)

```typescript
// Evaluate centralized rules on every response change
const rulesResult: RulesEvaluationResult = useMemo(
    () => evaluateAllRules(blueprint.rules || [], responses),
    [blueprint.rules, responses]
);
```

You need to add `useMemo` to the React import on line 1:
```typescript
import React, { useState, useEffect, useMemo } from 'react';
```

##### 3c. Update section filtering (replace the current sections logic around line 327-334)

Replace:
```typescript
const sections = blueprint.ui || [];
```

With:
```typescript
const allSections = blueprint.ui || [];

// Filter sections: check BOTH old logic[] system AND new rules[] system
const sections = allSections.filter(section => {
    // New rules engine check
    const rulesVisible = isSectionVisibleByRules(section.id, rulesResult);
    if (rulesVisible === false) return false;
    if (rulesVisible === true) return true;

    // Fall back to old logic[] system (backward compat)
    // Import isSectionVisible from logic.ts (see GAP-7 for implementation)
    return isSectionVisible(section.id, blueprint.logic || [], responses);
});
```

##### 3d. Update field visibility check (in the section rendering, around line 436)

Replace:
```typescript
const visible = isFieldVisible(field.id, blueprint.logic || [], responses);
```

With:
```typescript
// New rules engine takes priority, then falls back to old logic system
const rulesVisible = isFieldVisibleByRules(field.id, rulesResult);
const visible = rulesVisible !== null
    ? rulesVisible
    : isFieldVisible(field.id, blueprint.logic || [], responses);
```

##### 3e. Update field required check (in validateField, around line 126)

Inside the `validateField` function, add a `rulesResult` parameter and check conditional required:

```typescript
function validateField(
    field: FormField,
    value: unknown,
    blueprint: FormBlueprint,
    rulesResult: RulesEvaluationResult  // ADD THIS PARAM
): string | undefined {
    if (field.formula) return undefined;

    // Check if rules engine overrides the required status
    const rulesRequired = isFieldRequiredByRules(field.id, rulesResult);
    const isRequired = rulesRequired !== null ? rulesRequired : field.required;

    // ... rest of validation logic uses `isRequired` instead of `field.required`
```

Update the call sites in `handleNext` (around line 345):
```typescript
const fieldError = validateField(field, responses[field.id], blueprint, rulesResult);
```

##### 3f. Pass filtered options to dropdown fields (in FieldRenderer)

Update the FieldRenderer to check for rules-based option filtering:

```typescript
function FieldRenderer({ field, value, onChange, error, lookupContext, blueprint, responses, rulesResult }: any) {
    // Check if this field's options should be filtered by a rule
    const filteredOptions = getFilteredOptionsByRules(field.id, rulesResult, responses);
    const effectiveField = filteredOptions
        ? { ...field, options: filteredOptions }
        : field;

    // Use effectiveField instead of field in the switch cases below
    switch (effectiveField.type) {
        case 'dropdown':
            return <DropdownField field={effectiveField} value={value} onChange={onChange} error={error} />;
        // ... other cases use effectiveField
```

Update the FieldRenderer JSX call (around line 444) to pass `rulesResult`:
```tsx
<FieldRenderer
    field={field}
    value={responses[field.id]}
    onChange={(val: any) => setResponses({ ...responses, [field.id]: val })}
    error={errors[field.id]}
    lookupContext={lookupContext}
    blueprint={blueprint}
    responses={responses}
    rulesResult={rulesResult}
/>
```

##### 3g. Handle DISABLE_NAV (in the footer navigation)

In the footer "Next" button area (around line 479):

```typescript
<TouchableOpacity
    onPress={handleNext}
    disabled={submitting || rulesResult.navigationBlocked}
    style={{
        // ... existing styles
        backgroundColor: rulesResult.navigationBlocked ? '#334155' : '#158754',
        opacity: rulesResult.navigationBlocked ? 0.6 : 1,
    }}
>
    {/* ... */}
</TouchableOpacity>

{/* Show block message */}
{rulesResult.navigationBlocked && (
    <Text style={{ color: '#f59e0b', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
        {rulesResult.navigationBlockMessage}
    </Text>
)}
```

#### Step 4: Add Required-Indicator in Field Labels

When a field becomes conditionally required by rules, show the red asterisk dynamically:

In the field rendering section (around line 441-443):

```typescript
const rulesRequired = isFieldRequiredByRules(field.id, rulesResult);
const showRequired = rulesRequired !== null ? rulesRequired : field.required;

<Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 5 }}>
    {field.label} {showRequired && <Text style={{ color: '#ef4444' }}>*</Text>}
</Text>
```

#### Step 5: Build the Studio Rules Builder UI

**File to modify**: [FormBuilder.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/studio/src/pages/FormBuilder.tsx)

The [rules builder prototype](file:///c:/Users/kings/Dev%20Projects/opla/docs/opla_rules_engine_builder.tsx) is a standalone React component. It needs to be adapted and integrated into the Studio FormBuilder.

##### 5a. Create a new component file

**New file to create**: `opla-frontend/apps/studio/src/components/RulesBuilder.tsx`

Port the prototype code from `opla_rules_engine_builder.tsx` into this component. Key changes needed:

1. **Remove the hardcoded `SURVEY_FIELDS`** — instead, accept the current form's fields as a prop:
   ```typescript
   interface RulesBuilderProps {
       /** All fields from all sections in the current form */
       fields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
       /** All sections in the current form */
       sections: Array<{ id: string; title: string }>;
       /** Current rules array from blueprint.rules */
       rules: FormRule[];
       /** Callback when rules change */
       onRulesChange: (rules: FormRule[]) => void;
   }
   ```

2. **Use the `FormRule` type** from `@opla/types` instead of the ad-hoc shape in the prototype

3. **Map field types to operators** using `RULE_OPERATORS_BY_FIELD_TYPE` from the types package

4. **Support multiple rules** — the prototype shows one rule; the real builder needs a list of rules, each with its own name, condition tree, and action list

5. **Add the "THEN" action section** — reuse the action types from `RuleActionEffect`

6. **Remove the simulator panel** — the Studio already has a FormSimulator page for testing

7. **Keep the AST JSON preview** — useful for debugging. Remove the JS compilation tab (the runtime handles evaluation, not compiled JS).

##### 5b. Add a "Rules" tab in FormBuilder

In the Studio FormBuilder, there should be a tab or panel switch alongside the existing "Fields" / "Logic" / "Settings" views. When the user clicks "Rules", show the `RulesBuilder` component.

Find the tab/view switching code in FormBuilder.tsx and add:

```tsx
{activeView === 'rules' && (
    <RulesBuilder
        fields={allFieldsFlattened}
        sections={sections.map(s => ({ id: s.id, title: s.title }))}
        rules={formRules}
        onRulesChange={(newRules) => setFormRules(newRules)}
    />
)}
```

##### 5c. Include rules in blueprint save/load

When saving the blueprint (search for where `blueprint_draft` is assembled), add the `rules` key:

```typescript
const blueprint = {
    meta: { ... },
    schema: [ ... ],
    ui: [ ... ],
    logic: [ ... ],    // existing
    rules: formRules,  // NEW
};
```

When loading the blueprint, parse `rules`:
```typescript
const formRules = loadedBlueprint.rules || [];
```

#### Step 6: Blueprint JSON Examples for the Rules Engine

##### Example 1: Conditional Required ("If qty=0, Reason for Non-Purchase is mandatory")

```json
{
  "id": "rule_non_purchase_reason",
  "name": "Require reason when no purchase",
  "description": "When sales quantity is 0, the reason for non-purchase field becomes mandatory",
  "enabled": true,
  "condition": {
    "id": "root",
    "type": "group",
    "combinator": "AND",
    "children": [
      {
        "id": "cond_qty_zero",
        "type": "rule",
        "field": "sku_quantity",
        "operator": "==",
        "value": "0"
      }
    ]
  },
  "actions": [
    {
      "effect": "SHOW",
      "target_id": "reason_for_non_purchase",
      "target_type": "field"
    },
    {
      "effect": "REQUIRE",
      "target_id": "reason_for_non_purchase",
      "target_type": "field"
    }
  ],
  "priority": 0
}
```

##### Example 2: Section Visibility ("Show Distributor Activities only for distributors")

```json
{
  "id": "rule_distributor_section",
  "name": "Show distributor section",
  "enabled": true,
  "condition": {
    "id": "root",
    "type": "group",
    "combinator": "AND",
    "children": [
      {
        "id": "cond_activity_type",
        "type": "rule",
        "field": "activity_type",
        "operator": "==",
        "value": "distributor"
      }
    ]
  },
  "actions": [
    {
      "effect": "SHOW",
      "target_id": "section_distributor_activities",
      "target_type": "section"
    }
  ]
}
```

##### Example 3: Cascading Dropdown ("Filter Market by Region")

```json
{
  "id": "rule_filter_market_by_region",
  "name": "Filter market options by region",
  "enabled": true,
  "condition": {
    "id": "root",
    "type": "group",
    "combinator": "AND",
    "children": [
      {
        "id": "cond_region_selected",
        "type": "rule",
        "field": "region",
        "operator": "not_empty",
        "value": ""
      }
    ]
  },
  "actions": [
    {
      "effect": "FILTER_OPTIONS",
      "target_id": "market",
      "target_type": "field",
      "config": {
        "parent_field_id": "region",
        "filter_map": {
          "greater_accra": [
            { "label": "Madina Market", "value": "madina" },
            { "label": "Makola Market", "value": "makola" }
          ],
          "ashanti": [
            { "label": "Kejetia Market", "value": "kejetia" },
            { "label": "Kumasi Central", "value": "kumasi_central" }
          ]
        }
      }
    }
  ]
}
```

##### Example 4: Complex Nested Logic ("Block nav if ad not completed AND in Greater Accra")

```json
{
  "id": "rule_ad_block",
  "name": "Block navigation until ad is watched",
  "enabled": true,
  "condition": {
    "id": "root",
    "type": "group",
    "combinator": "OR",
    "children": [
      {
        "id": "g1",
        "type": "group",
        "combinator": "AND",
        "children": [
          { "id": "r1", "type": "rule", "field": "sku_quantity", "operator": "==", "value": "0" },
          { "id": "r2", "type": "rule", "field": "region", "operator": "==", "value": "greater_accra" }
        ]
      },
      {
        "id": "g2",
        "type": "group",
        "combinator": "AND",
        "children": [
          { "id": "r3", "type": "rule", "field": "ad_stimulus_eval", "operator": "!=", "value": "completed" }
        ]
      }
    ]
  },
  "actions": [
    {
      "effect": "DISABLE_NAV",
      "target_id": "next_button",
      "target_type": "navigation",
      "config": { "message": "Please complete the advertisement sequence before proceeding." }
    }
  ]
}
```

#### Validation Plan for GAP-9

| # | Test | Steps | Expected |
|:--|:--|:--|:--|
| 1 | Type compilation | Run `tsc --noEmit` in packages/types | No type errors |
| 2 | Simple SHOW/HIDE | Create rule: IF region == "accra" THEN SHOW market field. Set region to "accra" | Market field appears |
| 3 | Conditional REQUIRE | Create rule: IF qty == 0 THEN REQUIRE reason field. Set qty=0, leave reason blank, press Next | Validation error on reason |
| 4 | Conditional REQUIRE inverse | Set qty=5. Leave reason blank, press Next | No validation error (reason is optional) |
| 5 | FILTER_OPTIONS | Create FILTER_OPTIONS rule with filter_map for region→market. Select different regions | Market dropdown shows only matching options |
| 6 | DISABLE_NAV | Create DISABLE_NAV rule for ad_stimulus != completed | Next button is disabled with message |
| 7 | Nested AND/OR | Create nested group: (qty==0 AND region=="accra") OR (ad_status != "completed") | Rule fires when either group is true |
| 8 | Section visibility | Create HIDE rule targeting a section. Trigger condition | Section disappears from navigation |
| 9 | Backward compat | Form with only `logic[]` rules (no `rules[]`) | Old logic system still works |
| 10 | Priority ordering | Two rules targeting same field with different priorities | Lower priority rule wins |

---

### GAP-1: Cascading / Filtered Dropdowns

**What the questionnaire needs**: "Market" dropdown that filters its options based on the selected "Region".

**What exists today**: Static `options[]` on dropdown fields. No cascading.

> [!NOTE]
> With GAP-9 implemented, cascading is a **configuration concern** — you create a `FILTER_OPTIONS` rule that maps parent values to child options. No special cascade code is needed on the DropdownField component itself. The `FieldRenderer` in FormRenderer applies the filtered options before passing them to the component.
>
> **If you want a simpler shortcut** (without requiring the full rules engine), you can also add `cascade_parent_field_id` and `cascade_options_map` properties directly on the `FormField` type and handle them in `DropdownField`. See the standalone approach below.

#### Standalone Approach (if implementing without GAP-9 first)

##### Step 1: Add type definitions

**File**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts)

Add these properties to the `FormField` interface (after line 186, before the closing `}`):

```typescript
  // Cascading / filtered dropdown support
  /** ID of another field whose value filters this field's options */
  cascade_parent_field_id?: string;
  /** 
   * Maps parent values to child options.
   * Key = parent option value, Value = array of options to show.
   * Example: { "accra_region": [{ label: "Madina", value: "madina" }] }
   */
  cascade_options_map?: Record<string, FieldOption[]>;
```

##### Step 2: Update DropdownField component

**File**: [DropdownField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/DropdownField.tsx)

Add `responses` prop and cascading logic:

```typescript
interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    responses?: Record<string, any>;
}

export function DropdownField({ field, value, onChange, error, responses = {} }: Props) {
    const [modalVisible, setModalVisible] = useState(false);

    // Resolve cascading options
    const options = useMemo(() => {
        if (field.cascade_parent_field_id && field.cascade_options_map) {
            const parentValue = responses[field.cascade_parent_field_id];
            if (parentValue && field.cascade_options_map[parentValue]) {
                return field.cascade_options_map[parentValue];
            }
            return []; // Parent not selected — show nothing
        }
        return field.options || [];
    }, [field.options, field.cascade_parent_field_id, field.cascade_options_map, responses]);

    // Clear value when parent changes and current value is invalid
    useEffect(() => {
        if (field.cascade_parent_field_id && value) {
            const stillValid = options.some(o => o.value === value);
            if (!stillValid) onChange('');
        }
    }, [options]);

    // ... rest of component unchanged but use `options` variable
```

##### Step 3: Thread `responses` through FormRenderer

**File**: [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx)

Pass `responses` to FieldRenderer and from there to DropdownField:

```typescript
// In FieldRenderer signature:
function FieldRenderer({ field, value, onChange, error, lookupContext, blueprint, responses }: any) {

// In dropdown case:
case 'dropdown':
    return <DropdownField field={field} value={value} onChange={onChange} error={error} responses={responses} />;

// In JSX rendering:
<FieldRenderer
    field={field}
    value={responses[field.id]}
    onChange={(val: any) => setResponses({ ...responses, [field.id]: val })}
    error={errors[field.id]}
    lookupContext={lookupContext}
    blueprint={blueprint}
    responses={responses}
/>
```

#### Validation

1. Create a blueprint with Region (options: greater_accra, ashanti) and Market (cascade_parent_field_id: "region", cascade_options_map with entries for each region)
2. Load form → Market dropdown shows empty ("Select an option...")
3. Select "Greater Accra" → Market dropdown shows Madina, Makola
4. Select "Madina" → change Region to "Ashanti" → Market resets (clears), shows Kejetia, Kumasi Central
5. Submit → submission data has both region and market values

---

### GAP-2: Phone Input Format Validation

**What the questionnaire needs**: "Validated for local number format."

**What exists**: `phone_input` type renders as plain text input — no keyboard type, no format validation.

#### Implementation

##### Step 1: Update TextInputField

**File**: [TextInputField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/TextInputField.tsx)

```typescript
export function TextInputField({ field, value, error, onChange }: TextInputFieldProps) {
    const isTextArea = field.type === 'textarea';
    const isPhone = field.type === 'phone_input';
    const isEmail = field.type === 'email_input';

    const keyboardType = isPhone ? 'phone-pad' as const
        : isEmail ? 'email-address' as const
        : 'default' as const;

    return (
        <View>
            <TextInput
                value={value || ''}
                onChangeText={onChange}
                placeholder={field.placeholder || field.label}
                placeholderTextColor="#64748b"
                multiline={isTextArea}
                keyboardType={keyboardType}
                autoCapitalize={isEmail ? 'none' : undefined}
                style={{
                    backgroundColor: '#1e293b',
                    borderColor: error ? '#ef4444' : '#334155',
                    borderWidth: 1.5, borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 10,
                    color: '#f1f5f9', fontSize: 14,
                    minHeight: isTextArea ? 80 : undefined,
                    textAlignVertical: isTextArea ? 'top' : 'center',
                }}
            />
        </View>
    );
}
```

##### Step 2: Add validation in FormRenderer

**File**: [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx)

In the `validateField` function (around line 160), after the required check, add:

```typescript
if (value && field.type === 'phone_input') {
    const phoneStr = String(value).replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,15}$/.test(phoneStr)) {
        return 'Please enter a valid phone number';
    }
}

if (value && field.type === 'email_input') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        return 'Please enter a valid email address';
    }
}

// Generic pattern support (field.pattern is already in the type)
if (value && field.pattern) {
    try {
        if (!new RegExp(field.pattern).test(String(value))) {
            return 'Input does not match the required format';
        }
    } catch { /* invalid regex — skip */ }
}
```

#### Validation

1. Add `phone_input` field → enter "abc" → validation error
2. Enter "+233241234567" → passes
3. Enter "123" (too short) → validation error

---

### GAP-3: Time Range Field (Open + Close Time)

**What the questionnaire needs**: "Operating Hours" as Open and Close time selection.

#### Implementation

##### Step 1: Add `'time_range'` to FieldType

**File**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts) — add `| 'time_range'` after `'time_picker'` in the FieldType union (line 38).

##### Step 2: Create TimeRangeField component

**New File**: `opla-frontend/apps/mobile/src/components/fields/TimeRangeField.tsx`

Renders two side-by-side time picker buttons ("Opens" and "Closes"). Use the same iOS Modal / Android inline pattern from [TimePickerField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/TimePickerField.tsx). The value shape is `{ open: "HH:MM", close: "HH:MM" }`.

Key implementation points:
- State: `showPicker: 'open' | 'close' | null`
- Two `TouchableOpacity` buttons side by side (flex row, flex: 1 each)
- Each shows a label ("Opens"/"Closes") and the selected time or "--:--"
- Tapping opens the native DateTimePicker in `mode="time"`
- On change, update the corresponding key in the value object
- Required validation checks both open and close are set

##### Step 3: Register in FormRenderer switch + Studio widget library

Add import, add `case 'time_range':` in FieldRenderer, add to `widgetLibrary`, `widgetCategoryMap` ('Time & Date'), and `widgetHints` in FormBuilder.tsx.

##### Step 4: Add validation

In `validateField`:
```typescript
if (field.required && field.type === 'time_range') {
    const rangeVal = value as { open?: string; close?: string } | undefined;
    if (!rangeVal?.open || !rangeVal?.close) {
        return 'Both open and close times are required';
    }
}
```

#### Validation

1. Add `time_range` field → tap "Opens" → select time → shows selected time
2. Tap "Closes" → select time → both times shown
3. Required validation rejects if either is missing
4. Submission data: `{ "operating_hours": { "open": "08:00", "close": "18:00" } }`

---

### GAP-4: Multi-Select Dropdown

**What the questionnaire needs**: "SKU Categories" as Multi-select with many options.

**What exists**: `checkbox_group` renders all options inline — not suitable for large lists.

#### Implementation

##### Step 1: Add `'multi_select_dropdown'` to FieldType

**File**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts) — add to FieldType union.

##### Step 2: Create MultiSelectDropdownField component

**New File**: `opla-frontend/apps/mobile/src/components/fields/MultiSelectDropdownField.tsx`

Similar structure to `DropdownField` but:
- Value is `string[]` not `string`
- Modal has a search bar (like LookupListField)
- Each option has a checkbox — tapping toggles it
- Selected items shown as chip count on the button: "3 selected: Beverage, Dairy..."
- "Done" button closes modal

Key implementation:
```typescript
interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    error?: string;
}
```

##### Step 3: Register in FormRenderer + Studio

Add import, switch case, widget library entry.

#### Validation

1. Add field with 10+ options → tapping opens searchable modal
2. Check 3 options → button shows "3 selected: A, B..."
3. Uncheck 1 → updates to "2 selected"
4. Submit → data is `["value1", "value2"]`
5. Required validation rejects empty array

---

### GAP-5: Decimal / Currency Input

**What the questionnaire needs**: "Amount Paid" as decimal input for financial tracking.

#### Implementation

**File**: [NumberInputField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/NumberInputField.tsx)

Change `keyboardType` from `"numeric"` to `"decimal-pad"` and add input sanitization:

```typescript
<TextInput
    value={value || ''}
    onChangeText={(text) => {
        // Allow decimal point, prevent multiple dots
        const cleaned = text.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        const sanitized = parts.length > 2
            ? parts[0] + '.' + parts.slice(1).join('')
            : cleaned;
        onChange(sanitized);
    }}
    keyboardType="decimal-pad"  // Changed from "numeric"
    // ... rest unchanged
/>
```

**File**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts) — add optional properties:

```typescript
  decimal_places?: number;  // e.g. 2 for currency
  input_prefix?: string;    // e.g. "GHS", "$"
  input_suffix?: string;    // e.g. "kg", "%"
```

#### Validation

1. Enter "123.45" → accepted
2. Enter "123.45.6" → sanitized to "123.456"
3. Enter "abc" → prevented (only digits and dot)

---

### GAP-6: Auto-Timestamp Field

**What the questionnaire needs**: "Payment Date" auto-populated at submission time.

#### Implementation

**File**: [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts) — add to FormField:

```typescript
  /** Dynamic auto-value: 'now()', 'today()', 'current_time()' */
  auto_value?: string;
  /** When to evaluate: 'on_load' or 'on_submit' */
  auto_value_timing?: 'on_load' | 'on_submit';
  /** Whether user can override the auto-populated value */
  auto_value_editable?: boolean;
```

**File**: [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx)

Add helper function:
```typescript
function resolveAutoValue(autoValue: string): any {
    switch (autoValue) {
        case 'now()': return new Date().toISOString();
        case 'today()': return new Date().toISOString().split('T')[0];
        case 'current_time()': return new Date().toTimeString().slice(0, 5);
        default: return undefined;
    }
}
```

Add `useEffect` to populate `on_load` fields on mount. In `submitForm`, resolve `on_submit` fields before sending. If `auto_value_editable === false`, render field as read-only (same display as formula fields).

#### Validation

1. `auto_value: "today()", auto_value_timing: "on_load"` → pre-filled with current date on render
2. `auto_value: "now()", auto_value_timing: "on_submit"` → empty during editing, filled at submit
3. `auto_value_editable: false` → field is read-only

---

### GAP-7: Section-Level Skip Logic (Runtime)

**What exists**: Types for `section_skip` / `section_visibility` are defined, but the [FormRenderer has a TODO](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx#L334) saying "Implement proper skip logic."

> [!NOTE]
> With GAP-9 (rules engine) implemented, section visibility is handled by `isSectionVisibleByRules()` automatically. This gap only needs implementation if you want the **old `logic[]` system** to also support section skip (for backward compatibility).

#### Implementation (for backward compat with old logic[])

**File**: [logic.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/utils/logic.ts)

Add after `isFieldVisible`:

```typescript
export function isSectionVisible(
    sectionId: string,
    logic: LogicRule[],
    responses: Record<string, any>
): boolean {
    const rules = logic.filter(
        r => (r.type === 'section_visibility' || r.type === 'section_skip') && r.target_id === sectionId
    );
    if (rules.length === 0) return true;

    let visible = true;
    let hasShowRule = false;
    let showRulePassed = false;

    for (const rule of rules) {
        const passed = evaluateLogicRule(rule, responses);
        if (rule.type === 'section_skip' && rule.action === 'skip' && passed) return false;
        if (rule.action === 'hide' && passed) return false;
        if (rule.action === 'show') {
            hasShowRule = true;
            if (passed) showRulePassed = true;
        }
    }

    if (hasShowRule && !showRulePassed) visible = false;
    return visible;
}
```

**File**: [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx)

Import and use as shown in GAP-9 Step 3c (sections filtering with fallback to old logic system).

---

### GAP-8: Auto-Calculation with Catalog MSRP Lookup

**What the questionnaire needs**: Qty × MSRP auto-calculated using catalog pricing.

**What exists**: Formula engine in FormRenderer. ProjectCatalogItem model with `default_price`. ObjectCollectionField with `catalog_source_type`.

#### Implementation

**File**: [ObjectCollectionField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/ObjectCollectionField.tsx)

When creating a row from a catalog item, inject `default_price`:

```typescript
const newRow = {
    sku_code: catalogItem.sku_code,
    label: catalogItem.label,
    unit_price: catalogItem.default_price ?? 0,
    quantity: 0,
    total_price: 0,
};
```

Add per-row formula evaluation for computed properties:

```typescript
const evaluateRowFormulas = (row: Record<string, any>, properties: ObjectPropertyDefinition[]) => {
    const updatedRow = { ...row };
    properties
        .filter(p => p.type === 'computed' && p.formula)
        .forEach(prop => {
            const expr = prop.formula!.replace(
                /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
                (token) => {
                    const val = Number(updatedRow[token] ?? 0);
                    return Number.isFinite(val) ? String(val) : '0';
                }
            );
            try {
                if (/^[0-9+\-*/().\s]+$/.test(expr)) {
                    const result = Function(`"use strict"; return (${expr});`)();
                    if (typeof result === 'number' && Number.isFinite(result)) {
                        updatedRow[prop.key] = result;
                    }
                }
            } catch { /* skip */ }
        });
    return updatedRow;
};
```

Call `evaluateRowFormulas` whenever a row property changes.

---

## Files Changed Summary

### New Files to Create

| File | Description | GAP |
|:---|:---|:---|
| `opla-frontend/apps/mobile/src/utils/rulesEngine.ts` | Core rules engine evaluator (recursive tree evaluation, effect indexing) | GAP-9 |
| `opla-frontend/apps/studio/src/components/RulesBuilder.tsx` | Studio UI for building rules (port from prototype) | GAP-9 |
| `opla-frontend/apps/mobile/src/components/fields/TimeRangeField.tsx` | Time range compound field | GAP-3 |
| `opla-frontend/apps/mobile/src/components/fields/MultiSelectDropdownField.tsx` | Multi-select dropdown field | GAP-4 |

### Existing Files to Modify

| File | Changes | GAPs |
|:---|:---|:---|
| [index.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/packages/types/src/index.ts) | Add rule tree types (RuleNode, RuleGroupNode, FormRule, etc.), add FieldType entries, add cascade/auto_value/decimal props | 9,1,3,4,5,6 |
| [FormRenderer.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/FormRenderer.tsx) | Integrate rulesEngine, pass rulesResult to FieldRenderer, handle DISABLE_NAV, conditional REQUIRE, section filtering, auto-values, phone/email validation | 9,1,2,6,7 |
| [DropdownField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/DropdownField.tsx) | Add `responses` prop, cascading filter logic | 1 |
| [TextInputField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/TextInputField.tsx) | Add keyboardType for phone/email | 2 |
| [NumberInputField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/NumberInputField.tsx) | Change to decimal-pad, sanitize input | 5 |
| [logic.ts](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/utils/logic.ts) | Add `isSectionVisible` function | 7 |
| [ObjectCollectionField.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/mobile/src/components/fields/ObjectCollectionField.tsx) | Catalog price injection, per-row formula evaluation | 8 |
| [FormBuilder.tsx](file:///c:/Users/kings/Dev%20Projects/opla/opla-frontend/apps/studio/src/pages/FormBuilder.tsx) | Add new field types to widget library, add "Rules" tab, include rules in blueprint save/load | 9,3,4 |

### Backend — No changes required

The backend stores blueprints as JSONB. The new `rules[]` array flows through automatically. No schema migration needed.

---

## Implementation Order (Recommended)

| Priority | GAP | Feature | Complexity | Why This Order |
|:---|:---|:---|:---|:---|
| **1** | **GAP-9** | **Rules Engine (types + runtime + FormRenderer integration)** | **High** | **Foundation — everything else builds on this** |
| 2 | GAP-7 | Section Skip Logic (backward compat for old logic[]) | Low | Quick function, needed for section navigation |
| 3 | GAP-1 | Cascading Dropdowns (standalone + rules-based) | Medium | Most-used questionnaire pattern |
| 4 | GAP-4 | Multi-Select Dropdown | Medium | Required for SKU Categories |
| 5 | GAP-5 | Decimal Input | Low | One-line keyboardType fix |
| 6 | GAP-2 | Phone Validation | Low | Quick regex addition |
| 7 | GAP-6 | Auto-Timestamp | Medium | Important for audit trails |
| 8 | GAP-3 | Time Range | Medium | Nice-to-have for store profiles |
| 9 | GAP-8 | Catalog MSRP Auto-Calc | High | Complex but powerful for sales |
| **10** | **GAP-9 (Studio)** | **Rules Builder UI (port prototype to Studio)** | **High** | **Can be done last — runtime works without it** |

> [!TIP]
> GAP-9 implementation can be split into two phases:
> - **Phase A** (Priority 1): Types + runtime evaluator + FormRenderer integration. Rules are authored as JSON in the blueprint. This unlocks all runtime features immediately.
> - **Phase B** (Priority 10): Studio Rules Builder UI. Port the prototype into a proper Studio component. This gives designers a visual interface but is not needed for the runtime to work.
