import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  relationshipId: z.string().min(1),
  relationshipName: z.string().min(1),
});

export const updateUserSchema = z.object({
  password: z.string().min(8).optional(),
  relationshipId: z.string().min(1).optional(),
  relationshipName: z.string().min(1).optional(),
});

export const metricsQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  metric: z.enum(['minutes', 'attempts']).default('minutes'),
  relationshipId: z.string().optional(), // admins may preview a specific relationship
});
