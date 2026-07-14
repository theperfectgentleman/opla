import React from 'react';
import { FileAudio, FileImage, FileText, FileVideo, Image as ImageIcon, PenLine } from 'lucide-react';

export type SubmissionMediaItem = {
    id: string;
    submission_id: string;
    form_id: string;
    project_id: string;
    field_bind: string;
    field_label?: string | null;
    field_type: string;
    media_kind: string;
    url?: string | null;
    filename?: string | null;
    mime_type?: string | null;
    byte_size?: number | null;
    created_at: string;
    previewable?: boolean;
};

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

function KindIcon({ kind }: { kind: string }) {
    if (kind === 'image') return <FileImage className="h-4 w-4" />;
    if (kind === 'audio') return <FileAudio className="h-4 w-4" />;
    if (kind === 'video') return <FileVideo className="h-4 w-4" />;
    if (kind === 'signature') return <PenLine className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
}

type Props = {
    items: SubmissionMediaItem[];
    emptyLabel?: string;
    onOpenItem?: (item: SubmissionMediaItem) => void;
    compact?: boolean;
};

const SubmissionMediaGrid: React.FC<Props> = ({
    items,
    emptyLabel = 'No media collected yet.',
    onOpenItem,
    compact = false,
}) => {
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-8 text-center">
                <p className="text-sm text-[hsl(var(--text-secondary))]">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <ul
            className={cn(
                'grid gap-3',
                compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            )}
        >
            {items.map((item) => {
                const title = item.field_label || item.filename || item.field_bind;
                const canPreviewImage = item.previewable && item.media_kind === 'image' && item.url;
                return (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => {
                                if (onOpenItem) onOpenItem(item);
                                else if (item.previewable && item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
                            }}
                            className="group flex w-full flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-left transition hover:border-[hsl(var(--primary))]/40"
                        >
                            <div
                                className={cn(
                                    'relative flex items-center justify-center bg-[hsl(var(--surface))]',
                                    compact ? 'aspect-square' : 'aspect-[4/3]',
                                )}
                            >
                                {canPreviewImage ? (
                                    <img
                                        src={item.url!}
                                        alt={title}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-[hsl(var(--text-tertiary))]">
                                        <KindIcon kind={item.media_kind} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {item.media_kind}
                                        </span>
                                        {!item.previewable && (
                                            <span className="px-2 text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                                                Local / opaque URI
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1 px-3 py-2">
                                <p className="truncate text-xs font-semibold text-[hsl(var(--text-primary))]">{title}</p>
                                <p className="truncate text-[10px] text-[hsl(var(--text-tertiary))]">
                                    {new Date(item.created_at).toLocaleString()}
                                </p>
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export function RecentMediaHeaderIcon() {
    return <ImageIcon className="h-4 w-4 text-[hsl(var(--primary))]" />;
}

export default SubmissionMediaGrid;
