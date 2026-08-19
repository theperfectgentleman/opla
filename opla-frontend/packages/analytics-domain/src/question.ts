import { fail, ok } from './result';
import type {
  FieldKey,
  MetricAlias,
  ParseResult,
  Query,
  QuestionDraft,
  Result,
  ResultColumn,
  Viz,
} from './types';

export function queryOutputKeys(query: Query): Set<string> {
  const keys = new Set<string>();
  if (query.kind === 'rows') {
    for (const item of query.select) {
      keys.add(item.kind === 'field' ? item.field : item.alias);
    }
    return keys;
  }
  for (const dimension of query.dimensions) keys.add(dimension.field);
  for (const measure of query.measures) keys.add(measure.alias);
  return keys;
}

function hasKey(keys: Set<string>, key: string): boolean {
  return keys.has(key);
}

function measureAliases(query: Query): Set<string> {
  if (query.kind !== 'summary') return new Set();
  return new Set(query.measures.map((measure) => measure.alias));
}

export function bindVizToQuery(query: Query, viz: Viz): ParseResult<Viz> {
  const keys = queryOutputKeys(query);
  switch (viz.kind) {
    case 'table': {
      for (const column of viz.columns) {
        if (!hasKey(keys, column)) return fail('unknown_field', `table column ${column} is not in the query`);
      }
      return ok(viz);
    }
    case 'chart': {
      if (viz.mark === 'scatter') {
        if (!hasKey(keys, viz.x) || !hasKey(keys, viz.y)) {
          return fail('viz_query_mismatch', 'scatter axes must be query outputs');
        }
        return ok(viz);
      }
      if (query.kind !== 'summary') return fail('viz_query_mismatch', 'bar, line, and pie charts need a summary');
      if (!hasKey(keys, viz.x)) return fail('unknown_field', `chart x ${viz.x} is not in the query`);
      if (!measureAliases(query).has(viz.y)) {
        return fail('viz_query_mismatch', 'chart y must be a declared measure alias');
      }
      if (viz.series !== undefined && !hasKey(keys, viz.series)) {
        return fail('unknown_field', `chart series ${viz.series} is not in the query`);
      }
      return ok(viz);
    }
    case 'map': {
      if (!hasKey(keys, viz.point)) return fail('unknown_field', `map point ${viz.point} is not in the query`);
      if (viz.label !== undefined && !hasKey(keys, viz.label)) {
        return fail('unknown_field', `map label ${viz.label} is not in the query`);
      }
      if (viz.color !== undefined && !hasKey(keys, viz.color)) {
        return fail('unknown_field', `map color ${viz.color} is not in the query`);
      }
      return ok(viz);
    }
    case 'kpi': {
      if (query.kind !== 'summary') return fail('viz_query_mismatch', 'kpi needs a summary query');
      if (!measureAliases(query).has(viz.value)) {
        return fail('viz_query_mismatch', 'kpi value must be a declared measure alias');
      }
      return ok(viz);
    }
    default: {
      const _exhaustive: never = viz;
      return fail('unparseable', `unknown viz ${_exhaustive}`);
    }
  }
}

function findColumn(result: Result, key: string): ResultColumn | undefined {
  return result.columns.find((column) => column.key === key);
}

export function bindVizToResult(result: Result, viz: Viz): ParseResult<Viz> {
  const againstQuery = bindVizToQuery(result.query, viz);
  if (!againstQuery.ok) return againstQuery;

  if (result.kind === 'truncated') {
    if (result.query.kind === 'summary' || viz.kind !== 'table') {
      return fail('truncated_summary', 'a truncated result cannot be saved as this viz');
    }
  }

  switch (viz.kind) {
    case 'table':
      return ok(viz);
    case 'chart': {
      if (viz.mark === 'scatter') {
        const x = findColumn(result, viz.x);
        const y = findColumn(result, viz.y);
        if (x === undefined || y === undefined) return fail('unknown_field', 'scatter column is missing from the result');
        if (x.type !== 'number' || y.type !== 'number') return fail('not_number', 'scatter axes must be numbers');
        return ok(viz);
      }
      const y = findColumn(result, viz.y);
      if (y === undefined) return fail('unknown_field', 'chart y is missing from the result');
      if (y.type !== 'number') return fail('not_number', 'chart y must be a number');
      return ok(viz);
    }
    case 'map': {
      const point = findColumn(result, viz.point);
      if (point === undefined) return fail('unknown_field', 'map point is missing from the result');
      if (point.type !== 'geo_point') return fail('not_geo_point', 'map point must be a geo_point column');
      return ok(viz);
    }
    case 'kpi': {
      const value = findColumn(result, viz.value);
      if (value === undefined) return fail('unknown_field', 'kpi value is missing from the result');
      if (value.type !== 'number') return fail('not_number', 'kpi value must be a number');
      return ok(viz);
    }
    default: {
      const _exhaustive: never = viz;
      return fail('unparseable', `unknown viz ${_exhaustive}`);
    }
  }
}

export function commitQuestion(input: {
  title: string;
  result: Result;
  viz: Viz;
  projectId: QuestionDraft['projectId'];
}): ParseResult<QuestionDraft> {
  const title = input.title.trim();
  if (title.length === 0) return fail('empty', 'title is empty');
  const viz = bindVizToResult(input.result, input.viz);
  if (!viz.ok) return viz;
  return ok({
    projectId: input.projectId,
    title,
    query: input.result.query,
    viz: viz.value,
  });
}

export function keepQueryable(table: { schema: { fields: readonly { key: FieldKey; type: string }[] } }, drop: readonly FieldKey[] = []): ParseResult<NonEmptyKeys> {
  const dropped = new Set<string>(drop);
  const keys = table.schema.fields
    .filter((field) => field.type !== 'attachment' && !dropped.has(field.key))
    .map((field) => field.key);
  if (keys.length === 0) return fail('empty', 'view would have no queryable columns');
  const [head, ...rest] = keys;
  return ok([head, ...rest]);
}

type NonEmptyKeys = [FieldKey, ...FieldKey[]];
