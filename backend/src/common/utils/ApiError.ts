import { ERROR_CODES, ERROR_MESSAGES } from '../constants/index.constants';
import type { ErrorCode } from '../constants/index.constants';

/**
 * Stays a `class` on purpose: `err instanceof ApiError` is load-bearing in the error
 * handler, and that is the one carve-out from the wrapped-object export rule.
 *
 * `code` is new and additive — the response keeps `message` at the top level so
 * existing frontend error handling is unaffected, and gains a stable machine-readable
 * `code` that clients can switch on instead of string-matching copy.
 */
export class ApiError extends Error {
  public readonly statusCode: number;

  public readonly code: ErrorCode;

  /** Field-level detail for validation failures. */
  public readonly details?: Record<string, string[]>;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = ERROR_MESSAGES.BAD_REQUEST, code: ErrorCode = ERROR_CODES.BAD_REQUEST) {
    return new ApiError(400, message, code);
  }

  static validation(details: Record<string, string[]>, message = ERROR_MESSAGES.VALIDATION_ERROR) {
    return new ApiError(400, message, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(
    message = ERROR_MESSAGES.UNAUTHORIZED,
    code: ErrorCode = ERROR_CODES.UNAUTHORIZED,
  ) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = ERROR_MESSAGES.FORBIDDEN, code: ErrorCode = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = ERROR_MESSAGES.NOT_FOUND, code: ErrorCode = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message = ERROR_MESSAGES.CONFLICT, code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static tooManyRequests(
    message = ERROR_MESSAGES.TOO_MANY_REQUESTS,
    code: ErrorCode = ERROR_CODES.TOO_MANY_REQUESTS,
  ) {
    return new ApiError(429, message, code);
  }

  static internal(
    message = ERROR_MESSAGES.INTERNAL_ERROR,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
  ) {
    return new ApiError(500, message, code);
  }

  static serviceUnavailable(
    message = ERROR_MESSAGES.SERVICE_UNAVAILABLE,
    code: ErrorCode = ERROR_CODES.SERVICE_UNAVAILABLE,
  ) {
    return new ApiError(503, message, code);
  }

  /** Build from a code alone, using the paired message from the constants map. */
  static fromCode(statusCode: number, code: ErrorCode) {
    return new ApiError(statusCode, ERROR_MESSAGES[code], code);
  }
}
