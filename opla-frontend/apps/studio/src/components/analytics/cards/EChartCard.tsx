import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { SavedQuestion } from '../types';

interface EChartCardProps {
	question: SavedQuestion;
	data: { category: string; metric: number }[];
	theme?: 'light' | 'dark';
	onChartClick?: (params: any) => void;
}

export default function EChartCard({ question, data, theme = 'light', onChartClick }: EChartCardProps) {
	const option = useMemo(() => {
		const chartType = (question.viz_config?.chart_type as string) || 'bar';
		
		// Sleek HSL-based palette
		const colors = [
			'hsl(177, 81%, 30%)', // teal
			'hsl(340, 82%, 52%)', // pink-red
			'hsl(43, 100%, 70%)', // yellow
			'hsl(199, 89%, 48%)', // blue
			'hsl(250, 60%, 60%)', // purple
		];

		const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
		const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';

		const baseOption = {
			color: colors,
			backgroundColor: 'transparent',
			tooltip: {
				trigger: 'axis',
				backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
				borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
				textStyle: { color: theme === 'dark' ? '#f8fafc' : '#0f172a' },
				backdropFilter: 'blur(4px)',
			},
			grid: { left: 40, right: 24, top: 40, bottom: 40 },
		};

		if (chartType === 'pie') {
			return {
				...baseOption,
				tooltip: { trigger: 'item' },
				legend: { bottom: 0, textStyle: { color: textColor } },
				series: [
					{
						type: 'pie',
						radius: ['40%', '75%'],
						itemStyle: {
							borderRadius: 8,
							borderColor: theme === 'dark' ? '#0f172a' : '#ffffff',
							borderWidth: 2,
						},
						data: data.map(d => ({ name: d.category, value: d.metric })),
					},
				],
			};
		}

		return {
			...baseOption,
			xAxis: {
				type: 'category',
				data: data.map(d => d.category),
				axisLine: { lineStyle: { color: gridColor } },
				axisLabel: { color: textColor, rotate: data.length > 6 ? 30 : 0 },
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisLabel: { color: textColor },
				splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
			},
			series: [
				{
					type: chartType,
					smooth: chartType === 'line',
					data: data.map(d => d.metric),
					itemStyle: {
						borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : 0,
					},
					areaStyle: chartType === 'line' ? {
						opacity: 0.1,
						color: {
							type: 'linear',
							x: 0, y: 0, x2: 0, y2: 1,
							colorStops: [
								{ offset: 0, color: colors[0] },
								{ offset: 1, color: 'rgba(255,255,255,0)' }
							]
						}
					} : undefined,
				},
			],
		};
	}, [question, data, theme]);

	const onEvents = useMemo(() => {
		const evts: Record<string, Function> = {};
		if (onChartClick) {
			evts.click = onChartClick;
		}
		return evts;
	}, [onChartClick]);

	return <ReactECharts option={option} onEvents={onEvents} style={{ height: '100%', width: '100%', minHeight: 280 }} />;
}
