'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
  HelpCircle,
  X
} from 'lucide-react';

const LOGIN_SLIDES = [
  {
    image: '/images/login-sante.jpg',
    title: 'Épargne Santé',
    subtitle: 'Couvrir les urgences médicales',
    description: 'La santé n\u2019attend pas : prévoyez aujourd\u2019hui pour protéger et soigner votre famille en toute tranquillité.',
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

/* ─────────────────────────────────────────────
   Toast Notification Component
   ───────────────────────────────────────────── */
type ToastType = 'success' | 'error';

interface ToastProps {
  title?: string;
  message: string;
  type: ToastType;
  onClose: () => void;
}

function Toast({ title, message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animation d'entrée
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    // Fermeture automatique après 5 secondes
    const dismissTimer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
    }, 5000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const isSuccess = type === 'success';

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 w-full max-w-sm p-4 rounded-xl shadow-xl border backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
        ${isSuccess
          ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-900/10'
          : 'bg-red-50/95 border-red-300 text-red-950 shadow-red-900/10'
        }
      `}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-bold text-slate-900 leading-snug break-words">
            {title}
          </p>
        )}
        <p className={`text-xs leading-relaxed ${title ? 'text-slate-600 mt-0.5' : 'text-slate-800 font-medium'}`}>
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className={`shrink-0 rounded-lg p-1 transition-colors ${
          isSuccess ? 'hover:bg-emerald-200 text-emerald-700' : 'hover:bg-red-200 text-red-700'
        }`}
        aria-label="Fermer la notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Login Form Component
   ───────────────────────────────────────────── */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Toast notifications (fixed position, top-right)
  const [toasts, setToasts] = useState<Array<{ id: number; title?: string; message: string; type: ToastType }>>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('expired') === 'true') {
      return [{ id: Date.now(), title: 'Session expirée', message: 'Veuillez vous reconnecter pour continuer.', type: 'error' }];
    }
    return [];
  });

  // Per-field validation errors
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Track whether fields have been touched/blurred
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Track form submission attempts
  const [formSubmitted, setFormSubmitted] = useState(false);

  const addToast = useCallback((message: string, type: ToastType, title?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

  // Validate individual fields
  const validateIdentifier = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'L\'identifiant est requis. Saisissez votre e-mail, téléphone ou numéro de compte.';
    }
    if (trimmed.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return 'Le format de l\'adresse e-mail est invalide. Exemple : nom@domaine.com';
      }
    }
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) {
      return 'Le mot de passe est requis.';
    }
    if (value.length < 4) {
      return 'Le mot de passe doit contenir au moins 4 caractères.';
    }
    return null;
  };

  // Handle blur for real-time validation
  const handleIdentifierBlur = () => {
    setIdentifierTouched(true);
    setIdentifierError(validateIdentifier(identifier));
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  };

  // Live validation on change (only if already touched)
  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    if (identifierTouched || formSubmitted) {
      setIdentifierError(validateIdentifier(value));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordTouched || formSubmitted) {
      setPasswordError(validatePassword(value));
    }
  };

  // Helper: get input ring/border classes based on validation state
  const getInputClasses = (
    fieldError: string | null,
    touched: boolean,
    value: string,
  ): string => {
    const base =
      'w-full px-4 py-3.5 bg-white border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all';

    if (fieldError && (touched || formSubmitted)) {
      return `${base} border-red-400 focus:ring-red-500 focus:border-red-500`;
    }
    if (!fieldError && (touched || formSubmitted) && value.trim()) {
      return `${base} border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500`;
    }
    return `${base} border-slate-300 focus:ring-slate-900 focus:border-slate-900`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);

    // Validate all fields
    const idError = validateIdentifier(identifier);
    const pwError = validatePassword(password);
    setIdentifierError(idError);
    setPasswordError(pwError);

    // Stop if there are field-level errors
    if (idError || pwError) {
      return;
    }

    const cleanId = identifier.trim();
    setIsLoading(true);

    try {
      const res = await login(cleanId, password, rememberMe);

      if (res.success && res.user) {
        // Reset field states on success
        setIdentifierError(null);
        setPasswordError(null);
        setFormSubmitted(false);
        setIdentifierTouched(false);
        setPasswordTouched(false);

        // Récupération dynamique et précise du nom de l'utilisateur qui se connecte
        const rawUser = res.user as typeof res.user & {
          nomComplet?: string;
          prenom?: string;
          nom?: string;
        };
        const userName =
          (typeof rawUser.fullName === 'string' && rawUser.fullName.trim()) ||
          (typeof rawUser.nomComplet === 'string' && rawUser.nomComplet.trim()) ||
          [rawUser.firstName || rawUser.prenom, rawUser.lastName || rawUser.nom]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          (typeof rawUser.nom === 'string' && rawUser.nom.trim()) ||
          '';

        const welcomeTitle = userName ? `Bienvenue, ${userName} !` : 'Bienvenue !';
        const welcomeSubtitle = 'Connexion réussie. Accès à votre espace en cours…';

        // Affichage du toast avec le nom récupéré directement
        addToast(welcomeSubtitle, 'success', welcomeTitle);

        const destination = getPostLoginRedirect(res.user.role);
        // Légère pause (1,1s) pour permettre à l'utilisateur de voir le message de bienvenue avec son nom
        setTimeout(() => {
          router.push(destination);
        }, 1100);
      } else {
        const msg = res.message || 'Identifiants invalides.';
        handleBackendError(msg);
      }
    } catch (err: unknown) {
      const backendMessage = axios.isAxiosError(err)
        ? (Array.isArray(err.response?.data?.message)
          ? err.response.data.message[0]
          : err.response?.data?.message) || 'Identifiant ou mot de passe incorrect.'
        : 'Identifiant ou mot de passe incorrect.';
      handleBackendError(backendMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze backend error to attribute it to the right field + show toast
  const handleBackendError = (message: string) => {
    const msgLower = message.toLowerCase();

    // Show error toast notification
    addToast(message, 'error', 'Erreur de connexion');

    if (msgLower.includes('identifiant') && msgLower.includes('mot de passe')) {
      setIdentifierError('Vérifiez votre identifiant.');
      setPasswordError('Vérifiez votre mot de passe.');
    } else if (msgLower.includes('identifiant') || msgLower.includes('email') || msgLower.includes('compte') || msgLower.includes('utilisateur') || msgLower.includes('introuvable')) {
      setIdentifierError(message);
      setPasswordError(null);
    } else if (msgLower.includes('mot de passe') || msgLower.includes('password')) {
      setPasswordError(message);
      setIdentifierError(null);
    } else {
      setIdentifierError('Vérifiez votre identifiant.');
      setPasswordError('Vérifiez votre mot de passe.');
    }
  };

  return (
    <main className="login-page min-h-screen min-h-svh w-full bg-white">
      {/* ═══ Toast Notifications — fixed top-right ═══ */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-auto"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              title={toast.title}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}

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

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Champ Identifiant */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Identifiant
              </label>
              <div className="relative">
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  onBlur={handleIdentifierBlur}
                  placeholder="E-mail, téléphone ou numéro de compte"
                  aria-invalid={!!(identifierError && (identifierTouched || formSubmitted))}
                  aria-describedby={identifierError ? 'identifier-error' : undefined}
                  className={getInputClasses(identifierError, identifierTouched, identifier)}
                />
                {/* Validation icon inside input */}
                {(identifierTouched || formSubmitted) && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    {identifierError ? (
                      <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
                    ) : identifier.trim() ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    ) : null}
                  </div>
                )}
              </div>
              {/* Inline error message below the field */}
              {identifierError && (identifierTouched || formSubmitted) && (
                <p id="identifier-error" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600" role="alert">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {identifierError}
                </p>
              )}
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={handlePasswordBlur}
                  placeholder="••••••••"
                  aria-invalid={!!(passwordError && (passwordTouched || formSubmitted))}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                  className={`${getInputClasses(passwordError, passwordTouched, password)} pr-20`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                  {/* Validation icon */}
                  {(passwordTouched || formSubmitted) && (
                    <>
                      {passwordError ? (
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
                      ) : password ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                      ) : null}
                    </>
                  )}
                  {/* Toggle password visibility */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="ml-1 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Inline error message below the field */}
              {passwordError && (passwordTouched || formSubmitted) && (
                <p id="password-error" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600" role="alert">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {passwordError}
                </p>
              )}
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
