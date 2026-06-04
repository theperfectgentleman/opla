import os

filepath = r"c:\Users\kings\Dev Projects\opla\opla-frontend\apps\studio\src\pages\FormBuilder.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove unused propertyTab state
target1 = """    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [logic, setLogic] = useState<LogicRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [propertyTab, setPropertyTab] = useState<'content' | 'logic'>('content');
    const [view, setView] = useState<'flow' | 'section'>('flow');"""

replacement1 = """    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [logic, setLogic] = useState<LogicRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState<'flow' | 'section'>('flow');"""

# 2. Section Sub-tab Pill Selector & ternary start removal
target2 = """                                    {activeSidebarTab === 'section' && (
                                         <div className="flex-1 flex flex-col">
                                             {/* Sub-tab Pill Selector */}
                                             <div className="px-4 pt-4 pb-2 flex gap-2">
                                                 <button
                                                     onClick={() => setPropertyTab('content')}
                                                     className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                         propertyTab === 'content'
                                                             ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                             : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                     }`}
                                                 >
                                                     Settings
                                                 </button>
                                                 <button
                                                     onClick={() => setPropertyTab('logic')}
                                                     className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                         propertyTab === 'logic'
                                                             ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                             : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                     }`}
                                                 >
                                                     Logic Rules
                                                 </button>
                                             </div>

                                             <div className="flex-1 p-6 pt-2 overflow-y-auto hide-scrollbar">
                                                 {propertyTab === 'content' ? (
                                                     <div className="space-y-5 animate-in fade-in duration-200">"""

replacement2 = """                                    {activeSidebarTab === 'section' && (
                                         <div className="flex-1 flex flex-col">
                                             <div className="flex-1 p-6 pt-4 overflow-y-auto hide-scrollbar">
                                                 <div className="space-y-5 animate-in fade-in duration-200">"""

# 3. Section middle divider insertion
target3 = """                                                     <p className="text-[hsl(var(--text-tertiary))] text-xs italic">Select a field in the canvas to see its individual properties.</p>

                                                     </div>
                                                 ) : (
                                                     <div className="space-y-6 animate-in fade-in duration-200">"""

replacement3 = """                                                     <p className="text-[hsl(var(--text-tertiary))] text-xs italic">Select a field in the canvas to see its individual properties.</p>

                                                     </div>
                                                     {/* Border Divider */}
                                                     <div className="border-t border-[hsl(var(--border))]/30 my-6 pt-6" />
                                                     <div className="space-y-6 animate-in fade-in duration-200">"""

# 4. Section block end matching
target4 = """                                                     </div>

                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     )}"""

replacement4 = """                                                     </div>

                                                     </div>
                                             </div>
                                         </div>
                                     )}"""

# 5. Widget Pill Selector & ternary start removal
target5 = """                                                     {/* Sub-tab Pill Selector */}
                                                     <div className="px-4 pt-4 pb-2 flex gap-2">
                                                         <button
                                                             onClick={() => setPropertyTab('content')}
                                                             className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                                 propertyTab === 'content'
                                                                     ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                                     : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                             }`}
                                                         >
                                                             Settings
                                                         </button>
                                                         <button
                                                             onClick={() => setPropertyTab('logic')}
                                                             className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                                 propertyTab === 'logic'
                                                                     ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                                     : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                             }`}
                                                         >
                                                             Logic Rules
                                                         </button>
                                                     </div>

                                                     <div className="flex-1 p-6 pt-2 overflow-y-auto hide-scrollbar">
                                                         {propertyTab === 'content' ? (
                                                             <div className="flex-1 flex flex-col min-h-0 overflow-y-auto hide-scrollbar select-none">"""

replacement5 = """                                                     <div className="flex-1 p-6 pt-4 overflow-y-auto hide-scrollbar select-none">"""

# 6. Categories grid update
target6 = """                                                                     const categories = ['Appearance', 'Data', 'Validation', 'Behavior', 'Matrix Setup', 'API Integration', 'System Settings'];

                                                                     return (
                                                                         <div className="flex-1 overflow-y-auto hide-scrollbar border border-[hsl(var(--border))]/25 rounded-xl bg-[hsl(var(--background))]">
                                                                             {categories.map(categoryName => {
                                                                                 const isCollapsed = !!collapsedPropCategories[categoryName];
                                                                                 const categoryRows = allPropRows.filter(r => r.category === categoryName && r.visible);"""

replacement6 = """                                                                     const categories = ['Appearance', 'Data', 'Logic Rules', 'Validation', 'Behavior', 'Matrix Setup', 'API Integration', 'System Settings'];

                                                                     return (
                                                                         <div className="flex-1 overflow-y-auto hide-scrollbar border border-[hsl(var(--border))]/25 rounded-xl bg-[hsl(var(--background))]">
                                                                             {categories.map(categoryName => {
                                                                                 const isCollapsed = !!collapsedPropCategories[categoryName];

                                                                                 if (categoryName === 'Logic Rules') {
                                                                                     const rulesCount = logic.filter(r => r.type === 'field_visibility' && r.target_id === selectedField.id).length;
                                                                                     return (
                                                                                         <div key={categoryName} className="border-b border-[hsl(var(--border))]/30 last:border-b-0">
                                                                                             <button
                                                                                                 type="button"
                                                                                                 onClick={() => setCollapsedPropCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                                                                                                 className="w-full flex items-center justify-between px-3 py-1.5 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/45 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] select-none border-b border-[hsl(var(--border))]/25 transition-all"
                                                                                             >
                                                                                                 <div className="flex items-center gap-1.5">
                                                                                                     <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                                                     <span>{categoryName}</span>
                                                                                                 </div>
                                                                                                 <span className="text-[9px] text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))]/80 px-1.5 py-0.5 rounded-md border border-[hsl(var(--border))]/40">
                                                                                                     {rulesCount}
                                                                                                 </span>
                                                                                             </button>

                                                                                             {!isCollapsed && (
                                                                                                 <div className="p-4 bg-[hsl(var(--surface))] space-y-4 border-t border-[hsl(var(--border))]/20">
                                                                                                     <div className="space-y-4">
                                                                                                         {logic.filter(r => r.type === 'field_visibility' && r.target_id === selectedField.id).map(rule => (
                                                                                                             <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl space-y-4 relative group border border-[hsl(var(--border))]/30">
                                                                                                                 <button
                                                                                                                     type="button"
                                                                                                                     onClick={() => removeLogicRule(rule.id)}
                                                                                                                     className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                                                                                 >
                                                                                                                     <Trash2 className="w-3.5 h-3.5" />
                                                                                                                 </button>

                                                                                                                 {/* Timing badge */}
                                                                                                                 <div className="flex items-center justify-between">
                                                                                                                     <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">IF</span>
                                                                                                                     <div className="flex items-center bg-[hsl(var(--surface-elevated))]/40 p-0.5 gap-0.5 rounded-xl">
                                                                                                                         {(['pre', 'post'] as const).map(t => (
                                                                                                                             <button
                                                                                                                                 type="button"
                                                                                                                                 key={t}
                                                                                                                                 onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                                                                                 className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                                                                     ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20'
                                                                                                                                     : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                                                                     }`}
                                                                                                                             >
                                                                                                                                 {t}
                                                                                                                             </button>
                                                                                                                         ))}
                                                                                                                     </div>
                                                                                                                 </div>

                                                                                                                 <div className="space-y-3">
                                                                                                                     {rule.conditions.map((cond, cIdx) => (
                                                                                                                         <div key={cIdx} className="space-y-2">
                                                                                                                             <select
                                                                                                                                 value={cond.field}
                                                                                                                                 onChange={(e) => {
                                                                                                                                     const newConds = [...rule.conditions];
                                                                                                                                     newConds[cIdx].field = e.target.value;
                                                                                                                                     updateLogicRule(rule.id, { conditions: newConds });
                                                                                                                                 }}
                                                                                                                                 className="input-sm w-full py-1.5"
                                                                                                                             >
                                                                                                                                 <option value="">Select Field...</option>
                                                                                                                                 {sections.flatMap(p => p.fields).filter(f => f.id !== selectedField.id).map(f => (
                                                                                                                                     <option key={f.id} value={f.id}>{f.label}</option>
                                                                                                                                 ))}
                                                                                                                             </select>

                                                                                                                             <div className="flex space-x-2">
                                                                                                                                 <select
                                                                                                                                     value={cond.operator}
                                                                                                                                     onChange={(e) => {
                                                                                                                                         const newConds = [...rule.conditions];
                                                                                                                                         newConds[cIdx].operator = e.target.value as any;
                                                                                                                                         updateLogicRule(rule.id, { conditions: newConds });
                                                                                                                                     }}
                                                                                                                                     className="input-sm w-1/2 py-1.5"
                                                                                                                                 >
                                                                                                                                     <option value="eq">Equals</option>
                                                                                                                                     <option value="neq">Not Equal</option>
                                                                                                                                     <option value="contains">Contains</option>
                                                                                                                                     <option value="gt">Greater Than</option>
                                                                                                                                     <option value="lt">Less Than</option>
                                                                                                                                 </select>
                                                                                                                                 <input
                                                                                                                                     value={cond.value}
                                                                                                                                     onChange={(e) => {
                                                                                                                                         const newConds = [...rule.conditions];
                                                                                                                                         newConds[cIdx].value = e.target.value;
                                                                                                                                         updateLogicRule(rule.id, { conditions: newConds });
                                                                                                                                     }}
                                                                                                                                     placeholder="Value"
                                                                                                                                     className="input-sm w-1/2 py-1.5"
                                                                                                                                 />
                                                                                                                             </div>
                                                                                                                         </div>
                                                                                                                     ))}
                                                                                                                 </div>

                                                                                                                 <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                                                                                     <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">THEN</span>
                                                                                                                     <span>SHOW FIELD</span>
                                                                                                                 </div>
                                                                                                             </div>
                                                                                                         ))}

                                                                                                         <button
                                                                                                             type="button"
                                                                                                             onClick={() => addLogicRule({
                                                                                                                 type: 'field_visibility',
                                                                                                                 timing: 'pre',
                                                                                                                 target_id: selectedField.id,
                                                                                                                 action: 'show',
                                                                                                                 conditions: [{ field: '', operator: 'eq', value: '' }]
                                                                                                             })}
                                                                                                             className="w-full py-3 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                                                                         >
                                                                                                             + Add Visibility Rule
                                                                                                         </button>
                                                                                                     </div>
                                                                                                 </div>
                                                                                             )}
                                                                                         </div>
                                                                                     );
                                                                                 }

                                                                                 const categoryRows = allPropRows.filter(r => r.category === categoryName && r.visible);"""

# 7. Ternary end removal for widget logic rules block
# Let's read the exact block to replace for target 7.
# We want to replace from:
#                                                                  })()}
#                                                              </div>) : (
#                                                              <div className="space-y-6 animate-in fade-in duration-200">
#                                                                  ...
#                                                              </div>
#                                                          )}
#                                                      </div>
# To:
#                                                                  })()}
#                                                      </div>

target7 = """                                                                 })()}
                                                             </div>) : (
                                                             <div className="space-y-6 animate-in fade-in duration-200">
                                                                                                                     <div className="flex items-center justify-between">
                                                         <h3 className="text-sm font-bold flex items-center">
                                                             <Zap className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                                                             Field Logic
                                                         </h3>
                                                     </div>
                                                     <p className="text-[hsl(var(--text-secondary))] text-xs">Define rules for when this field should be visible.</p>

                                                     <div className="space-y-4">
                                                         {logic.filter(r => r.type === 'field_visibility' && r.target_id === selectedField.id).map(rule => (
                                                             <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl space-y-4 relative group">
                                                                 <button
                                                                     onClick={() => removeLogicRule(rule.id)}
                                                                     className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                                 >
                                                                     <Trash2 className="w-3.5 h-3.5" />
                                                                 </button>

                                                                 {/* Timing badge */}
                                                                 <div className="flex items-center justify-between">
                                                                     <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">IF</span>
                                                                     <div className="flex items-center bg-[hsl(var(--surface-elevated))]/40 p-0.5 gap-0.5 rounded-xl">
                                                                         {(['pre', 'post'] as const).map(t => (
                                                                             <button
                                                                                 key={t}
                                                                                 onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                                 className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                     ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20'
                                                                                     : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                     }`}
                                                                             >
                                                                                 {t}
                                                                             </button>
                                                                         ))}
                                                                     </div>
                                                                 </div>

                                                                 <div className="space-y-3">
                                                                     {rule.conditions.map((cond, cIdx) => (
                                                                         <div key={cIdx} className="space-y-2">
                                                                             <select
                                                                                 value={cond.field}
                                                                                 onChange={(e) => {
                                                                                     const newConds = [...rule.conditions];
                                                                                     newConds[cIdx].field = e.target.value;
                                                                                     updateLogicRule(rule.id, { conditions: newConds });
                                                                                 }}
                                                                                 className="input-sm w-full py-1.5"
                                                                             >
                                                                                 <option value="">Select Field...</option>
                                                                                 {sections.flatMap(p => p.fields).filter(f => f.id !== selectedField.id).map(f => (
                                                                                     <option key={f.id} value={f.id}>{f.label}</option>
                                                                                 ))}
                                                                             </select>

                                                                             <div className="flex space-x-2">
                                                                                 <select
                                                                                     value={cond.operator}
                                                                                     onChange={(e) => {
                                                                                         const newConds = [...rule.conditions];
                                                                                         newConds[cIdx].operator = e.target.value as any;
                                                                                         updateLogicRule(rule.id, { conditions: newConds });
                                                                                     }}
                                                                                     className="input-sm w-1/2 py-1.5"
                                                                                 >
                                                                                     <option value="eq">Equals</option>
                                                                                     <option value="neq">Not Equal</option>
                                                                                     <option value="contains">Contains</option>
                                                                                     <option value="gt">Greater Than</option>
                                                                                     <option value="lt">Less Than</option>
                                                                                 </select>
                                                                                 <input
                                                                                     value={cond.value}
                                                                                     onChange={(e) => {
                                                                                         const newConds = [...rule.conditions];
                                                                                         newConds[cIdx].value = e.target.value;
                                                                                         updateLogicRule(rule.id, { conditions: newConds });
                                                                                     }}
                                                                                     placeholder="Value"
                                                                                     className="input-sm w-1/2 py-1.5"
                                                                                 />
                                                                             </div>
                                                                         </div>
                                                                     ))}
                                                                 </div>

                                                                 <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                                     <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">THEN</span>
                                                                     <span>SHOW FIELD</span>
                                                                 </div>
                                                             </div>
                                                         ))}

                                                         <button
                                                             onClick={() => addLogicRule({
                                                                 type: 'field_visibility',
                                                                 timing: 'pre',
                                                                 target_id: selectedField.id,
                                                                 action: 'show',
                                                                 conditions: [{ field: '', operator: 'eq', value: '' }]
                                                             })}
                                                             className="w-full py-3 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                         >
                                                             + Add Visibility Rule
                                                         </button>
                                                     </div>

                                                             </div>
                                                         )}
                                                     </div>"""

replacement7 = """                                                                 })()}
                                                     </div>"""

targets = [
    (target1, replacement1, "Unused propertyTab state"),
    (target2, replacement2, "Section Sub-tab Pill Selector"),
    (target3, replacement3, "Section middle divider"),
    (target4, replacement4, "Section block end"),
    (target5, replacement5, "Widget Pill Selector"),
    (target6, replacement6, "Categories grid update"),
    (target7, replacement7, "Ternary end removal")
]

for t, r, desc in targets:
    if t not in content:
        print(f"FAILED TO FIND TARGET: {desc}")
        # Normalize whitespace and test
        t_normalized = " ".join(t.split())
        content_normalized = " ".join(content.split())
        if t_normalized in content_normalized:
            print("  (But normalized version is in content. Check formatting/newlines)")
        else:
            print("  (Normalized version NOT in content)")
    else:
        content = content.replace(t, r)
        print(f"SUCCESSFULLY REPLACED: {desc}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("File updated successfully.")
