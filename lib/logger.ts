import 'server-only';

import pino from 'pino';

/**
 * Singleton structured logger. JSON-line output keeps it pipeable into Vercel
 * logs / Datadog / wherever; pino-pretty during local dev makes the lines
 * readable. Tokens, share IDs, and reactor cookies must never be logged.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { app: 'animeroll' },
  redact: {
    paths: ['authorization', 'cookie', 'set-cookie', '*.token', '*.authToken'],
    censor: '[redacted]',
  },
});

interface RouteEvent {
  route: string;
  method: string;
  status: number;
  ms: number;
  userId?: string;
  err?: unknown;
}

/**
 * Log the result of a route handler in one structured line. Call from inside
 * a route handler around the response: `logRequest({...})`.
 */
export function logRequest(event: RouteEvent): void {
  if (event.err || event.status >= 500) {
    log.error(event, 'request_failed');
  } else if (event.status >= 400) {
    log.warn(event, 'request_rejected');
  } else {
    log.info(event, 'request');
  }
}
