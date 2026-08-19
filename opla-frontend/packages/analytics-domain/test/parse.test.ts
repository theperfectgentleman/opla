import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parseLegacyQuestion } from '../src/index';
import { parseQuery } from '../src/parse';
import { parseTableId } from '../src/ids';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(here, 'fixtures', 'legacy-saved-questions', name), 'utf8'));
}

describe('parseLegacyQuestion', () => {
  it('rejects Walker as a persisted viz', () => {
    const parsed = parseLegacyQuestion(loadFixture('walker.json'));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, 'walker_not_supported');
  });

  it('rejects markdown as a question', () => {
    const parsed = parseLegacyQuestion(loadFixture('markdown.json'));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, 'markdown_not_a_question');
  });

  it('rejects a query that mixes rows select with summary measures', () => {
    const parsed = parseLegacyQuestion(loadFixture('mixed-rows-summary.json'));
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, 'unparseable_query');
  });

  it('upgrades a v1 QuickChart save to Query version 2 summary', () => {
    const parsed = parseLegacyQuestion(loadFixture('v1-chart.json'));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.query.version, 2);
    assert.equal(parsed.value.query.kind, 'summary');
    assert.equal(parsed.value.viz.kind, 'chart');
    if (parsed.value.query.kind !== 'summary' || parsed.value.viz.kind !== 'chart') return;
    assert.equal(parsed.value.query.measures[0].fn, 'count_rows');
    assert.equal(parsed.value.query.measures[0].alias, 'count');
    if (parsed.value.viz.mark === 'scatter') return;
    assert.equal(parsed.value.viz.y, 'count');
    assert.equal(parsed.value.viz.x, 'district');
  });
});

describe('parseQuery', () => {
  it('rejects mixed select and measures even without a question envelope', () => {
    const table = parseTableId('33333333-3333-4333-8333-333333333333');
    assert.equal(table.ok, true);
    if (!table.ok) return;
    const parsed = parseQuery(
      {
        version: 2,
        kind: 'rows',
        table: table.value,
        select: [{ kind: 'field', field: 'district' }],
        measures: [{ kind: 'measure', fn: 'count_rows', alias: 'visits' }],
        orderBy: [],
        limit: 500,
        offset: 0,
      },
      table.value,
    );
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, 'unparseable_query');
  });
});
