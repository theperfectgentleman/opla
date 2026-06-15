import React, { useState, useMemo, useRef, useCallback } from 'react';
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

interface ParsedCustomData {
  type: 'csv' | 'json' | 'empty';
  headers: string[];
  rows: Array<Record<string, any>>;
  error?: string;
}

function parseCustomLookupData(dataString: string, separator = ','): ParsedCustomData {
  const trimmed = (dataString || '').trim();
  if (!trimmed) {
    return { type: 'empty', headers: [], rows: [] };
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const keysSet = new Set<string>();
        parsed.forEach(item => {
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(k => keysSet.add(k));
          }
        });
        const headers = Array.from(keysSet);
        return {
          type: 'json',
          headers,
          rows: parsed.filter(item => item && typeof item === 'object')
        };
      }
    } catch (err: any) {
      return { type: 'json', headers: [], rows: [], error: `JSON Parse Error: ${err.message}` };
    }
  }

  try {
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) {
      return { type: 'csv', headers: [], rows: [] };
    }

    const firstLineCols = lines[0].split(separator).map(c => c.trim());
    const headers = firstLineCols.length > 0 ? firstLineCols : ['Column 1'];
    const dataLines = lines.slice(1);

    const rows = dataLines.map((line) => {
      const cols = line.split(separator).map(c => c.trim());
      const rowObj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = cols[colIdx] || '';
      });
      return rowObj;
    });

    return { type: 'csv', headers, rows };
  } catch (err: any) {
    return { type: 'csv', headers: [], rows: [], error: `CSV Parse Error: ${err.message}` };
  }
}

interface RulesBuilderProps {
  fields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
  sections: Array<{ id: string; title: string }>;
  rules: FormRule[];
  onRulesChange: (rules: FormRule[]) => void;
  triggerId?: string;
  triggerType?: 'field' | 'section';
  timing?: 'pre' | 'post';
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

export function RulesBuilder({
  fields,
  sections,
  rules = [],
  onRulesChange,
  triggerId,
  triggerType,
  timing,
}: RulesBuilderProps) {
  const filteredRules = useMemo(() => {
    if (!triggerId || !timing) return rules;
    return rules.filter(r => r.trigger_id === triggerId && r.timing === timing);
  }, [rules, triggerId, timing]);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Synchronize selectedRuleId with filteredRules changes
  React.useEffect(() => {
    if (filteredRules.length > 0 && !filteredRules.some(r => r.id === selectedRuleId)) {
      setSelectedRuleId(filteredRules[0].id);
    } else if (filteredRules.length === 0) {
      setSelectedRuleId(null);
    }
  }, [filteredRules, selectedRuleId]);

  const activeRule = useMemo(() => {
    return filteredRules.find(r => r.id === selectedRuleId) || null;
  }, [filteredRules, selectedRuleId]);

  // Auto-assign priority based on list position within the subset
  const applyPriority = useCallback((ruleList: FormRule[]): FormRule[] => {
    return ruleList.map((r, idx) => ({ ...r, priority: idx }));
  }, []);

  const createNewRule = () => {
    const newRule: FormRule = {
      id: 'rule_' + Date.now(),
      name: 'New Rule ' + (filteredRules.length + 1),
      enabled: true,
      priority: filteredRules.length,
      condition: {
        id: 'root',
        type: 'group',
        combinator: 'AND',
        children: [],
      },
      actions: [],
      trigger_id: triggerId,
      trigger_type: triggerType,
      timing: timing,
    };
    
    const updatedFiltered = applyPriority([...filteredRules, newRule]);
    
    // Merge back into the global list
    const nonFiltered = rules.filter(r => !(r.trigger_id === triggerId && r.timing === timing));
    onRulesChange([...nonFiltered, ...updatedFiltered]);
    setSelectedRuleId(newRule.id);
  };

  const deleteRule = (ruleId: string) => {
    const updatedGlobal = rules.filter(r => r.id !== ruleId);
    const updatedFiltered = filteredRules.filter(r => r.id !== ruleId);
    
    // Re-apply priorities to the remaining filtered subset
    const withPriorities = applyPriority(updatedFiltered);
    const nonFiltered = updatedGlobal.filter(r => !(r.trigger_id === triggerId && r.timing === timing));
    
    onRulesChange([...nonFiltered, ...withPriorities]);
    if (selectedRuleId === ruleId) {
      setSelectedRuleId(withPriorities[0]?.id || null);
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

  // ─── Drag-to-reorder handlers ───
  const handleDragStart = (e: React.DragEvent, ruleId: string) => {
    setDraggedRuleId(ruleId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ruleId);
  };

  const handleDragEnd = () => {
    setDraggedRuleId(null);
    setDragOverIdx(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (idx: number) => {
    dragCounter.current++;
    setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragOverIdx(null);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (!draggedRuleId) return;
    const srcIdx = filteredRules.findIndex(r => r.id === draggedRuleId);
    if (srcIdx === -1 || srcIdx === targetIdx) {
      handleDragEnd();
      return;
    }
    const reorderedFiltered = [...filteredRules];
    const [moved] = reorderedFiltered.splice(srcIdx, 1);
    reorderedFiltered.splice(targetIdx, 0, moved);
    
    // Assign local priorities to the reordered subset
    const updatedFiltered = applyPriority(reorderedFiltered);
    
    // Merge back into the global list preserving slots of non-matching rules
    let filteredIdx = 0;
    const nextRules = rules.map(r => {
      if (r.trigger_id === triggerId && r.timing === timing) {
        return updatedFiltered[filteredIdx++];
      }
      return r;
    });
    
    onRulesChange(nextRules);
    handleDragEnd();
  };

  return (
    <div className="flex flex-row h-full min-h-[600px] border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] overflow-hidden">
      {/* Left Sidebar: Rules List */}
      <div className="w-1/4 min-w-[180px] border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/40 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Form Rules</h3>
            <button
              onClick={createNewRule}
              className="text-[11px] font-semibold bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/85 text-white px-2 py-1 rounded transition"
            >
              + Add
            </button>
          </div>
          <p className="text-[10px] text-[hsl(var(--text-tertiary))]/70 mb-3">Drag to reorder priority</p>
          <div className="space-y-1 overflow-y-auto max-h-[500px]">
            {filteredRules.length === 0 ? (
              <p className="text-xs text-[hsl(var(--text-tertiary))] italic p-2">No rules defined.</p>
            ) : (
              filteredRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, rule.id)}
                  onDragEnd={handleDragEnd}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                    draggedRuleId === rule.id
                      ? 'opacity-40 scale-95'
                      : dragOverIdx === idx && draggedRuleId !== rule.id
                        ? 'border-t-2 border-t-[hsl(var(--primary))]'
                        : ''
                  } ${
                    selectedRuleId === rule.id
                      ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30 text-[hsl(var(--text-primary))]'
                      : 'border border-transparent hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {/* Drag handle */}
                    <svg className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]/50 shrink-0 cursor-grab active:cursor-grabbing" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="5" cy="3" r="1.2" /><circle cx="11" cy="3" r="1.2" />
                      <circle cx="5" cy="8" r="1.2" /><circle cx="11" cy="8" r="1.2" />
                      <circle cx="5" cy="13" r="1.2" /><circle cx="11" cy="13" r="1.2" />
                    </svg>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        updateRuleMeta(rule.id, { enabled: !rule.enabled });
                      }}
                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-pointer ${
                        rule.enabled ? 'bg-emerald-500' : 'bg-[hsl(var(--text-tertiary))]/40'
                      }`}
                      title={rule.enabled ? 'Enabled' : 'Disabled'}
                    />
                    <span className="text-xs font-medium truncate">{rule.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-[hsl(var(--text-tertiary))]/60 bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded" title={`Priority: ${idx} (top = first)`}>#{idx + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRule(rule.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Content: Builder Workspace */}
      <div className="flex-1 flex flex-col bg-[hsl(var(--surface))] overflow-y-auto p-6 space-y-6">
        {activeRule ? (
          <>
            {/* Rule Header Metadata */}
            <div className="border-b border-[hsl(var(--border))]/60 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={activeRule.name}
                  onChange={(e) => updateRuleMeta(activeRule.id, { name: e.target.value })}
                  className="bg-transparent text-lg font-bold border-b border-transparent hover:border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:outline-none py-0.5 px-1 w-2/3 text-[hsl(var(--text-primary))]"
                  placeholder="Enter rule name..."
                />
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))]/40 px-2 py-1 rounded" title="Priority is determined by list order (drag to reorder)">
                    Priority #{(rules.findIndex(r => r.id === activeRule.id) + 1) || '?'}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--text-secondary))] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeRule.enabled}
                      onChange={(e) => updateRuleMeta(activeRule.id, { enabled: e.target.checked })}
                      className="rounded border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                    />
                    Active
                  </label>
                </div>
              </div>
              <input
                type="text"
                value={activeRule.description || ''}
                onChange={(e) => updateRuleMeta(activeRule.id, { description: e.target.value })}
                className="bg-transparent text-xs border-b border-transparent hover:border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:outline-none py-0.5 px-1 w-full text-[hsl(var(--text-secondary))]"
                placeholder="Add rule description..."
              />
            </div>

            {/* Condition Tree (IF) */}
            <div className="border border-[hsl(var(--border))]/50 rounded-xl p-5 bg-[hsl(var(--surface-elevated))]/20 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--border))]/30">
                <span className="text-[10px] uppercase font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">IF</span>
                <span className="text-xs font-bold text-[hsl(var(--text-primary))]">Conditions Block</span>
              </div>
              <ConditionTreeEditor
                rootGroup={activeRule.condition}
                onChange={(nextTree) => updateConditionTree(activeRule.id, nextTree)}
                fields={fields}
              />
            </div>

            {/* Actions List (THEN) */}
            <div className="border border-[hsl(var(--border))]/50 rounded-xl p-5 bg-[hsl(var(--surface-elevated))]/20 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--border))]/30">
                <span className="text-[10px] uppercase font-bold bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] px-2 py-0.5 rounded">THEN</span>
                <span className="text-xs font-bold text-[hsl(var(--text-primary))]">Action Consequences</span>
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
          <div className="flex-1 flex flex-col items-center justify-center text-[hsl(var(--text-tertiary))] italic py-12">
            <svg className="w-12 h-12 text-[hsl(var(--text-tertiary))]/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div className="bg-[hsl(var(--surface-elevated))]/15 p-2.5 rounded-lg border border-[hsl(var(--border))]/30">
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
      depth === 0 ? 'bg-[hsl(var(--surface-elevated))]/20 border-[hsl(var(--border))]/40' : 'bg-[hsl(var(--surface))]/60 border-[hsl(var(--border))]/30'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-widest">
          Group depth {depth}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAddRule(groupNode.id)}
            className="text-[10px] font-semibold bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--surface-elevated))]/80 border border-[hsl(var(--border))] rounded px-2.5 py-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
          >
            + Add Rule
          </button>
          <button
            onClick={() => onAddGroup(groupNode.id)}
            className="text-[10px] font-semibold bg-[hsl(var(--primary))]/8 hover:bg-[hsl(var(--primary))]/15 border border-[hsl(var(--primary))]/20 rounded px-2.5 py-1 text-[hsl(var(--primary))]"
          >
            + Add Group
          </button>
          {groupNode.id !== 'root' && (
            <button
              onClick={() => onDeleteNode(groupNode.id)}
              className="p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded transition"
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
        <p className="text-xs text-[hsl(var(--text-tertiary))] italic py-2 text-center">No validation constraints in this group.</p>
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
                    <div className="absolute left-0 right-0 h-px bg-[hsl(var(--border))]/50"></div>
                    <button
                      onClick={() => onToggleCombinator(groupNode.id)}
                      className={`relative z-10 px-3 py-0.5 rounded-full text-[9px] font-extrabold border transition-all uppercase tracking-widest ${
                        groupNode.combinator === 'AND'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                          : 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/25'
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
    <div className="flex flex-wrap items-center gap-3 bg-[hsl(var(--surface))] p-3 rounded-lg border border-[hsl(var(--border))]/40 relative">
      <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Field</label>
        <select
          value={rule.field}
          onChange={(e) => onUpdate(rule.id, { field: e.target.value })}
          className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
        >
          {fields.map(f => (
            <option key={f.id} value={f.id}>{f.label || f.id}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Operator</label>
        <select
          value={rule.operator}
          onChange={(e) => onUpdate(rule.id, { operator: e.target.value as RuleOperator })}
          className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
        >
          {operators.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">
            {rule.operator === 'between' ? 'Range bounds (min,max)' : 'Value'}
          </label>
          {activeField?.options?.length ? (
            <select
              value={rule.value}
              onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
              className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
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
              className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--text-primary))] outline-none w-full"
              placeholder={rule.operator === 'between' ? 'e.g. 10,20' : 'e.g. 5'}
            />
          )}
        </div>
      )}

      <button
        onClick={() => onDelete(rule.id)}
        className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] mt-4 rounded transition"
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
        <p className="text-xs text-[hsl(var(--text-tertiary))] italic py-2 text-center">No actions configured for this rule.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => {
            const isNav = action.effect === 'DISABLE_NAV' || action.effect === 'ENABLE_NAV';
            const isFilter = action.effect === 'FILTER_OPTIONS';
            const isValue = action.effect === 'SET_VALUE';
            const isValidate = action.effect === 'VALIDATE';

            return (
              <div key={idx} className="flex flex-wrap items-center gap-3 bg-[hsl(var(--surface))] p-4 rounded-xl border border-[hsl(var(--border))]/40">
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Effect</label>
                  <select
                    value={action.effect}
                    onChange={(e) => updateAction(idx, { effect: e.target.value as RuleActionEffect })}
                    className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
                  >
                    {ACTION_EFFECTS.map(eff => (
                      <option key={eff.value} value={eff.value}>{eff.label}</option>
                    ))}
                  </select>
                </div>

                {!isNav && (
                  <div className="flex flex-col gap-1 w-36">
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Target Type</label>
                    <select
                      value={action.target_type}
                      onChange={(e) => updateAction(idx, { target_type: e.target.value as 'field' | 'section', target_id: '' })}
                      className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
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
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Target Node</label>
                    {action.target_type === 'section' ? (
                      <select
                        value={action.target_id}
                        onChange={(e) => updateAction(idx, { target_id: e.target.value })}
                        className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
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
                        className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
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
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Message</label>
                    <input
                      type="text"
                      value={action.config?.message || action.config?.error_message || ''}
                      onChange={(e) => updateAction(idx, {
                        config: isValidate ? { error_message: e.target.value } : { message: e.target.value }
                      })}
                      className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--text-primary))] outline-none w-full"
                      placeholder="e.g. Please watch the ad stimulus first"
                    />
                  </div>
                )}

                {/* Extra configurations: value mapping for FILTER_OPTIONS */}
                {isFilter && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Parent Field Dependency</label>
                    <select
                      value={action.config?.parent_field_id || ''}
                      onChange={(e) => updateAction(idx, {
                        config: { ...action.config, parent_field_id: e.target.value }
                      })}
                      className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
                    >
                      <option value="">Select parent field...</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.label || f.id}</option>
                      ))}
                    </select>
                  </div>
                )}

                {isFilter && action.config?.parent_field_id && (
                  <div className="flex flex-col gap-1 w-48">
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Filter Mode</label>
                    <select
                      value={action.config?.filter_mode || (action.config?.parent_column ? 'column' : 'visual')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'column') {
                          updateAction(idx, {
                            config: {
                              ...action.config,
                              filter_mode: 'column',
                              parent_column: action.config?.parent_column || '1',
                              filter_map: undefined
                            }
                          });
                        } else {
                          updateAction(idx, {
                            config: {
                              ...action.config,
                              filter_mode: 'visual',
                              parent_column: undefined,
                              filter_map: {}
                            }
                          });
                        }
                      }}
                      className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full"
                    >
                      <option value="visual">Visual Mappings (Static Map)</option>
                      <option value="column">Dynamic Column Match (CSV/JSON)</option>
                    </select>
                  </div>
                )}

                {isFilter && action.config?.parent_field_id && (action.config?.filter_mode === 'column' || action.config?.parent_column !== undefined) && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Target Column / Key</label>
                    {(() => {
                      const targetField = fields.find(f => f.id === action.target_id) as any;
                      const customData = targetField?.lookup_custom_data || '';
                      const sep = targetField?.lookup_separator || ',';
                      const parsed = parseCustomLookupData(customData, sep);

                      return (
                        <div className="flex gap-2 w-full">
                          {parsed.headers.length > 0 ? (
                            <select
                              value={action.config?.parent_column || ''}
                              onChange={(e) => updateAction(idx, {
                                config: { ...action.config, parent_column: e.target.value }
                              })}
                              className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:border-[hsl(var(--primary))] outline-none w-full flex-1"
                            >
                              <option value="">Select column...</option>
                              {parsed.headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                              {parsed.headers.map((_, i) => (
                                <option key={`idx-${i}`} value={i + 1}>Column {i + 1}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={action.config?.parent_column || ''}
                              onChange={(e) => updateAction(idx, {
                                config: { ...action.config, parent_column: e.target.value }
                              })}
                              className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--text-primary))] outline-none w-full flex-1"
                              placeholder="e.g. region or 1 (index)"
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isFilter && action.config?.parent_field_id && (action.config?.filter_mode === 'visual' || (!action.config?.filter_mode && !action.config?.parent_column)) && (
                  <FilterMapEditor
                    parentFieldId={action.config.parent_field_id}
                    targetFieldId={action.target_id}
                    filterMap={action.config.filter_map || {}}
                    onChange={(nextMap) => updateAction(idx, {
                      config: { ...action.config, filter_map: nextMap }
                    })}
                    fields={fields}
                  />
                )}

                {/* Extra configurations: set specific value for SET_VALUE */}
                {isValue && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                    <label className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider">Set Value To</label>
                    <input
                      type="text"
                      value={action.config?.value || ''}
                      onChange={(e) => updateAction(idx, {
                        config: { value: e.target.value }
                      })}
                      className="bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded-lg px-2.5 py-1.5 text-xs text-[hsl(var(--text-primary))] outline-none w-full"
                      placeholder="e.g. 100"
                    />
                  </div>
                )}

                <button
                  onClick={() => deleteAction(idx)}
                  className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] mt-4 rounded transition"
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
        className="text-xs font-bold bg-[hsl(var(--primary))]/8 hover:bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] px-3.5 py-2 rounded-lg border border-[hsl(var(--primary))]/20 transition"
      >
        + Add Action Consequence
      </button>
    </div>
  );
}

// ─── Filter Options Map Editor ──────────────────────────────────────────────

interface FilterMapEditorProps {
  parentFieldId: string;
  targetFieldId: string;
  filterMap: Record<string, any[]>;
  onChange: (map: Record<string, any[]>) => void;
  fields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
}

function FilterMapEditor({
  parentFieldId,
  targetFieldId,
  filterMap = {},
  onChange,
  fields,
}: FilterMapEditorProps) {
  const parentField = fields.find(f => f.id === parentFieldId);
  const targetField = fields.find(f => f.id === targetFieldId);

  const parentOptions = parentField?.options || [];
  const targetOptions = targetField?.options || [];

  const [expandedParentKey, setExpandedParentKey] = useState<string | null>(null);

  // Fallback: If parent or target has no predefined options, render JSON editor
  if (parentOptions.length === 0 || targetOptions.length === 0) {
    const jsonString = JSON.stringify(filterMap, null, 2);
    const handleTextChange = (val: string) => {
      try {
        const parsed = JSON.parse(val);
        if (typeof parsed === 'object' && parsed !== null) {
          onChange(parsed);
        }
      } catch (e) {
        // ignore invalid JSON format during typing
      }
    };
    return (
      <div className="mt-3 p-3.5 border border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/20 rounded-xl w-full">
        <p className="text-[10px] text-[hsl(var(--text-tertiary))] font-bold uppercase tracking-wider mb-2 select-none">
          Option Mapping (JSON Syntax)
        </p>
        <textarea
          defaultValue={jsonString}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full font-mono text-[11px] p-3 rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] outline-none h-32 focus:ring-1 focus:ring-[hsl(var(--primary))]"
          placeholder={`{\n  "greater_accra": [\n    { "label": "Makola Market", "value": "makola" }\n  ]\n}`}
        />
      </div>
    );
  }

  // Visual subset checkbox editor
  return (
    <div className="mt-3 p-3.5 border border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/20 rounded-xl space-y-3 w-full">
      <div className="flex flex-col select-none">
        <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider">
          Cascade Options Mapping
        </span>
        <span className="text-[9px] text-[hsl(var(--text-tertiary))]/80 mt-0.5">
          Map each {parentField?.label || parentField?.id || parentFieldId} value to visible options in {targetField?.label || targetField?.id || targetFieldId}
        </span>
      </div>

      <div className="divide-y divide-[hsl(var(--border))]/30 border border-[hsl(var(--border))]/40 rounded-xl overflow-hidden bg-[hsl(var(--surface))]">
        {parentOptions.map(pOpt => {
          const isExpanded = expandedParentKey === pOpt.value;
          const currentMappings = filterMap[pOpt.value] || [];

          return (
            <div key={pOpt.value} className="flex flex-col">
              <button
                type="button"
                onClick={() => setExpandedParentKey(isExpanded ? null : pOpt.value)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--surface-elevated))]/30 text-left text-xs font-semibold text-[hsl(var(--text-primary))] transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[hsl(var(--text-tertiary))]">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span>{pOpt.label}</span>
                  <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))]/60">({pOpt.value})</span>
                </div>
                <span className="text-[9px] font-bold bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-2.5 py-0.5 rounded-lg border border-[hsl(var(--primary))]/20 shrink-0">
                  {currentMappings.length} mapped
                </span>
              </button>

              {isExpanded && (
                <div className="p-4 bg-[hsl(var(--surface-elevated))]/10 border-t border-[hsl(var(--border))]/30 grid grid-cols-2 gap-x-4 gap-y-3 animate-in fade-in duration-150">
                  {targetOptions.map(tOpt => {
                    const isChecked = currentMappings.some((m: any) => m.value === tOpt.value);
                    const handleToggle = () => {
                      let nextMappings = [...currentMappings];
                      if (isChecked) {
                        nextMappings = nextMappings.filter((m: any) => m.value !== tOpt.value);
                      } else {
                        nextMappings.push({ label: tOpt.label, value: tOpt.value });
                      }
                      onChange({
                        ...filterMap,
                        [pOpt.value]: nextMappings,
                      });
                    };

                    return (
                      <label key={tOpt.value} className="flex items-center gap-2.5 text-xs text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer select-none py-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={handleToggle}
                          className="h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer transition-all"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{tOpt.label}</span>
                          <span className="text-[9px] font-mono text-[hsl(var(--text-tertiary))]/60 leading-none mt-0.5">({tOpt.value})</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
