import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ConfirmPopoverProps = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    loading?: boolean;
    anchorRect?: DOMRect | null;
    onConfirm: () => void;
    onCancel: () => void;
};

const ConfirmPopover: React.FC<ConfirmPopoverProps> = ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    variant = 'default',
    loading = false,
    anchorRect = null,
    onConfirm,
    onCancel,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        if (!open || !anchorRect || !panelRef.current) {
            setPosition(null);
            return;
        }

        const panel = panelRef.current;
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        const margin = 8;

        let left = anchorRect.right - panelWidth;
        let top = anchorRect.top - panelHeight - margin;

        left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
        top = Math.max(margin, top);

        setPosition({ top, left });
    }, [open, anchorRect, title, description]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onCancel]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onCancel();
            }
        };
        const timer = window.setTimeout(() => {
            document.addEventListener('mousedown', onPointerDown);
        }, 0);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [open, onCancel]);

    if (!open) {
        return null;
    }

    const confirmClassName =
        variant === 'danger'
            ? 'bg-rose-600 hover:bg-rose-700 text-white'
            : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white';

    return (
        <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={onCancel} />
            <div
                ref={panelRef}
                className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                style={position ? { top: position.top, left: position.left } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-popover-title"
                onClick={(event) => event.stopPropagation()}
            >
                <p id="confirm-popover-title" className="text-xs font-bold text-[hsl(var(--text-primary))]">
                    {title}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--text-secondary))]">
                    {description}
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-lg border border-[hsl(var(--border))]/70 px-2.5 py-1.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors disabled:opacity-50 ${confirmClassName}`}
                    >
                        {loading ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ConfirmPopover;
