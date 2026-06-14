import React, { useState, useMemo } from 'react';

// === COOPERATIVE CONSTANTS & SCHEMA ===
const SURVEY_FIELDS = [
  { id: 'region', label: 'Region', type: 'dropdown', options: ['Greater Accra', 'Ashanti', 'Northern', 'Western'] },
  { id: 'market', label: 'Market', type: 'dropdown', options: ['Makola', 'Kejetia', 'Tamale Central', 'Takoradi Circle'] },
  { id: 'gps_accuracy', label: 'GPS Accuracy (meters)', type: 'number' },
  { id: 'product_category', label: 'SKU Categories Selected', type: 'multiselect', options: ['washing_powder', 'laundry_soap', 'beauty_soap', 'medicated_soap', 'liquid_soap', 'fabric_softener'] },
  { id: 'sku_quantity', label: 'Sales Quantity', type: 'number' },
  { id: 'ad_stimulus_eval', label: 'Ad Stimulus Playback Status', type: 'media', options: ['not_started', 'playing', 'completed'] },
  { id: 'sku_expiry_date', label: 'Expiry Date', type: 'date' },
  { id: 'reason_for_non_purchase', label: 'Reason for Non-Purchase', type: 'dropdown', options: ['Out of Stock', 'Price High', 'Competitor Preference'] }
];

const TARGET_ACTIONS = [
  { id: 'SHOW', label: 'Show/Unhide Field' },
  { id: 'HIDE', label: 'Hide Field' },
  { id: 'REQUIRE', label: 'Make Field Required' },
  { id: 'DISABLE_NAV', label: 'Disable Next Button' },
  { id: 'FILTER_OPTIONS', label: 'Filter Sub-SKUs List' }
];

const OPERATORS_BY_TYPE = {
  number: [
    { label: 'equals', value: '==' },
    { label: 'not equals', value: '!=' },
    { label: 'greater than', value: '>' },
    { label: 'less than', value: '<' }
  ],
  dropdown: [
    { label: 'is', value: '==' },
    { label: 'is not', value: '!=' },
    { label: 'is empty', value: 'empty' }
  ],
  multiselect: [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'not_contains' }
  ],
  media: [
    { label: 'status is', value: '==' },
    { label: 'status is not', value: '!=' }
  ],
  date: [
    { label: 'is after', value: '>' },
    { label: 'is before', value: '<' }
  ]
};

// We use a hierarchical recursive state tree representation for complex rules
const INITIAL_NESTED_RULE_TREE = {
  id: 'root',
  type: 'group',
  combinator: 'OR',
  children: [
    {
      id: 'g1',
      type: 'group',
      combinator: 'AND',
      children: [
        { id: 'r1', type: 'rule', field: 'sku_quantity', operator: '==', value: '0' },
        { id: 'r2', type: 'rule', field: 'region', operator: '==', value: 'Greater Accra' }
      ]
    },
    {
      id: 'g2',
      type: 'group',
      combinator: 'AND',
      children: [
        { id: 'r3', type: 'rule', field: 'ad_stimulus_eval', operator: '!=', value: 'completed' }
      ]
    }
  ]
};

export default function App() {
  // --- STUDIO STATES ---
  const [ruleTree, setRuleTree] = useState(INITIAL_NESTED_RULE_TREE);
  const [action, setAction] = useState({ effect: 'SHOW', target: 'reason_for_non_purchase' });
  const [activeTab, setActiveTab] = useState('json'); // json | js

  // Live Survey Mock Database Simulator State
  const [simValues, setSimValues] = useState({
    region: 'Greater Accra',
    market: 'Makola',
    gps_accuracy: '12',
    product_category: ['washing_powder'],
    sku_quantity: '0',
    ad_stimulus_eval: 'not_started',
    sku_expiry_date: '2026-12-31',
    reason_for_non_purchase: ''
  });

  // Safely traverse and edit nodes inside the tree structure
  const updateTreeNode = (node, targetId, updateFn) => {
    if (node.id === targetId) {
      return { ...node, ...updateFn(node) };
    }
    if (node.type === 'group' && node.children) {
      return {
        ...node,
        children: node.children.map(child => updateTreeNode(child, targetId, updateFn))
      };
    }
    return node;
  };

  // Safely remove a node from the recursive state tree
  const removeTreeNode = (node, targetId) => {
    if (node.type === 'group' && node.children) {
      // Filter out immediate children that match the targetId
      const filtered = node.children.filter(child => child.id !== targetId);
      // Recursively filter deeper children
      return {
        ...node,
        children: filtered.map(child => removeTreeNode(child, targetId))
      };
    }
    return node;
  };

  // Add rule to a specific nested group node
  const handleAddRule = (groupId) => {
    const defaultField = SURVEY_FIELDS[0];
    const newRule = {
      id: 'rule_' + Date.now(),
      type: 'rule',
      field: defaultField.id,
      operator: OPERATORS_BY_TYPE[defaultField.type][0].value,
      value: defaultField.options ? defaultField.options[0] : '0'
    };

    setRuleTree(prev => updateTreeNode(prev, groupId, (group) => ({
      children: [...(group.children || []), newRule]
    })));
  };

  // Create a new sub-group nested under a specific target group
  const handleAddGroup = (groupId) => {
    const defaultField = SURVEY_FIELDS[0];
    const newGroup = {
      id: 'group_' + Date.now(),
      type: 'group',
      combinator: 'AND',
      children: [
        {
          id: 'rule_sub_' + Date.now(),
          type: 'rule',
          field: defaultField.id,
          operator: OPERATORS_BY_TYPE[defaultField.type][0].value,
          value: defaultField.options ? defaultField.options[0] : '0'
        }
      ]
    };

    setRuleTree(prev => updateTreeNode(prev, groupId, (group) => ({
      children: [...(group.children || []), newGroup]
    })));
  };

  // Toggle logical connector ('AND' <-> 'OR') for a specific group node
  const handleToggleCombinator = (groupId) => {
    setRuleTree(prev => updateTreeNode(prev, groupId, (group) => ({
      combinator: group.combinator === 'AND' ? 'OR' : 'AND'
    })));
  };

  // Delete element (leaf rule or entire nested group)
  const handleDeleteNode = (nodeId) => {
    if (nodeId === 'root') return; // Cannot delete root
    setRuleTree(prev => removeTreeNode(prev, nodeId));
  };

  // Update properties of a specific rule
  const handleUpdateRule = (ruleId, updatedProps) => {
    setRuleTree(prev => updateTreeNode(prev, ruleId, (rule) => {
      const merged = { ...rule, ...updatedProps };
      if (updatedProps.field) {
        const fieldMeta = SURVEY_FIELDS.find(f => f.id === updatedProps.field);
        if (fieldMeta) {
          merged.operator = OPERATORS_BY_TYPE[fieldMeta.type][0].value;
          merged.value = fieldMeta.options ? fieldMeta.options[0] : '0';
        }
      }
      return merged;
    }));
  };

  // Calculate validation results per node in real-time, passing down detailed debugging status
  const evaluateTree = (node, values) => {
    if (node.type === 'rule') {
      const currentVal = values[node.field];
      const targetVal = node.value;
      const fieldMeta = SURVEY_FIELDS.find(f => f.id === node.field);
      
      let pass = false;
      if (fieldMeta) {
        if (fieldMeta.type === 'multiselect') {
          const list = Array.isArray(currentVal) ? currentVal : [];
          if (node.operator === 'contains') pass = list.includes(targetVal);
          if (node.operator === 'not_contains') pass = !list.includes(targetVal);
        } else if (node.operator === '==') {
          pass = String(currentVal) === String(targetVal);
        } else if (node.operator === '!=') {
          pass = String(currentVal) !== String(targetVal);
        } else if (node.operator === 'empty') {
          pass = !currentVal || String(currentVal).trim() === '';
        } else {
          const numCur = Number(currentVal);
          const numTar = Number(targetVal);
          if (node.operator === '>') pass = numCur > numTar;
          if (node.operator === '<') pass = numCur < numTar;
        }
      }
      return { id: node.id, val: pass };
    }

    if (node.type === 'group') {
      const childrenEvaluations = (node.children || []).map(child => evaluateTree(child, values));
      const booleans = childrenEvaluations.map(e => e.val);
      
      let groupPass = false;
      if (booleans.length === 0) {
        groupPass = true;
      } else if (node.combinator === 'AND') {
        groupPass = booleans.every(b => b === true);
      } else {
        groupPass = booleans.some(b => b === true);
      }

      return {
        id: node.id,
        val: groupPass,
        children: childrenEvaluations
      };
    }
  };

  // Compute live trace states
  const evaluationResultTree = useMemo(() => {
    return evaluateTree(ruleTree, simValues);
  }, [ruleTree, simValues]);

  // Helper dictionary mapping node ID to its boolean result for inline indicators
  const inlineTraceResults = useMemo(() => {
    const dict = {};
    const traverse = (nodeResult) => {
      if (!nodeResult) return;
      dict[nodeResult.id] = nodeResult.val;
      if (nodeResult.children) {
        nodeResult.children.forEach(traverse);
      }
    };
    traverse(evaluationResultTree);
    return dict;
  }, [evaluationResultTree]);

  const isRuleTriggered = evaluationResultTree.val;

  // Recursively compile rules tree into clear AST representation
  const compiledASTString = useMemo(() => {
    const formatAST = (node) => {
      if (node.type === 'rule') {
        return {
          rule: node.field,
          op: node.operator,
          val: node.value
        };
      }
      return {
        combinator: node.combinator,
        rules: (node.children || []).map(formatAST)
      };
    };

    const finalAST = {
      action: action.effect,
      target: action.target,
      logic: formatAST(ruleTree)
    };
    return JSON.stringify(finalAST, null, 2);
  }, [ruleTree, action]);

  // Recursively compile into lightweight client runtime Javascript
  const compiledJSString = useMemo(() => {
    const compileToJS = (node) => {
      if (node.type === 'rule') {
        const fieldMeta = SURVEY_FIELDS.find(f => f.id === node.field);
        if (fieldMeta && fieldMeta.type === 'multiselect') {
          if (node.operator === 'contains') return `surveyData.${node.field}.includes('${node.value}')`;
          return `!surveyData.${node.field}.includes('${node.value}')`;
        }
        if (node.operator === 'empty') return `(!surveyData.${node.field} || surveyData.${node.field} === '')`;
        const quote = isNaN(node.value) || node.value === '' ? "'" : "";
        return `surveyData.${node.field} ${node.operator} ${quote}${node.value}${quote}`;
      }
      
      const parts = (node.children || []).map(compileToJS);
      if (parts.length === 0) return 'true';
      const separator = node.combinator === 'AND' ? ' && ' : ' || ';
      return `(${parts.join(separator)})`;
    };

    let consequence = '';
    if (action.effect === 'SHOW') consequence = `showField('${action.target}');`;
    else if (action.effect === 'HIDE') consequence = `hideField('${action.target}');`;
    else if (action.effect === 'REQUIRE') consequence = `setRequired('${action.target}', true);`;
    else if (action.effect === 'DISABLE_NAV') consequence = `disableNavigation(true, "Fill required fields");`;
    else if (action.effect === 'FILTER_OPTIONS') consequence = `filterSubSKUOptions('${action.target}');`;

    return `// Opla Lightweight Logical Offline Driver\nif (${compileToJS(ruleTree)}) {\n    ${consequence}\n} else {\n    ${action.effect === 'SHOW' ? `hideField('${action.target}');` : `// Maintain neutral layout state`}\n}`;
  }, [ruleTree, action]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Opla Dynamic Rules Studio</h1>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/20">Nested Query Builder</span>
            </div>
            <p className="text-xs text-slate-400">Design skip logic, cascading effects, and validations with inline join structures</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-400">Interactive Preview Enabled</span>
        </div>
      </header>

      {}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6">
        
        {/* Left Side: Rule Canvas & Node hierarchy */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">IF</span>
                <h2 className="text-sm font-bold text-slate-200">Conditions Logic Workspace</h2>
              </div>
              <div className="text-[11px] text-slate-400 italic">
                Logical operators are placed exactly <span className="text-indigo-400 font-semibold underline decoration-indigo-400/40">between</span> your items.
              </div>
            </div>

            {/* Recursive Logic Builder Element */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <RecursiveGroupRenderer
                groupNode={ruleTree}
                onAddRule={handleAddRule}
                onAddGroup={handleAddGroup}
                onToggleCombinator={handleToggleCombinator}
                onDeleteNode={handleDeleteNode}
                onUpdateRule={handleUpdateRule}
                traceDict={inlineTraceResults}
                depth={0}
              />
            </div>
          </div>

          {/* Target consequence effects block */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-800/60">
              <span className="h-6 w-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">THEN</span>
              <h3 className="text-sm font-bold text-slate-200">Action Consequence</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Execute Action Effect</label>
                <select 
                  value={action.effect}
                  onChange={(e) => setAction({ ...action, effect: e.target.value })}
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-xs text-slate-100 outline-none w-full"
                >
                  {TARGET_ACTIONS.map(act => (
                    <option key={act.id} value={act.id}>{act.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">On Survey Target Node</label>
                <select 
                  value={action.target}
                  onChange={(e) => setAction({ ...action, target: e.target.value })}
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-xs text-slate-100 outline-none w-full"
                >
                  {SURVEY_FIELDS.map(f => (
                    <option key={f.id} value={f.id}>{f.label} ({f.id})</option>
                  ))}
                  <option value="next_button">Main Survey Form Navigation</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {}
        {/* Right Side: Simulator + AST Export */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* Real-time survey emulator */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isRuleTriggered ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                <h3 className="text-sm font-bold text-slate-200">Device Mock Database Sandbox</h3>
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded uppercase">Dry-Run Mode</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tweak survey parameters below to simulate a field agent’s answers offline. Watch the visual nodes on the left update immediately based on nested calculation outputs.
            </p>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-4 max-h-[280px] overflow-y-auto">
              
              {/* Region Selector */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-slate-400">region</span>
                <select 
                  value={simValues.region}
                  onChange={(e) => setSimValues({ ...simValues, region: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 outline-none w-44"
                >
                  {SURVEY_FIELDS.find(f => f.id === 'region').options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Sku Quantity Input */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-slate-400">sku_quantity</span>
                <input 
                  type="number"
                  value={simValues.sku_quantity}
                  onChange={(e) => setSimValues({ ...simValues, sku_quantity: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 outline-none w-44 text-right"
                />
              </div>

              {/* Ad Stimulus Recall Evaluation Player state */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-slate-400">ad_stimulus_eval</span>
                <select
                  value={simValues.ad_stimulus_eval}
                  onChange={(e) => setSimValues({ ...simValues, ad_stimulus_eval: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 outline-none w-44"
                >
                  <option value="not_started">not_started</option>
                  <option value="playing">playing</option>
                  <option value="completed">completed</option>
                </select>
              </div>

              {/* GPS Accuracy mock */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-slate-400">gps_accuracy (m)</span>
                <input 
                  type="number"
                  value={simValues.gps_accuracy}
                  onChange={(e) => setSimValues({ ...simValues, gps_accuracy: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 outline-none w-44 text-right"
                />
              </div>

              {/* Multiselect mockup categories */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400">product_category</span>
                  <span className="text-[10px] text-slate-500 italic">Toggle answers database values</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['washing_powder', 'laundry_soap', 'liquid_soap', 'beauty_soap'].map(cat => {
                    const active = simValues.product_category.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          const updated = active 
                            ? simValues.product_category.filter(c => c !== cat)
                            : [...simValues.product_category, cat];
                          setSimValues({ ...simValues, product_category: updated });
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${active ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Displaying Evaluated layout mockup */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Layout Engine Evaluation:</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isRuleTriggered ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-850'}`}>
                  {isRuleTriggered ? 'ACTIVE TRIGGER' : 'INACTIVE'}
                </span>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-850 text-xs text-slate-300 min-h-[95px] flex flex-col justify-center">
                {isRuleTriggered ? (
                  <div className="space-y-2 animate-fadeIn">
                    <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Device Render Result</span>
                    
                    {action.effect === 'SHOW' && (
                      <div className="p-2 bg-slate-950 rounded border border-emerald-500/20">
                        <label className="text-[11px] font-bold text-slate-200 block mb-1">Reason for Non-Purchase?</label>
                        <select className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-1 w-full outline-none text-slate-300">
                          <option>Out of Stock</option>
                          <option>Competitor preference</option>
                          <option>Price was too high</option>
                        </select>
                      </div>
                    )}

                    {action.effect === 'DISABLE_NAV' && (
                      <div className="flex items-center justify-between gap-2 p-2 bg-rose-500/5 rounded border border-rose-500/10 text-rose-400 text-[11px] font-medium">
                        <span>⚠️ Ad recall locked. You must complete the advertisement sequence first.</span>
                        <button className="bg-slate-900 px-3 py-1 rounded text-slate-400 text-[10px] font-bold cursor-not-allowed" disabled>Next</button>
                      </div>
                    )}

                    {action.effect === 'REQUIRE' && (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-semibold">
                        ⚠️ Field "{action.target}" has been set to MANDATORY before proceeding.
                      </span>
                    )}

                    {action.effect === 'FILTER_OPTIONS' && (
                      <div className="p-2 bg-slate-950 rounded border border-indigo-500/20 text-[11px]">
                        <span className="text-slate-400 font-bold block mb-1">Cascaded SKUs:</span>
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-mono">soklin_25g</span>
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-mono">good_mama_85g</span>
                        </div>
                      </div>
                    )}

                    {action.effect === 'HIDE' && (
                      <span className="text-slate-400 italic">Target field "{action.target}" was successfully removed from the layout hierarchy.</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500 italic text-center text-[11px]">Conditions not met. Showing standard survey layout hierarchy.</span>
                )}
              </div>
            </div>

          </div>

          {/* Code exporter logs tabs */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-slate-300">Compiled Code Drivers</span>
              
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  AST JSON
                </button>
                <button 
                  onClick={() => setActiveTab('js')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${activeTab === 'js' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Runtime JS
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-950 p-4 rounded-xl border border-slate-850 overflow-auto">
              {activeTab === 'json' ? (
                <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
                  {compiledASTString}
                </pre>
              ) : (
                <pre className="text-[11px] font-mono text-indigo-300 leading-relaxed overflow-x-auto whitespace-pre">
                  {compiledJSString}
                </pre>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

// This component outputs sub-branches recursively, injecting the Join logical elements directly BETWEEN children
function RecursiveGroupRenderer({ 
  groupNode, 
  onAddRule, 
  onAddGroup, 
  onToggleCombinator, 
  onDeleteNode, 
  onUpdateRule, 
  traceDict,
  depth 
}) {
  const children = groupNode.children || [];
  const evaluatedPass = traceDict[groupNode.id];

  return (
    <div className="relative flex flex-col gap-3">
      
      {/* Visual group card wrapper */}
      <div className={`p-4 rounded-xl border transition-all ${
        depth === 0 
          ? 'bg-slate-900/30 border-slate-800/80 shadow-md' 
          : 'bg-slate-950/40 border-slate-850/60'
      }`}>
        
        {/* Branch group metadata status row */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900/60">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider ${
              evaluatedPass 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-slate-900 text-slate-500 border border-slate-850'
            }`}>
              {evaluatedPass ? 'TRUE GROUP' : 'FALSE GROUP'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Depth Level {depth}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => onAddRule(groupNode.id)}
              className="px-2.5 py-1 text-[10px] font-semibold bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 transition text-slate-300 hover:text-white"
            >
              + Add Rule
            </button>
            <button 
              onClick={() => onAddGroup(groupNode.id)}
              className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-950/20 border border-indigo-900/40 rounded hover:bg-indigo-950/40 transition text-indigo-400 hover:text-indigo-300"
            >
              + Add Group
            </button>
            {groupNode.id !== 'root' && (
              <button 
                onClick={() => onDeleteNode(groupNode.id)}
                className="p-1 text-slate-500 hover:text-red-400 rounded transition"
                title="Delete Group Branch"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Render children inside the group with dynamic inline logical joining lines between them */}
        {children.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 italic">
            This logic branch contains no validation constraints.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {children.map((child, index) => {
              const isLast = index === children.length - 1;
              return (
                <React.Fragment key={child.id}>
                  
                  {/* Visual item child */}
                  {child.type === 'rule' ? (
                    <LogicRuleRow
                      rule={child}
                      onDelete={onDeleteNode}
                      onUpdate={onUpdateRule}
                      evaluatedPass={traceDict[child.id]}
                    />
                  ) : (
                    <RecursiveGroupRenderer
                      groupNode={child}
                      onAddRule={onAddRule}
                      onAddGroup={onAddGroup}
                      onToggleCombinator={onToggleCombinator}
                      onDeleteNode={onDeleteNode}
                      onUpdateRule={onUpdateRule}
                      traceDict={traceDict}
                      depth={depth + 1}
                    />
                  )}

                  {/* Logical splitter connector inline between items */}
                  {!isLast && (
                    <div className="relative flex items-center justify-center my-1.5 group">
                      {/* Left line connector */}
                      <div className="absolute left-0 right-0 h-px bg-slate-850/50 group-hover:bg-indigo-950 transition-colors z-0"></div>
                      
                      {/* Combinator pill toggle button */}
                      <button
                        onClick={() => onToggleCombinator(groupNode.id)}
                        className={`relative z-10 px-3 py-0.5 rounded-full text-[9px] font-bold border transition-all shadow-md focus:ring-1 focus:ring-indigo-500/40 uppercase tracking-widest ${
                          groupNode.combinator === 'AND' 
                            ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/60' 
                            : 'bg-indigo-950 text-indigo-400 border-indigo-800/40 hover:bg-indigo-900/60'
                        }`}
                        title="Click to toggle group logical logic"
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
    </div>
  );
}

function LogicRuleRow({ rule, onDelete, onUpdate, evaluatedPass }) {
  const selectedFieldMeta = SURVEY_FIELDS.find(f => f.id === rule.field) || SURVEY_FIELDS[0];
  const availableOperators = OPERATORS_BY_TYPE[selectedFieldMeta.type] || [];

  return (
    <div className={`flex flex-wrap items-center gap-3 bg-slate-950 p-3.5 rounded-xl border hover:border-slate-800 transition-colors relative ${
      evaluatedPass ? 'border-emerald-500/20' : 'border-slate-900'
    }`}>
      
      {/* Logical evaluation dot trace state */}
      <div 
        className={`h-2.5 w-2.5 rounded-full absolute -left-1 flex items-center justify-center shadow-md ${
          evaluatedPass ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-slate-800'
        }`}
        title={evaluatedPass ? 'Rule evaluates to TRUE' : 'Rule evaluates to FALSE'}
      >
        <span className="text-[7px] text-white font-bold">{evaluatedPass ? '✓' : ''}</span>
      </div>

      {/* Field dropdown selector */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Source Field</span>
        <select
          value={rule.field}
          onChange={(e) => onUpdate(rule.id, { field: e.target.value })}
          className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
        >
          {SURVEY_FIELDS.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Operator dropdown selector */}
      <div className="flex flex-col gap-1.5 flex-0 min-w-[110px]">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Comparison</span>
        <select
          value={rule.operator}
          onChange={(e) => onUpdate(rule.id, { operator: e.target.value })}
          className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
        >
          {availableOperators.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      {/* Value input fields (adapts based on schemas) */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Comparison Value</span>
        {selectedFieldMeta.options ? (
          <select
            value={rule.value}
            onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
            className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full"
          >
            {selectedFieldMeta.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type={selectedFieldMeta.type === 'number' ? 'number' : 'text'}
            value={rule.value}
            onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
            placeholder="Type value..."
            className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full text-left"
          />
        )}
      </div>

      {/* Delete Rule button */}
      <button
        onClick={() => onDelete(rule.id)}
        className="p-1.5 mt-5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
        title="Delete Rule Node"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

    </div>
  );
}