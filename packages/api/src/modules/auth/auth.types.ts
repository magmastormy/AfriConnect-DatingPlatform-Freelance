import { UserRole, UserStatus } from '@africonnect/shared';

export interface RequestOtpInput {
  email: string;
  phone: string;
}

export interface VerifyOtpInput {
  email: string;
  phone: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    userId: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  };
}
