import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  transport: config.isProd
    ? undefined
    : { target: 'pino/file', options: { destination: 1 } },
  redact: ['req.headers.authorization', '*.password', '*.token', '*.apiKey'],
});
