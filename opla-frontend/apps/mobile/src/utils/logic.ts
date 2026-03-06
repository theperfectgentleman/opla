import { LogicRule, LogicCondition } from '@opla/types';

export function evaluateCondition(condition: LogicCondition, fieldValue: any): boolean {
    if (fieldValue === undefined || fieldValue === null) return false;

    const valueString = String(fieldValue).toLowerCase();
    const targetString = String(condition.value).toLowerCase();

    switch (condition.operator) {
        case 'eq':
            return valueString === targetString;
        case 'neq':
            return valueString !== targetString;
        case 'contains':
            return valueString.includes(targetString);
        case 'gt':
            return Number(fieldValue) > Number(condition.value);
        case 'lt':
            return Number(fieldValue) < Number(condition.value);
        default:
            return false;
    }
}

export function evaluateLogicRule(rule: LogicRule, responses: Record<string, any>): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    const isOr = rule.logic_operator === 'OR';

    let result = !isOr; // AND starts true, OR starts false

    for (const condition of rule.conditions) {
        const val = responses[condition.field];
        const conditionResult = evaluateCondition(condition, val);

        if (isOr) {
            if (conditionResult) return true; // short circuit OR
        } else {
            if (!conditionResult) return false; // short circuit AND
        }
    }

    return isOr ? false : true; // if OR didn't short circuit, false. If AND didn't short circuit, true
}

export function isFieldVisible(fieldId: string, logic: LogicRule[], responses: Record<string, any>): boolean {
    // Find all field_visibility rules that target this field
    const rules = logic.filter(r => r.type === 'field_visibility' && r.target_id === fieldId);

    // If no rules target this field, it is visible by default
    if (rules.length === 0) return true;

    // We need to evaluate the rules.
    // Usually, a 'show' rule means the field is hidden by default and shown if true.
    // A 'hide' rule means the field is shown by default and hidden if true.

    let visible = true;
    let hasShowRule = false;
    let showRulePassed = false;

    for (const rule of rules) {
        const passed = evaluateLogicRule(rule, responses);

        if (rule.action === 'hide' && passed) {
            return false; // Hide rule matched, immediately hide
        }

        if (rule.action === 'show') {
            hasShowRule = true;
            if (passed) {
                showRulePassed = true;
            }
        }
    }

    // If there are 'show' rules but none passed, hide the field
    if (hasShowRule && !showRulePassed) {
        visible = false;
    }

    return visible;
}
