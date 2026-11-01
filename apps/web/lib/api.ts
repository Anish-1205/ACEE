'use client';
import { ApiError, createApiClient } from '@acee/shared';
import type { TFunction } from 'i18next';
import { errorKeyFor } from '@acee/i18n';
import type { ZodSafeParseResult } from 'zod';

export const api = createApiClient({ baseUrl: '/api/v1' });

/** Localised message for any thrown error; falls back to the server's English message. */
export function errorText(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) { const k = errorKeyFor(err.code); return k ? t(k) : err.message; }
  return t('common:errorBody');
}

export type FieldErrors = Record<string, string>;

/** Zod messages are i18n keys (e.g. "validation:mobile"); unknown messages fall back to a generic one. */
export function fieldErrors(t: TFunction, result: ZodSafeParseResult<unknown>): FieldErrors {
  if (result.success) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message.includes(':') ? t(issue.message) : t('validation:required');
  }
  return out;
}

/** Field errors returned by the API (fastify-type-provider-zod format). */
export function apiFieldErrors(t: TFunction, err: unknown): FieldErrors {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_ERROR' || !Array.isArray(err.details)) return {};
  const out: FieldErrors = {};
  for (const d of err.details as { instancePath?: string; message?: string }[]) {
    const key = (d.instancePath ?? '').split('/').filter(Boolean)[0] ?? '_';
    out[key] ??= d.message?.includes(':') ? t(d.message) : t('validation:required');
  }
  return out;
}
