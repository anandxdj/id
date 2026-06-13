import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route handler so rejections reach the Express error handler. */
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
