import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { analyticsAPI } from '../../lib/api';
import type { QueryResult, SavedQuestion } from '../analytics/types';
import KPICard from '../analytics/cards/KPICard';
import GoalCard from '../analytics/cards/GoalCard';
import EChartCard from '../analytics/cards/EChartCard';

function extractChartData(question: SavedQuestion, result: QueryResult) {
    const cfg = question.query_config as Record<string, any> | undefined;
    const groupField = cfg?.group_by?.[0];
    const aggField = cfg?.aggregates?.[0];
    if (!result.rows.length) return [];
    const key = typeof groupField === 'object' ? groupField.field : groupField || result.columns[0]?.key;
    const valKey = aggField?.alias || result.columns.find((c) => c.type === 'number')?.key || result.columns[1]?.key;
    return result.rows.map((r) => ({ category: String(r[key] || ''), metric: Number(r[valKey]) || 0 }));
}

function extractKPIValue(question: SavedQuestion, result: QueryResult): number {
    const cfg = question.query_config as Record<string, any> | undefined;
    const aggField = cfg?.aggregates?.[0];
    const valKey = aggField?.alias || result.columns[0]?.key;
    return result.rows.length > 0 ? Number(result.rows[0]?.[valKey]) || 0 : 0;
}

type PinnedAnalyticsCardProps = {
    orgId: string;
    question: SavedQuestion;
};

export default function PinnedAnalyticsCard({ orgId, question }: PinnedAnalyticsCardProps) {
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<QueryResult | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (question.viz_type === 'markdown' || question.viz_type === 'walker') {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const cfg = (question.query_config as Record<string, any>) || {};
                const src = (question.source_config as Record<string, any>) || {};
                const data = await analyticsAPI.runQuery(orgId, {
                    dataset_id: src.dataset_id,
                    select_fields: cfg.select_fields,
                    filters: cfg.filters,
                    group_by: cfg.group_by,
                    aggregates: cfg.aggregates,
                    order_by: cfg.order_by,
                    limit: cfg.limit || 500,
                });
                if (!cancelled) setResult(data);
            } catch {
                if (!cancelled) setResult(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [orgId, question]);

    if (loading) {
        return (
            <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--text-tertiary))]" />
            </div>
        );
    }

    if (question.viz_type === 'kpi') {
        return <KPICard question={question} currentValue={result ? extractKPIValue(question, result) : 0} />;
    }
    if (question.viz_type === 'goal') {
        return (
            <GoalCard
                question={question}
                currentValue={result ? extractKPIValue(question, result) : 0}
                targetValue={(question.viz_config as any)?.target || 1000}
            />
        );
    }
    if (question.viz_type === 'chart' || question.viz_type === 'table') {
        return <EChartCard question={question} data={result ? extractChartData(question, result) : []} />;
    }

    return (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 text-sm text-[hsl(var(--text-secondary))]">
            {question.title} cannot be rendered on Overview yet.
        </div>
    );
}
