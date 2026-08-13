import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

/** Internal: Zod issues → a single 400. Path params and query strings use the same shape as bodies. */
const _toApiError = (error: unknown): unknown => {
  if (!(error instanceof ZodError)) return error;
  const message = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  return ApiError.badRequest(message);
};

/**
 * Request-shape validators. Bodies are replaced with the parsed value (strips unknown keys).
 * Params and query are assigned onto the existing objects so Express's prototype stays intact.
 */
export const Validate = {
  body(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        next(_toApiError(error));
      }
    };
  },

  params(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        Object.assign(req.params, schema.parse(req.params));
        next();
      } catch (error) {
        next(_toApiError(error));
      }
    };
  },

  query(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        Object.assign(req.query, schema.parse(req.query));
        next();
      } catch (error) {
        next(_toApiError(error));
      }
    };
  },
};

/** Body validator. Kept as a named alias so existing `validate(schema)` call sites stay valid. */
export const validate = Validate.body;
