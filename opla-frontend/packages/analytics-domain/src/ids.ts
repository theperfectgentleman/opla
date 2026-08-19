import type {
  BoardId,
  Brand,
  FieldKey,
  FormId,
  Limit,
  MetricAlias,
  OrgId,
  ParseResult,
  ProjectId,
  QuestionId,
  TableId,
  TeamId,
  TileId,
} from './types';
import { fail, ok } from './result';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function brand<Name extends string>(value: string): Brand<string, Name> {
  return value as Brand<string, Name>;
}

function parseUuid<Name extends string>(raw: string, label: string): ParseResult<Brand<string, Name>> {
  if (!UUID.test(raw)) return fail('unparseable', `${label} is not a uuid`);
  return ok(brand<Name>(raw.toLowerCase()));
}

export function parseOrgId(raw: string): ParseResult<OrgId> {
  return parseUuid(raw, 'org id');
}

export function parseProjectId(raw: string): ParseResult<ProjectId> {
  return parseUuid(raw, 'project id');
}

export function parseFormId(raw: string): ParseResult<FormId> {
  return parseUuid(raw, 'form id');
}

export function parseTableId(raw: string): ParseResult<TableId> {
  return parseUuid(raw, 'table id');
}

export function parseQuestionId(raw: string): ParseResult<QuestionId> {
  return parseUuid(raw, 'question id');
}

export function parseBoardId(raw: string): ParseResult<BoardId> {
  return parseUuid(raw, 'board id');
}

export function parseTileId(raw: string): ParseResult<TileId> {
  return parseUuid(raw, 'tile id');
}

export function parseTeamId(raw: string): ParseResult<TeamId> {
  return parseUuid(raw, 'team id');
}

export function parseFieldKey(raw: string): ParseResult<FieldKey> {
  const key = raw.trim();
  if (key.length === 0) return fail('empty', 'field key is empty');
  return ok(brand<'FieldKey'>(key));
}

export function parseMetricAlias(raw: string): ParseResult<MetricAlias> {
  const key = raw.trim();
  if (key.length === 0) return fail('empty', 'metric alias is empty');
  return ok(brand<'MetricAlias'>(key));
}

export const DEFAULT_ROW_LIMIT = 500;
const MAX_LIMIT = 10000;

export function parseLimit(raw: unknown, fallback = DEFAULT_ROW_LIMIT): ParseResult<Limit> {
  const value = raw === undefined ? fallback : raw;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    return fail('unparseable', 'limit must be an integer from 1 to 10000');
  }
  return ok(value as Limit);
}

export function defaultRowLimit(): Limit {
  const parsed = parseLimit(DEFAULT_ROW_LIMIT);
  if (!parsed.ok) throw new Error('DEFAULT_ROW_LIMIT is a valid limit');
  return parsed.value;
}
