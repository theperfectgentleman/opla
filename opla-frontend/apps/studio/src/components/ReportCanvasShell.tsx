import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AudioLines,
    AtSign,
    BadgeCheck,
    CalendarClock,
    CircleX,
    Database,
    Eye,
    Hash,
    Image,
    Lightbulb,
    Link2,
    MessageSquare,
    Paperclip,
    PenSquare,
    Plus,
    Quote,
    Sparkles,
} from 'lucide-react';

type CanvasMode = 'write' | 'read';
type CanvasBlockType = 'narrative' | 'callout' | 'artifact';

export type ReportCanvasBlock = {
    id: string;
    type: CanvasBlockType;
    label: string;
    content: string;
    reference?: string;
};

type ReferenceKind = 'asset' | 'dataset' | 'thread' | 'team' | 'user' | 'report';

export type ReportCanvasReferenceSuggestion = {
    token: string;
    label: string;
    kind: ReferenceKind;
    title: string;
    summary: string;
    detail: string;
    icon: React.ReactNode;
};

type ReferenceFilter = '#' | '@';

type InlineCompletion = {
    blockId: string;
    trigger: ReferenceFilter;
    query: string;
    start: number;
    end: number;
};

type ReportCanvasShellProps = {
    reportTitle: string;
    content?: ReportCanvasBlock[];
    onContentChange?: (blocks: ReportCanvasBlock[]) => void;
    suggestions?: ReportCanvasReferenceSuggestion[];
};

const makeBlockId = () => `block-${Math.random().toString(36).slice(2, 10)}`;

const blockTone: Record<CanvasBlockType, string> = {
    narrative: 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]',
    callout: 'border-amber-500/20 bg-amber-500/5',
    artifact: 'border-sky-500/20 bg-sky-500/5',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const referenceTone: Record<ReferenceKind, string> = {
    asset: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    dataset: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    thread: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    team: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    user: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    report: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
};

const getCaretOffset = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!element.contains(range.endContainer)) {
        return null;
    }

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
};

const setCaretOffset = (element: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    if (!selection) {
        return;
    }

    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let currentNode = walker.nextNode();

    while (currentNode) {
        const nodeLength = currentNode.textContent?.length ?? 0;
        if (remaining <= nodeLength) {
            range.setStart(currentNode, remaining);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        remaining -= nodeLength;
        currentNode = walker.nextNode();
    }

    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
};

type CanvasEditableSurfaceProps = {
    blockId: string;
    value: string;
    placeholder: string;
    onUpdate: (blockId: string, value: string, cursor: number | null) => void;
    onRegister: (blockId: string, node: HTMLDivElement | null) => void;
    onBlur: () => void;
};

const CanvasEditableSurface: React.FC<CanvasEditableSurfaceProps> = ({
    blockId,
    value,
    placeholder,
    onUpdate,
    onRegister,
    onBlur,
}) => {
    const editableRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        onRegister(blockId, editableRef.current);
        return () => onRegister(blockId, null);
    }, [blockId, onRegister]);

    useEffect(() => {
        const element = editableRef.current;
        if (!element) {
            return;
        }

        const normalizedValue = value || '';
        if (element.innerText !== normalizedValue) {
            element.innerText = normalizedValue;
        }
    }, [value]);

    const emitUpdate = () => {
        const element = editableRef.current;
        if (!element) {
            return;
        }

        onUpdate(blockId, element.innerText.replace(/\r\n/g, '\n'), getCaretOffset(element));
    };

    return (
        <div className="relative">
            {!value && (
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-[hsl(var(--text-tertiary))]">
                    {placeholder}
                </div>
            )}
            <div
                ref={editableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={emitUpdate}
                onKeyUp={emitUpdate}
                onMouseUp={emitUpdate}
                onBlur={onBlur}
                className="min-h-[140px] whitespace-pre-wrap rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm leading-7 outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
            />
        </div>
    );
};

const createDefaultBlocks = (reportTitle: string): ReportCanvasBlock[] => ([
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
        id: 'evidence',
        type: 'artifact',
        label: 'Linked Evidence',
        content: 'Attach a linked dataset, asset, or thread so the reader can inspect source context without leaving the report.',
        reference: '#Field briefing deck',
    },
]);

const ReportCanvasShell: React.FC<ReportCanvasShellProps> = ({ reportTitle, content, onContentChange, suggestions: liveSuggestions }) => {
    const [mode, setMode] = useState<CanvasMode>('write');
    const [selectedBlockId, setSelectedBlockId] = useState<string>('summary');
    const [referenceFilter, setReferenceFilter] = useState<ReferenceFilter>('#');
    const [activePreviewToken, setActivePreviewToken] = useState<string | null>(null);
    const [activeCompletion, setActiveCompletion] = useState<InlineCompletion | null>(null);
    const [blocks, setBlocks] = useState<ReportCanvasBlock[]>(() => (content && content.length > 0 ? content : createDefaultBlocks(reportTitle)));
    const editableRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (content && content.length > 0) {
            setBlocks(content);
        }
    }, [content]);

    useEffect(() => {
        onContentChange?.(blocks);
    }, [blocks, onContentChange]);

    const selectedBlock = blocks.find(block => block.id === selectedBlockId) || blocks[0] || null;

    const fallbackSuggestions = useMemo<ReportCanvasReferenceSuggestion[]>(
        () => [
            {
                token: '#Field briefing deck',
                label: 'Asset link',
                kind: 'asset',
                title: 'Field briefing deck',
                summary: 'Training deck used to align supervisors and field teams before deployment.',
                detail: 'Document • Updated today • Includes launch checklist, scripts, and escalation flow.',
                icon: <Paperclip className="h-4 w-4" />,
            },
            {
                token: '#Enumerator dataset',
                label: 'Dataset link',
                kind: 'dataset',
                title: 'Enumerator dataset',
                summary: 'Operational dataset tracking enumerator assignments, progress, and field coverage.',
                detail: 'Dataset • 1,240 rows • Last sync 45 minutes ago.',
                icon: <Database className="h-4 w-4" />,
            },
            {
                token: '#Launch thread',
                label: 'Thread link',
                kind: 'thread',
                title: 'Launch thread',
                summary: 'Shared launch-day communication lane with supervisor clarifications and issue flags.',
                detail: 'Thread • 12 replies • Last reply 18 minutes ago.',
                icon: <MessageSquare className="h-4 w-4" />,
            },
            {
                token: '#Baseline report',
                label: 'Report link',
                kind: 'report',
                title: 'Baseline report',
                summary: 'Previous reporting artifact linked for historical context and comparison.',
                detail: 'Report • Published • Shared with leadership last week.',
                icon: <BadgeCheck className="h-4 w-4" />,
            },
            {
                token: '@Regional supervisors',
                label: 'Team mention',
                kind: 'team',
                title: 'Regional supervisors',
                summary: 'Core team responsible for field coordination and escalation handling.',
                detail: 'Team • 6 members • Can receive updates and review requests.',
                icon: <AtSign className="h-4 w-4" />,
            },
            {
                token: '@Amina Bello',
                label: 'User mention',
                kind: 'user',
                title: 'Amina Bello',
                summary: 'Project lead for field operations and final readiness checks.',
                detail: 'User • Lead owner • Active in launch and risk review threads.',
                icon: <AtSign className="h-4 w-4" />,
            },
        ],
        []
    );

    const suggestions = useMemo<ReportCanvasReferenceSuggestion[]>(() => {
        if (!liveSuggestions || liveSuggestions.length === 0) {
            return fallbackSuggestions;
        }

        const liveTokenSet = new Set(liveSuggestions.map(suggestion => suggestion.token));
        return [...liveSuggestions, ...fallbackSuggestions.filter(suggestion => !liveTokenSet.has(suggestion.token))];
    }, [fallbackSuggestions, liveSuggestions]);

    const filteredSuggestions = suggestions.filter(suggestion => suggestion.token.startsWith(referenceFilter));
    const inlineSuggestions = activeCompletion
        ? suggestions.filter(suggestion => {
            if (!suggestion.token.startsWith(activeCompletion.trigger)) {
                return false;
            }

            if (!activeCompletion.query.trim()) {
                return true;
            }

            const normalizedQuery = activeCompletion.query.toLowerCase();
            return suggestion.token.slice(1).toLowerCase().includes(normalizedQuery)
                || suggestion.title.toLowerCase().includes(normalizedQuery)
                || suggestion.label.toLowerCase().includes(normalizedQuery);
        })
        : [];
    const previewItem = suggestions.find(suggestion => suggestion.token === activePreviewToken) || null;
    const tokenMatcher = useMemo(() => {
        const pattern = suggestions.map(suggestion => escapeRegExp(suggestion.token)).join('|');
        return pattern ? new RegExp(`(${pattern})`, 'g') : null;
    }, [suggestions]);

    const updateBlock = (blockId: string, patch: Partial<ReportCanvasBlock>) => {
        setBlocks(prev => prev.map(block => block.id === blockId ? { ...block, ...patch } : block));
    };

    const handleEditableUpdate = (blockId: string, value: string, cursor: number | null) => {
        updateBlock(blockId, { content: value });
        updateInlineCompletion(blockId, value, cursor);
    };

    const updateInlineCompletion = (blockId: string, value: string, cursorPosition: number | null) => {
        if (cursorPosition === null || cursorPosition < 0) {
            setActiveCompletion(null);
            return;
        }

        const beforeCursor = value.slice(0, cursorPosition);
        const match = beforeCursor.match(/(^|\s)([#@][^\s#@]*)$/);

        if (!match || !match[2]) {
            setActiveCompletion(current => current?.blockId === blockId ? null : current);
            return;
        }

        const token = match[2];
        const trigger = token.charAt(0) as ReferenceFilter;
        const start = cursorPosition - token.length;

        setReferenceFilter(trigger);
        setActiveCompletion({
            blockId,
            trigger,
            query: token.slice(1),
            start,
            end: cursorPosition,
        });
    };

    const addBlock = (type: CanvasBlockType) => {
        const nextBlock: ReportCanvasBlock = {
            id: makeBlockId(),
            type,
            label: type === 'narrative' ? 'New Section' : type === 'callout' ? 'Insight Callout' : 'Artifact Embed',
            content: type === 'artifact'
                ? 'Summarize what this linked artifact adds to the report.'
                : 'Start writing here. Use # to link artifacts and @ to mention teams or users.',
            reference: type === 'artifact' ? '#Reference me' : undefined,
        };

        setBlocks(prev => [...prev, nextBlock]);
        setSelectedBlockId(nextBlock.id);
    };

    const injectToken = (token: string) => {
        if (!selectedBlock) return;

        if (activeCompletion && activeCompletion.blockId === selectedBlock.id) {
            const nextContent = `${selectedBlock.content.slice(0, activeCompletion.start)}${token} ${selectedBlock.content.slice(activeCompletion.end)}`;
            updateBlock(selectedBlock.id, { content: nextContent });
            setActiveCompletion(null);

            window.requestAnimationFrame(() => {
                const editable = editableRefs.current[selectedBlock.id];
                const cursor = activeCompletion.start + token.length + 1;
                editable?.focus();
                if (editable) {
                    setCaretOffset(editable, cursor);
                }
            });
            return;
        }

        if (selectedBlock.type === 'artifact' && !selectedBlock.reference) {
            updateBlock(selectedBlock.id, { reference: token });
            return;
        }

        const nextContent = selectedBlock.content.trim()
            ? `${selectedBlock.content.trim()} ${token}`
            : token;
        updateBlock(selectedBlock.id, { content: nextContent });
    };

    const renderInteractiveContent = (content: string) => {
        if (!tokenMatcher) {
            return content;
        }

        const parts = content.split(tokenMatcher);

        return parts.map((part, index) => {
            const match = suggestions.find(suggestion => suggestion.token === part);

            if (!match) {
                return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
            }

            return (
                <button
                    key={`${part}-${index}`}
                    type="button"
                    onClick={() => setActivePreviewToken(match.token)}
                    className={`mx-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-all hover:brightness-95 ${referenceTone[match.kind]}`}
                >
                    {match.icon}
                    {match.token}
                </button>
            );
        });
    };

    return (
        <section className="relative rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm overflow-hidden">
            <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                            <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
                            Report Canvas
                        </div>
                        <h2 className="mt-2 text-xl font-semibold">Narrative Editor Host</h2>
                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Compose reports as blocks, attach linked evidence with <span className="font-semibold text-[hsl(var(--text-primary))]">#</span>, and mention teams or users with <span className="font-semibold text-[hsl(var(--text-primary))]">@</span>.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1">
                            <button
                                type="button"
                                onClick={() => setMode('write')}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${mode === 'write' ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'text-[hsl(var(--text-secondary))]'}`}
                            >
                                <PenSquare className="h-4 w-4" />
                                Write
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('read')}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${mode === 'read' ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'text-[hsl(var(--text-secondary))]'}`}
                            >
                                <Eye className="h-4 w-4" />
                                Read
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => addBlock('narrative')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                        >
                            <Plus className="h-4 w-4" />
                            Section
                        </button>
                        <button
                            type="button"
                            onClick={() => addBlock('callout')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                        >
                            <Lightbulb className="h-4 w-4" />
                            Insight
                        </button>
                        <button
                            type="button"
                            onClick={() => addBlock('artifact')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                        >
                            <Paperclip className="h-4 w-4" />
                            Embed
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.6fr)_340px]">
                <div className="space-y-4 p-6">
                    {blocks.map(block => {
                        const isSelected = selectedBlockId === block.id;

                        return (
                            <article
                                key={block.id}
                                className={`rounded-[24px] border p-5 transition-all ${blockTone[block.type]} ${isSelected ? 'ring-2 ring-[hsl(var(--primary))]/25 shadow-md' : ''}`}
                                onClick={() => setSelectedBlockId(block.id)}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{block.type}</p>
                                        {mode === 'write' ? (
                                            <input
                                                value={block.label}
                                                onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                                                className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-lg font-semibold"
                                            />
                                        ) : (
                                            <h3 className="mt-2 text-lg font-semibold">{block.label}</h3>
                                        )}
                                    </div>

                                    {block.reference ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-xs font-semibold text-[hsl(var(--text-secondary))]">
                                            <Hash className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                                            {block.reference}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-4">
                                    {mode === 'write' ? (
                                        <CanvasEditableSurface
                                            blockId={block.id}
                                            value={block.content}
                                            placeholder="Write your report section here. Use # to link artifacts and @ to mention teams or users."
                                            onUpdate={handleEditableUpdate}
                                            onRegister={(currentBlockId, node) => {
                                                editableRefs.current[currentBlockId] = node;
                                            }}
                                            onBlur={() => setActiveCompletion(current => current?.blockId === block.id ? null : current)}
                                        />
                                    ) : (
                                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm leading-7 text-[hsl(var(--text-secondary))] whitespace-pre-wrap">
                                            {renderInteractiveContent(block.content)}
                                        </div>
                                    )}
                                </div>

                                {mode === 'write' && activeCompletion?.blockId === block.id && inlineSuggestions.length > 0 ? (
                                    <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-2 shadow-lg">
                                        <div className="mb-2 px-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                            {activeCompletion.trigger === '#' ? 'Insert linked artifact' : 'Insert mention'}
                                        </div>
                                        <div className="space-y-1">
                                            {inlineSuggestions.slice(0, 5).map(suggestion => (
                                                <button
                                                    key={`${block.id}-${suggestion.token}`}
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => injectToken(suggestion.token)}
                                                    className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <span className="flex min-w-0 items-center gap-3 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                        <span className="text-[hsl(var(--primary))]">{suggestion.icon}</span>
                                                        <span className="truncate">{suggestion.token}</span>
                                                    </span>
                                                    <span className="ml-3 shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{suggestion.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {mode === 'write' && isSelected ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setReferenceFilter('#')}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${referenceFilter === '#' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))]'}`}
                                        >
                                            <Hash className="h-3.5 w-3.5" />
                                            Insert link
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReferenceFilter('@')}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${referenceFilter === '@' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))]'}`}
                                        >
                                            <AtSign className="h-3.5 w-3.5" />
                                            Insert mention
                                        </button>
                                    </div>
                                ) : null}

                                {block.type === 'artifact' && (
                                    <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                <Paperclip className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {mode === 'write' ? (
                                                    <input
                                                        value={block.reference || ''}
                                                        onChange={(event) => updateBlock(block.id, { reference: event.target.value })}
                                                        className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-semibold"
                                                        placeholder="#Link an artifact"
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => block.reference ? setActivePreviewToken(block.reference) : undefined}
                                                        className="text-sm font-semibold text-[hsl(var(--text-primary))] hover:text-[hsl(var(--primary))]"
                                                    >
                                                        {block.reference || 'Artifact preview slot'}
                                                    </button>
                                                )}
                                                <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">Read mode will eventually render the linked item in a popup preview instead of navigating away.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>

                <aside className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 xl:border-l xl:border-t-0">
                    <div className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Current block</h3>
                        {selectedBlock ? (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <p className="text-lg font-semibold">{selectedBlock.label}</p>
                                    <p className="text-sm text-[hsl(var(--text-secondary))]">{selectedBlock.type === 'narrative' ? 'Long-form writing area' : selectedBlock.type === 'callout' ? 'Highlight or recommendation block' : 'Embedded source context block'}</p>
                                </div>
                                <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-xs text-[hsl(var(--text-secondary))]">
                                    Canvas state now follows the report payload. A later pass can add autosave, collaboration, and cursor-aware suggestions.
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-6 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Reference helpers</h3>
                            <div className="inline-flex rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-1">
                                <button
                                    type="button"
                                    onClick={() => setReferenceFilter('#')}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${referenceFilter === '#' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--text-secondary))]'}`}
                                >
                                    # Links
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReferenceFilter('@')}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${referenceFilter === '@' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--text-secondary))]'}`}
                                >
                                    @ Mentions
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {filteredSuggestions.map(suggestion => (
                                <button
                                    key={suggestion.token}
                                    type="button"
                                    onClick={() => injectToken(suggestion.token)}
                                    className="flex w-full items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-left hover:bg-[hsl(var(--surface-elevated))]"
                                >
                                    <span className="flex items-center gap-3 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        <span className="text-[hsl(var(--primary))]">{suggestion.icon}</span>
                                        {suggestion.token}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{suggestion.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Reading behavior</h3>
                        <div className="mt-4 space-y-3 text-sm text-[hsl(var(--text-secondary))]">
                            <div className="flex items-start gap-3">
                                <Quote className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                <span>Readers stay in context while linked artifacts open in a local popup renderer.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <MessageSquare className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                <span>Threads can be cited as evidence and previewed inline for operational history.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <AtSign className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                <span>Mentions will later resolve to teams and users with role-aware presence.</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {previewItem ? (
                <div className="absolute inset-0 z-10 flex items-start justify-end bg-black/10 p-4 backdrop-blur-[1px]">
                    <div className="w-full max-w-sm rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${referenceTone[previewItem.kind]}`}>
                                    {previewItem.icon}
                                    {previewItem.label}
                                </div>
                                <h3 className="mt-3 text-lg font-semibold">{previewItem.title}</h3>
                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">{previewItem.summary}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActivePreviewToken(null)}
                                className="rounded-xl border border-[hsl(var(--border))] p-2 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]"
                            >
                                <CircleX className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                            <div className="flex items-center gap-3 text-[hsl(var(--text-secondary))]">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                    {previewItem.kind === 'asset' ? <Paperclip className="h-5 w-5" /> : null}
                                    {previewItem.kind === 'dataset' ? <Database className="h-5 w-5" /> : null}
                                    {previewItem.kind === 'thread' ? <MessageSquare className="h-5 w-5" /> : null}
                                    {previewItem.kind === 'team' ? <BadgeCheck className="h-5 w-5" /> : null}
                                    {previewItem.kind === 'user' ? <AtSign className="h-5 w-5" /> : null}
                                    {previewItem.kind === 'report' ? <Quote className="h-5 w-5" /> : null}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Preview renderer</p>
                                    <p className="text-xs">{previewItem.detail}</p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3 text-sm text-[hsl(var(--text-secondary))]">
                                <div className="flex items-start gap-3">
                                    <CalendarClock className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                    <span>Readers can inspect this linked item without leaving the report canvas.</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    {previewItem.kind === 'asset' ? <Image className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    {previewItem.kind === 'dataset' ? <Link2 className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    {previewItem.kind === 'thread' ? <MessageSquare className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    {previewItem.kind === 'team' ? <BadgeCheck className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    {previewItem.kind === 'user' ? <AtSign className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    {previewItem.kind === 'report' ? <Quote className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" /> : null}
                                    <span>This popup stands in for the future artifact renderer that will be backed by real API data.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default ReportCanvasShell;