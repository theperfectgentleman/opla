import type { ReactNode } from 'react';
import { Suspense, lazy, useEffect, useMemo, useState, useRef } from 'react';
import { ArrowRight, BarChart3, FileSpreadsheet, FlaskConical, LayoutDashboard, Loader2, PanelsTopLeft, Table2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { analyticsAPI } from '../../lib/api';
import type { AnalyticsSource } from './types';
import { AnalyticsHubSkeleton, AnalyticsPageHeader, AnalyticsPanelSkeleton, analyticsGhostButtonClass, analyticsInsetClass, analyticsPanelClass } from './ui';

const DataExplorer = lazy(() => import('./DataExplorer'));
const ChartBuilder = lazy(() => import('./ChartBuilder'));
const AnalyticsSpreadsheet = lazy(() => import('./AnalyticsSpreadsheet'));
const AnalyticsPivot = lazy(() => import('./AnalyticsPivot'));
const DashboardCanvas = lazy(() => import('./DashboardCanvas'));
const VisualQueryBuilder = lazy(() => import('./VisualQueryBuilder'));

type AnalyticsHubForm = {
  id: string;
  title: string;
  project_id?: string;
  version?: number;
  published_version?: number | null;
};

interface AnalyticsHubProps {
  orgId: string;
  projectId?: string;
  forms?: AnalyticsHubForm[];
  activeTool?: AnalyticsToolKey;
}

type AnalyticsToolKey = 'lab' | 'explorer' | 'chart' | 'spreadsheet' | 'pivot' | 'dashboard';

type AnalyticsToolCard = {
  key: AnalyticsToolKey;
  label: string;
  icon: ReactNode;
  color: string;
  accent: string;
  description: string;
  bullets: string[];
};

const toolCards: AnalyticsToolCard[] = [
  {
    key: 'lab',
    label: 'Analysis Lab',
    icon: <FlaskConical className="h-7 w-7" />,
    color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    accent: 'text-emerald-700 dark:text-emerald-300',
    description: 'Analyze one published dataset in Graphic Walker through the first user-facing Opla analysis flow.',
    bullets: ['Single-form analysis', 'Local capped row loading', 'Phase 1 analysis workflow'],
  },
  {
    key: 'explorer',
    label: 'Data Explorer',
    icon: <Table2 className="h-7 w-7" />,
    color: 'from-sky-500/20 to-sky-500/5 border-sky-500/30',
    accent: 'text-sky-700 dark:text-sky-300',
    description: 'Inspect raw submission rows, choose a dataset, and prepare ad hoc tables.',
    bullets: ['Dataset field browsing', 'Tabular query results', 'Saved question workflow is being restored'],
  },
  {
    key: 'chart',
    label: 'Chart Builder',
    icon: <BarChart3 className="h-7 w-7" />,
    color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    accent: 'text-emerald-700 dark:text-emerald-300',
    description: 'Configure grouped metrics and preview chart-oriented summaries.',
    bullets: ['Dimension and metric mapping', 'Aggregation setup', 'Chart rendering slice needs to be reconnected'],
  },
  {
    key: 'spreadsheet',
    label: 'Spreadsheet',
    icon: <FileSpreadsheet className="h-7 w-7" />,
    color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    accent: 'text-violet-700 dark:text-violet-300',
    description: 'Open analytics results in a spreadsheet-style surface for review and cleanup.',
    bullets: ['Syncfusion spreadsheet surface', 'Result export and manipulation', 'Spreadsheet module content needs restoring'],
  },
  {
    key: 'dashboard',
    label: 'Dashboards',
    icon: <PanelsTopLeft className="h-7 w-7" />,
    color: 'from-slate-200 to-slate-50 border-slate-300',
    accent: 'text-slate-700',
    description: 'Review saved dashboards and reusable questions already persisted for this workspace.',
    bullets: ['Saved dashboard inventory', 'Question reuse visibility', 'Compact read-only analytics catalog'],
  },
  {
    key: 'pivot',
    label: 'Pivot Table',
    icon: <LayoutDashboard className="h-7 w-7" />,
    color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    accent: 'text-amber-700 dark:text-amber-300',
    description: 'Slice dataset rows into cross-tab summaries with row, column, and value fields.',
    bullets: ['Pivot summarization flow', 'Aggregation controls', 'Syncfusion pivot module content needs restoring'],
  },
];

function ToolWorkspaceFallback({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
        Loading {label.toLowerCase()}...
      </div>
      <AnalyticsPanelSkeleton withSidebar rows={5} />
    </div>
  );
}

export default function AnalyticsHub({ orgId, projectId, forms = [], activeTool = 'lab' }: AnalyticsHubProps) {
  const navigate = useNavigate();
  const [sources, setSources] = useState<AnalyticsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Use standard fetch to bypass json serialization
      const token = localStorage.getItem('opla_auth_token') || '';
      const res = await fetch(`http://localhost:8000/api/v1/organizations/${orgId}/analytics/upload-csv?project_id=${projectId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      // Reload sources
      const response = await analyticsAPI.listSources(orgId);
      setSources(response);
    } catch (err: any) {
      setError(err.message || 'Could not upload CSV.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedTool = useMemo(
    () => toolCards.find(tool => tool.key === activeTool) ?? toolCards[0],
    [activeTool],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSources = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await analyticsAPI.listSources(orgId);
        if (!cancelled) {
          setSources(response);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.response?.data?.detail || loadError?.message || 'Could not load analytics datasets.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const workspace = useMemo(() => {
    if (loading) {
      return <AnalyticsHubSkeleton />;
    }

    if (error) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      );
    }

    if (sources.length === 0) {
      const unpublishedForms = forms.filter(form => !form.published_version);

      return (
        <div className={analyticsPanelClass}>
          <AnalyticsPageHeader
            eyebrow="Analytics Setup"
            title="No Published Datasets Yet"
            description="Publish at least one form to generate a dataset that the analytics workbenches can query."
            actions={
              <>
                <button type="button" onClick={() => navigate('/dashboard?tab=forms')} className={analyticsGhostButtonClass}>Go To Forms</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className={analyticsGhostButtonClass} disabled={uploading || !projectId}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload CSV
                </button>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
              </>
            }
          />

          <div className={`${analyticsInsetClass} mt-4 p-4`}>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Analytics reads from published form datasets. This organization currently has {forms.length} form{forms.length === 1 ? '' : 's'} and 0 published datasets,
              so the workbenches cannot query anything yet.
            </p>

            {unpublishedForms.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Publish one of these forms to unlock analytics</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {unpublishedForms.slice(0, 6).map(form => (
                    <button
                      key={form.id}
                      type="button"
                      onClick={() => navigate(`/builder/${form.id}`)}
                      className="rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
                    >
                      <span className="block text-sm font-semibold text-slate-800">{form.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">Draft version {form.version ?? 0} • Not yet published</span>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        Open Builder
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500">
                No forms are available to publish from this view. Create or reopen a form from the Forms tab, then publish it.
              </div>
            )}
          </div>
        </div>
      );
    }

    const toolProps = { orgId, projectId, sources };
    switch (activeTool) {
    case 'lab':
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="visual query builder" />}>
          <VisualQueryBuilder {...toolProps} />
        </Suspense>
      );
      case 'dashboard':
        return (
          <Suspense fallback={<ToolWorkspaceFallback label="dashboards" />}>
            <DashboardCanvas {...toolProps} />
          </Suspense>
        );
      case 'chart':
        return (
          <Suspense fallback={<ToolWorkspaceFallback label="chart builder" />}>
            <ChartBuilder {...toolProps} />
          </Suspense>
        );
      case 'spreadsheet':
        return (
          <Suspense fallback={<ToolWorkspaceFallback label="spreadsheet" />}>
            <AnalyticsSpreadsheet {...toolProps} />
          </Suspense>
        );
      case 'pivot':
        return (
          <Suspense fallback={<ToolWorkspaceFallback label="pivot table" />}>
            <AnalyticsPivot {...toolProps} />
          </Suspense>
        );
      case 'explorer':
      default:
        return (
          <Suspense fallback={<ToolWorkspaceFallback label="data explorer" />}>
            <DataExplorer {...toolProps} />
          </Suspense>
        );
    }
  }, [activeTool, error, forms, loading, navigate, orgId, projectId, sources]);

  return (
    <div className="space-y-4" data-org={orgId} data-project={projectId}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Insights Workspace</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{selectedTool.label}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{selectedTool.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
            disabled={uploading || !projectId}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
            Upload CSV
          </button>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            Org {orgId.slice(0, 8)}{projectId ? ` • Project ${projectId.slice(0, 8)}` : ''}
          </span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            {selectedTool.label}
          </span>
        </div>
      </div>

      {workspace}
    </div>
  );
}
