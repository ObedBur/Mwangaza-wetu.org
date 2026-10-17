'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSession, fetchCurrentUser, getAuthToken, getPostLoginRedirect } from '@/lib/auth';
import type { UserRole } from '@/types/auth';

const KNOWN_ROLES: UserRole[] = ['admin', 'superadmin', 'agent', 'member'];

export function RoleRouteGuard({
  allowedRoles,
  roleRedirects,
  children,
}: {
  allowedRoles: UserRole[];
  roleRedirects?: Partial<Record<UserRole, string>>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'authorized' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);

  const verifySession = useCallback(async () => {
    setStatus('checking');
    if (!getAuthToken()) {
      clearAuthSession();
      router.replace('/login');
      return;
    }

    try {
      const user = await fetchCurrentUser();
      if (!KNOWN_ROLES.includes(user.role)) {
        clearAuthSession();
        router.replace('/login');
        return;
      }
      if (!allowedRoles.includes(user.role)) {
        router.replace(roleRedirects?.[user.role] ?? getPostLoginRedirect(user.role));
        return;
      }
      setStatus('authorized');
    } catch {
      // A 401 is also redirected by the API interceptor. For network/server
      // failures, keep protected content hidden and let the user retry.
      setStatus('error');
    }
  }, [allowedRoles, roleRedirects, router]);

  useEffect(() => {
    void verifySession();
  }, [verifySession, attempt]);

  if (status === 'authorized') return children;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      {status === 'checking' ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          <p role="status" className="text-sm text-slate-600">Vérification de votre session…</p>
        </>
      ) : (
        <>
          <p role="alert" className="max-w-md text-sm text-slate-700">
            Impossible de vérifier votre session. Vérifiez la connexion au serveur puis réessayez.
          </p>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Réessayer
          </button>
        </>
      )}
    </div>
  );
}
