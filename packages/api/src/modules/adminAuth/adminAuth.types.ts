export interface AdminAuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  passwordHash: string | null;
}
