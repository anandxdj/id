import { AsyncLocalStorage } from 'node:async_hooks';
import { Config } from '../config/config';

/**
 * Structured logger. Deliberately dependency-free — we need exactly three things
 * a `console.log` cannot give us:
 *
 *  1. Real `Error` serialisation. `JSON.stringify(new Error('boom'))` is `{}`, so a
 *     naive `logger.error(msg, { error })` silently discards every stack trace and
 *     message. That is how a project ends up unable to debug its own boot failures.
 *  2. Redaction. Tokens, passwords, secrets, and cookies must never reach a log sink;
 *     an identity provider's logs are a credential store if you let them be.
 *  3. Request correlation, so one request's lines can be stitched together.
 */

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;
type Level = Exclude<keyof typeof LEVEL_WEIGHT, 'silent'>;

/** Substring match, case-insensitive — catches `access_token`, `refreshToken`, `X-Api-Key`, … */
const REDACT_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'private',
  'credential',
  'hash',
  'code_verifier',
  'client_secret',
];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

const shouldRedact = (key: string): boolean => {
  const lower = key.toLowerCase();
  return REDACT_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
};

const serializeError = (error: Error): Record<string, unknown> => {
  const output: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  // Carry ApiError's statusCode/code and any other own enumerable properties.
  for (const key of Object.keys(error)) {
    if (key === 'name' || key === 'message' || key === 'stack') continue;
    output[key] = shouldRedact(key) ? REDACTED : sanitize((error as unknown as Record<string, unknown>)[key], 1);
  }
  if (error.cause instanceof Error) {
    output.cause = serializeError(error.cause);
  }
  return output;
};

const sanitize = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return String(value);
  if (type === 'function' || type === 'symbol') return `[${type}]`;

  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = shouldRedact(key) ? REDACTED : sanitize(nested, depth + 1);
  }
  return output;
};

const resolveLevel = (): keyof typeof LEVEL_WEIGHT => {
  try {
    return Config.server.logLevel;
  } catch {
    // Logging must never be the thing that fails while reporting a config error.
    return 'info';
  }
};

const isPretty = (): boolean => {
  try {
    return !Config.server.isProduction;
  } catch {
    return true;
  }
};

const write = (level: Level, message: string, context?: Record<string, unknown>): void => {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[resolveLevel()]) return;

  const requestId = requestContext.getStore()?.requestId;
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(requestId ? { requestId } : {}),
    ...(context ? (sanitize(context) as Record<string, unknown>) : {}),
  };

  const line = isPretty()
    ? `${payload.time} ${level.toUpperCase().padEnd(5)} ${requestId ? `[${requestId}] ` : ''}${message}${
        context ? ` ${JSON.stringify(sanitize(context))}` : ''
      }`
    : JSON.stringify(payload);

  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

export const Logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    write('debug', message, context);
  },

  info(message: string, context?: Record<string, unknown>): void {
    write('info', message, context);
  },

  warn(message: string, context?: Record<string, unknown>): void {
    write('warn', message, context);
  },

  error(message: string, context?: Record<string, unknown>): void {
    write('error', message, context);
  },

  /** Run `fn` with a request id attached to every log line it produces. */
  withRequestId<T>(requestId: string, fn: () => T): T {
    return requestContext.run({ requestId }, fn);
  },

  getRequestId(): string | undefined {
    return requestContext.getStore()?.requestId;
  },

  // Helper — exported so the error handler and tests can assert redaction behaviour.
  sanitize(value: unknown): unknown {
    return sanitize(value);
  },
};
