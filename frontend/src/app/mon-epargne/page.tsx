'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Wallet, PiggyBank, ArrowRight, ShieldCheck } from 'lucide-react';
import { getAuthToken, getAuthUser, logout } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';
import type { AuthUser } from '@/types/auth';

export default function MonEpargnePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace('/login');
      return;
    }
    // Lecture de la session différée : évite setState synchrone dans l'effet
    const id = window.setTimeout(() => setUser(getAuthUser()), 0);
    return () => window.clearTimeout(id);
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans">
      {/* En-tête */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center p-1.5">
              <Image src="/images/logo.png" alt="Logo Mwangaza Wetu" width={24} height={24} className="object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide uppercase">{MWANGAZA_BRAND.name}</span>
              <div className="flex items-center gap-1 text-[11px] text-slate-300 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Espace membre
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-2.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Bienvenue{user?.fullName ? `, ${user.fullName}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Suivez votre épargne et vos opérations depuis votre espace sécurisé.
        </p>

        {/* Informations de compte */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              Mon compte
            </div>
            <p className="text-lg font-extrabold text-slate-900">{user?.accountNumber || '—'}</p>
            <p className="text-xs text-slate-500 mt-1">Section : {user?.section || 'Standard'}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              <Wallet className="w-4 h-4 text-amber-600" />
              Soldes
            </div>
            <p className="text-lg font-extrabold text-slate-900">—</p>
            <p className="text-xs text-slate-500 mt-1">Chargement des soldes en cours de finalisation</p>
          </div>
        </div>

        {/* Panneau informatif */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-slate-900 mb-2">Votre espace épargne</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Le tableau de bord complet de votre épargne (soldes, dépôts, retraits et crédits) est en
            cours de déploiement. Pour toute opération, rapprochez-vous de votre agence ou de votre
            guichetier.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-slate-900 hover:underline"
          >
            Retour à la connexion
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400">
        {MWANGAZA_BRAND.name} • {MWANGAZA_BRAND.slogan} • © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
