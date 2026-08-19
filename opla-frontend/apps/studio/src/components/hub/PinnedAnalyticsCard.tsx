import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { analyticsAPI } from '../../lib/api';
import type { QueryResult, SavedQuestion } from '../analytics/types';
import { extractChartData, extractKPIValue, queryPayloadFromQuestion } from '../analytics/queryUtils';
import KPICard from '../analytics/cards/KPICard';
import EChartCard from '../analytics/cards/EChartCard';

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
            setLoading(true);
            try {
                const payload = queryPayloadFromQuestion(question);
                if (!payload) {
                    if (!cancelled) setResult(null);
                    return;
                }
                const data = await analyticsAPI.runQuery(orgId, payload);
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
    if (question.viz_type === 'chart' || question.viz_type === 'table') {
        return <EChartCard question={question} data={result ? extractChartData(question, result) : []} />;
    }

    return (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 text-sm text-[hsl(var(--text-secondary))]">
            {question.title} cannot be rendered on Overview yet.
        </div>
    );
}
