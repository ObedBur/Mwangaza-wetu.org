'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  Check
} from 'lucide-react';
import axios from 'axios';
import { login, getPostLoginRedirect, getAuthToken, getAuthUser } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';

interface SlideItem {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  description: string;
}

const SLIDES: SlideItem[] = [
  {
    id: 'kelasi',
    image: '/images/img1.jpg',
    title: 'Épargne Kelasi',
    subtitle: 'Offrez à vos enfants un avenir éclairé',
    description: 'Préparez sereinement les études et l’éducation de vos enfants avec des solutions d’épargne sécurisées.',
  },
  {
    id: 'biashara',
    image: '/images/img2.jpg',
    title: 'Épargne Biashara',
    subtitle: 'Financement et renforcement des PME',
    description: 'Protégez vos revenus commerciaux, développez votre activité et sécurisez la trésorerie de votre entreprise.',
  },
  {
    id: 'sante',
    image: '/images/img3.jpg',
    title: 'Épargne Santé',
    subtitle: 'Couvrir les urgences médicales',
    description: 'La santé n’attend pas : prévoyez aujourd’hui pour protéger et soigner votre famille en toute tranquillité.',
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

  // État du carrousel d'images plein écran (left 50%)
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
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
      const res = await login(cleanId, password);

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

  const activeSlideData = SLIDES[currentSlide];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans overflow-x-hidden">
      {/* ========================================================================= */}
      {/* GAUCHE (50% Exact) : Photo Plein Écran (Full Bleed) avec Textes & Indicateurs */}
      {/* ========================================================================= */}
      <div className="relative w-full lg:w-1/2 min-h-[460px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-14 overflow-hidden bg-slate-900">
        {/* Images en fondu-enchaîné occupant 100% de la surface gauche */}
        {SLIDES.map((slide, idx) => {
          const isActive = idx === currentSlide;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
                }`}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority={idx === 0}
                className="object-cover object-center scale-100"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          );
        })}

        {/* Voile sombre dégradé subtil pour la lisibilité des textes */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.05) 35%, rgba(0, 0, 0, 0.65) 70%, rgba(0, 0, 0, 0.88) 100%)',
          }}
        />

        {/* Haut Gauche : Logo & Nom de la marque */}
        <div className="relative z-20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/95 shadow-md flex items-center justify-center p-1.5 backdrop-blur-sm">
            <Image
              src="/images/logo.png"
              alt="Logo Mwangaza Wetu"
              width={30}
              height={30}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <span className="text-white font-extrabold text-lg tracking-wide uppercase drop-shadow-sm">
              {MWANGAZA_BRAND.name}
            </span>
          </div>
        </div>

        {/* Bas Gauche : Titre, Description & Indicateurs (Dots) comme la référence */}
        <div className="relative z-20 mt-auto pt-16">
          <div className="max-w-lg">
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white leading-tight drop-shadow-md tracking-tight">
              {activeSlideData.title}
            </h2>
            <p className="text-base sm:text-lg font-medium text-white/90 mt-2 drop-shadow-sm">
              {activeSlideData.subtitle}
            </p>
            <p className="text-xs sm:text-sm text-white/75 mt-2 line-clamp-2 max-w-md drop-shadow-sm">
              {activeSlideData.description}
            </p>
          </div>

          {/* Indicateurs de diapositives (Pill active + dots inactifs) */}
          <div className="flex items-center gap-2 mt-8">
            {SLIDES.map((slide, idx) => {
              const isActive = idx === currentSlide;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Aller à la diapositive ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${isActive
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DROITE (50% Exact) : Formulaire Minimaliste & Épuré sur Fond Blanc Pur     */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 min-h-screen bg-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20">
        {/* En-tête supérieur droit : Bouton / Badge institutionnel */}
        <div className="flex justify-end items-center">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Portail Sécurisé</span>
          </div>
        </div>

        {/* Conteneur Central du Formulaire (centré exactement comme la référence) */}
        <div className="max-w-[420px] w-full mx-auto my-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Bienvenue sur Mwangaza Wetu!
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Connectez-vous à votre espace sécurisé
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
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
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
                placeholder="Email, numéro de compte ou téléphone"
                className="w-full px-4 py-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
              />
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
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
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ligne Se souvenir de moi / Aide */}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                    }`}
                >
                  {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Se souvenir de moi</span>
              </label>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-slate-500 hover:text-slate-900 font-semibold transition-colors flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Besoin d&apos;aide ?</span>
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
            <span>Nouveau membre de la coopérative ? </span>
            <Link
              href="/activate"
              className="font-bold text-slate-900 hover:underline inline-block ml-1"
            >
              Activer mon compte
            </Link>
          </div>
        </div>

        {/* Pied de page discret */}
        <div className="text-center text-xs text-slate-400">
          {MWANGAZA_BRAND.name} • {MWANGAZA_BRAND.slogan} • © {new Date().getFullYear()}
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
    </div>
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
