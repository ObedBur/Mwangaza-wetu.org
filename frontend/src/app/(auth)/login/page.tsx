'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { login, getPostLoginRedirect, getAuthToken, getAuthUser } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

const LOGIN_SLIDES = [
  {
    image: '/images/login-sante.jpg',
    title: 'Épargne Santé',
    subtitle: 'Couvrir les urgences médicales',
    description: 'La santé n’attend pas : prévoyez aujourd’hui pour protéger et soigner votre famille en toute tranquillité.',
  },
  {
    image: '/images/login-kelasi.jpg',
    title: 'Épargne Kelasi',
    subtitle: 'Offrez un avenir éclairé à vos enfants',
    description: 'Épargnez sereinement pour accompagner les études et les projets de vos enfants.',
  },
  {
    image: '/images/login-biashara.jpg',
    title: 'Épargne Biashara',
    subtitle: 'Financement et renforcement des PME',
    description: 'Protégez vos revenus commerciaux, développez votre activité et sécurisez la trésorerie de votre entreprise.',
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    searchParams.get('expired') === 'true'
      ? 'Votre session a expiré. Veuillez vous reconnecter.'
      : null,
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;

    const timer = window.setInterval(() => {
      setCurrentSlide((current) => (current + 1) % LOGIN_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);
  // Session déjà active : on redirige directement vers l'espace du rôle
  useEffect(() => {
    const user = getAuthUser();
    if (getAuthToken() && user) {
      router.replace(getPostLoginRedirect(user.role));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg('Veuillez renseigner votre identifiant (email, compte ou téléphone).');
      return;
    }

    if (!password) {
      setErrorMsg('Veuillez renseigner votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login(cleanId, password, rememberMe);

      if (res.success && res.user) {
        setSuccessMsg(`Connexion réussie. Bienvenue, ${res.user.fullName || 'Cher utilisateur'} !`);
        const destination = getPostLoginRedirect(res.user.role);

        setTimeout(() => {
          router.push(destination);
        }, 600);
      } else {
        setErrorMsg(res.message || 'Identifiants invalides.');
      }
    } catch (err: unknown) {
      const backendMessage = axios.isAxiosError(err)
        ? (Array.isArray(err.response?.data?.message)
          ? err.response.data.message[0]
          : err.response?.data?.message) || 'Identifiant ou mot de passe incorrect.'
        : 'Identifiant ou mot de passe incorrect.';
      setErrorMsg(backendMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page min-h-screen min-h-svh w-full bg-white">
      <div className="mx-auto flex min-h-screen min-h-svh w-full max-w-7xl flex-col px-6 py-6 sm:px-12 sm:py-10 xl:mx-0 xl:max-w-none xl:flex-row xl:px-0 xl:py-0">
        <aside className="relative hidden min-h-svh overflow-hidden bg-slate-950 text-white xl:flex xl:w-1/2 xl:flex-col xl:justify-between xl:p-12 2xl:p-16" aria-label="Présentation des produits Mwangaza Wetu">
          {LOGIN_SLIDES.map((slide, index) => (
            <Image
              key={slide.image}
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              sizes="50vw"
              className={`object-cover transition-opacity duration-700 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/15" />
          <header className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-white/30">
              <Image src="/images/logo.png" alt="" width={30} height={30} className="object-contain" priority />
            </div>
            <span className="text-sm font-bold tracking-wide text-white uppercase">{MWANGAZA_BRAND.name}</span>
          </header>
          <div className="relative z-10 max-w-xl pb-2">
            <h2 className="text-4xl font-black tracking-tight 2xl:text-5xl">{LOGIN_SLIDES[currentSlide].title}</h2>
            <p className="mt-3 text-lg font-semibold text-white/90">{LOGIN_SLIDES[currentSlide].subtitle}</p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80">{LOGIN_SLIDES[currentSlide].description}</p>
            <div className="mt-7 flex items-center gap-2" aria-label="Choisir une présentation">
              {LOGIN_SLIDES.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Afficher ${slide.title}`}
                  aria-current={index === currentSlide ? 'true' : undefined}
                  className={`h-2.5 rounded-full transition-all ${index === currentSlide ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex min-h-screen min-h-svh flex-1 flex-col xl:w-1/2 xl:px-12 2xl:px-20">
        <header className="flex items-center gap-3 xl:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <Image
              src="/images/logo.png"
              alt="Logo Mwangaza Wetu"
              width={30}
              height={30}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-sm font-bold tracking-wide text-slate-900 uppercase">
            {MWANGAZA_BRAND.name}
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center py-10 xl:py-12">
          <section className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Connexion
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Accédez à votre compte en toute sécurité.
            </p>
          </div>

          {/* Alertes d'état */}
          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Champ Identifiant */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Identifiant
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="E-mail, téléphone ou numéro de compte"
                className="w-full px-4 py-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ligne Se souvenir de moi / Aide */}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <label className="flex min-h-11 items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
                <span>Se souvenir de moi</span>
              </label>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="flex min-h-11 items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Assistance</span>
              </button>
            </div>

            {/* Bouton Principal de Connexion */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Connexion en cours...</span>
                </div>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Lien d'activation membre pour nouveau compte */}
          <div className="mt-8 text-center text-xs text-slate-500">
            <span>Nouveau membre ? </span>
            <Link
              href="/activate"
              className="font-bold text-slate-900 hover:underline inline-block ml-1"
            >
              Activer mon compte
            </Link>
          </div>
          </section>
        </div>

        <footer className="text-center text-xs text-slate-400">
          {MWANGAZA_BRAND.name} • © {new Date().getFullYear()}
        </footer>
        </div>
      </div>

      {/* Modal d'Aide aux Usagers */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Formats d&apos;identifiants acceptés
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              Notre système identifie automatiquement votre espace selon vos coordonnées :
            </p>
            <ul className="text-xs sm:text-sm text-slate-700 space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-slate-900">• Administrateurs :</span>
                <span>Votre email ou identifiant admin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-slate-900">• Guichetiers :</span>
                <span>Votre email ou numéro de téléphone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-slate-900">• Membres :</span>
                <span>Votre numéro de compte (ex: <code>MW-PRI-XXXXXX</code>) ou email</span>
              </li>
            </ul>
            <div className="border border-dashed border-slate-300 rounded-xl p-3.5 mb-6 bg-slate-50">
              <p className="text-xs font-bold text-slate-900 mb-2">
                Comptes de démonstration (environnement de test)
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>Superadmin : <code>superadmin@mwangaza.cd</code> / <code>Admin@2026</code></li>
                <li>Admin : <code>admin@mwangaza.cd</code> / <code>Admin@123</code></li>
                <li>Guichetier : <code>agent@mwangaza.cd</code> / <code>Agent@123</code></li>
                <li>Membre : <code>MW-PRI-VXHZZ3</code> / <code>Test@1234</code></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Compris, fermer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
