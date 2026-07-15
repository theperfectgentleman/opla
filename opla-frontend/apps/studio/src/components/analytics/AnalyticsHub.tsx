import type { ReactNode } from 'react';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FlaskConical, Loader2, Map, PanelsTopLeft, Table2, UploadCloud } from 'lucide-react';
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
const SpatialAnalysisLab = lazy(() => import('./SpatialAnalysisLab'));

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
    key: 'lab',
    label: 'Analysis Lab',
    icon: <FlaskConical className="h-5 w-5" />,
    description: 'Explore with Graphic Walker.',
  },
  {
    key: 'prep',
    label: 'Data Prep',
    icon: <Table2 className="h-5 w-5" />,
    description: 'Transform rows with Excel-like formulas, then open in Lab.',
  },
  {
    key: 'dashboard',
    label: 'Dashboards',
    icon: <PanelsTopLeft className="h-5 w-5" />,
    description: 'Organize saved questions into dashboards.',
  },
  {
    key: 'spatial',
    label: 'Map Analysis',
    icon: <Map className="h-5 w-5" />,
    description: 'Ask geographic questions and see answers on a map.',
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

  const selectedTool = useMemo(
    () => toolCards.find(tool => tool.key === activeTool) ?? toolCards[0],
    [activeTool],
  );

  const reloadSources = async () => {
    const response = await analyticsAPI.listSources(orgId);
    setSources(response);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem('opla_auth_token') || '';
      const res = await fetch(
        `http://localhost:8000/api/v1/organizations/${orgId}/analytics/upload-csv?project_id=${projectId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: (() => {
            const formData = new FormData();
            formData.append('file', file);
            return formData;
          })(),
        },
      );
      if (!res.ok) throw new Error('Upload failed');
      await reloadSources();
    } catch (err: any) {
      setError(err.message || 'Could not upload CSV.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSources = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await analyticsAPI.listSources(orgId);
        if (!cancelled) setSources(response);
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.response?.data?.detail || loadError?.message || 'Could not load analytics datasets.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const workspace = useMemo(() => {
    // Map Analysis is a demo surface with its own sample data — available without datasets.
    if (activeTool === 'spatial') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="map analysis" />}>
          <SpatialAnalysisLab />
        </Suspense>
      );
    }

    if (loading) return <AnalyticsHubSkeleton />;

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
            eyebrow="Analytics"
            title="No datasets yet"
            description="Publish a form or upload a CSV to create a dataset for Analysis Lab."
            actions={
              <>
                <button type="button" onClick={() => navigate('/dashboard?tab=design')} className={analyticsGhostButtonClass}>
                  Go to forms
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={analyticsGhostButtonClass}
                  disabled={uploading || !projectId}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload CSV
                </button>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
              </>
            }
          />

          <div className={`${analyticsInsetClass} mt-4 p-4`}>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Analytics reads published form datasets. This organization has {forms.length} form
              {forms.length === 1 ? '' : 's'} and 0 queryable datasets.
            </p>

            {unpublishedForms.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Publish one of these forms
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {unpublishedForms.slice(0, 6).map(form => (
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
                Create or reopen a form from the Forms tab, then publish it.
              </div>
            )}
          </div>
        </div>
      );
    }

    const toolProps = { orgId, projectId, sources, onSourcesChanged: reloadSources };

    if (activeTool === 'dashboard') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="dashboards" />}>
          <DashboardCanvas {...toolProps} />
        </Suspense>
      );
    }

    if (activeTool === 'prep') {
      return (
        <Suspense fallback={<ToolWorkspaceFallback label="data prep" />}>
          <PrepTable {...toolProps} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<ToolWorkspaceFallback label="analysis lab" />}>
        <WalkerAnalysisLab {...toolProps} />
      </Suspense>
    );
  }, [activeTool, error, forms, loading, navigate, orgId, projectId, sources, uploading]);

  return (
    <div
      className={activeTool === 'spatial' ? '' : 'space-y-3'}
      data-org={orgId}
      data-project={projectId}
    >
      {activeTool === 'spatial' ? null : activeTool === 'lab' || activeTool === 'prep' ? (
        <div className="flex items-center justify-end gap-2">
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={uploading || !projectId}
            title={!projectId ? 'Open a project to upload CSV' : 'Upload CSV'}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            CSV
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-800">{selectedTool.label}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              disabled={uploading || !projectId}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              Upload CSV
            </button>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {sources.length} datasets
            </span>
          </div>
        </div>
      )}

      {workspace}
    </div>
  );
}
