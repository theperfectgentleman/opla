import {
  parseFieldKey,
  parseLimit,
  parseMetricAlias,
  parseProjectId,
  parseQuestionId,
  parseTableId,
} from './ids';
import { bindVizToQuery } from './question';
import { fail, isRecord, ok } from './result';
import type {
  DateBucket,
  Dimension,
  FieldKey,
  Literal,
  Measure,
  NonEmpty,
  Order,
  ParseResult,
  Predicate,
  Query,
  Question,
  Select,
  TableId,
  Viz,
} from './types';

export function nonEmpty<T>(items: readonly T[], label: string): ParseResult<NonEmpty<T>> {
  if (items.length === 0) return fail('empty', `${label} is empty`);
  const [head, ...rest] = items;
  return ok([head, ...rest]);
}

function readString(record: Record<string, unknown>, key: string): ParseResult<string> {
  const value = record[key];
  if (typeof value !== 'string') return fail('unparseable', `${key} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return fail('empty', `${key} is empty`);
  return ok(trimmed);
}

function parseOffset(raw: unknown): ParseResult<number> {
  if (raw === undefined) return ok(0);
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return fail('unparseable', 'offset must be a non-negative integer');
  }
  return ok(raw);
}

function isDateBucket(value: string): value is DateBucket {
  switch (value) {
    case 'day':
    case 'week':
    case 'month':
    case 'quarter':
    case 'year':
      return true;
    default:
      return false;
  }
}

function parseLiteral(raw: unknown): ParseResult<Literal> {
  if (typeof raw === 'string') return ok({ kind: 'text', value: raw });
  if (typeof raw === 'number' && Number.isFinite(raw)) return ok({ kind: 'number', value: raw });
  if (typeof raw === 'boolean') return ok({ kind: 'boolean', value: raw });
  return fail('unparseable', 'literal must be text, number, or boolean');
}

function parsePredicate(raw: unknown): ParseResult<Predicate | undefined> {
  if (raw === undefined || raw === null) return ok(undefined);
  if (!isRecord(raw)) return fail('unparseable_query', 'filters are not an object');
  const keys = Object.keys(raw);
  if (keys.length === 0) return ok(undefined);

  if (typeof raw.kind === 'string') return parsePredicateNode(raw);

  const rules = raw.rules;
  if (!Array.isArray(rules)) return fail('unparseable_query', 'filters.rules must be an array');
  if (rules.length === 0) return ok(undefined);
  const parsed: Predicate[] = [];
  for (const rule of rules) {
    const clause = parseFilterRule(rule);
    if (!clause.ok) return clause;
    parsed.push(clause.value);
  }
  const clauses = nonEmpty(parsed, 'filters.rules');
  if (!clauses.ok) return clauses;
  const combinator = raw.combinator === 'or' ? 'or' : 'and';
  return ok(combinator === 'or' ? { kind: 'or', clauses: clauses.value } : { kind: 'and', clauses: clauses.value });
}

function parsePredicateNode(raw: Record<string, unknown>): ParseResult<Predicate> {
  switch (raw.kind) {
    case 'and':
    case 'or': {
      if (!Array.isArray(raw.clauses)) return fail('unparseable_query', 'predicate clauses must be an array');
      const parsed: Predicate[] = [];
      for (const clause of raw.clauses) {
        if (!isRecord(clause)) return fail('unparseable_query', 'predicate clause is not an object');
        const inner = parsePredicateNode(clause);
        if (!inner.ok) return inner;
        parsed.push(inner.value);
      }
      const clauses = nonEmpty(parsed, 'predicate clauses');
      if (!clauses.ok) return clauses;
      return ok(raw.kind === 'or' ? { kind: 'or', clauses: clauses.value } : { kind: 'and', clauses: clauses.value });
    }
    case 'not': {
      if (!isRecord(raw.clause)) return fail('unparseable_query', 'not.clause must be an object');
      const clause = parsePredicateNode(raw.clause);
      if (!clause.ok) return clause;
      return ok({ kind: 'not', clause: clause.value });
    }
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const field = parseNamedField(raw.field);
      if (!field.ok) return field;
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: raw.kind, field: field.value, value: value.value });
    }
    case 'contains': {
      const field = parseNamedField(raw.field);
      if (!field.ok) return field;
      if (typeof raw.value !== 'string') return fail('unparseable_query', 'contains value must be text');
      return ok({ kind: 'contains', field: field.value, value: raw.value });
    }
    case 'in': {
      const field = parseNamedField(raw.field);
      if (!field.ok) return field;
      if (!Array.isArray(raw.values)) return fail('unparseable_query', 'in.values must be an array');
      const values: Literal[] = [];
      for (const item of raw.values) {
        const literal = parseLiteral(item);
        if (!literal.ok) return literal;
        values.push(literal.value);
      }
      const nonempty = nonEmpty(values, 'in.values');
      if (!nonempty.ok) return nonempty;
      return ok({ kind: 'in', field: field.value, values: nonempty.value });
    }
    case 'is_null':
    case 'is_not_null': {
      const field = parseNamedField(raw.field);
      if (!field.ok) return field;
      return ok({ kind: raw.kind, field: field.value });
    }
    default:
      return fail('unparseable_query', `unknown predicate kind ${String(raw.kind)}`);
  }
}

function parseNamedField(raw: unknown): ParseResult<FieldKey> {
  if (typeof raw !== 'string') return fail('unparseable_query', 'field must be a string');
  return parseFieldKey(raw);
}

function parseFilterRule(raw: unknown): ParseResult<Predicate> {
  if (!isRecord(raw)) return fail('unparseable_query', 'filter rule is not an object');
  const field = parseNamedField(raw.field);
  if (!field.ok) return field;
  const operator = typeof raw.operator === 'string' ? raw.operator : typeof raw.op === 'string' ? raw.op : undefined;
  if (operator === undefined) return fail('unparseable_query', 'filter rule is missing operator');
  switch (operator) {
    case '=':
    case 'eq': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'eq', field: field.value, value: value.value });
    }
    case '!=':
    case 'neq': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'neq', field: field.value, value: value.value });
    }
    case '<':
    case 'lt': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'lt', field: field.value, value: value.value });
    }
    case '<=':
    case 'lte': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'lte', field: field.value, value: value.value });
    }
    case '>':
    case 'gt': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'gt', field: field.value, value: value.value });
    }
    case '>=':
    case 'gte': {
      const value = parseLiteral(raw.value);
      if (!value.ok) return value;
      return ok({ kind: 'gte', field: field.value, value: value.value });
    }
    case 'contains': {
      if (typeof raw.value !== 'string') return fail('unparseable_query', 'contains value must be text');
      return ok({ kind: 'contains', field: field.value, value: raw.value });
    }
    case 'is_null':
      return ok({ kind: 'is_null', field: field.value });
    case 'is_not_null':
      return ok({ kind: 'is_not_null', field: field.value });
    default:
      return fail('unparseable_query', `unsupported filter operator ${operator}`);
  }
}

function parseSelect(raw: unknown): ParseResult<Select> {
  if (typeof raw === 'string') {
    const field = parseFieldKey(raw);
    if (!field.ok) return field;
    return ok({ kind: 'field', field: field.value });
  }
  if (!isRecord(raw)) return fail('unparseable_query', 'select item is not an object');
  if (raw.kind === 'field' || raw.field !== undefined) {
    const field = parseNamedField(raw.field);
    if (!field.ok) return field;
    return ok({ kind: 'field', field: field.value });
  }
  return fail('unparseable_query', 'select expressions beyond a field are not in v1 upgrade');
}

function parseDimension(raw: unknown): ParseResult<Dimension> {
  if (typeof raw === 'string') {
    const field = parseFieldKey(raw);
    if (!field.ok) return field;
    return ok({ kind: 'field', field: field.value });
  }
  if (!isRecord(raw)) return fail('unparseable_query', 'group_by item is not an object');
  const fieldRaw = raw.field ?? raw.key;
  const field = parseNamedField(fieldRaw);
  if (!field.ok) return field;
  if (typeof raw.bucket === 'string') {
    if (!isDateBucket(raw.bucket)) return fail('unparseable_query', `unknown date bucket ${raw.bucket}`);
    return ok({ kind: 'time', field: field.value, bucket: raw.bucket });
  }
  return ok({ kind: 'field', field: field.value });
}

function parseMeasure(raw: unknown, index: number): ParseResult<Measure> {
  if (!isRecord(raw)) return fail('unparseable_query', 'aggregate is not an object');
  const fn = typeof raw.fn === 'string' ? raw.fn : undefined;
  if (fn === undefined) return fail('unparseable_query', 'aggregate is missing fn');
  const aliasRaw = typeof raw.alias === 'string' && raw.alias.trim().length > 0 ? raw.alias : `${fn}_${index}`;
  const alias = parseMetricAlias(aliasRaw);
  if (!alias.ok) return alias;
  if (fn === 'count_rows' || fn === 'count') {
    return ok({ kind: 'measure', fn: 'count_rows', alias: alias.value });
  }
  if (fn === 'count_distinct' || fn === 'sum' || fn === 'avg' || fn === 'min' || fn === 'max') {
    const field = parseNamedField(raw.field);
    if (!field.ok) return field;
    return ok({ kind: 'measure', fn, field: field.value, alias: alias.value });
  }
  return fail('unparseable_query', `unsupported aggregate ${fn}`);
}

function parseOrder(raw: unknown): ParseResult<Order> {
  if (!isRecord(raw)) return fail('unparseable_query', 'order_by item is not an object');
  const fieldRaw = raw.field;
  if (typeof fieldRaw !== 'string') return fail('unparseable_query', 'order_by.field must be a string');
  const field = parseFieldKey(fieldRaw);
  if (!field.ok) return field;
  const direction = raw.direction === 'desc' ? 'desc' : 'asc';
  return ok({ field: field.value, direction });
}

function parseOrderList(raw: unknown): ParseResult<readonly Order[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) return fail('unparseable_query', 'order_by must be an array');
  const orders: Order[] = [];
  for (const item of raw) {
    const order = parseOrder(item);
    if (!order.ok) return order;
    orders.push(order.value);
  }
  return ok(orders);
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return record[key] !== undefined;
}

export function parseQuery(raw: unknown, tableId: TableId): ParseResult<Query> {
  if (!isRecord(raw)) return fail('unparseable_query', 'query is not an object');

  if (hasKey(raw, 'select') && (hasKey(raw, 'measures') || hasKey(raw, 'groupBy') || hasKey(raw, 'group_by'))) {
    return fail('unparseable_query', 'rows select cannot mix with summary measures');
  }

  if (raw.version === 2) return parseQueryV2(raw, tableId);
  return upgradeQueryConfigV1(raw, tableId);
}

function parseQueryV2(raw: Record<string, unknown>, tableId: TableId): ParseResult<Query> {
  const table = hasKey(raw, 'table')
    ? typeof raw.table === 'string'
      ? parseTableId(raw.table)
      : fail<TableId>('unparseable_query', 'table must be a uuid')
    : ok(tableId);
  if (!table.ok) return table;

  const where = parsePredicate(raw.where);
  if (!where.ok) return where;
  const orderBy = parseOrderList(raw.orderBy ?? raw.order_by);
  if (!orderBy.ok) return orderBy;
  const limit = parseLimit(raw.limit);
  if (!limit.ok) return limit;

  if (raw.kind === 'rows') {
    if (!Array.isArray(raw.select)) return fail('unparseable_query', 'rows query needs select');
    const selected: Select[] = [];
    for (const item of raw.select) {
      const select = parseSelect(item);
      if (!select.ok) return select;
      selected.push(select.value);
    }
    const nonempty = nonEmpty(selected, 'select');
    if (!nonempty.ok) return nonempty;
    const offset = parseOffset(raw.offset);
    if (!offset.ok) return offset;
    const query: Query = {
      version: 2,
      kind: 'rows',
      table: table.value,
      select: nonempty.value,
      orderBy: orderBy.value,
      limit: limit.value,
      offset: offset.value,
    };
    if (where.value) query.where = where.value;
    return ok(query);
  }

  if (raw.kind === 'summary') {
    if (!Array.isArray(raw.measures)) return fail('unparseable_query', 'summary query needs measures');
    const measures: Measure[] = [];
    for (const [index, item] of raw.measures.entries()) {
      const measure = parseMeasure(item, index);
      if (!measure.ok) return measure;
      measures.push(measure.value);
    }
    const nonempty = nonEmpty(measures, 'measures');
    if (!nonempty.ok) return nonempty;
    const dimensions: Dimension[] = [];
    const dimensionRaw = raw.dimensions ?? [];
    if (!Array.isArray(dimensionRaw)) return fail('unparseable_query', 'dimensions must be an array');
    for (const item of dimensionRaw) {
      const dimension = parseDimension(item);
      if (!dimension.ok) return dimension;
      dimensions.push(dimension.value);
    }
    const query: Query = {
      version: 2,
      kind: 'summary',
      table: table.value,
      dimensions,
      measures: nonempty.value,
      orderBy: orderBy.value,
      limit: limit.value,
    };
    if (where.value) query.where = where.value;
    return ok(query);
  }

  return fail('unparseable_query', 'query.kind must be rows or summary');
}

export function upgradeQueryConfigV1(raw: unknown, tableId: TableId): ParseResult<Query> {
  if (!isRecord(raw)) return fail('unparseable_query', 'query_config is not an object');
  const groupByRaw = raw.group_by ?? raw.groupBy;
  const aggregatesRaw = raw.aggregates ?? raw.measures;
  const selectRaw = raw.select_fields ?? raw.select;
  const hasGroups = Array.isArray(groupByRaw) && groupByRaw.length > 0;
  const hasAggregates = Array.isArray(aggregatesRaw) && aggregatesRaw.length > 0;
  const where = parsePredicate(raw.filters ?? raw.where);
  if (!where.ok) return where;
  const orderBy = parseOrderList(raw.order_by ?? raw.orderBy);
  if (!orderBy.ok) return orderBy;
  const limit = parseLimit(raw.limit);
  if (!limit.ok) return limit;

  if (hasGroups || hasAggregates) {
    const measures: Measure[] = [];
    const aggregateItems = Array.isArray(aggregatesRaw) ? aggregatesRaw : [];
    for (const [index, item] of aggregateItems.entries()) {
      const measure = parseMeasure(item, index);
      if (!measure.ok) return measure;
      measures.push(measure.value);
    }
    const nonempty = nonEmpty(measures, 'aggregates');
    if (!nonempty.ok) return nonempty;
    const dimensions: Dimension[] = [];
    const groupItems = Array.isArray(groupByRaw) ? groupByRaw : [];
    for (const item of groupItems) {
      const dimension = parseDimension(item);
      if (!dimension.ok) return dimension;
      dimensions.push(dimension.value);
    }
    const query: Query = {
      version: 2,
      kind: 'summary',
      table: tableId,
      dimensions,
      measures: nonempty.value,
      orderBy: orderBy.value,
      limit: limit.value,
    };
    if (where.value) query.where = where.value;
    return ok(query);
  }

  const selectItems = Array.isArray(selectRaw) ? selectRaw : [];
  const selected: Select[] = [];
  for (const item of selectItems) {
    const select = parseSelect(item);
    if (!select.ok) return select;
    selected.push(select.value);
  }
  const nonempty = nonEmpty(selected, 'select_fields');
  if (!nonempty.ok) return nonempty;
  const offset = parseOffset(raw.offset);
  if (!offset.ok) return offset;
  const query: Query = {
    version: 2,
    kind: 'rows',
    table: tableId,
    select: nonempty.value,
    orderBy: orderBy.value,
    limit: limit.value,
    offset: offset.value,
  };
  if (where.value) query.where = where.value;
  return ok(query);
}

function parseMark(raw: unknown): ParseResult<'bar' | 'line' | 'pie'> {
  if (raw === 'bar' || raw === 'line' || raw === 'pie') return ok(raw);
  if (raw === 'column') return ok('bar');
  return fail('unparseable', `unsupported chart mark ${String(raw)}`);
}

export function upgradeVizConfig(vizType: unknown, vizConfig: unknown, query: Query): ParseResult<Viz> {
  if (vizType === 'walker') return fail('walker_not_supported', 'Walker is a scratchpad, not a saved viz');
  if (vizType === 'markdown') return fail('markdown_not_a_question', 'markdown is a board tile, not a question');
  if (vizType === 'goal') return fail('unparseable', 'goal is not a viz on the question contract');

  const config = isRecord(vizConfig) ? vizConfig : {};

  if (vizType === 'kpi') {
    if (query.kind !== 'summary') return fail('viz_query_mismatch', 'kpi needs a summary query');
    return ok({ kind: 'kpi', value: query.measures[0].alias });
  }

  if (vizType === 'map') {
    const pointRaw = typeof config.point === 'string' ? config.point : typeof config.location === 'string' ? config.location : undefined;
    if (pointRaw === undefined) return fail('unparseable', 'map viz needs a point field');
    const point = parseFieldKey(pointRaw);
    if (!point.ok) return point;
    const viz: Viz = { kind: 'map', point: point.value };
    if (typeof config.label === 'string') {
      const label = parseFieldKey(config.label);
      if (!label.ok) return label;
      viz.label = label.value;
    }
    if (typeof config.color === 'string') {
      const color = parseFieldKey(config.color);
      if (!color.ok) return color;
      viz.color = color.value;
    }
    return ok(viz);
  }

  if (vizType === 'chart') {
    const markRaw = config.chart_type ?? config.mark;
    if (markRaw === 'scatter') {
      if (typeof config.category_field !== 'string' && typeof config.x !== 'string') {
        return fail('unparseable', 'scatter needs an x field');
      }
      const xRaw = typeof config.x === 'string' ? config.x : String(config.category_field);
      const yRaw =
        typeof config.y === 'string'
          ? config.y
          : typeof config.metric_field === 'string'
            ? config.metric_field
            : undefined;
      if (yRaw === undefined) return fail('unparseable', 'scatter needs a y field');
      const xField = parseFieldKey(xRaw);
      const yField = parseFieldKey(yRaw);
      if (!xField.ok) return xField;
      if (!yField.ok) return yField;
      return ok({ kind: 'chart', mark: 'scatter', x: xField.value, y: yField.value });
    }
    if (query.kind !== 'summary') return fail('viz_query_mismatch', 'bar, line, and pie charts need a summary');
    const mark = parseMark(markRaw ?? 'bar');
    if (!mark.ok) return mark;
    const xRaw = typeof config.category_field === 'string' ? config.category_field : typeof config.x === 'string' ? config.x : undefined;
    const x = xRaw !== undefined ? parseFieldKey(xRaw) : firstDimensionField(query);
    if (!x.ok) return x;
    const yRaw = typeof config.y === 'string' ? config.y : typeof config.metric_alias === 'string' ? config.metric_alias : undefined;
    const y = yRaw !== undefined ? parseMetricAlias(yRaw) : ok(query.measures[0].alias);
    if (!y.ok) return y;
    const viz: Extract<Viz, { kind: 'chart'; mark: 'bar' | 'line' | 'pie' }> = {
      kind: 'chart',
      mark: mark.value,
      x: x.value,
      y: y.value,
    };
    const seriesRaw = typeof config.series_field === 'string' ? config.series_field : typeof config.series === 'string' ? config.series : undefined;
    if (seriesRaw !== undefined && seriesRaw.length > 0) {
      const series = parseFieldKey(seriesRaw);
      if (!series.ok) return series;
      viz.series = series.value;
    }
    return ok(viz);
  }

  if (vizType === 'table' || vizType === undefined) {
    return tableVizFromQuery(query, config);
  }

  return fail('unparseable', `unknown viz_type ${String(vizType)}`);
}

function firstDimensionField(query: Extract<Query, { kind: 'summary' }>): ParseResult<FieldKey> {
  const first = query.dimensions[0];
  if (first === undefined) return fail('viz_query_mismatch', 'chart needs a dimension');
  return ok(first.field);
}

function tableVizFromQuery(query: Query, config: Record<string, unknown>): ParseResult<Viz> {
  if (Array.isArray(config.columns)) {
    const columns: Array<FieldKey> = [];
    for (const item of config.columns) {
      if (typeof item !== 'string') return fail('unparseable', 'table columns must be strings');
      const key = parseFieldKey(item);
      if (!key.ok) return key;
      columns.push(key.value);
    }
    const nonempty = nonEmpty(columns, 'table columns');
    if (!nonempty.ok) return nonempty;
    return ok({ kind: 'table', columns: nonempty.value });
  }
  if (query.kind === 'rows') {
    const columns = query.select.map((item) => (item.kind === 'field' ? item.field : item.alias));
    const nonempty = nonEmpty(columns, 'table columns');
    if (!nonempty.ok) return nonempty;
    return ok({ kind: 'table', columns: nonempty.value });
  }
  const columns = [...query.dimensions.map((item) => item.field), ...query.measures.map((item) => item.alias)];
  const nonempty = nonEmpty(columns, 'table columns');
  if (!nonempty.ok) return nonempty;
  return ok({ kind: 'table', columns: nonempty.value });
}

function tableIdFromSource(source: unknown): ParseResult<TableId> {
  if (!isRecord(source)) return fail('unparseable', 'source_config is not an object');
  const datasetId = source.dataset_id ?? source.table ?? source.table_id;
  if (typeof datasetId !== 'string') return fail('unparseable', 'source_config.dataset_id is required');
  return parseTableId(datasetId);
}

export function parseLegacyQuestion(payload: unknown): ParseResult<Question> {
  if (!isRecord(payload)) return fail('unparseable', 'question is not an object');

  const vizType = payload.viz_type;
  if (vizType === 'walker') return fail('walker_not_supported', 'Walker is a scratchpad, not a saved viz');
  if (vizType === 'markdown') return fail('markdown_not_a_question', 'markdown is a board tile, not a question');

  const idRaw = payload.id;
  if (typeof idRaw !== 'string') return fail('unparseable', 'question id is required');
  const id = parseQuestionId(idRaw);
  if (!id.ok) return id;

  const projectRaw = payload.project_id ?? payload.projectId;
  if (typeof projectRaw !== 'string') return fail('missing_project', 'saved questions need a project');
  const projectId = parseProjectId(projectRaw);
  if (!projectId.ok) return projectId;

  const title = readString(payload, 'title');
  if (!title.ok) return title;

  if (isRecord(payload.query) && payload.query.version === 2 && isRecord(payload.viz)) {
    const table = typeof payload.query.table === 'string' ? parseTableId(payload.query.table) : fail<TableId>('unparseable_query', 'query.table is required');
    if (!table.ok) return table;
    const query = parseQuery(payload.query, table.value);
    if (!query.ok) return query;
    const viz = parseDomainViz(payload.viz);
    if (!viz.ok) return viz;
    const bound = bindVizToQuery(query.value, viz.value);
    if (!bound.ok) return bound;
    return ok({
      id: id.value,
      projectId: projectId.value,
      title: title.value,
      query: query.value,
      viz: viz.value,
    });
  }

  const table = tableIdFromSource(payload.source_config ?? payload.source);
  if (!table.ok) return table;
  const queryRaw = payload.query_config ?? payload.query;
  const query = parseQuery(queryRaw, table.value);
  if (!query.ok) return query;
  const viz = upgradeVizConfig(vizType, payload.viz_config ?? payload.viz, query.value);
  if (!viz.ok) return viz;
  const bound = bindVizToQuery(query.value, viz.value);
  if (!bound.ok) return bound;
  return ok({
    id: id.value,
    projectId: projectId.value,
    title: title.value,
    query: query.value,
    viz: viz.value,
  });
}

function parseDomainViz(raw: Record<string, unknown>): ParseResult<Viz> {
  switch (raw.kind) {
    case 'table': {
      if (!Array.isArray(raw.columns)) return fail('unparseable', 'table viz needs columns');
      const columns: FieldKey[] = [];
      for (const item of raw.columns) {
        if (typeof item !== 'string') return fail('unparseable', 'table columns must be strings');
        const key = parseFieldKey(item);
        if (!key.ok) return key;
        columns.push(key.value);
      }
      const nonempty = nonEmpty(columns, 'table columns');
      if (!nonempty.ok) return nonempty;
      return ok({ kind: 'table', columns: nonempty.value });
    }
    case 'chart': {
      if (raw.mark === 'scatter') {
        if (typeof raw.x !== 'string' || typeof raw.y !== 'string') {
          return fail('unparseable', 'scatter needs x and y');
        }
        const x = parseFieldKey(raw.x);
        const y = parseFieldKey(raw.y);
        if (!x.ok) return x;
        if (!y.ok) return y;
        return ok({ kind: 'chart', mark: 'scatter', x: x.value, y: y.value });
      }
      if (raw.mark !== 'bar' && raw.mark !== 'line' && raw.mark !== 'pie') {
        return fail('unparseable', 'chart mark must be bar, line, pie, or scatter');
      }
      if (typeof raw.x !== 'string' || typeof raw.y !== 'string') {
        return fail('unparseable', 'chart needs x and y');
      }
      const x = parseFieldKey(raw.x);
      const y = parseMetricAlias(raw.y);
      if (!x.ok) return x;
      if (!y.ok) return y;
      const viz: Extract<Viz, { kind: 'chart'; mark: 'bar' | 'line' | 'pie' }> = {
        kind: 'chart',
        mark: raw.mark,
        x: x.value,
        y: y.value,
      };
      if (typeof raw.series === 'string' && raw.series.length > 0) {
        const series = parseFieldKey(raw.series);
        if (!series.ok) return series;
        viz.series = series.value;
      }
      return ok(viz);
    }
    case 'map': {
      if (typeof raw.point !== 'string') return fail('unparseable', 'map needs a point field');
      const point = parseFieldKey(raw.point);
      if (!point.ok) return point;
      const viz: Extract<Viz, { kind: 'map' }> = { kind: 'map', point: point.value };
      if (typeof raw.label === 'string') {
        const label = parseFieldKey(raw.label);
        if (!label.ok) return label;
        viz.label = label.value;
      }
      if (typeof raw.color === 'string') {
        const color = parseFieldKey(raw.color);
        if (!color.ok) return color;
        viz.color = color.value;
      }
      return ok(viz);
    }
    case 'kpi': {
      if (typeof raw.value !== 'string') return fail('unparseable', 'kpi needs a measure alias');
      const value = parseMetricAlias(raw.value);
      if (!value.ok) return value;
      const viz: Extract<Viz, { kind: 'kpi' }> = { kind: 'kpi', value: value.value };
      if (typeof raw.target === 'number' && Number.isFinite(raw.target)) viz.target = raw.target;
      return ok(viz);
    }
    default:
      return fail('unparseable', `unknown viz kind ${String(raw.kind)}`);
  }
}
