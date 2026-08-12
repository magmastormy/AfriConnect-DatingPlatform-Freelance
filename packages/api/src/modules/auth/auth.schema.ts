import { z } from 'zod';

export const requestOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(8, 'Phone number is too short').max(20),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(8).max(20),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

export const clerkExchangeSchema = z.object({
  token: z.string().min(1, 'Clerk session token required'),
});

export const requestVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const confirmEmailSchema = z.object({
  token: z.string().min(1, 'Verification token required'),
});

export const requestSmsFallbackSchema = z.object({
  phone: z.string().min(8, 'Phone number is too short').max(20),
});

export const confirmSmsFallbackSchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export type RequestOtpDTO = z.infer<typeof requestOtpSchema>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema>;
export type RefreshDTO = z.infer<typeof refreshSchema>;
export type ClerkExchangeDTO = z.infer<typeof clerkExchangeSchema>;
