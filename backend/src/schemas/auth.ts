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

export const updateAdminAccountSchema = z.object({
  currentPassword: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
}).refine((value) => value.email !== undefined || value.password !== undefined, {
  message: 'Provide a new email or password',
});

export const metricsQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  metric: z.enum(['minutes', 'attempts', 'ports', 'favorite_ports', 'cps', 'profit']).default('minutes'),
  role: z.enum(['customer', 'vendor']).default('customer'),
  relationshipId: z.string().optional(), // admins may preview a specific relationship
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().trim().max(80).optional(),
});

export const cdrQuerySchema = z.object({
  direction: z.enum(['termination', 'origination']).default('termination'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().trim().max(80).optional(),
  customerTrunkGroupId: z.string().trim().max(120).optional(),
  customerTrunkGroupLabel: z.string().trim().max(240).optional(),
  vendorTrunkGroupId: z.string().trim().max(120).optional(),
  vendorTrunkGroupLabel: z.string().trim().max(240).optional(),
  ani: z.string().trim().max(64).optional(),
  dnis: z.string().trim().max(64).optional(),
  releaseCode: z.string().trim().max(32).optional(),
  callId: z.string().trim().max(160).optional(),
  minDuration: z.coerce.number().int().min(0).max(86400).optional(),
  maxDuration: z.coerce.number().int().min(0).max(86400).optional(),
  includeBLeg: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  status: z.enum(['all', 'completed', 'failed']).default('all'),
}).superRefine((value, ctx) => {
  const start = new Date(value.startTime).getTime();
  const end = new Date(value.endTime).getTime();
  if (end <= start) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'End time must be after start time' });
  if (end - start > 31 * 24 * 60 * 60 * 1000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'CDR range cannot exceed 31 days' });
  if (value.minDuration !== undefined && value.maxDuration !== undefined && value.maxDuration < value.minDuration) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxDuration'], message: 'Maximum duration must be greater than or equal to minimum duration' });
  }
});
