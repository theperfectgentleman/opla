/** Shared typed block model for the report canvas. */

export type AiCatalogNode =
    | { type: 'Metric'; label: string; value: string; change?: string }
    | { type: 'Callout'; title: string; body: string }
    | { type: 'Narrative'; text: string }
    | { type: 'Table'; columns: string[]; rows: string[][] }
    | {
          type: 'Chart';
          title: string;
          chartType: 'bar' | 'line';
          categories: string[];
          values: number[];
      };

export type AiBlockStatus = 'idle' | 'generating' | 'ready' | 'error';

export type ReportBlock =
    | { id: string; type: 'narrative'; label: string; content: string }
    | { id: string; type: 'callout'; label: string; content: string }
    | {
          id: string;
          type: 'artifact';
          label: string;
          content: string;
          reference?: string;
      }
    | {
          id: string;
          type: 'data';
          label: string;
          questionId: string;
          projectId?: string;
      }
    | {
          id: string;
          type: 'ai';
          label: string;
          prompt: string;
          inputBlockIds: string[];
          output: AiCatalogNode[] | null;
          status: AiBlockStatus;
      }
    | {
          id: string;
          type: 'media';
          label: string;
          url: string;
          caption?: string;
      };

/** @deprecated Prefer ReportBlock — kept for ReportDetail imports. */
export type ReportCanvasBlock = ReportBlock;

export type AddableBlockType = 'narrative' | 'callout' | 'data' | 'ai' | 'media';

export const makeBlockId = () => `block-${Math.random().toString(36).slice(2, 10)}`;

export function createDefaultBlocks(reportTitle: string): ReportBlock[] {
    return [
        {
            id: 'summary',
            type: 'narrative',
            label: 'Executive Summary',
            content: `Use this opening section to explain what ${reportTitle || 'this report'} is answering, why it matters, and what action a reader should take next.`,
        },
        {
            id: 'signal',
            type: 'callout',
            label: 'Key Signal',
            content: 'Call out the one trend, risk, or field observation the reader should not miss.',
        },
        {
            id: 'live-data',
            type: 'data',
            label: 'Live data',
            questionId: '',
        },
        {
            id: 'ai-panel',
            type: 'ai',
            label: 'AI briefing',
            prompt: 'Turn the sections above into a short board update for seniors.',
            inputBlockIds: ['summary', 'signal', 'live-data'],
            output: null,
            status: 'idle',
        },
    ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function normalizeAiOutput(raw: unknown): AiCatalogNode[] | null {
    if (!Array.isArray(raw)) return null;
    const nodes: AiCatalogNode[] = [];
    for (const item of raw) {
        if (!isRecord(item) || typeof item.type !== 'string') continue;
        switch (item.type) {
            case 'Metric':
                nodes.push({
                    type: 'Metric',
                    label: asString(item.label, 'Metric'),
                    value: asString(item.value, '—'),
                    change: typeof item.change === 'string' ? item.change : undefined,
                });
                break;
            case 'Callout':
                nodes.push({
                    type: 'Callout',
                    title: asString(item.title, 'Insight'),
                    body: asString(item.body),
                });
                break;
            case 'Narrative':
                nodes.push({ type: 'Narrative', text: asString(item.text) });
                break;
            case 'Table':
                nodes.push({
                    type: 'Table',
                    columns: Array.isArray(item.columns)
                        ? item.columns.map((c) => String(c))
                        : [],
                    rows: Array.isArray(item.rows)
                        ? item.rows.map((row) =>
                              Array.isArray(row) ? row.map((cell) => String(cell)) : [],
                          )
                        : [],
                });
                break;
            case 'Chart':
                nodes.push({
                    type: 'Chart',
                    title: asString(item.title, 'Chart'),
                    chartType: item.chartType === 'line' ? 'line' : 'bar',
                    categories: Array.isArray(item.categories)
                        ? item.categories.map((c) => String(c))
                        : [],
                    values: Array.isArray(item.values)
                        ? item.values.map((v) => Number(v) || 0)
                        : [],
                });
                break;
            default:
                break;
        }
    }
    return nodes.length > 0 ? nodes : null;
}

/** Map legacy / loose JSONB payloads into typed ReportBlock[]. */
export function normalizeBlocks(raw: unknown): ReportBlock[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        return [];
    }

    const blocks: ReportBlock[] = [];

    for (const item of raw) {
        if (!isRecord(item)) continue;
        const id = asString(item.id, makeBlockId());
        const label = asString(item.label, 'Untitled');
        const type = asString(item.type, 'narrative');

        switch (type) {
            case 'callout':
                blocks.push({
                    id,
                    type: 'callout',
                    label,
                    content: asString(item.content),
                });
                break;
            case 'artifact':
                // Keep legacy artifact readable in the canvas.
                blocks.push({
                    id,
                    type: 'artifact',
                    label,
                    content: asString(item.content),
                    reference: typeof item.reference === 'string' ? item.reference : undefined,
                });
                break;
            case 'data':
                blocks.push({
                    id,
                    type: 'data',
                    label,
                    questionId: asString(item.questionId || item.question_id),
                    projectId:
                        typeof item.projectId === 'string'
                            ? item.projectId
                            : typeof item.project_id === 'string'
                              ? item.project_id
                              : undefined,
                });
                break;
            case 'ai': {
                const statusRaw = asString(item.status, 'idle');
                const status: AiBlockStatus =
                    statusRaw === 'generating' ||
                    statusRaw === 'ready' ||
                    statusRaw === 'error' ||
                    statusRaw === 'idle'
                        ? statusRaw
                        : 'idle';
                blocks.push({
                    id,
                    type: 'ai',
                    label,
                    prompt: asString(item.prompt),
                    inputBlockIds: Array.isArray(item.inputBlockIds)
                        ? item.inputBlockIds.map((v) => String(v))
                        : Array.isArray(item.input_block_ids)
                          ? item.input_block_ids.map((v) => String(v))
                          : [],
                    output: normalizeAiOutput(item.output),
                    status,
                });
                break;
            }
            case 'media':
                blocks.push({
                    id,
                    type: 'media',
                    label,
                    url: asString(item.url),
                    caption: typeof item.caption === 'string' ? item.caption : undefined,
                });
                break;
            case 'narrative':
            default:
                blocks.push({
                    id,
                    type: 'narrative',
                    label,
                    content: asString(item.content),
                });
                break;
        }
    }

    return blocks;
}

function blockSummary(block: ReportBlock): string {
    switch (block.type) {
        case 'narrative':
        case 'callout':
        case 'artifact':
            return block.content.slice(0, 240) || block.label;
        case 'data':
            return block.questionId
                ? `Live data widget (${block.questionId.slice(0, 8)}…)`
                : 'Empty data block — pick a saved question';
        case 'media':
            return block.caption || block.url || 'Media block';
        case 'ai':
            return block.prompt || 'AI panel';
    }
}

/** Deterministic stub generator — same catalog shape a future LLM endpoint will return. */
export function stubGenerateAiCatalog(
    prompt: string,
    inputBlocks: ReportBlock[],
): AiCatalogNode[] {
    const summaries = inputBlocks.map((b) => ({
        label: b.label,
        type: b.type,
        summary: blockSummary(b),
    }));

    const firstCallout = inputBlocks.find((b) => b.type === 'callout');
    const firstNarrative = inputBlocks.find((b) => b.type === 'narrative');
    const dataCount = inputBlocks.filter((b) => b.type === 'data').length;

    return [
        {
            type: 'Metric',
            label: 'Sections synthesized',
            value: String(Math.max(inputBlocks.length, 1)),
            change: dataCount > 0 ? `${dataCount} live` : undefined,
        },
        {
            type: 'Callout',
            title: 'Board takeaway',
            body:
                (firstCallout && firstCallout.type === 'callout'
                    ? firstCallout.content
                    : prompt.trim()) ||
                'No signal yet — add callouts or a prompt, then regenerate.',
        },
        {
            type: 'Narrative',
            text:
                prompt.trim() ||
                (firstNarrative && firstNarrative.type === 'narrative'
                    ? firstNarrative.content.slice(0, 400)
                    : 'Stub briefing generated from linked report blocks.'),
        },
        {
            type: 'Table',
            columns: ['Section', 'Type', 'Snippet'],
            rows: summaries.slice(0, 5).map((s) => [
                s.label,
                s.type,
                s.summary.slice(0, 80),
            ]),
        },
        {
            type: 'Chart',
            title: 'Block mix',
            chartType: 'bar',
            categories: ['narrative', 'callout', 'data', 'ai', 'media'],
            values: [
                inputBlocks.filter((b) => b.type === 'narrative').length,
                inputBlocks.filter((b) => b.type === 'callout' || b.type === 'artifact').length,
                inputBlocks.filter((b) => b.type === 'data').length,
                inputBlocks.filter((b) => b.type === 'ai').length,
                inputBlocks.filter((b) => b.type === 'media').length,
            ],
        },
    ];
}

export function createEmptyBlock(type: AddableBlockType): ReportBlock {
    const id = makeBlockId();
    switch (type) {
        case 'callout':
            return {
                id,
                type: 'callout',
                label: 'Insight Callout',
                content: 'Start writing here. Use # to link artifacts and @ to mention teams or users.',
            };
        case 'data':
            return {
                id,
                type: 'data',
                label: 'Live data',
                questionId: '',
            };
        case 'ai':
            return {
                id,
                type: 'ai',
                label: 'AI briefing',
                prompt: 'Summarize the selected sections for a stakeholder update.',
                inputBlockIds: [],
                output: null,
                status: 'idle',
            };
        case 'media':
            return {
                id,
                type: 'media',
                label: 'Media',
                url: '',
                caption: '',
            };
        case 'narrative':
        default:
            return {
                id,
                type: 'narrative',
                label: 'New Section',
                content: 'Start writing here. Use # to link artifacts and @ to mention teams or users.',
            };
    }
}

export const blockTone: Record<ReportBlock['type'], string> = {
    narrative: 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]',
    callout: 'border-amber-500/20 bg-amber-500/5',
    artifact: 'border-sky-500/20 bg-sky-500/5',
    data: 'border-emerald-500/20 bg-emerald-500/5',
    ai: 'border-violet-500/20 bg-violet-500/5',
    media: 'border-slate-500/20 bg-slate-500/5',
};

export function blockTypeDescription(type: ReportBlock['type']): string {
    switch (type) {
        case 'narrative':
            return 'Long-form writing area';
        case 'callout':
            return 'Highlight or recommendation block';
        case 'artifact':
            return 'Legacy linked evidence block';
        case 'data':
            return 'Live chart or KPI from a saved question';
        case 'ai':
            return 'AI-generated catalog section from linked blocks';
        case 'media':
            return 'Image or media embed';
        default:
            return 'Report block';
    }
}
