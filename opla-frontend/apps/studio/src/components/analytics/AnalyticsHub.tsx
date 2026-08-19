import type { ReactNode } from 'react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Loader2, Map, PanelsTopLeft, Table2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { analyticsAPI } from '../../lib/api';
import type { AnalyticsSource } from './types';
import {
  AnalyticsHubSkeleton,
  AnalyticsPageHeader,
  AnalyticsPanelSkeleton,
  analyticsGhostButtonClass,
  analyticsInsetClass,
  analyticsPanelClass,
} from './ui';

const WalkerAnalysisLab = lazy(() => import('./WalkerAnalysisLab'));
const PrepTable = lazy(() => import('./PrepTable'));
const DashboardCanvas = lazy(() => import('./DashboardCanvas'));
const AnalysisMap = lazy(() => import('./AnalysisMap'));

export type AnalyticsToolKey = 'lab' | 'prep' | 'dashboard' | 'spatial';

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

type AnalyticsToolCard = {
  key: AnalyticsToolKey;
  label: string;
  icon: ReactNode;
  description: string;
};

const toolCards: AnalyticsToolCard[] = [
  {
    key: 'prep',
    label: 'Table',
    icon: <Table2 className="h-5 w-5" />,
    description: 'Sort, filter, and add calculated columns.',
  },
  {
    key: 'lab',
    label: 'Chart',
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'Summarize on the server and save a question.',
  },
  {
    key: 'spatial',
    label: 'Map',
    icon: <Map className="h-5 w-5" />,
    description: 'Plot live GPS capture on this project.',
  },
  {
    key: 'dashboard',
    label: 'Boards',
    icon: <PanelsTopLeft className="h-5 w-5" />,
    description: 'Place saved questions on an Analysis board.',
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

export default function AnalyticsHub({ orgId, projectId, forms = [], activeTool = 'prep' }: AnalyticsHubProps) {
  const navigate = useNavigate();
  const [sources, setSources] = useState<AnalyticsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedTool = useMemo(
    () => toolCards.find((tool) => tool.key === activeTool) ?? toolCards[0],
    [activeTool],
  );

  const reloadSources = async () => {
    const response = await analyticsAPI.listSources(orgId, projectId);
    setSources(response);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSources = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await analyticsAPI.listSources(orgId, projectId);
        if (!cancelled) setSources(response);
      } catch (loadError: unknown) {
        if (!cancelled) {
          const err = loadError as { response?: { data?: { detail?: string } }; message?: string };
          setError(err.response?.data?.detail || err.message || 'Could not load analytics datasets.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [orgId, projectId]);

  const workspace = useMemo(() => {
    if (loading) return <AnalyticsHubSkeleton />;

    if (error) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      );
    }

    if (sources.length === 0) {
      const unpublishedForms = forms.filter((form) => !form.published_version);

      return (
        <div className={analyticsPanelClass}>
          <AnalyticsPageHeader
            eyebrow="Analysis"
            title="No datasets yet"
            description="Publish a form with submissions, then open Table, Chart, or Map from here."
            actions={
              <button type="button" onClick={() => navigate('/dashboard?tab=design')} className={analyticsGhostButtonClass}>
                Go to forms
              </button>
            }
          />

          <div className={`${analyticsInsetClass} mt-4 p-4`}>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Analysis reads published form datasets. This project has {forms.length} form
              {forms.length === 1 ? '' : 's'} and 0 queryable datasets.
            </p>

            {unpublishedForms.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Publish one of these forms
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {unpublishedForms.slice(0, 6).map((form) => (
                    <button
                      key={form.id}
                      type="button"
                      onClick={() => navigate(`/forms/${form.id}`)}
                      className="rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
                    >
                      <span className="block text-sm font-semibold text-slate-800">{form.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Draft version {form.version ?? 0} · Not published
                      </span>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        Open builder
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500">
                Create or reopen a form from Design, then publish it.
              </div>
            )}
          </div>
        </div>
      );
    }

    const toolProps = { orgId, projectId, sources, onSourcesChanged: reloadSources };

    if (activeTool === 'dashboard') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="boards" />}>
          <DashboardCanvas {...toolProps} />
        </Suspense>
      );
    }

    if (activeTool === 'prep') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="table" />}>
          <PrepTable {...toolProps} />
        </Suspense>
      );
    }

    if (activeTool === 'spatial') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="map" />}>
          <AnalysisMap {...toolProps} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<ToolWorkspaceFallback label="chart" />}>
        <WalkerAnalysisLab {...toolProps} />
      </Suspense>
    );
  }, [activeTool, error, forms, loading, navigate, orgId, projectId, sources]);

  return (
    <div className="space-y-3" data-org={orgId} data-project={projectId}>
      {activeTool === 'lab' || activeTool === 'prep' || activeTool === 'spatial' ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-800">{selectedTool.label}</h2>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            {sources.length} datasets
          </span>
        </div>
      )}

      {workspace}
    </div>
  );
}
