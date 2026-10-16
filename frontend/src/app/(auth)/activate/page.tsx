'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { apiClient } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';

function ActivateForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(token ? null : "Lien d'activation manquant ou invalide.");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token) {
      setErrorMsg("Lien d'activation manquant ou invalide.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/membres/activate', { token, motDePasse: password });
      setSuccessMsg('Votre compte a été activé avec succès. Vous pouvez désormais vous connecter.');
    } catch (err: unknown) {
      const backendMessage = axios.isAxiosError(err)
        ? (Array.isArray(err.response?.data?.message)
            ? err.response.data.message[0]
            : err.response?.data?.message) || "Lien d'activation invalide ou expiré"
        : "Lien d'activation invalide ou expiré";
      setErrorMsg(backendMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4 py-12 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center p-1.5">
            <Image src="/images/logo.png" alt="Logo Mwangaza Wetu" width={26} height={26} className="object-contain" priority />
          </div>
          <div>
            <span className="text-slate-900 font-extrabold text-base tracking-wide uppercase">
              {MWANGAZA_BRAND.name}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Activation de compte membre
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          Activez votre compte
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Choisissez le mot de passe qui vous servira à vous connecter à votre espace épargne.
        </p>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {!successMsg ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full pl-4 pr-11 py-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retapez le mot de passe"
                className="w-full px-4 py-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full mt-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Activation en cours...
                </span>
              ) : (
                <span>Activer mon compte</span>
              )}
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="w-full mt-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>Se connecter</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        <div className="mt-6 text-center text-xs text-slate-400">
          {MWANGAZA_BRAND.name} • {MWANGAZA_BRAND.slogan} • © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ActivateForm />
    </Suspense>
  );
}
