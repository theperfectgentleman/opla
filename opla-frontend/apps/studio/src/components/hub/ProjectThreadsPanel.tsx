import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { projectAPI } from '../../lib/api';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

export type ProjectThread = {
    id: string;
    project_id: string;
    title: string;
    summary?: string | null;
    reply_count: number;
    kind: 'general' | 'team' | string;
    team_id?: string | null;
    updated_at: string;
    created_at: string;
};

export type ThreadMessage = {
    id: string;
    thread_id: string;
    project_id: string;
    author_id?: string | null;
    author?: { id: string; full_name: string; email?: string | null } | null;
    body: string;
    mentions_json?: Array<{ user_id: string; full_name: string }> | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
};

type Props = {
    orgId: string;
    projectId: string;
    canEditProject?: boolean;
    initialThreadId?: string | null;
    compact?: boolean;
};

const AUTHOR_WINDOW_MS = 24 * 60 * 60 * 1000;

function withinAuthorWindow(createdAt: string) {
    return Date.now() - new Date(createdAt).getTime() <= AUTHOR_WINDOW_MS;
}

const ProjectThreadsPanel: React.FC<Props> = ({
    orgId,
    projectId,
    canEditProject = false,
    initialThreadId = null,
    compact = false,
}) => {
    const { user } = useAuth();
    const [threads, setThreads] = useState<ProjectThread[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [loadingThreads, setLoadingThreads] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [composer, setComposer] = useState('');
    const [sending, setSending] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState('');
    const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

    const activeThread = useMemo(
        () => threads.find((t) => t.id === activeThreadId) || null,
        [threads, activeThreadId],
    );

    const loadThreads = useCallback(async () => {
        setLoadingThreads(true);
        setError(null);
        try {
            const rows: ProjectThread[] = await projectAPI.listMessages(orgId, projectId);
            setThreads(Array.isArray(rows) ? rows : []);
            setActiveThreadId((prev) => {
                if (prev && rows.some((t) => t.id === prev)) return prev;
                if (initialThreadId && rows.some((t) => t.id === initialThreadId)) return initialThreadId;
                const general = rows.find((t) => t.kind === 'general');
                return general?.id || rows[0]?.id || null;
            });
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Could not load channels');
            setThreads([]);
        } finally {
            setLoadingThreads(false);
        }
    }, [orgId, projectId, initialThreadId]);

    const loadMessages = useCallback(
        async (threadId: string) => {
            setLoadingMessages(true);
            try {
                const rows: ThreadMessage[] = await projectAPI.listChannelMessages(orgId, projectId, threadId, {
                    limit: 80,
                });
                setMessages(Array.isArray(rows) ? rows : []);
            } catch (err: any) {
                setError(err?.response?.data?.detail || 'Could not load messages');
                setMessages([]);
            } finally {
                setLoadingMessages(false);
            }
        },
        [orgId, projectId],
    );

    useEffect(() => {
        void loadThreads();
    }, [loadThreads]);

    useEffect(() => {
        if (!activeThreadId) {
            setMessages([]);
            return;
        }
        void loadMessages(activeThreadId);
    }, [activeThreadId, loadMessages]);

    useEffect(() => {
        if (initialThreadId) setActiveThreadId(initialThreadId);
    }, [initialThreadId]);

    const sendMessage = async () => {
        if (!activeThreadId || !composer.trim() || sending) return;
        setSending(true);
        setError(null);
        try {
            const created = await projectAPI.postChannelMessage(orgId, projectId, activeThreadId, {
                body: composer.trim(),
            });
            setMessages((prev) => [...prev, created]);
            setComposer('');
            setThreads((prev) =>
                prev.map((t) =>
                    t.id === activeThreadId
                        ? {
                              ...t,
                              reply_count: (t.reply_count || 0) + 1,
                              updated_at: created.created_at,
                              summary: created.body.slice(0, 180),
                          }
                        : t,
                ),
            );
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Could not send message');
        } finally {
            setSending(false);
        }
    };

    const saveEdit = async (messageId: string) => {
        if (!editBody.trim()) return;
        setBusyMessageId(messageId);
        try {
            const updated = await projectAPI.editMessage(orgId, projectId, messageId, {
                body: editBody.trim(),
            });
            setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
            setEditingId(null);
            setEditBody('');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Could not edit message');
        } finally {
            setBusyMessageId(null);
        }
    };

    const removeMessage = async (messageId: string) => {
        setBusyMessageId(messageId);
        try {
            const updated = await projectAPI.deleteMessage(orgId, projectId, messageId);
            setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
            setThreads((prev) =>
                prev.map((t) =>
                    t.id === activeThreadId
                        ? { ...t, reply_count: Math.max(0, (t.reply_count || 1) - 1) }
                        : t,
                ),
            );
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Could not delete message');
        } finally {
            setBusyMessageId(null);
        }
    };

    const canMutate = (message: ThreadMessage) => {
        if (message.deleted_at) return { edit: false, remove: false };
        const isAuthor = !!user?.id && message.author_id === user.id;
        const inWindow = withinAuthorWindow(message.created_at);
        return {
            edit: isAuthor && inWindow,
            remove: (isAuthor && inWindow) || canEditProject,
        };
    };

    return (
        <section
            className={cn(
                'overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm',
                compact ? '' : 'min-h-[420px]',
            )}
        >
            <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                        Threads
                    </h2>
                    <span className="rounded-full bg-[hsl(var(--background))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--text-tertiary))]">
                        {threads.length}
                    </span>
                </div>
                <p className="text-[11px] text-[hsl(var(--text-tertiary))]">General + team channels · @mentions notify</p>
            </div>

            {error && (
                <div className="border-b border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-4 py-2 text-xs text-[hsl(var(--error))]">
                    {error}
                </div>
            )}

            <div className={cn('grid gap-0', compact ? 'lg:grid-cols-[200px_1fr]' : 'lg:grid-cols-[220px_1fr]')}>
                <aside className="border-b border-[hsl(var(--border))] lg:border-b-0 lg:border-r">
                    {loadingThreads ? (
                        <div className="flex items-center gap-2 px-4 py-6 text-sm text-[hsl(var(--text-secondary))]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading channels…
                        </div>
                    ) : threads.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-[hsl(var(--text-tertiary))]">No channels yet.</p>
                    ) : (
                        <ul className="max-h-48 overflow-y-auto lg:max-h-[480px]">
                            {threads.map((thread) => (
                                <li key={thread.id}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveThreadId(thread.id)}
                                        className={cn(
                                            'flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors',
                                            activeThreadId === thread.id
                                                ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                : 'hover:bg-[hsl(var(--background))]',
                                        )}
                                    >
                                        <span className="text-sm font-semibold">{thread.title}</span>
                                        <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                            {thread.kind === 'general' ? 'General' : 'Team'} · {thread.reply_count}{' '}
                                            messages
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                <div className="flex min-h-[320px] flex-col">
                    <div className="border-b border-[hsl(var(--border))] px-4 py-2.5">
                        <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                            {activeThread?.title || 'Select a channel'}
                        </p>
                        {activeThread?.summary && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--text-secondary))]">
                                {activeThread.summary}
                            </p>
                        )}
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {loadingMessages ? (
                            <div className="flex items-center gap-2 py-8 text-sm text-[hsl(var(--text-secondary))]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading messages…
                            </div>
                        ) : messages.length === 0 ? (
                            <p className="py-8 text-center text-sm text-[hsl(var(--text-tertiary))]">
                                No messages yet. Say hello — use @Name to mention someone.
                            </p>
                        ) : (
                            messages.map((message) => {
                                const perms = canMutate(message);
                                const deleted = !!message.deleted_at;
                                return (
                                    <div
                                        key={message.id}
                                        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">
                                                    {message.author?.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                                    {new Date(message.created_at).toLocaleString()}
                                                    {message.edited_at ? ' · edited' : ''}
                                                </p>
                                            </div>
                                            {!deleted && (perms.edit || perms.remove) && (
                                                <div className="flex gap-1">
                                                    {perms.edit && (
                                                        <button
                                                            type="button"
                                                            title="Edit"
                                                            className="rounded p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))]"
                                                            onClick={() => {
                                                                setEditingId(message.id);
                                                                setEditBody(message.body);
                                                            }}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    {perms.remove && (
                                                        <button
                                                            type="button"
                                                            title="Delete"
                                                            disabled={busyMessageId === message.id}
                                                            className="rounded p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--error))]/10 hover:text-[hsl(var(--error))]"
                                                            onClick={() => void removeMessage(message.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {editingId === message.id ? (
                                            <div className="mt-2 space-y-2">
                                                <textarea
                                                    value={editBody}
                                                    onChange={(e) => setEditBody(e.target.value)}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-sm"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary text-xs"
                                                        disabled={busyMessageId === message.id}
                                                        onClick={() => void saveEdit(message.id)}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary text-xs"
                                                        onClick={() => {
                                                            setEditingId(null);
                                                            setEditBody('');
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p
                                                className={cn(
                                                    'mt-2 whitespace-pre-wrap text-sm',
                                                    deleted
                                                        ? 'italic text-[hsl(var(--text-tertiary))]'
                                                        : 'text-[hsl(var(--text-secondary))]',
                                                )}
                                            >
                                                {deleted ? 'Message deleted' : message.body}
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t border-[hsl(var(--border))] p-3">
                        <div className="flex gap-2">
                            <textarea
                                value={composer}
                                onChange={(e) => setComposer(e.target.value)}
                                rows={compact ? 2 : 3}
                                placeholder={
                                    activeThread
                                        ? `Message #${activeThread.title}… (@mention to notify)`
                                        : 'Select a channel first'
                                }
                                disabled={!activeThreadId || sending}
                                className="min-h-[44px] flex-1 resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        void sendMessage();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="btn btn-primary inline-flex h-11 items-center gap-1.5 self-end px-3 text-xs"
                                disabled={!activeThreadId || !composer.trim() || sending}
                                onClick={() => void sendMessage()}
                            >
                                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Send
                            </button>
                        </div>
                        <p className="mt-1.5 text-[10px] text-[hsl(var(--text-tertiary))]">
                            Ctrl/⌘+Enter to send · Authors can edit/delete for 24h · Editors can delete anytime
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProjectThreadsPanel;
