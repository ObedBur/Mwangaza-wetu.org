'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clearAuthSession, fetchCurrentUser, getPostLoginRedirect } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';
import type { UserRole } from '@/types/auth';
import { WifiOff, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react';

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
      // Pour les coupures réseau ou indisponibilités temporaires,
      // on affiche un écran convivial avec actions de secours
      setStatus('error');
    }
  }, [allowedRoles, roleRedirects, router]);

  useEffect(() => {
    void verifySession();
  }, [verifySession, attempt]);

  const handleBackToLogin = () => {
    clearAuthSession();
    router.replace('/login');
  };

  if (status === 'authorized') return children;

  return (
    <div className="min-h-screen min-h-svh flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      {status === 'checking' ? (
        /* État de chargement : Rassurant, chaleureux et orienté client */
        <div className="flex flex-col items-center text-center animate-fade-in max-w-xs">
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2.5 shadow-md ring-1 ring-slate-200">
            <Image
              src="/images/logo.png"
              alt={MWANGAZA_BRAND.name}
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
            <h2 className="text-sm font-bold text-slate-800">
              Accès à votre espace sécurisé…
            </h2>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Un instant s&apos;il vous plaît, nous préparons vos informations en toute sécurité.
          </p>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Connexion chiffrée et protégée</span>
          </div>
        </div>
      ) : (
        /* État d'erreur / coupure réseau : Explications claires et sans jargon */
        <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-slate-100 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
            <WifiOff className="h-6 w-6" />
          </div>

          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Connexion momentanément interrompue
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
            Nous ne parvenons pas à joindre le service {MWANGAZA_BRAND.name}. Cela peut être dû à une coupure de votre connexion Internet ou à une brève indisponibilité de nos services.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3 px-4 text-sm font-bold text-white shadow-md active:scale-[0.99] transition"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Réessayer la connexion</span>
            </button>

            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 px-4 text-xs font-semibold text-slate-700 transition"
              onClick={handleBackToLogin}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retourner à la page de connexion</span>
            </button>
          </div>

          <p className="mt-6 text-[11px] text-slate-400">
            {MWANGAZA_BRAND.name} • {MWANGAZA_BRAND.slogan}
          </p>
        </div>
      )}
    </div>
  );
}
