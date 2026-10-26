import axios from 'axios';
import { AuthUser, LoginResponse, AuthMeResponse, UserRole } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'mwangaza_auth_token';
const USER_KEY = 'mwangaza_auth_user';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour injecter automatiquement le token Bearer
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Intercepteur pour intercepter les 401 et rediriger si nécessaire
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      // Nettoyage en cas de session expirée ou invalide
      clearAuthSession();
      if (!window.location.pathname.startsWith('/login')) {
        // Intercepteur hors React : window.location est le seul moyen de navigation
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// Helpers de stockage
export function setAuthSession(token: string, user: AuthUser, rememberMe = true): void {
  if (typeof window === 'undefined') return;
  const storage = rememberMe ? localStorage : sessionStorage;
  const otherStorage = rememberMe ? sessionStorage : localStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  otherStorage.removeItem(TOKEN_KEY);
  otherStorage.removeItem(USER_KEY);
  // Pour le support SSR si nécessaire, on peut également définir un cookie léger
  document.cookie = `mwangaza_role=${user.role}; path=/; max-age=86400; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  document.cookie = 'mwangaza_role=; path=/; max-age=0';
}

/** Déconnexion : purge la session puis renvoie vers /login (aucun endpoint backend). */
export function logout(): void {
  if (typeof window === 'undefined') return;
  clearAuthSession();
  // Intercepteur/hors React : window.location est le seul moyen de navigation
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/login';
}

// Détermination de la redirection selon le rôle (matrice API.md section 0.2)
export function getPostLoginRedirect(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'superadmin':
    case 'agent':
      return '/dashboard';
    case 'member':
      return '/accueil';
    default:
      return '/dashboard';
  }
}

// Helper pour préparer le body de requête selon le format de l'identifiant
// (email → champ "email", sinon → champ "accountNumber" — API.md §1)
function formatIdentifierBody(identifier: string, password: string) {
  const trimmed = identifier.trim();
  return trimmed.includes('@')
    ? { email: trimmed, password }
    : { accountNumber: trimmed, password };
}

export type LoginRole = 'admin' | 'agent' | 'member';

/**
 * Connexion unifiée — POST /auth/login (backend tente admin → agent → membre,
 * voir API.md §1). L'identifiant email/accountNumber est déduit automatiquement.
 */
export async function login(
  identifier: string,
  password: string,
  rememberMe = true,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    '/auth/login',
    formatIdentifierBody(identifier, password),
  );
  if (response.data.success && response.data.token) {
    setAuthSession(response.data.token, response.data.user, rememberMe);
  }
  return response.data;
}

// 1. Connexion Administrateur
export async function loginAdmin(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse>('/auth/admin/login', payload);
  if (response.data.success && response.data.token) {
    setAuthSession(response.data.token, response.data.user);
  }
  return response.data;
}

// 2. Connexion Membre
export async function loginMember(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse>('/auth/member/login', payload);
  if (response.data.success && response.data.token) {
    setAuthSession(response.data.token, response.data.user);
  }
  return response.data;
}

// 3. Connexion Agent (Guichet)
export async function loginAgent(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse>('/auth/agent/login', payload);
  if (response.data.success && response.data.token) {
    setAuthSession(response.data.token, response.data.user);
  }
  return response.data;
}

// 4. Vérification de session active (GET /auth/me)
export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me');
  if (response.data.success && response.data.user) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }
    return response.data.user;
  }
  throw new Error('Impossible de récupérer le profil utilisateur');
}
