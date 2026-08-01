import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** Single place that turns any thrown error into a safe JSON response. */
export function errorHandler(
  err: FastifyError | AppError | ZodError | Error,
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    reply.status(400).send({
      error: {
        code: 'validation_error',
        message: firstIssue?.message ?? 'Invalid request',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    return;
  }

  // Fastify's own validation errors carry a statusCode.
  const status = (err as FastifyError).statusCode;
  if (typeof status === 'number' && status < 500) {
    reply.status(status).send({ error: { code: 'bad_request', message: err.message } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  reply.status(500).send({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
