import axios from 'axios';
import { AuthUser, LoginResponse, AuthMeResponse, UserRole } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Jeton CSRF stocké en mémoire (plus lisible via document.cookie car cookie HttpOnly)
let csrfToken: string | null = null;
// Requête de récupération en cours : évite d'en lancer plusieurs en parallèle.
let csrfTokenRequest: Promise<string> | null = null;

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Extrait un message d'erreur lisible depuis une erreur Axios.
 * Gère les codes 400, 401, 403, 429 et les erreurs réseau.
 */
function extractAxiosError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return 'Erreur de connexion inconnue.';
  }

  const status = err.response?.status;
  const data = err.response?.data;
  const message = data?.message || data?.error || '';

  // 429 — Trop de tentatives (rate limiting)
  if (status === 429) {
    const retryAfter = err.response?.headers?.['retry-after'];
    return retryAfter
      ? `Trop de tentatives. Réessayez dans ${retryAfter} seconde(s).`
      : 'Trop de tentatives. Réessayez plus tard.';
  }

  // 401 — Identifiants incorrects ou compte verrouillé
  if (status === 401) {
    return message || 'Identifiants incorrects.';
  }

  // 400 — Données invalides ou manquantes
  if (status === 400) {
    return message || 'Données de connexion invalides.';
  }

  // 403 — Origine non autorisée (erreur de configuration serveur)
  if (status === 403) {
    return 'Erreur de configuration serveur. Contactez l\'administrateur.';
  }

  // Autres erreurs HTTP
  if (status) {
    return message || `Erreur serveur (${status}).`;
  }

  // Pas de réponse du serveur (réseau, DNS, timeout, etc.)
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }

  return 'Erreur de connexion.';
}

// Récupère le jeton CSRF depuis l'endpoint dédié (le cookie est HttpOnly, illisible par JS).
// Après un rechargement de page, la mémoire est vide : on le récupère à la demande
// dans l'intercepteur ci-dessous, sinon toute mutation partirait sans en-tête (403).
export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = apiClient
      .get<{ csrfToken: string }>('/auth/csrf-token')
      .then((response) => {
        csrfToken = response.data.csrfToken;
        return csrfToken;
      })
      .catch((err: unknown) => {
        throw new Error(extractAxiosError(err));
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }
  return csrfTokenRequest;
}

// Le JWT reste en cookie HttpOnly; le jeton CSRF est envoyé via l'en-tête X-CSRF-Token.
apiClient.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  const method = (config.method ?? 'get').toLowerCase();
  if (MUTATING_METHODS.has(method) && !csrfToken) {
    try {
      await fetchCsrfToken();
    } catch {
      // Sans jeton, le backend répondra 403 : on laisse la requête partir
      // pour remonter l'erreur réelle à l'appelant.
    }
  }

  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Intercepteur pour intercepter les 401 et rediriger si nécessaire
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    // Jeton CSRF expiré/invalide (ex. cookie renouvelé côté serveur) :
    // on le récupère une fois puis on rejoue la requête.
    const status = error.response?.status;
    const message = String(error.response?.data?.message ?? '');
    const retryable = error.config as
      | (typeof error.config & { __csrfRetry?: boolean })
      | undefined;
    if (
      status === 403 &&
      message.toLowerCase().includes('csrf') &&
      retryable &&
      !retryable.__csrfRetry
    ) {
      csrfToken = null;
      retryable.__csrfRetry = true;
      return apiClient.request(retryable);
    }

    if (error.response?.status === 401) {
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

/**
 * Purge locale uniquement (cookie de rôle + jeton CSRF en mémoire).
 * Utilisée par l'intercepteur 401 : inutile d'appeler le serveur, la session
 * est déjà invalide.
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0`;
  csrfToken = null;
  csrfTokenRequest = null;
}

/**
 * Révoque la session côté serveur (déconnexion réelle).
 * Le cookie CSRF est HttpOnly : après un rechargement, le jeton en mémoire est
 * vide. Il faut donc le récupérer avant l'appel, sinon le backend répond 403
 * CSRF et le cookie de session n'est jamais effacé.
 */
async function revokeServerSession(): Promise<void> {
  try {
    const token = csrfToken ?? (await fetchCsrfToken());
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'X-CSRF-Token': token },
    });
  } catch {
    // Hors ligne ou session déjà expirée : le nettoyage local suffit.
  }
}

/** Déconnexion : révoque la session serveur, purge le local puis redirige. */
export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;
  await revokeServerSession();
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
  try {
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
  } catch (err) {
    throw new Error(extractAxiosError(err));
  }
}

// 1. Connexion Administrateur
export async function loginAdmin(identifier: string, password: string): Promise<LoginResponse> {
  try {
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
  } catch (err) {
    throw new Error(extractAxiosError(err));
  }
}

// 2. Connexion Membre
export async function loginMember(identifier: string, password: string): Promise<LoginResponse> {
  try {
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
  } catch (err) {
    throw new Error(extractAxiosError(err));
  }
}

// 3. Connexion Agent (Guichet)
export async function loginAgent(identifier: string, password: string): Promise<LoginResponse> {
  try {
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
  } catch (err) {
    throw new Error(extractAxiosError(err));
  }
}

// 4. Vérification de session active (GET /auth/me)
export async function fetchCurrentUser(): Promise<AuthUser> {
  try {
    const response = await apiClient.get<AuthMeResponse>('/auth/me');
    if (response.data.success && response.data.user) {
      if (typeof window !== 'undefined') {
        setAuthSession(response.data.user, true);
      }
      return response.data.user;
    }
    throw new Error('Impossible de récupérer le profil utilisateur');
  } catch (err) {
    throw new Error(extractAxiosError(err));
  }
}
