import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  relationshipId: z.string().min(1),
  brand: z.string().min(1).optional(),
});

export const setPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});

export const requestResetSchema = z.object({
  email: z.string().email(),
});

export const metricsQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  metric: z.enum(['minutes', 'attempts']).default('minutes'),
});
