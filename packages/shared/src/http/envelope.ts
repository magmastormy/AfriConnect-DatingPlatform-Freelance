/**
 * Standard HTTP response envelope (AGENTS.md Clause 5.3).
 * Every success/error response is shaped consistently.
 */

export interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  timestamp: string;
  cached?: boolean;
  count?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Meta;
  error: null;
}

export interface ApiError {
  success: false;
  data: null;
  meta: { timestamp: string };
  error: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
}

export function success<T>(data: T, meta?: Omit<Meta, 'timestamp'>): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), ...meta },
    error: null,
  };
}

export function errorPayload(
  code: string,
  message: string,
  field?: string,
  details?: unknown,
): ApiError {
  return {
    success: false,
    data: null,
    meta: { timestamp: new Date().toISOString() },
    error: { code, message, field, details },
  };
}

/** Pagination helper honouring named constants. */
export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

export function toPagination(page?: number, limit?: number): Pagination {
  const safePage = Math.max(1, Math.floor(page ?? DEFAULT_PAGE));
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE)));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}
