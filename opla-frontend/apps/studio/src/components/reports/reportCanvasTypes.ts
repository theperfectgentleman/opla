import type React from 'react';

export type ReferenceKind = 'asset' | 'dataset' | 'thread' | 'team' | 'user' | 'report';

export type ReportCanvasReferenceSuggestion = {
    token: string;
    label: string;
    kind: ReferenceKind;
    title: string;
    summary: string;
    detail: string;
    icon: React.ReactNode;
};
