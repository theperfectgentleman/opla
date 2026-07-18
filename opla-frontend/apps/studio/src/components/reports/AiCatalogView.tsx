import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { AiCatalogNode } from './reportBlocks';

type AiCatalogViewProps = {
    nodes: AiCatalogNode[];
};

const CatalogChart: React.FC<{
    title: string;
    chartType: 'bar' | 'line';
    categories: string[];
    values: number[];
}> = ({ title, chartType, categories, values }) => {
    const option = useMemo(
        () => ({
            color: ['hsl(177, 81%, 30%)'],
            backgroundColor: 'transparent',
            title: {
                text: title,
                left: 0,
                textStyle: { fontSize: 12, fontWeight: 600, color: '#475569' },
            },
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 16, top: 40, bottom: 32 },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { fontSize: 10, color: '#64748b' },
            },
            yAxis: {
                type: 'value',
                axisLabel: { fontSize: 10, color: '#64748b' },
                splitLine: { lineStyle: { color: '#e2e8f0' } },
            },
            series: [
                {
                    type: chartType,
                    data: values,
                    smooth: chartType === 'line',
                    itemStyle: { borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : undefined },
                },
            ],
        }),
        [categories, chartType, title, values],
    );

    return (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2">
            <ReactECharts option={option} style={{ height: 200, width: '100%' }} opts={{ renderer: 'canvas' }} />
        </div>
    );
};

const AiCatalogView: React.FC<AiCatalogViewProps> = ({ nodes }) => {
    if (nodes.length === 0) {
        return (
            <p className="text-sm text-[hsl(var(--text-tertiary))]">
                No generated output yet. Add a prompt and linked sections, then generate.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {nodes.map((node, index) => {
                const key = `${node.type}-${index}`;
                switch (node.type) {
                    case 'Metric':
                        return (
                            <div
                                key={key}
                                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3"
                            >
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                    {node.label}
                                </p>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-2xl font-semibold text-[hsl(var(--text-primary))]">
                                        {node.value}
                                    </span>
                                    {node.change ? (
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                            {node.change}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    case 'Callout':
                        return (
                            <div
                                key={key}
                                className="rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3"
                            >
                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{node.title}</p>
                                <p className="mt-1 text-sm leading-6 text-[hsl(var(--text-secondary))]">{node.body}</p>
                            </div>
                        );
                    case 'Narrative':
                        return (
                            <div
                                key={key}
                                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm leading-7 text-[hsl(var(--text-secondary))] whitespace-pre-wrap"
                            >
                                {node.text}
                            </div>
                        );
                    case 'Table':
                        return (
                            <div
                                key={key}
                                className="overflow-x-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                            >
                                <table className="min-w-full text-left text-xs">
                                    <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                                        <tr>
                                            {node.columns.map((col) => (
                                                <th
                                                    key={col}
                                                    className="px-3 py-2 font-semibold text-[hsl(var(--text-secondary))]"
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {node.rows.map((row, rowIndex) => (
                                            <tr
                                                key={rowIndex}
                                                className="border-b border-[hsl(var(--border))]/60 last:border-0"
                                            >
                                                {row.map((cell, cellIndex) => (
                                                    <td
                                                        key={cellIndex}
                                                        className="px-3 py-2 text-[hsl(var(--text-primary))]"
                                                    >
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    case 'Chart':
                        return (
                            <CatalogChart
                                key={key}
                                title={node.title}
                                chartType={node.chartType}
                                categories={node.categories}
                                values={node.values}
                            />
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
};

export default AiCatalogView;
