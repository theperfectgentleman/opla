import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Database, FileText, FolderOpen, Loader2, Search, Table2 } from 'lucide-react';
import type { AnalyticsSource } from './analytics/types';

type CatalogFormSummary = {
    id: string;
    title: string;
    project_id?: string;
    project_name?: string;
    status?: string;
};

export type DatasetsTabProps = {
    sources: AnalyticsSource[];
    catalogForms: CatalogFormSummary[];
    loading?: boolean;
    error?: string | null;
    projects: Array<{ id: string; name: string }>;
};

const DatasetsTab: React.FC<DatasetsTabProps> = ({
    sources,
    catalogForms,
    loading = false,
    error = null,
    projects,
}) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');

    const filteredSources = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return sources.filter((source) => {
            if (projectFilter !== 'all' && source.project_id !== projectFilter) {
                return false;
            }
            if (!query) {
                return true;
            }
            const haystack = [
                source.form_title,
                source.dataset_name,
                source.project_name,
                source.dataset_slug,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [projectFilter, searchQuery, sources]);

    const filteredCatalogs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return catalogForms.filter((form) => {
            if (projectFilter !== 'all' && form.project_id !== projectFilter) {
                return false;
            }
            if (!query) {
                return true;
            }
            return `${form.title} ${form.project_name || ''}`.toLowerCase().includes(query);
        });
    }, [catalogForms, projectFilter, searchQuery]);

    const totalRecords = filteredSources.reduce((sum, source) => sum + (source.record_count || 0), 0);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-bold mb-2">Datasets</h2>
                    <p className="text-[hsl(var(--text-secondary))] text-sm leading-relaxed">
                        Submission datasets are created automatically when you publish a standard form and collect responses.
                        Use catalogs for reference data (regions, products, districts) that power dropdowns — not custom tables here.
                    </p>
                </div>
                <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))] shrink-0">
                    {filteredSources.length} dataset{filteredSources.length === 1 ? '' : 's'} · {totalRecords.toLocaleString()} records
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-tertiary))]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search forms, projects, datasets..."
                        className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] pl-10 pr-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]/50"
                    />
                </div>
                <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]/50"
                >
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--text-secondary))]">
                    <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" />
                    Loading datasets...
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            ) : (
                <>
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Table2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                Form submission datasets
                            </h3>
                        </div>

                        {filteredSources.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 text-center">
                                <Database className="w-10 h-10 mx-auto text-[hsl(var(--text-tertiary))] mb-3" />
                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">No submission datasets yet</p>
                                <p className="mt-2 text-sm text-[hsl(var(--text-tertiary))] max-w-lg mx-auto">
                                    Publish a standard form and collect submissions. Each published form gets a dataset you can explore in Analysis.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard?tab=forms')}
                                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Go to Forms
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                                <table className="w-full border-collapse text-sm">
                                    <thead className="bg-[hsl(var(--surface-elevated))]/80 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                        <tr className="border-b border-[hsl(var(--border))]/50">
                                            <th className="p-3 text-left">Form</th>
                                            <th className="p-3 text-left">Project</th>
                                            <th className="p-3 text-right">Records</th>
                                            <th className="p-3 text-right">Fields</th>
                                            <th className="p-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[hsl(var(--border))]/40">
                                        {filteredSources.map((source) => (
                                            <tr key={source.dataset_id} className="hover:bg-[hsl(var(--surface-elevated))]/30">
                                                <td className="p-3">
                                                    <div className="font-semibold text-[hsl(var(--text-primary))]">{source.form_title}</div>
                                                    <div className="text-[11px] font-mono text-[hsl(var(--text-tertiary))]">{source.dataset_slug}</div>
                                                </td>
                                                <td className="p-3 text-[hsl(var(--text-secondary))]">{source.project_name || '—'}</td>
                                                <td className="p-3 text-right font-mono text-[hsl(var(--text-primary))]">
                                                    {(source.record_count || 0).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right text-[hsl(var(--text-secondary))]">
                                                    {source.fields?.length || 0}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {source.project_id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/projects/${source.project_id}`)}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))]/60 px-2 py-1 text-[11px] font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))]"
                                                                title="Open project"
                                                            >
                                                                <FolderOpen className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/dashboard?tab=analysis&tool=lab')}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20"
                                                        >
                                                            <BarChart3 className="w-3.5 h-3.5" />
                                                            Analyze
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-amber-600" />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                    Reference catalogs
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard?tab=forms')}
                                className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                            >
                                Manage catalogs in Forms
                            </button>
                        </div>
                        <p className="text-xs text-[hsl(var(--text-tertiary))] max-w-3xl">
                            Catalogs replace the old idea of custom data tables. Build a catalog form, publish it, then add records in the project Catalog tab.
                            Survey dropdowns can source options from catalogs (including cascading region → district).
                        </p>

                        {filteredCatalogs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-amber-500/25 bg-amber-500/5 p-6 text-center">
                                <p className="text-sm text-[hsl(var(--text-secondary))]">No published catalogs in this filter.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {filteredCatalogs.map((catalog) => (
                                    <div
                                        key={catalog.id}
                                        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h4 className="text-sm font-semibold text-[hsl(var(--text-primary))]">{catalog.title}</h4>
                                                <p className="text-[11px] text-[hsl(var(--text-tertiary))] mt-0.5">{catalog.project_name || 'Project'}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                catalog.status === 'live'
                                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                    : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]/40'
                                            }`}>
                                                {catalog.status || 'draft'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => catalog.project_id && navigate(`/projects/${catalog.project_id}?tab=catalog`)}
                                            disabled={!catalog.project_id}
                                            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-40"
                                        >
                                            Open catalog data
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default DatasetsTab;
