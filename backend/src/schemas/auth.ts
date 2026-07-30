import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const metricsQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  metric: z.enum(['minutes', 'attempts']).default('minutes'),
});
