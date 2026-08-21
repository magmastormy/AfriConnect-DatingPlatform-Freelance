import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid admin email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const adminBootstrapSchema = z.object({
  email: z.string().email('Invalid admin email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  setupToken: z.string().min(1, 'Setup token required'),
});

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
export type AdminBootstrapDTO = z.infer<typeof adminBootstrapSchema>;
export type AdminRefreshDTO = z.infer<typeof adminRefreshSchema>;
