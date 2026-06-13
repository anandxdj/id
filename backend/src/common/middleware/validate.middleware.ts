import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body); // overwrite with stripped/typed values
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return next(ApiError.badRequest(message));
      }
      next(error);
    }
  };
};
