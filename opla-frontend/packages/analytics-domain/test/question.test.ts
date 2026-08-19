import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitQuestion } from '../src/question';
import { parseFieldKey, parseLimit, parseMetricAlias, parseProjectId, parseTableId } from '../src/ids';
import type { Query, Result, Viz } from '../src/types';

function must<T>(parsed: { ok: true; value: T } | { ok: false }): T {
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error('parse failed');
  return parsed.value;
}

describe('commitQuestion', () => {
  it('rejects a truncated summary as a chart', () => {
    const table = must(parseTableId('33333333-3333-4333-8333-333333333333'));
    const projectId = must(parseProjectId('22222222-2222-4222-8222-222222222222'));
    const district = must(parseFieldKey('district'));
    const visits = must(parseMetricAlias('visits'));
    const limit = must(parseLimit(500));
    const query: Query = {
      version: 2,
      kind: 'summary',
      table,
      dimensions: [{ kind: 'field', field: district }],
      measures: [{ kind: 'measure', fn: 'count_rows', alias: visits }],
      orderBy: [],
      limit,
    };
    const result: Result = {
      kind: 'truncated',
      query,
      columns: [
        { key: district, label: 'District', type: 'text' },
        { key: visits, label: 'Visits', type: 'number' },
      ],
      rows: [],
      totalCount: 9000,
    };
    const viz: Viz = { kind: 'chart', mark: 'bar', x: district, y: visits };
    const saved = commitQuestion({ title: 'Visits by district', result, viz, projectId });
    assert.equal(saved.ok, false);
    if (saved.ok) return;
    assert.equal(saved.code, 'truncated_summary');
  });

  it('stores the query that produced the result', () => {
    const table = must(parseTableId('33333333-3333-4333-8333-333333333333'));
    const projectId = must(parseProjectId('22222222-2222-4222-8222-222222222222'));
    const district = must(parseFieldKey('district'));
    const visits = must(parseMetricAlias('visits'));
    const limit = must(parseLimit(500));
    const query: Query = {
      version: 2,
      kind: 'summary',
      table,
      dimensions: [{ kind: 'field', field: district }],
      measures: [{ kind: 'measure', fn: 'count_rows', alias: visits }],
      orderBy: [],
      limit,
    };
    const result: Result = {
      kind: 'complete',
      query,
      columns: [
        { key: district, label: 'District', type: 'text' },
        { key: visits, label: 'Visits', type: 'number' },
      ],
      rows: [],
      totalCount: 4,
    };
    const viz: Viz = { kind: 'chart', mark: 'bar', x: district, y: visits };
    const saved = commitQuestion({ title: 'Visits by district', result, viz, projectId });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.value.query, query);
    assert.equal(saved.value.viz.kind, 'chart');
  });
});
