import type { ReactNode } from 'react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, FileSpreadsheet, LayoutDashboard, Loader2, PanelsTopLeft, Table2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { analyticsAPI } from '../../lib/api';
import type { AnalyticsSource } from './types';
import { AnalyticsHubSkeleton, AnalyticsPageHeader, AnalyticsPanelSkeleton, analyticsGhostButtonClass, analyticsInsetClass, analyticsPanelClass } from './ui';

const DataExplorer = lazy(() => import('./DataExplorer'));
const ChartBuilder = lazy(() => import('./ChartBuilder'));
const AnalyticsSpreadsheet = lazy(() => import('./AnalyticsSpreadsheet'));
const AnalyticsPivot = lazy(() => import('./AnalyticsPivot'));
const DashboardCanvas = lazy(() => import('./DashboardCanvas'));

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
}

type AnalyticsToolKey = 'explorer' | 'chart' | 'spreadsheet' | 'pivot' | 'dashboard';

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

export default function AnalyticsHub({ orgId, projectId, forms = [] }: AnalyticsHubProps) {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<AnalyticsToolKey>('explorer');
  const [sources, setSources] = useState<AnalyticsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <button type="button" onClick={() => navigate('/dashboard?tab=projects')} className={analyticsGhostButtonClass}>Go To Projects</button>
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
      <div className="border-b border-slate-200 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Insights Workspace</p>
        <h2 className="mt-1 text-xl font-bold text-slate-800">Analytics Hub</h2>
        <p className="mt-1 text-sm text-slate-500">
          Run exploratory analytics across submissions, teams, and time windows before turning findings into reports.
          (Module currently under construction as per Phase C of Analytics Module Dev Guide)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {toolCards.map(tool => (
          <button
            key={tool.key}
            type="button"
            onClick={() => setActiveTool(tool.key)}
            className={`flex min-h-[136px] flex-col items-start rounded-lg border p-4 text-left transition hover:bg-slate-50 ${tool.color} ${activeTool === tool.key ? 'border-l-2 border-l-emerald-700 bg-emerald-50 ring-1 ring-emerald-100' : 'bg-white'}`}
            aria-pressed={activeTool === tool.key}
          >
            <div className={`mb-3 ${tool.accent}`}>{tool.icon}</div>
            <h3 className="text-base font-bold text-slate-800">{tool.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{tool.description}</p>
            <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              Open
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Active Workspace</p>
          <h3 className="mt-1 text-xl font-bold text-slate-800">{selectedTool.label}</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{selectedTool.description}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Org {orgId.slice(0, 8)}{projectId ? ` • Project ${projectId.slice(0, 8)}` : ''}
        </div>
      </div>

      {workspace}
    </div>
  );
}
