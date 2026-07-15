import React, { useMemo, useState } from 'react';
import {
  Beaker,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { submissionAPI } from '../../lib/api';
import {
  generateSyntheticBatch,
  listGeneratableFields,
  summarizeFieldDistribution,
  type RatioRule,
  type FieldWeight,
  type GeneratedResponse,
} from './syntheticGenerator';

interface SyntheticDataPanelProps {
  formId: string;
  blueprint: any;
  directoryItems?: any[];
}

type GenPhase = 'idle' | 'generating' | 'submitting' | 'done' | 'error';

function newRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const SyntheticDataPanel: React.FC<SyntheticDataPanelProps> = ({
  formId,
  blueprint,
  directoryItems = [],
}) => {
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState(25);
  const [seed, setSeed] = useState<string>('');
  const [ratioRules, setRatioRules] = useState<RatioRule[]>([]);
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastBatch, setLastBatch] = useState<GeneratedResponse[]>([]);
  const [previewBind, setPreviewBind] = useState<string>('');

  const fields = useMemo(() => listGeneratableFields(blueprint || { ui: [] }), [blueprint]);
  const choiceFields = fields.filter((f) => f.isChoice && f.options.length > 0);
  const numericFields = fields.filter((f) => f.isNumeric);

  const previewDist = useMemo(() => {
    if (!previewBind || !lastBatch.length) return [];
    return summarizeFieldDistribution(lastBatch, previewBind);
  }, [lastBatch, previewBind]);

  const addWeightRule = () => {
    const field = choiceFields[0];
    if (!field) return;
    const weights: FieldWeight[] = field.options.slice(0, 4).map((o, _i, arr) => ({
      value: o.value,
      percent: Math.round(100 / arr.length),
    }));
    setRatioRules((prev) => [
      ...prev,
      {
        id: newRuleId(),
        fieldBind: field.bind,
        mode: 'weights',
        weights,
      },
    ]);
  };

  const addRangeRule = () => {
    const field = numericFields[0] || fields.find((f) => f.isNumeric);
    if (!field && !choiceFields.length) return;
    setRatioRules((prev) => [
      ...prev,
      {
        id: newRuleId(),
        fieldBind: field?.bind || choiceFields[0]?.bind || '',
        mode: 'range',
        rangeMin: 18,
        rangeMax: 35,
        percentOfTotal: 50,
        whenFieldBind: '',
        whenValue: '',
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<RatioRule>) => {
    setRatioRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => {
    setRatioRules((prev) => prev.filter((r) => r.id !== id));
  };

  const setFieldWeights = (ruleId: string, fieldBind: string) => {
    const field = fields.find((f) => f.bind === fieldBind);
    const weights: FieldWeight[] = (field?.options || []).slice(0, 8).map((o, _i, arr) => ({
      value: o.value,
      percent: Math.round(100 / Math.max(arr.length, 1)),
    }));
    updateRule(ruleId, { fieldBind, weights, mode: 'weights' });
  };

  const updateWeight = (ruleId: string, value: string, percent: number) => {
    setRatioRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const weights = (r.weights || []).map((w) =>
          w.value === value ? { ...w, percent } : w,
        );
        return { ...r, weights };
      }),
    );
  };

  const handleGenerate = async () => {
    if (!blueprint || !formId) return;
    setError(null);
    setWarnings([]);
    setPhase('generating');
    setProgress({ done: 0, total: count });

    try {
      const seedNum = seed.trim() === '' ? undefined : Number(seed);
      const { responses, warnings: w } = generateSyntheticBatch(
        blueprint,
        {
          count,
          seed: seedNum !== undefined && !Number.isNaN(seedNum) ? seedNum : undefined,
          ratioRules,
        },
        directoryItems,
      );
      setWarnings(w);
      setLastBatch(responses);
      if (!previewBind && fields[0]) setPreviewBind(fields[0].bind);

      setPhase('submitting');
      let done = 0;
      const failures: string[] = [];

      // Submit sequentially with small concurrency to avoid flooding
      const concurrency = 3;
      let cursor = 0;

      const worker = async () => {
        while (cursor < responses.length) {
          const i = cursor++;
          const response = responses[i];
          try {
            await submissionAPI.create({
              form_id: formId,
              data: response.data,
              metadata: {
                source: 'synthetic_generator',
                synthetic: true,
                path: response.path,
                batch_index: i,
                seed: seedNum ?? null,
                user_agent: navigator.userAgent,
              },
            });
          } catch (err: any) {
            const msg =
              err?.response?.data?.detail ||
              err?.message ||
              'Submit failed';
            failures.push(`Record ${i + 1}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
          }
          done += 1;
          setProgress({ done, total: responses.length });
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (failures.length === responses.length) {
        setPhase('error');
        setError(
          failures[0] ||
            'All submissions failed. Publish the form (live blueprint) before generating.',
        );
      } else if (failures.length) {
        setPhase('done');
        setWarnings((prev) => [
          ...prev,
          `${failures.length} of ${responses.length} submissions failed.`,
          failures[0],
        ]);
      } else {
        setPhase('done');
      }
    } catch (err: any) {
      setPhase('error');
      setError(err?.message || 'Generation failed');
    }
  };

  const weightSum = (rule: RatioRule) =>
    (rule.weights || []).reduce((s, w) => s + (Number(w.percent) || 0), 0);

  return (
    <div className="w-[380px] max-h-[780px] flex flex-col bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] flex items-center justify-center">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-[hsl(var(--text-primary))] text-sm">Synthetic Data</div>
            <div className="text-[11px] text-[hsl(var(--text-tertiary))]">
              Path-aware · rules · directories · ratios
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[hsl(var(--text-tertiary))]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[hsl(var(--text-tertiary))]" />
        )}
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
            Generates responses that walk your survey path — cascades, directory filters, show/hide,
            jumps, and set-value rules — then submits them as tagged test data.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                Records
              </span>
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(clampInt(e.target.value, 1, 500))}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm text-[hsl(var(--text-primary))]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                Seed (optional)
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="random"
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/[^\d-]/g, ''))}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm text-[hsl(var(--text-primary))]"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                Ratio rules
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={addWeightRule}
                  disabled={!choiceFields.length}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Choice %
                  </span>
                </button>
                <button
                  type="button"
                  onClick={addRangeRule}
                  disabled={!numericFields.length && !choiceFields.length}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Range
                  </span>
                </button>
              </div>
            </div>

            {!ratioRules.length && (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-4 text-center text-xs text-[hsl(var(--text-tertiary))]">
                No ratios — options are picked uniformly within allowed cascades.
                <br />
                Add e.g. 50% Male, or age 18–35 for 50% of records.
              </div>
            )}

            {ratioRules.map((rule) => {
              const field = fields.find((f) => f.bind === rule.fieldBind);
              return (
                <div
                  key={rule.id}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <select
                      value={rule.fieldBind}
                      onChange={(e) => {
                        if (rule.mode === 'weights') setFieldWeights(rule.id, e.target.value);
                        else updateRule(rule.id, { fieldBind: e.target.value });
                      }}
                      className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1.5 text-xs text-[hsl(var(--text-primary))]"
                    >
                      {fields.map((f) => (
                        <option key={f.bind} value={f.bind}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={rule.mode}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          mode: e.target.value as 'weights' | 'range',
                          weights:
                            e.target.value === 'weights'
                              ? field?.options.slice(0, 6).map((o, _i, arr) => ({
                                  value: o.value,
                                  percent: Math.round(100 / Math.max(arr.length, 1)),
                                }))
                              : undefined,
                          rangeMin: e.target.value === 'range' ? rule.rangeMin ?? 18 : undefined,
                          rangeMax: e.target.value === 'range' ? rule.rangeMax ?? 35 : undefined,
                          percentOfTotal:
                            e.target.value === 'range' ? rule.percentOfTotal ?? 50 : undefined,
                        })
                      }
                      className="w-[90px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1.5 text-xs text-[hsl(var(--text-primary))]"
                    >
                      <option value="weights">Weights</option>
                      <option value="range">Range</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="p-1.5 text-[hsl(var(--text-tertiary))] hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {rule.mode === 'weights' && (
                    <div className="space-y-2">
                      {(rule.weights || []).map((w) => {
                        const label =
                          field?.options.find((o) => o.value === w.value)?.label || w.value;
                        return (
                          <div key={w.value} className="flex items-center gap-2">
                            <span className="flex-1 text-xs text-[hsl(var(--text-secondary))] truncate">
                              {label}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={w.percent}
                              onChange={(e) =>
                                updateWeight(rule.id, w.value, clampInt(e.target.value, 0, 100))
                              }
                              className="w-16 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-xs text-right"
                            />
                            <span className="text-[10px] text-[hsl(var(--text-tertiary))]">%</span>
                          </div>
                        );
                      })}
                      <div
                        className={`text-[10px] ${
                          weightSum(rule) > 105
                            ? 'text-amber-600'
                            : 'text-[hsl(var(--text-tertiary))]'
                        }`}
                      >
                        Sum {weightSum(rule)}%
                        {weightSum(rule) < 100 ? ' · remainder distributed randomly' : ''}
                      </div>
                    </div>
                  )}

                  {rule.mode === 'range' && (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] text-[hsl(var(--text-tertiary))]">Min</span>
                        <input
                          type="number"
                          value={rule.rangeMin ?? ''}
                          onChange={(e) =>
                            updateRule(rule.id, { rangeMin: Number(e.target.value) })
                          }
                          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-[hsl(var(--text-tertiary))]">Max</span>
                        <input
                          type="number"
                          value={rule.rangeMax ?? ''}
                          onChange={(e) =>
                            updateRule(rule.id, { rangeMax: Number(e.target.value) })
                          }
                          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-[hsl(var(--text-tertiary))]">% of N</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.percentOfTotal ?? 50}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              percentOfTotal: clampInt(e.target.value, 0, 100),
                            })
                          }
                          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-xs"
                        />
                      </label>
                    </div>
                  )}

                  <div className="pt-1 border-t border-[hsl(var(--border))] space-y-2">
                    <span className="text-[10px] font-semibold text-[hsl(var(--text-tertiary))]">
                      When condition (optional)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={rule.whenFieldBind || ''}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            whenFieldBind: e.target.value || undefined,
                            whenValue: e.target.value ? rule.whenValue : undefined,
                          })
                        }
                        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1.5 text-xs"
                      >
                        <option value="">Any respondent</option>
                        {choiceFields.map((f) => (
                          <option key={f.bind} value={f.bind}>
                            When {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={rule.whenValue || ''}
                        disabled={!rule.whenFieldBind}
                        onChange={(e) => updateRule(rule.id, { whenValue: e.target.value })}
                        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1.5 text-xs disabled:opacity-40"
                      >
                        <option value="">= value…</option>
                        {(
                          fields.find((f) => f.bind === rule.whenFieldBind)?.options || []
                        ).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {rule.whenFieldBind && rule.mode === 'weights' && (
                      <label className="flex items-center gap-2 text-[10px] text-[hsl(var(--text-tertiary))]">
                        Apply to
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.percentOfTotal ?? 100}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              percentOfTotal: clampInt(e.target.value, 0, 100),
                            })
                          }
                          className="w-14 rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-1 py-0.5 text-xs"
                        />
                        % of all records
                      </label>
                    )}
                    {rule.whenFieldBind && rule.whenValue && rule.mode === 'range' && (
                      <p className="text-[10px] text-[hsl(var(--text-tertiary))] leading-snug">
                        Example: when Gender = Male, put age in {rule.rangeMin}–{rule.rangeMax} for{' '}
                        {rule.percentOfTotal ?? 50}% of records.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(phase === 'generating' || phase === 'submitting') && (
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-[hsl(var(--text-secondary))]">
                <span>{phase === 'generating' ? 'Building paths…' : 'Submitting…'}</span>
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex items-start gap-2 rounded-lg bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-3 py-2 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Submitted {progress.done} synthetic record{progress.done === 1 ? '' : 's'} (tagged{' '}
                <code className="text-[10px]">source: synthetic_generator</code>).
              </span>
            </div>
          )}

          {phase === 'error' && error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 text-red-600 px-3 py-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 space-y-1">
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {lastBatch.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                  Last batch preview
                </span>
                <select
                  value={previewBind}
                  onChange={(e) => setPreviewBind(e.target.value)}
                  className="max-w-[160px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-1.5 py-0.5 text-[10px]"
                >
                  {fields.map((f) => (
                    <option key={f.bind} value={f.bind}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {previewDist.slice(0, 8).map((d) => (
                  <div key={d.value} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 truncate text-[hsl(var(--text-secondary))]">
                      {d.value}
                    </span>
                    <span className="text-[hsl(var(--text-tertiary))] tabular-nums">
                      {d.count} · {d.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={phase === 'generating' || phase === 'submitting' || !blueprint}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold text-sm py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {phase === 'generating' || phase === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {phase === 'generating' ? 'Generating…' : 'Submitting…'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate {count} record{count === 1 ? '' : 's'}
              </>
            )}
          </button>

          <p className="text-[10px] text-[hsl(var(--text-tertiary))] leading-relaxed">
            Form must be published (live). Automations still fire on create — use a test project for
            large batches.
          </p>
        </div>
      )}
    </div>
  );
};

function clampInt(raw: string, min: number, max: number) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export default SyntheticDataPanel;
