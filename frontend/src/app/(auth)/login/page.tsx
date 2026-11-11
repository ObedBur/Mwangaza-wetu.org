'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, getPostLoginRedirect, getAuthUser, fetchCurrentUser, clearAuthSession } from '@/lib/auth';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Pause,
  Play
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
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

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
  const [formError, setFormError] = useState<string | null>(null);
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
    if (motionPreference.matches || isCarouselPaused) return;

    const timer = window.setInterval(() => {
      setCurrentSlide((current) => (current + 1) % LOGIN_SLIDES.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isCarouselPaused]);

  // Session déjà active : on redirige directement vers l'espace du rôle
  useEffect(() => {
    let active = true;
    if (getAuthUser()) {
      void fetchCurrentUser()
        .then((user) => { if (active) router.replace(getPostLoginRedirect(user.role)); })
        .catch(() => { if (active) clearAuthSession(); });
    }
    return () => { active = false; };
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
    if (value.length < 12) {
      return 'Le mot de passe doit contenir au moins 12 caractères.';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Le mot de passe doit contenir au moins une majuscule.';
    }
    if (!/[a-z]/.test(value)) {
      return 'Le mot de passe doit contenir au moins une minuscule.';
    }
    if (!/[0-9]/.test(value)) {
      return 'Le mot de passe doit contenir au moins un chiffre.';
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      return 'Le mot de passe doit contenir au moins un caractère spécial.';
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
    setFormError(null);
    if (identifierTouched || formSubmitted) {
      setIdentifierError(validateIdentifier(value));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setFormError(null);
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
      'w-full min-w-0 rounded-none border-x-0 border-t-0 border-b-2 bg-transparent px-1 py-4 text-[15px] text-slate-900 placeholder:text-slate-400 transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-0 sm:text-base';

    if (fieldError && (touched || formSubmitted)) {
      return `${base} border-b-red-500 hover:border-b-red-600 hover:shadow-[0_3px_4px_-3px_rgba(239,68,68,0.55)] focus:border-b-red-600 focus:shadow-[0_3px_4px_-3px_rgba(239,68,68,0.7)]`;
    }
    if (!fieldError && (touched || formSubmitted) && value.trim()) {
      return `${base} border-b-emerald-500 hover:border-b-emerald-600 hover:shadow-[0_3px_4px_-3px_rgba(16,185,129,0.55)] focus:border-b-emerald-600 focus:shadow-[0_3px_4px_-3px_rgba(16,185,129,0.7)]`;
    }
    return `${base} border-b-slate-300 hover:border-b-slate-400 hover:shadow-[0_3px_4px_-3px_rgba(11,94,168,0.45)] focus:border-b-[#0B5EA8] focus:shadow-[0_3px_4px_-3px_rgba(11,94,168,0.6)]`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isRedirecting) return;
    setFormSubmitted(true);
    setFormError(null);

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
        setFormError(null);
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
        const destinationLabel = res.user.role === 'member'
          ? 'votre espace membre'
          : res.user.role === 'agent'
            ? 'votre espace guichet'
            : 'votre tableau de bord';
        const welcomeSubtitle = `Connexion réussie. Nous ouvrons ${destinationLabel}…`;

        // Affichage du toast avec le nom récupéré directement
        addToast(welcomeSubtitle, 'success', welcomeTitle);

        const destination = getPostLoginRedirect(res.user.role);
        setIsRedirecting(true);
        // Légère pause (1,1s) pour permettre à l'utilisateur de voir le message de bienvenue avec son nom
        setTimeout(() => {
          router.push(destination);
        }, 1100);
      } else {
        const msg = res.message || 'Identifiants invalides.';
        handleBackendError(msg);
      }
    } catch (err: unknown) {
      setIsRedirecting(false);
      const backendMessage = err instanceof Error ? err.message : 'Identifiant ou mot de passe incorrect.';
      handleBackendError(backendMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep authentication failures at form level: the server cannot identify which credential was wrong.
  const handleBackendError = (message: string) => {
    setIdentifierError(null);
    setPasswordError(null);
    setFormError(message);
  };

  return (
    <main className="login-page min-h-dvh w-full bg-white">
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

      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-8 sm:py-8 xl:mx-0 xl:max-w-none xl:flex-row xl:px-0 xl:py-0">
        <aside className="relative hidden min-h-svh overflow-hidden bg-slate-950 text-white xl:flex xl:w-1/2 xl:flex-col xl:justify-between xl:p-12 2xl:p-16" aria-label="Présentation des produits Mwangaza Wetu">
          {LOGIN_SLIDES.map((slide, index) => (
            <Image
              key={slide.image}
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              sizes="50vw"
              className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
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
            <div className="mt-7 flex items-center gap-1" role="group" aria-label="Commandes du carrousel">
              {LOGIN_SLIDES.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Afficher ${slide.title}`}
                  aria-current={index === currentSlide ? 'true' : undefined}
                  className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === currentSlide ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCarouselPaused((paused) => !paused)}
                aria-label={isCarouselPaused ? 'Reprendre le carrousel' : 'Mettre le carrousel en pause'}
                aria-pressed={isCarouselPaused}
                className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {isCarouselPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </aside>
        <div className="flex min-h-[calc(100svh-2rem)] flex-1 flex-col xl:min-h-svh xl:w-1/2 xl:px-12 2xl:px-20">
        <header className="flex items-center gap-3 py-1 xl:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
            <Image
              src="/images/logo.png"
              alt="Logo Mwangaza Wetu"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-slate-900">{MWANGAZA_BRAND.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">Épargne · Crédit · Développement</p>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-7 sm:py-10 xl:py-12">
          <section className="w-full max-w-lg p-0">
          <div className="mb-8">
            <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-[#0B5EA8] uppercase">
              Votre espace Mwangaza Wetu
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              Connexion
            </h1>
            <p className="mt-3 text-xs font-medium text-slate-500">
              Membres, agents et administrateurs : utilisez votre identifiant habituel.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on" noValidate>
            {formError && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </p>
            )}
            {/* Champ Identifiant */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-base font-semibold text-slate-700 mb-2"
              >
                Votre identifiant
              </label>
              <div className="relative">
                <input
                  id="identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  onBlur={handleIdentifierBlur}
                  placeholder="Votre identifiant"
                  aria-invalid={!!(identifierError && (identifierTouched || formSubmitted))}
                  aria-describedby={identifierError ? 'identifier-help identifier-error' : 'identifier-help'}
                  className={`${getInputClasses(identifierError, identifierTouched, identifier)} pr-10`}
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
              <p id="identifier-help" className="mt-2 text-xs leading-relaxed text-slate-500">
                Saisissez votre e-mail, téléphone ou numéro de compte.
              </p>
              {/* Inline error message below the field */}
              {identifierError && (identifierTouched || formSubmitted) && (
                <p id="identifier-error" className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-red-600" role="alert">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {identifierError}
                </p>
              )}
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-base font-semibold text-slate-700 mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
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
                    className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Inline error message below the field */}
              {passwordError && (passwordTouched || formSubmitted) && (
                <p id="password-error" className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-red-600" role="alert">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Ligne Se souvenir de moi / Aide */}
            <div className="flex flex-col items-start justify-between gap-1 pt-1 text-xs sm:flex-row sm:items-center sm:gap-4 sm:text-sm">
              <label className="flex min-h-11 items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
                <span>Rester connecté</span>
              </label>

              <Link
                href="/aide-connexion"
                className="flex min-h-11 items-center gap-1 whitespace-nowrap text-slate-500 hover:text-slate-900 font-semibold transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Besoin d&apos;aide ?</span>
              </Link>
            </div>

            {/* Bouton Principal de Connexion */}
            <button
              type="submit"
              disabled={isLoading || isRedirecting}
              className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#c65313] px-4 py-4 text-sm font-bold text-white shadow-md shadow-orange-900/10 transition-all hover:bg-[#ad450d] hover:shadow-lg hover:shadow-orange-900/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c65313] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading || isRedirecting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
                  <span>{isRedirecting ? 'Ouverture de votre espace…' : 'Connexion en cours…'}</span>
                </div>
              ) : (
                <span>Accéder à mon espace</span>
              )}
            </button>
          </form>

          {/* Lien d'activation membre pour nouveau compte */}
          <div className="mt-8 text-center text-sm text-slate-500">
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

        <footer className="py-2 text-center text-xs text-slate-400">
          {MWANGAZA_BRAND.name} • © {new Date().getFullYear()}
        </footer>
        </div>
      </div>

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
