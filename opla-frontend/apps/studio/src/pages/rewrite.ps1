$targetFile = "c:\Users\kings\Dev Projects\opla\opla-frontend\apps\studio\src\pages\ProjectWorkspace.tsx"
$lines = Get-Content -Path $targetFile

$newContent = @"
    return (
        <StudioLayout
            activeNav="projects"
            onSelectNav={handleShellNavSelect}
            counts={{ projects: 0, forms: forms.length, members: members?.length || 0 }}
            contentClassName="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[hsl(var(--background))] md:bg-[#f9fafb] dark:md:bg-[hsl(var(--background))]"
        >
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))]" />
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6 text-[hsl(var(--text-primary))]">
                    <div className="mb-2 flex items-center gap-3 text-[hsl(var(--error))]">
                        <AlertCircle className="h-5 w-5" />
                        <h2 className="text-base font-semibold">Workspace unavailable</h2>
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
                </div>
            ) : currentProject ? (
                <div className="mx-auto max-w-[1600px] space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between px-2">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                    {currentProject.name}
                                </h1>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[currentProject.status] || statusTone.planning}`}>
                                    {currentProject.status}
                                </span>
                            </div>
                            <p className="text-sm text-[hsl(var(--text-secondary))] max-w-2xl">
                                {currentProject.description || 'Manage forms, tasks, reports, and team access.'}
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4">
                            {workspaceStats.map(stat => (
                                <div key={stat.label} className="flex flex-col border-l border-[hsl(var(--border))] pl-4 first:border-l-0 first:pl-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{stat.label}</span>
                                    <span className="text-xl font-semibold text-[hsl(var(--text-primary))]">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2-Column Board */}
                    <div className="grid gap-6 md:grid-cols-2 items-start">
                        
                        {/* COLUMN 1 */}
                        <div className="space-y-6 flex flex-col">
                            
                            {/* FORMS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Forms</h2>
                                        <span className="rounded-full bg-[hsl(var(--background))] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]">{forms.length}</span>
                                    </div>
                                    <button onClick={handleCreateForm} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {forms.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-xl border border-dashed border-[hsl(var(--border))]">No forms yet.</p>
                                    ) : forms.map(form => (
                                        <div key={form.id} className="group relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{form.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">v{form.version} • {new Date(form.updated_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${formStatusTone[form.status] || formStatusTone.draft}`}>
                                                    {form.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type)}>
                                                        {resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <select
                                                        value={getAccessorValue(form.assigned_accessor_id, form.assigned_accessor_type)}
                                                        onChange={(e) => handleFormResponsibilityChange(form, 'assigned', e.target.value)}
                                                        className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-28 truncate"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assignmentOptions.map(opt => <option key={`form-assign-${form.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button onClick={() => navigate(`/simulator/${form.id}`)} className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-md hover:bg-[hsl(var(--primary))]/10">
                                                        <Play className="h-3.5 w-3.5 fill-current" />
                                                    </button>
                                                    <button onClick={() => navigate(`/builder/${form.id}`)} className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-md hover:bg-[hsl(var(--primary))]/10">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* REPORTS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileBarChart2 className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Reports</h2>
                                        <span className="rounded-full bg-[hsl(var(--background))] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]">{reports.length}</span>
                                    </div>
                                    <button onClick={handleCreateReport} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {reports.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-xl border border-dashed border-[hsl(var(--border))]">No reports yet.</p>
                                    ) : reports.map(report => (
                                        <div key={report.id} className="group relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{report.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))] truncate max-w-xs">{report.description || 'No description'}</p>
                                                </div>
                                                <select
                                                    value={report.status}
                                                    onChange={(e) => handleReportUpdate(report.id, { status: e.target.value as ReportArtifact['status'] })}
                                                    className={`shrink-0 appearance-none inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer outline-none border-0 ${reportStatusTone[report.status] || reportStatusTone.draft}`}
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type)}>
                                                        {resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs text-[hsl(var(--text-secondary))] uppercase tracking-widest leading-none font-bold">Owner</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button onClick={() => handleDeleteReport(report.id)} className="p-1 px-2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-xs font-semibold mr-1 rounded bg-[hsl(var(--error))]/5">
                                                        Del
                                                    </button>
                                                    <button onClick={() => navigate(`/projects/${projectId}/reports/${report.id}`)} className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-md hover:bg-[hsl(var(--primary))]/10">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                        </div>

                        {/* COLUMN 2 */}
                        <div className="space-y-6 flex flex-col">
                            
                            {/* TASKS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <SquareCheckBig className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Tasks</h2>
                                        <span className="rounded-full bg-[hsl(var(--background))] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]">{tasks.length}</span>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=tasks')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {tasks.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-xl border border-dashed border-[hsl(var(--border))]">No tasks yet.</p>
                                    ) : tasks.map(task => (
                                        <div key={task.id} className={`group relative rounded-xl border p-3 transition-shadow hover:shadow-md block ${task.status === 'done' ? 'border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 opacity-75' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}>
                                            <div className="flex items-start gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={task.status === 'done'}
                                                    onChange={(e) => handleTaskStatusChange(task.id, e.target.checked ? 'done' : 'todo')}
                                                    className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] cursor-pointer shrink-0" 
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-sm font-semibold leading-tight text-[hsl(var(--text-primary))] ${task.status === 'done' ? 'line-through text-[hsl(var(--text-tertiary))]' : ''}`}>
                                                        {task.title}
                                                    </h3>
                                                    {task.due_at && (
                                                        <p className="mt-1 text-[11px] font-medium text-orange-500/80">
                                                            Due {new Date(task.due_at).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0" title={resolveTaskAssigneeLabel(task)}>
                                                        {resolveTaskAssigneeLabel(task).charAt(0).toUpperCase()}
                                                    </div>
                                                    <select
                                                        value={getTaskAssignmentValue(task)}
                                                        onChange={(e) => handleTaskAssignmentChange(task.id, e.target.value)}
                                                        className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-24 truncate"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assignmentOptions.map(opt => <option key={`task-assign-${task.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                    </select>
                                                </div>
                                                <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 px-2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-xs font-semibold transition-opacity rounded bg-[hsl(var(--error))]/5">
                                                    Del
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* MEMBERS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Members</h2>
                                        <span className="rounded-full bg-[hsl(var(--background))] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]">{accessRules.length}</span>
                                    </div>
                                    <div></div>
                                </div>
                                <div className="p-4 lg:p-5 flex flex-col gap-4">
                                    <form onSubmit={handleGrantAccess} className="flex gap-2">
                                        <select
                                            value={accessorId}
                                            onChange={(e) => setAccessorId(e.target.value)}
                                            className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                        >
                                            <option value="">Add member...</option>
                                            {selectableAccessors.map(opt => <option key={`add-mem-${opt.id}`} value={opt.id}>{opt.label}</option>)}
                                        </select>
                                        <select
                                            value={roleTemplateId}
                                            onChange={(e) => setRoleTemplateId(e.target.value)}
                                            className="w-24 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-2 text-[11px] text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                        >
                                            {roleTemplates.map(rt => <option key={`add-role-${rt.id}`} value={rt.id}>{businessRoleLabelBySlug[rt.slug] || rt.name}</option>)}
                                        </select>
                                        <button type="submit" disabled={!accessorId || !roleTemplateId} className="w-auto flex-none rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[hsl(var(--primary-hover))] shadow-sm">
                                            Add
                                        </button>
                                    </form>
                                    
                                    <div className="space-y-2">
                                        {accessRules.length === 0 ? (
                                            <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-2">No members.</p>
                                        ) : accessRules.map(rule => (
                                            <div key={`member-rule-${rule.id}`} className="group flex items-center justify-between rounded-xl p-2.5 hover:bg-[hsl(var(--background))] transition-colors border border-transparent hover:border-[hsl(var(--border))]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        {resolveRuleLabel(rule).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] leading-tight">{resolveRuleLabel(rule)}</p>
                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-widest mt-0.5">{getBusinessRoleLabel(rule)}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRevokeAccess(rule)} className="opacity-0 group-hover:opacity-100 py-1 px-2.5 rounded bg-[hsl(var(--error))]/5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[11px] font-semibold transition-opacity">
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                        </div>

                    </div>
                </div>
            ) : null}
        </StudioLayout>
    );
"@

# Array index in Powershell starts from 0.
# Lines 1 to 625 correspond to indexes 0 to 624.
# We want to keep lines up to 624 (which is before `return ()`)
$prefix = $lines[0..624]
# We want to stringify them and put them over.
$suffix = $lines[1127..($lines.Length-1)]

$finalContent = ($prefix -join "`r`n") + "`r`n$newContent`r`n" + ($suffix -join "`r`n")
Set-Content -Path $targetFile -Value $finalContent -Encoding UTF8
