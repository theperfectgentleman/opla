import type {
  FormRule,
  RuleNode,
  RuleConditionNode,
  RuleGroupNode,
  RuleAction,
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

  // Handle between (expects value as "min,max" string)
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
        } else if (action.target_type === 'navigation' && action.effect === 'ENABLE_NAV') {
          navigationBlocked = false;
          navigationBlockMessage = undefined;
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
 */
function normalizeForComparison(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .toLowerCase()
    .replace(/[_\-\s]+/g, ' ')
    .trim();
}

export function getFilteredOptionsByRules(
  fieldId: string,
  result: RulesEvaluationResult,
  responses: Record<string, any>,
  options?: any[]
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

  // Dynamic column filter mapping
  if (config.parent_column && config.parent_field_id && options) {
    const parentValue = responses[config.parent_field_id];
    if (parentValue === undefined || parentValue === null || parentValue === '') {
      return []; // Parent not selected yet — show nothing
    }

    const parentCol = String(config.parent_column);
    const targetVal = normalizeForComparison(parentValue);

    return options.filter(opt => {
      // 1. Check row_data if it exists (JSON and CSV-with-headers)
      if (opt.row_data && typeof opt.row_data === 'object') {
        if (opt.row_data[parentCol] !== undefined) {
          return normalizeForComparison(opt.row_data[parentCol]) === targetVal;
        }
        const matchingKey = Object.keys(opt.row_data).find(k => k.toLowerCase() === parentCol.toLowerCase());
        if (matchingKey !== undefined) {
          return normalizeForComparison(opt.row_data[matchingKey]) === targetVal;
        }
      }

      // 2. Check row_cols if it exists (CSV)
      if (opt.row_cols && Array.isArray(opt.row_cols)) {
        const colIdx = parseInt(parentCol, 10);
        if (!isNaN(colIdx) && opt.row_cols[colIdx - 1] !== undefined) {
          return normalizeForComparison(opt.row_cols[colIdx - 1]) === targetVal;
        }
      }

      return false;
    });
  }

  return null;
}

/**
 * Get all SET_VALUE effects from the active rules result.
 * Returns an array of { fieldId, value } pairs to apply to the form responses.
 */
export function getSetValueEffects(
  result: RulesEvaluationResult
): Array<{ fieldId: string; value: any }> {
  const setValues: Array<{ fieldId: string; value: any }> = [];
  for (const effect of result.activeEffects) {
    if (
      effect.action.effect === 'SET_VALUE' &&
      effect.action.target_type === 'field' &&
      effect.action.config?.value !== undefined
    ) {
      setValues.push({
        fieldId: effect.action.target_id,
        value: effect.action.config.value,
      });
    }
  }
  return setValues;
}

/**
 * Get a custom validation error message from VALIDATE rules targeting a specific field.
 * Returns the error message string if a VALIDATE rule is active, or null if none.
 */
export function getValidationErrorByRules(
  fieldId: string,
  result: RulesEvaluationResult
): string | null {
  const effects = result.fieldEffects[fieldId] || [];
  const validateEffect = effects.find(e => e.action.effect === 'VALIDATE');
  if (validateEffect) {
    return validateEffect.action.config?.error_message || 'Validation failed';
  }
  return null;
}

/**
 * Get the target section ID from an active JUMP_TO_SECTION rule effect.
 * Returns the section ID to jump to, or null if no jump rule is active.
 * This should only be called during handleNext() — not reactively.
 */
export function getJumpToSectionTarget(
  result: RulesEvaluationResult
): string | null {
  for (const effect of result.activeEffects) {
    if (
      effect.action.effect === 'JUMP_TO_SECTION' &&
      effect.action.target_type === 'section' &&
      effect.action.target_id
    ) {
      return effect.action.target_id;
    }
  }
  return null;
}
