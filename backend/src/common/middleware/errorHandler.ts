import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { Logger } from '../logger/index.logger';
import { Config } from '../config/config';
import { ERROR_CODES, ERROR_MESSAGES, MONGO_ERROR_CODES } from '../constants/index.constants';
import type { ErrorCode } from '../constants/index.constants';

interface NormalizedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
}

const MONGO_DUPLICATE_KEY = MONGO_ERROR_CODES.DUPLICATE_KEY;

const isMongoServerError = (error: unknown): error is { code?: number; keyPattern?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null && 'code' in error;

const zodDetails = (error: ZodError): Record<string, string[]> => {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
};

/**
 * Maps thrown values onto the wire contract. Anything unrecognised becomes a generic
 * 500 with no internal detail — stack traces and driver messages go to the log, never
 * to the client.
 *
 * The mappings below exist because without them every malformed `:id` path param is a
 * 500 (Mongoose `CastError`) and every unique-index collision is a 500 (`E11000`),
 * which is both a bad contract and a noisy alerting problem.
 */
const normalize = (error: unknown): NormalizedError => {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      details: zodDetails(error),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string[]> = {};
    for (const [path, issue] of Object.entries(error.errors)) {
      details[path] = [issue.message];
    }
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      details,
    };
  }

  // A malformed ObjectId in a path param is a client mistake, not a server fault.
  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: ERROR_CODES.BAD_REQUEST,
      message: `Invalid value for '${error.path}'`,
    };
  }

  if (isMongoServerError(error) && error.code === MONGO_DUPLICATE_KEY) {
    return {
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
      message: ERROR_MESSAGES.CONFLICT,
    };
  }

  if (error instanceof Error) {
    // jsonwebtoken error names — mapped without importing the library.
    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        code: ERROR_CODES.TOKEN_EXPIRED,
        message: ERROR_MESSAGES.TOKEN_EXPIRED,
      };
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return {
        statusCode: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        message: ERROR_MESSAGES.INVALID_TOKEN,
      };
    }
    if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
      return {
        statusCode: 503,
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
      };
    }
  }

  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: ERROR_MESSAGES.INTERNAL_ERROR,
  };
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const normalized = normalize(err);

  const isServerFault = normalized.statusCode >= 500;

  const logContext = {
    method: req.method,
    path: req.path,
    statusCode: normalized.statusCode,
    code: normalized.code,
    // A rejected request is an expected outcome, not an incident: log the reason, not a
    // stack trace. Attaching the Error would bury the useful lines under a wall of
    // framework frames on every validation failure.
    ...(isServerFault ? { error: err } : { reason: normalized.message }),
  };

  // Client faults are noise at error level; only 5xx should page anyone.
  if (isServerFault) Logger.error('Request failed', logContext);
  else Logger.warn('Request rejected', logContext);

  // A response already on the wire cannot be replaced; handing back to Express lets
  // it destroy the socket instead of throwing ERR_HTTP_HEADERS_SENT over the top.
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = Logger.getRequestId();

  res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    code: normalized.code,
    ...(normalized.details ? { details: normalized.details } : {}),
    ...(requestId ? { requestId } : {}),
    // Dev-only: surface the real cause without ever shipping it to production clients.
    ...(!Config.server.isProduction && normalized.statusCode >= 500 && err instanceof Error
      ? { debug: { name: err.name, message: err.message } }
      : {}),
  });
};
