export type UserRole = 'admin' | 'superadmin' | 'member' | 'agent';

export interface AuthUser {
  id: number;
  email?: string | null;
  accountNumber?: string | null;
  role: UserRole;
  fullName: string;
  lastName?: string;
  firstName?: string;
  profilePhoto?: string | null;
  section?: string;    // Spécifique au membre (ex: PRINCIPAL, KELASI, etc.)
  guichet?: string;    // Spécifique à l'agent (ex: "Guichet 1")
  actif?: boolean;
  isActivated?: boolean;
}

export interface LoginCredentials {
  identifier: string; // email, numéro de compte ou téléphone
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
}

export interface AuthMeResponse {
  success: boolean;
  user: AuthUser;
}
