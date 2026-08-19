import type { ParseResult, RejectCode } from './types';

export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: RejectCode, error: string): ParseResult<T> {
  return { ok: false, error, code };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
