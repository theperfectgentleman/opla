import React, { useState, useMemo } from 'react';
import type {
  FormRule,
  RuleNode,
  RuleConditionNode,
  RuleGroupNode,
  RuleAction,
  RuleActionEffect,
  RuleOperator,
} from '@opla/types';
import { RULE_OPERATORS_BY_FIELD_TYPE } from '@opla/types';

interface RulesBuilderProps {
  fields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
  sections: Array<{ id: string; title: string }>;
  rules: FormRule[];
  onRulesChange: (rules: FormRule[]) => void;
}

const ACTION_EFFECTS: Array<{ value: RuleActionEffect; label: string }> = [
  { value: 'SHOW', label: 'Show Field/Section' },
  { value: 'HIDE', label: 'Hide Field/Section' },
  { value: 'REQUIRE', label: 'Make Field Required' },
  { value: 'UNREQUIRE', label: 'Make Field Optional' },
  { value: 'DISABLE_NAV', label: 'Disable Navigation' },
  { value: 'FILTER_OPTIONS', label: 'Filter Dropdown Options' },
  { value: 'SET_VALUE', label: 'Set Field Value' },
  { value: 'VALIDATE', label: 'Show Custom Validation Error' },
  { value: 'JUMP_TO_SECTION', label: 'Jump to Section' },
];

export function RulesBuilder({ fields, sections, rules = [], onRulesChange }: RulesBuilderProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(rules[0]?.id || null);

  const activeRule = useMemo(() => {
    return rules.find(r => r.id === selectedRuleId) || null;
  }, [rules, selectedRuleId]);

  const createNewRule = () => {
    const newRule: FormRule = {
      id: 'rule_' + Date.now(),
      name: 'New Rule ' + (rules.length + 1),
      enabled: true,
      condition: {
        id: 'root',
        type: 'group',
        combinator: 'AND',
        children: [],
      },
      actions: [],
    };
    const updated = [...rules, newRule];
    onRulesChange(updated);
    setSelectedRuleId(newRule.id);
  };

  const deleteRule = (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    onRulesChange(updated);
    if (selectedRuleId === ruleId) {
      setSelectedRuleId(updated[0]?.id || null);
    }
  };

  const updateRuleMeta = (ruleId: string, updates: Partial<FormRule>) => {
    const updated = rules.map(r => (r.id === ruleId ? { ...r, ...updates } : r));
    onRulesChange(updated);
  };

  const updateConditionTree = (ruleId: string, nextTree: RuleGroupNode) => {
    const updated = rules.map(r => (r.id === ruleId ? { ...r, condition: nextTree } : r));
    onRulesChange(updated);
  };

  const updateActionsList = (ruleId: string, nextActions: RuleAction[]) => {
    const updated = rules.map(r => (r.id === ruleId ? { ...r, actions: nextActions } : r));
    onRulesChange(updated);
  };

  return (
    <div className="flex flex-row h-full min-h-[600px] border border-slate-800 rounded-xl bg-slate-950 text-slate-100 overflow-hidden">
      {/* Left Sidebar: Rules List */}
      <div className="w-1/4 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Form Rules</h3>
            <button
              onClick={createNewRule}
              className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[500px]">
            {rules.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">No rules defined.</p>
            ) : (
              rules.map(rule => (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${
                    selectedRuleId === rule.id
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                      : 'border border-transparent hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        updateRuleMeta(rule.id, { enabled: !rule.enabled });
                      }}
                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-pointer ${
                        rule.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                      title={rule.enabled ? 'Enabled' : 'Disabled'}
                    />
                    <span className="text-xs font-medium truncate">{rule.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRule(rule.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 rounded transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Content: Builder Workspace */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto p-6 space-y-6">
        {activeRule ? (
          <>
            {/* Rule Header Metadata */}
            <div className="border-b border-slate-800/80 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={activeRule.name}
                  onChange={(e) => updateRuleMeta(activeRule.id, { name: e.target.value })}
                  className="bg-transparent text-lg font-bold border-b border-transparent hover:border-slate-800 focus:border-indigo-500 focus:outline-none py-0.5 px-1 w-2/3"
                  placeholder="Enter rule name..."
                />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    Priority:
                    <input
                      type="number"
                      value={activeRule.priority ?? 0}
                      onChange={(e) => updateRuleMeta(activeRule.id, { priority: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-xs text-slate-200 outline-none w-16 text-right"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeRule.enabled}
                      onChange={(e) => updateRuleMeta(activeRule.id, { enabled: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                    />
                    Rule Active
                  </label>
                </div>
              </div>
              <input
                type="text"
                value={activeRule.description || ''}
                onChange={(e) => updateRuleMeta(activeRule.id, { description: e.target.value })}
                className="bg-transparent text-xs border-b border-transparent hover:border-slate-800 focus:border-indigo-500 focus:outline-none py-0.5 px-1 w-full text-slate-400"
                placeholder="Add rule description..."
              />
            </div>

            {/* Condition Tree (IF) */}
            <div className="border border-slate-800/60 rounded-xl p-5 bg-slate-900/10 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/40">
                <span className="text-[10px] uppercase font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">IF</span>
                <span className="text-xs font-bold text-slate-300">Conditions Block</span>
              </div>
              <ConditionTreeEditor
                rootGroup={activeRule.condition}
                onChange={(nextTree) => updateConditionTree(activeRule.id, nextTree)}
                fields={fields}
              />
            </div>

            {/* Actions List (THEN) */}
            <div className="border border-slate-800/60 rounded-xl p-5 bg-slate-900/10 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/40">
                <span className="text-[10px] uppercase font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">THEN</span>
                <span className="text-xs font-bold text-slate-300">Action Consequences</span>
              </div>
              <ActionsListEditor
                actions={activeRule.actions || []}
                onChange={(nextActions) => updateActionsList(activeRule.id, nextActions)}
                fields={fields}
                sections={sections}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic py-12">
            <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Select a rule or create a new one to begin editing.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recursive Condition Tree Editor ────────────────────────────────────────

interface ConditionTreeProps {
  rootGroup: RuleGroupNode;
  onChange: (tree: RuleGroupNode) => void;
  fields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
}

function ConditionTreeEditor({ rootGroup, onChange, fields }: ConditionTreeProps) {
  // Helper to edit nodes
  const updateNode = (node: RuleNode, targetId: string, updateFn: (n: RuleNode) => Partial<RuleNode>): RuleNode => {
    if (node.id === targetId) {
      return { ...node, ...updateFn(node) } as RuleNode;
    }
    if (node.type === 'group' && node.children) {
      return {
        ...node,
        children: node.children.map(child => updateNode(child, targetId, updateFn)),
      };
    }
    return node;
  };

  // Helper to remove nodes
  const removeNode = (node: RuleNode, targetId: string): RuleNode => {
    if (node.type === 'group' && node.children) {
      const filtered = node.children.filter(child => child.id !== targetId);
      return {
        ...node,
        children: filtered.map(child => removeNode(child, targetId)),
      } as RuleGroupNode;
    }
    return node;
  };

  const handleAddRule = (groupId: string) => {
    const defaultField = fields[0] || { id: '', type: 'string' };
    const validOperators = RULE_OPERATORS_BY_FIELD_TYPE[defaultField.type] || ['=='];
    const newRule: RuleConditionNode = {
      id: 'rule_' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'rule',
      field: defaultField.id,
      operator: validOperators[0],
      value: '',
    };
    const nextTree = updateNode(rootGroup, groupId, (node) => {
      const gp = node as RuleGroupNode;
      return { children: [...(gp.children || []), newRule] };
    });
    onChange(nextTree as RuleGroupNode);
  };

  const handleAddGroup = (groupId: string) => {
    const defaultField = fields[0] || { id: '', type: 'string' };
    const validOperators = RULE_OPERATORS_BY_FIELD_TYPE[defaultField.type] || ['=='];
    const newGroup: RuleGroupNode = {
      id: 'group_' + Date.now() + Math.random().toString(36).substr(2, 4),
      type: 'group',
      combinator: 'AND',
      children: [
        {
          id: 'rule_' + Date.now() + Math.random().toString(36).substr(2, 4),
          type: 'rule',
          field: defaultField.id,
          operator: validOperators[0],
          value: '',
        },
      ],
    };
    const nextTree = updateNode(rootGroup, groupId, (node) => {
      const gp = node as RuleGroupNode;
      return { children: [...(gp.children || []), newGroup] };
    });
    onChange(nextTree as RuleGroupNode);
  };

  const handleToggleCombinator = (groupId: string) => {
    const nextTree = updateNode(rootGroup, groupId, (node) => {
      const gp = node as RuleGroupNode;
      return { combinator: gp.combinator === 'AND' ? 'OR' : 'AND' };
    });
    onChange(nextTree as RuleGroupNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'root') return;
    const nextTree = removeNode(rootGroup, nodeId);
    onChange(nextTree as RuleGroupNode);
  };

  const handleUpdateRule = (ruleId: string, updatedProps: Partial<RuleConditionNode>) => {
    const nextTree = updateNode(rootGroup, ruleId, (node) => {
      const rl = node as RuleConditionNode;
      const merged = { ...rl, ...updatedProps };
      if (updatedProps.field) {
        const fieldMeta = fields.find(f => f.id === updatedProps.field);
        const validOperators = fieldMeta ? (RULE_OPERATORS_BY_FIELD_TYPE[fieldMeta.type] || ['==']) : ['=='];
        merged.operator = validOperators[0] as RuleOperator;
        merged.value = '';
      }
      return merged;
    });
    onChange(nextTree as RuleGroupNode);
  };

  return (
    <div className="bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
      <RecursiveGroupRenderer
        groupNode={rootGroup}
        onAddRule={handleAddRule}
        onAddGroup={handleAddGroup}
        onToggleCombinator={handleToggleCombinator}
        onDeleteNode={handleDeleteNode}
        onUpdateRule={handleUpdateRule}
        fields={fields}
        depth={0}
      />
    </div>
  );
}

// ─── Recursive Group Renderer ────────────────────────────────────────────────

interface RecursiveGroupProps {
  groupNode: RuleGroupNode;
  onAddRule: (id: string) => void;
  onAddGroup: (id: string) => void;
  onToggleCombinator: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onUpdateRule: (id: string, updates: Partial<RuleConditionNode>) => void;
  fields: ConditionTreeProps['fields'];
  depth: number;
}

function RecursiveGroupRenderer({
  groupNode,
  onAddRule,
  onAddGroup,
  onToggleCombinator,
  onDeleteNode,
  onUpdateRule,
  fields,
  depth,
}: RecursiveGroupProps) {
  const children = groupNode.children || [];

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      depth === 0 ? 'bg-slate-900/30 border-slate-850' : 'bg-slate-950/40 border-slate-900'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Group depth {depth}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAddRule(groupNode.id)}
            className="text-[10px] font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded px-2.5 py-1 text-slate-300 hover:text-white"
          >
            + Add Rule
          </button>
          <button
            onClick={() => onAddGroup(groupNode.id)}
            className="text-[10px] font-semibold bg-indigo-950/20 hover:bg-indigo-950/40 border border-indigo-900/30 rounded px-2.5 py-1 text-indigo-400"
          >
            + Add Group
          </button>
          {groupNode.id !== 'root' && (
            <button
              onClick={() => onDeleteNode(groupNode.id)}
              className="p-1 text-slate-500 hover:text-red-400 rounded transition"
              title="Delete group"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {children.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2 text-center">No validation constraints in this group.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {children.map((child, index) => {
            const isLast = index === children.length - 1;
            return (
              <React.Fragment key={child.id}>
                {child.type === 'rule' ? (
                  <ConditionRuleRow
                    rule={child}
                    onDelete={onDeleteNode}
                    onUpdate={onUpdateRule}
                    fields={fields}
                  />
                ) : (
                  <RecursiveGroupRenderer
                    groupNode={child}
                    onAddRule={onAddRule}
                    onAddGroup={onAddGroup}
                    onToggleCombinator={onToggleCombinator}
                    onDeleteNode={onDeleteNode}
                    onUpdateRule={onUpdateRule}
                    fields={fields}
                    depth={depth + 1}
                  />
                )}
                {!isLast && (
                  <div className="relative flex items-center justify-center my-1">
                    <div className="absolute left-0 right-0 h-px bg-slate-800/80"></div>
                    <button
                      onClick={() => onToggleCombinator(groupNode.id)}
                      className={`relative z-10 px-3 py-0.5 rounded-full text-[9px] font-extrabold border transition-all uppercase tracking-widest ${
                        groupNode.combinator === 'AND'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40'
                          : 'bg-indigo-950 text-indigo-400 border-indigo-800/40'
                      }`}
                    >
                      {groupNode.combinator}
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Rule Leaf Condition Row ──────────────────────────────────────────────────

interface ConditionRuleRowProps {
  rule: RuleConditionNode;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<RuleConditionNode>) => void;
  fields: RecursiveGroupProps['fields'];
}

function ConditionRuleRow({ rule, onDelete, onUpdate, fields }: ConditionRuleRowProps) {
  const activeField = fields.find(f => f.id === rule.field) || fields[0];
  const operators = activeField ? (RULE_OPERATORS_BY_FIELD_TYPE[activeField.type] || ['==']) : ['=='];

  return (
    <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-900 relative">
      <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Field</label>
        <select
          value={rule.field}
          onChange={(e) => onUpdate(rule.id, { field: e.target.value })}
          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
        >
          {fields.map(f => (
            <option key={f.id} value={f.id}>{f.label || f.id}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Operator</label>
        <select
          value={rule.operator}
          onChange={(e) => onUpdate(rule.id, { operator: e.target.value as RuleOperator })}
          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
        >
          {operators.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            {rule.operator === 'between' ? 'Range bounds (min,max)' : 'Value'}
          </label>
          {activeField?.options?.length ? (
            <select
              value={rule.value}
              onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
            >
              <option value="">Select option...</option>
              {activeField.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={rule.value || ''}
              onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none w-full"
              placeholder={rule.operator === 'between' ? 'e.g. 10,20' : 'e.g. 5'}
            />
          )}
        </div>
      )}

      <button
        onClick={() => onDelete(rule.id)}
        className="p-1.5 text-slate-600 hover:text-red-400 mt-4 rounded transition"
        title="Delete rule condition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// ─── Actions List Editor ──────────────────────────────────────────────────────

interface ActionsListProps {
  actions: RuleAction[];
  onChange: (actions: RuleAction[]) => void;
  fields: RulesBuilderProps['fields'];
  sections: RulesBuilderProps['sections'];
}

function ActionsListEditor({ actions = [], onChange, fields, sections }: ActionsListProps) {
  const addAction = () => {
    const newAction: RuleAction = {
      effect: 'SHOW',
      target_id: fields[0]?.id || '',
      target_type: 'field',
    };
    onChange([...actions, newAction]);
  };

  const deleteAction = (idx: number) => {
    onChange(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, updates: Partial<RuleAction>) => {
    const next = actions.map((act, i) => {
      if (i !== idx) return act;
      const merged = { ...act, ...updates };
      // Align target type if effect targets navigation specifically
      if (updates.effect === 'DISABLE_NAV' || updates.effect === 'ENABLE_NAV') {
        merged.target_type = 'navigation';
        merged.target_id = 'next_button';
        if (!merged.config) merged.config = { message: '' };
      }
      // JUMP_TO_SECTION always targets a section
      if (updates.effect === 'JUMP_TO_SECTION') {
        merged.target_type = 'section';
      }
      return merged;
    });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {actions.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2 text-center">No actions configured for this rule.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => {
            const isNav = action.effect === 'DISABLE_NAV' || action.effect === 'ENABLE_NAV';
            const isFilter = action.effect === 'FILTER_OPTIONS';
            const isValue = action.effect === 'SET_VALUE';
            const isValidate = action.effect === 'VALIDATE';

            return (
              <div key={idx} className="flex flex-wrap items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-900">
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Effect</label>
                  <select
                    value={action.effect}
                    onChange={(e) => updateAction(idx, { effect: e.target.value as RuleActionEffect })}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
                  >
                    {ACTION_EFFECTS.map(eff => (
                      <option key={eff.value} value={eff.value}>{eff.label}</option>
                    ))}
                  </select>
                </div>

                {!isNav && (
                  <div className="flex flex-col gap-1 w-36">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Target Type</label>
                    <select
                      value={action.target_type}
                      onChange={(e) => updateAction(idx, { target_type: e.target.value as 'field' | 'section', target_id: '' })}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
                    >
                      <option value="field">Field</option>
                      {action.effect !== 'REQUIRE' && action.effect !== 'UNREQUIRE' && action.effect !== 'FILTER_OPTIONS' && action.effect !== 'SET_VALUE' && action.effect !== 'VALIDATE' && (
                        <option value="section">Section</option>
                      )}
                    </select>
                  </div>
                )}

                {!isNav && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Target Node</label>
                    {action.target_type === 'section' ? (
                      <select
                        value={action.target_id}
                        onChange={(e) => updateAction(idx, { target_id: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
                      >
                        <option value="">Select section...</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.title || s.id}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={action.target_id}
                        onChange={(e) => updateAction(idx, { target_id: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
                      >
                        <option value="">Select field...</option>
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>{f.label || f.id}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Extra configurations: message for DISABLE_NAV or VALIDATE */}
                {(isNav || isValidate) && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Message</label>
                    <input
                      type="text"
                      value={action.config?.message || action.config?.error_message || ''}
                      onChange={(e) => updateAction(idx, {
                        config: isValidate ? { error_message: e.target.value } : { message: e.target.value }
                      })}
                      className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none w-full"
                      placeholder="e.g. Please watch the ad stimulus first"
                    />
                  </div>
                )}

                {/* Extra configurations: value mapping for FILTER_OPTIONS */}
                {isFilter && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Parent Field Dependency</label>
                    <select
                      value={action.config?.parent_field_id || ''}
                      onChange={(e) => updateAction(idx, {
                        config: { ...action.config, parent_field_id: e.target.value, filter_map: action.config?.filter_map || {} }
                      })}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
                    >
                      <option value="">Select parent field...</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.label || f.id}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Extra configurations: set specific value for SET_VALUE */}
                {isValue && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Set Value To</label>
                    <input
                      type="text"
                      value={action.config?.value || ''}
                      onChange={(e) => updateAction(idx, {
                        config: { value: e.target.value }
                      })}
                      className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none w-full"
                      placeholder="e.g. 100"
                    />
                  </div>
                )}

                <button
                  onClick={() => deleteAction(idx)}
                  className="p-1.5 text-slate-600 hover:text-red-400 mt-4 rounded transition"
                  title="Remove action"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={addAction}
        className="text-xs font-bold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 px-3.5 py-2 rounded-lg border border-indigo-500/20 transition"
      >
        + Add Action Consequence
      </button>
    </div>
  );
}
