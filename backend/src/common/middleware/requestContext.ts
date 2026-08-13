import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger/index.logger';
import { HEADERS } from '../constants/index.constants';

/** Accept an inbound id only if it is safe to echo into logs and response headers. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Assigns a request id, echoes it back, and binds it to the async context so every
 * log line emitted while handling this request carries the same correlation id.
 *
 * An inbound `x-request-id` is honoured (so a reverse proxy or calling service can
 * stitch traces together) but validated first — an unfiltered header would let a
 * caller inject newlines into our log stream.
 */
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const inbound = req.headers[HEADERS.REQUEST_ID];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;

  const requestId =
    candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID().replace(/-/g, '').slice(0, 16);

  res.setHeader(HEADERS.REQUEST_ID, requestId);
  Logger.withRequestId(requestId, next);
};
