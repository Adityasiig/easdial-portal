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
  role: z.enum(['customer', 'vendor']).default('customer'),
  relationshipId: z.string().optional(), // admins may preview a specific relationship
});

export const cdrQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().trim().max(80).optional(),
  trunkGroupId: z.string().trim().max(120).optional(),
  trunkGroupLabel: z.string().trim().max(240).optional(),
  ani: z.string().trim().max(64).optional(),
  dnis: z.string().trim().max(64).optional(),
  status: z.enum(['all', 'completed', 'failed']).default('all'),
}).superRefine((value, ctx) => {
  const start = new Date(value.startTime).getTime();
  const end = new Date(value.endTime).getTime();
  if (end <= start) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'End time must be after start time' });
  if (end - start > 31 * 24 * 60 * 60 * 1000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'CDR range cannot exceed 31 days' });
});
