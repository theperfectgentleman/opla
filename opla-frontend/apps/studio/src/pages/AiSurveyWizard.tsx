import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Code2, Eye, Loader2, Sparkles, Wand2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import SurveyMarkdownPreview from '../components/SurveyMarkdownPreview';
import { aiSurveyAPI, type AiSurveyInterviewQuestion } from '../lib/api';

type WizardStep = 'brief' | 'interview' | 'draft';
type DraftViewMode = 'preview' | 'edit';

const AiSurveyWizard: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [step, setStep] = useState<WizardStep>('brief');
    const [brief, setBrief] = useState('');
    const [questions, setQuestions] = useState<AiSurveyInterviewQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [title, setTitle] = useState('');
    const [markdown, setMarkdown] = useState('');
    const [reviseInstruction, setReviseInstruction] = useState('');
    const [warnings, setWarnings] = useState<string[]>([]);
    const [sectionCount, setSectionCount] = useState(0);
    const [fieldCount, setFieldCount] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState('Working…');
    const [draftView, setDraftView] = useState<DraftViewMode>('preview');

    const canContinueBrief = brief.trim().length >= 8;

    const stepLabel = useMemo(() => {
        if (step === 'brief') return '1 · Brief';
        if (step === 'interview') return '2 · Interview';
        return '3 · Draft';
    }, [step]);

    useEffect(() => {
        if (step !== 'draft' || !markdown.trim()) {
            setWarnings([]);
            setSectionCount(0);
            setFieldCount(0);
            return;
        }
        const handle = window.setTimeout(async () => {
            try {
                const result = await aiSurveyAPI.compile(markdown);
                setWarnings(result.warnings || []);
                setTitle((prev) => prev || result.title);
                const ui = Array.isArray(result.blueprint?.ui) ? result.blueprint.ui : [];
                setSectionCount(ui.length);
                setFieldCount(
                    ui.reduce((sum: number, screen: any) => sum + (Array.isArray(screen?.children) ? screen.children.length : 0), 0),
                );
                setError('');
            } catch (err: any) {
                setWarnings([]);
                setSectionCount(0);
                setFieldCount(0);
                setError(err?.response?.data?.detail || err?.message || 'Markdown does not compile yet');
            }
        }, 450);
        return () => window.clearTimeout(handle);
    }, [markdown, step]);

    const extractError = (err: any) =>
        err?.response?.data?.detail || err?.message || 'Something went wrong';

    const runDraft = async (withAnswers: Record<string, string> | undefined) => {
        if (!brief.trim()) return;
        setBusy(true);
        setBusyLabel('Drafting questionnaire… larger surveys are built section-by-section');
        setError('');
        try {
            const result = await aiSurveyAPI.draft(brief.trim(), withAnswers);
            setTitle(result.title);
            setMarkdown(result.markdown);
            setDraftView('preview');
            setStep('draft');
        } catch (err: any) {
            setError(extractError(err));
        } finally {
            setBusy(false);
            setBusyLabel('Working…');
        }
    };

    const handleStartInterview = async () => {
        if (!canContinueBrief) return;
        setBusy(true);
        setBusyLabel('Preparing follow-up questions…');
        setError('');
        try {
            const result = await aiSurveyAPI.interview(brief.trim());
            setQuestions(result.questions || []);
            setAnswers({});
            setStep('interview');
        } catch (err: any) {
            setError(extractError(err));
        } finally {
            setBusy(false);
            setBusyLabel('Working…');
        }
    };

    const handleSkipInterview = async () => {
        await runDraft(undefined);
    };

    const handleSubmitInterview = async () => {
        await runDraft(answers);
    };

    const handleRevise = async () => {
        if (!reviseInstruction.trim() || !markdown.trim()) return;
        setBusy(true);
        setBusyLabel('Revising…');
        setError('');
        try {
            const result = await aiSurveyAPI.revise(markdown, reviseInstruction.trim());
            setMarkdown(result.markdown);
            setReviseInstruction('');
        } catch (err: any) {
            setError(extractError(err));
        } finally {
            setBusy(false);
            setBusyLabel('Working…');
        }
    };

    const handleGenerate = async () => {
        if (!projectId || !markdown.trim()) return;
        setBusy(true);
        setError('');
        try {
            const form = await aiSurveyAPI.generate(projectId, {
                markdown,
                title: title.trim() || undefined,
            });
            navigate(`/builder/${form.id}`);
        } catch (err: any) {
            setError(extractError(err));
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))]">
            <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(projectId ? `/projects/${projectId}` : '/dashboard')}
                        className="inline-flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to project
                    </button>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                        AI Survey Builder
                        <span className="text-[hsl(var(--text-tertiary))] font-normal">· {stepLabel}</span>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {error ? (
                    <div className="rounded-xl border border-[hsl(var(--error))]/30 bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] text-sm px-4 py-3">
                        {error}
                    </div>
                ) : null}

                {busy ? (
                    <div className="rounded-xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/5 text-[hsl(var(--text-secondary))] text-sm px-4 py-3 inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" />
                        {busyLabel}
                    </div>
                ) : null}

                {step === 'brief' && (
                    <section className="space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Describe the survey you need</h1>
                            <p className="mt-2 text-sm text-[hsl(var(--text-secondary))] max-w-2xl">
                                Write a broad brief — audience, goal, topics, and roughly how long (e.g. “about 50 questions”). AI will ask a few follow-ups, then draft a questionnaire you can edit before generating the Opla form.
                            </p>
                        </div>
                        <textarea
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            rows={8}
                            placeholder="e.g. Customer onboarding survey for a retail bank app. Need to segment new vs existing customers, measure NPS, and capture product interest with light branching."
                            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm outline-none focus:border-[hsl(var(--primary))]/60 focus:ring-2 focus:ring-[hsl(var(--primary))]/15 shadow-inner"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={!canContinueBrief || busy}
                                onClick={handleStartInterview}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                Continue with interview
                            </button>
                            <button
                                type="button"
                                disabled={!canContinueBrief || busy}
                                onClick={handleSkipInterview}
                                className="px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] text-sm font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-50"
                            >
                                Skip interview, draft now
                            </button>
                        </div>
                    </section>
                )}

                {step === 'interview' && (
                    <section className="space-y-5">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">A few quick questions</h1>
                            <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
                                Answer what you can — skip anything unclear. Then we draft the questionnaire.
                            </p>
                        </div>
                        <div className="space-y-4">
                            {questions.map((q) => (
                                <div key={q.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 space-y-2">
                                    <label className="text-sm font-semibold">{q.prompt}</label>
                                    {q.kind === 'choice' && Array.isArray(q.options) && q.options.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {q.options.map((opt) => {
                                                const selected = answers[q.id] === opt;
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            selected
                                                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                                : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                        }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={answers[q.id] || ''}
                                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]/60"
                                            placeholder="Your answer (optional)"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={handleSubmitInterview}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Draft questionnaire
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={handleSkipInterview}
                                className="px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] text-sm font-semibold text-[hsl(var(--text-secondary))] disabled:opacity-50"
                            >
                                Skip answers, draft now
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setStep('brief')}
                                className="px-3 py-2.5 text-sm text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                            >
                                Edit brief
                            </button>
                        </div>
                    </section>
                )}

                {step === 'draft' && (
                    <section className="space-y-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Review & edit</h1>
                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
                                    Preview the questionnaire, or switch to markdown to edit. Ask AI to change it, then generate into Opla.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--surface))]">
                                    <button
                                        type="button"
                                        onClick={() => setDraftView('preview')}
                                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                            draftView === 'preview'
                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Preview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDraftView('edit')}
                                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                            draftView === 'edit'
                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                                        }`}
                                    >
                                        <Code2 className="w-3.5 h-3.5" />
                                        Markdown
                                    </button>
                                </div>
                                <div className="text-xs text-[hsl(var(--text-tertiary))]">
                                    {sectionCount > 0 ? (
                                        <span>
                                            {sectionCount} section{sectionCount === 1 ? '' : 's'} · {fieldCount} field
                                            {fieldCount === 1 ? '' : 's'}
                                        </span>
                                    ) : (
                                        <span>Fix compile errors to preview counts</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                Form title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]/60"
                            />
                        </div>

                        {draftView === 'edit' ? (
                            <textarea
                                value={markdown}
                                onChange={(e) => setMarkdown(e.target.value)}
                                rows={18}
                                spellCheck={false}
                                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-[13px] font-mono leading-relaxed outline-none focus:border-[hsl(var(--primary))]/60 focus:ring-2 focus:ring-[hsl(var(--primary))]/15 shadow-inner"
                            />
                        ) : (
                            <SurveyMarkdownPreview markdown={markdown} />
                        )}

                        {warnings.length > 0 ? (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                                <p className="font-semibold text-xs uppercase tracking-wide">Compile warnings</p>
                                {warnings.map((w) => (
                                    <p key={w}>{w}</p>
                                ))}
                            </div>
                        ) : null}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={reviseInstruction}
                                onChange={(e) => setReviseInstruction(e.target.value)}
                                placeholder='Ask AI to change… e.g. "Add a section on pricing and make Q2 required"'
                                className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]/60"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleRevise();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                disabled={busy || !reviseInstruction.trim()}
                                onClick={handleRevise}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] text-sm font-semibold disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Revise
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
                            <button
                                type="button"
                                disabled={busy || !markdown.trim() || fieldCount === 0}
                                onClick={handleGenerate}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Generate into Opla
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setStep('brief')}
                                className="px-3 py-2.5 text-sm text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                            >
                                Start over
                            </button>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default AiSurveyWizard;
