import axios from 'axios';
import { AuthUser, LoginResponse, AuthMeResponse, UserRole } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const CSRF_COOKIE = 'mwangaza_csrf';

// Jeton CSRF stocké en mémoire (plus lisible via document.cookie car cookie HttpOnly)
let csrfToken: string | null = null;

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Récupère le jeton CSRF depuis l'endpoint dédié (le cookie est HttpOnly, illisible par JS)
export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await apiClient.get<{ csrfToken: string }>('/auth/csrf-token');
  csrfToken = response.data.csrfToken;
  return csrfToken;
}

// Le JWT reste en cookie HttpOnly; le jeton CSRF est envoyé via l'en-tête X-CSRF-Token.
apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined' && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
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

// Helpers de stockage — les données utilisateur ne sont plus stockées dans localStorage (XSS).
// Le JWT est déjà protégé dans le cookie HttpOnly `mwangaza_session` côté backend.
const ROLE_COOKIE = 'mwangaza_role';

export function setAuthSession(user: AuthUser, rememberMe = true): void {
  if (typeof window === 'undefined') return;
  const maxAge = rememberMe ? '; max-age=86400' : '';
  document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(user.role)}; path=/; SameSite=Lax${maxAge}`;
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${ROLE_COOKIE}=`));
  if (!match) return null;
  const role = decodeURIComponent(match.slice(ROLE_COOKIE.length + 1));
  return { role: role as AuthUser['role'] } as AuthUser;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${CSRF_COOKIE}=; path=/; max-age=0`;
  void fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
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
  const response = await apiClient.post<LoginResponse & { csrfToken?: string }>(
    '/auth/login',
    { ...formatIdentifierBody(identifier, password), rememberMe },
  );
  if (response.data.csrfToken) {
    csrfToken = response.data.csrfToken;
  }
  if (response.data.success && response.data.user) {
    setAuthSession(response.data.user, rememberMe);
  }
  return response.data;
}

// 1. Connexion Administrateur
export async function loginAdmin(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse & { csrfToken?: string }>(
    '/auth/admin/login',
    payload,
  );
  if (response.data.csrfToken) {
    csrfToken = response.data.csrfToken;
  }
  if (response.data.success && response.data.user) {
    setAuthSession(response.data.user);
  }
  return response.data;
}

// 2. Connexion Membre
export async function loginMember(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse & { csrfToken?: string }>(
    '/auth/member/login',
    payload,
  );
  if (response.data.csrfToken) {
    csrfToken = response.data.csrfToken;
  }
  if (response.data.success && response.data.user) {
    setAuthSession(response.data.user);
  }
  return response.data;
}

// 3. Connexion Agent (Guichet)
export async function loginAgent(identifier: string, password: string): Promise<LoginResponse> {
  const payload = formatIdentifierBody(identifier, password);
  const response = await apiClient.post<LoginResponse & { csrfToken?: string }>(
    '/auth/agent/login',
    payload,
  );
  if (response.data.csrfToken) {
    csrfToken = response.data.csrfToken;
  }
  if (response.data.success && response.data.user) {
    setAuthSession(response.data.user);
  }
  return response.data;
}

// 4. Vérification de session active (GET /auth/me)
export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me');
  if (response.data.success && response.data.user) {
    if (typeof window !== 'undefined') {
      setAuthSession(response.data.user, true);
    }
    return response.data.user;
  }
  throw new Error('Impossible de récupérer le profil utilisateur');
}
