'use client';

import './vitrine.css';
import Link from 'next/link';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  BarChart3,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  Star,
  Landmark,
  Target,
  Eye,
  GraduationCap,
  HeartPulse,
  Home,
  Baby,
  Store,
  Wallet,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Menu,
  X,
  Lock,
  Calculator,
  ArrowLeftRight,
  Building2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Search,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Types & Données
───────────────────────────────────────────── */
type Lang = 'FR' | 'EN';
type Segment = 'particuliers' | 'entrepreneurs' | 'diaspora';
type SimType = 'epargne' | 'credit';

interface AccountFormula {
  slug: string;
  name: string;
  sub: string;
  desc: string;
  color: string;
  segment: 'particuliers' | 'entrepreneurs' | 'all';
  icon: any;
  rateBonus: string;
  features: string[];
}

const accountsList: AccountFormula[] = [
  {
    slug: 'principal',
    name: 'Compte Courant & Pivot',
    sub: 'Dépôts & Retraits Quotidiens',
    desc: 'Effectuez vos versements et retraits en toute liberté au guichet central ou auprès des agents de proximité certifiés.',
    color: '#074780',
    segment: 'all',
    icon: Wallet,
    rateBonus: 'Liquidité 100% immédiate',
    features: [
      'Dépôts et retraits sans frais au guichet',
      'Validation biométrique par empreinte à chaque passage',
      'Carte de membre délivrée immédiatement à l’adhésion',
    ],
  },
  {
    slug: 'biashara',
    name: 'Épargne & Crédit Biashara',
    sub: 'Commerce, Boutiques & Activités PME',
    desc: 'Sécurisez vos recettes journalières sans risque, renforcez votre fonds de roulement et débloquez une ligne de crédit pour financer vos stocks.',
    color: '#0D9488',
    segment: 'entrepreneurs',
    icon: Store,
    rateBonus: 'Ligne de crédit stock incluse',
    features: [
      'Dépôt journalier de vos recettes auprès des agents mobiles',
      'Accès prioritaire aux crédits de réapprovisionnement',
      'Attestation de régularité financière pour vos fournisseurs',
    ],
  },
  {
    slug: 'nyumba',
    name: 'Épargne Nyumba',
    sub: 'Loyer & Sérénité Locative',
    desc: 'Épargnez chaque mois et ne subissez plus la pression du loyer. Payez vos échéances locatives en avance et vivez sereinement chez vous.',
    color: '#9333EA',
    segment: 'particuliers',
    icon: Home,
    rateBonus: 'Sérénité locative garantie',
    features: [
      'Paiement anticipé de loyer sans stress de fin de mois',
      'Facilité d’avance locative en cas de coup dur temporaire',
      'Constitution progressive d’apport pour l’achat de parcelle',
    ],
  },
  {
    slug: 'kelasi',
    name: 'Épargne Kelasi',
    sub: 'Scolarité, Minerval & Université',
    desc: 'Planifiez sereinement les frais académiques et le minerval de vos enfants et protégez leur avenir sans angoisse de rentrée scolaire.',
    color: '#D97706',
    segment: 'particuliers',
    icon: GraduationCap,
    rateBonus: 'Rentrée scolaire garantie',
    features: [
      'Planification progressive sans charge financière brutale',
      'Avances scolaires rapides débloquées sous 24h en cas d’imprévu',
      'Bonus coopératif de rentrée scolaire versé chaque année',
    ],
  },
  {
    slug: 'hopital',
    name: 'Épargne Santé & Hôpital',
    sub: 'Santé & Urgences Médicales',
    desc: 'Un filet de sécurité indispensable pour parer aux imprévus de santé de toute votre famille avec décaissement prioritaire.',
    color: '#DC2626',
    segment: 'particuliers',
    icon: HeartPulse,
    rateBonus: 'Déblocage prioritaire 24h',
    features: [
      'Décaissement express sur simple présentation de facture médicale',
      'Protection étendue à tous les membres de la famille',
      'Fonds d’urgence 100% sécurisés et disponibles sans préavis',
    ],
  },
  {
    slug: 'mutoto',
    name: 'Épargne Mutoto',
    sub: 'Avenir des Enfants & Mineurs',
    desc: 'Un compte bloqué au nom de votre enfant pour lui garantir un capital d’envol à sa majorité ou pour financer ses études supérieures.',
    color: '#2563EB',
    segment: 'particuliers',
    icon: Baby,
    rateBonus: 'Capital d’envol garanti',
    features: [
      'Compte nominatif bloqué et protégé jusqu’à la majorité',
      'Rémunération par intérêts capitalisés garantis',
      'Relevé annuel de progression remis aux parents',
    ],
  },
];

interface HeroSlide {
  id: string;
  image: string;
  badge: string;
  title: string;
  highlight: string;
  titleSuffix?: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  secondaryHref: string;
}

const heroSlides: HeroSlide[] = [
  {
    id: 'cooperative',
    image: '/hero/banner-cooperative.jpg',
    badge: 'Coopérative Agréée BCC N° 048/COOPEC',
    title: '« Avec Mwangaza Wetu, ',
    highlight: 'je sécurise l’avenir',
    titleSuffix: ' de ma famille »',
    subtitle: 'Déposez, épargnez et accédez à des crédits solidaires avec validation biométrique à chaque passage en agence.',
    primaryCta: 'Devenir membre',
    secondaryCta: 'Espace membre',
    secondaryHref: '/login',
  },
  {
    id: 'biashara',
    image: '/hero/banner-biashara.jpg',
    badge: '#CréditBiashara · PME & Commerçants',
    title: '« Avec le crédit Biashara, ',
    highlight: 'mon commerce grandit',
    titleSuffix: ' chaque jour »',
    subtitle: 'Épargnez vos recettes journalières en toute sécurité et débloquez une ligne de crédit pour financer vos stocks et agrandir votre activité.',
    primaryCta: 'Demander un crédit Biashara',
    secondaryCta: 'Calculer mes mensualités',
    secondaryHref: '#simulateur',
  },
  {
    id: 'nyumba',
    image: '/hero/banner-nyumba.jpg',
    badge: '#ÉpargneNyumba · Loyer & Logement',
    title: '« Avec l’épargne Nyumba, ',
    highlight: 'je paie mon loyer',
    titleSuffix: ' en toute sérénité »',
    subtitle: 'Épargnez chaque mois et ne subissez plus la pression du loyer. Notre formule Nyumba vous permet d’anticiper vos échéances locatives.',
    primaryCta: 'Ouvrir mon compte Nyumba',
    secondaryCta: 'Calculer mon épargne',
    secondaryHref: '#simulateur',
  },
  {
    id: 'kelasi',
    image: '/hero/banner-kelasi.jpg',
    badge: '#ÉpargneKelasi · Scolarité & Université',
    title: '« Avec l’épargne Kelasi, ',
    highlight: 'la rentrée de mes enfants',
    titleSuffix: ' est garantie »',
    subtitle: 'Anticipez les frais académiques et le minerval grâce à une épargne régulière et bénéficiez d’avances scolaires rapides.',
    primaryCta: 'Souscrire à Kelasi',
    secondaryCta: 'Simuler mon épargne',
    secondaryHref: '#simulateur',
  },
];

export default function VitrinePage() {
  const [lang, setLang] = useState<Lang>('FR');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<Segment>('particuliers');
  const [modalOpen, setModalOpen] = useState(false);
  const [showSecurityAlert, setShowSecurityAlert] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  // Simulateur State
  const [simType, setSimType] = useState<SimType>('credit');
  const [amount, setAmount] = useState<number>(1000);
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');

  // Convertisseur devises rapide
  const [fxAmountUSD, setFxAmountUSD] = useState<number>(100);
  const FX_RATE = 2850;

  // Calculs du simulateur
  const simResults = useMemo(() => {
    if (simType === 'credit') {
      const monthlyRate = 0.02; // 2% indicatif
      const totalInterest = amount * monthlyRate * durationMonths;
      const totalToRepay = amount + totalInterest;
      const monthlyPayment = totalToRepay / durationMonths;
      return {
        label1: 'Mensualité estimée',
        val1: `${Math.round(monthlyPayment).toLocaleString()} ${currency}`,
        label2: 'Total remboursable',
        val2: `${Math.round(totalToRepay).toLocaleString()} ${currency}`,
        info: 'Estimation indicative soumise aux conditions d’adhésion et de régularité d’épargne.',
      };
    } else {
      const bonusRate = 0.045; // 4.5% l'an
      const estimatedBonus = (amount * bonusRate * (durationMonths / 12));
      const totalSaved = amount + estimatedBonus;
      return {
        label1: 'Capital accumulé estimé',
        val1: `${Math.round(totalSaved).toLocaleString()} ${currency}`,
        label2: 'Bonus coopératif projeté',
        val2: `+${Math.round(estimatedBonus).toLocaleString()} ${currency}`,
        info: 'Rendement coopératif calculé selon les statuts de distribution des excédents d’exercice.',
      };
    }
  }, [simType, amount, durationMonths, currency]);

  // Filtrage des formules selon le segment
  const filteredAccounts = useMemo(() => {
    if (activeSegment === 'entrepreneurs') {
      return accountsList.filter((a) => a.segment === 'entrepreneurs' || a.slug === 'principal');
    }
    if (activeSegment === 'diaspora') {
      return accountsList.filter((a) => a.slug === 'nyumba' || a.slug === 'principal' || a.slug === 'mutoto');
    }
    return accountsList;
  }, [activeSegment]);

  return (
    <div className="bk-portal">
      {/* 1. TOPBAR BLEU NUIT */}
      <aside className="bk-topbar">
        <div className="bk-container bk-topbar-inner">
          <div className="bk-topbar-segments">
            <button
              type="button"
              className={`bk-seg-tab-new ${activeSegment === 'particuliers' ? 'active' : ''}`}
              onClick={() => setActiveSegment('particuliers')}
            >
              Particuliers
            </button>
            <button
              type="button"
              className={`bk-seg-tab-new ${activeSegment === 'entrepreneurs' ? 'active' : ''}`}
              onClick={() => setActiveSegment('entrepreneurs')}
            >
              Entrepreneurs
            </button>
            <button
              type="button"
              className={`bk-seg-tab-new ${activeSegment === 'diaspora' ? 'active' : ''}`}
              onClick={() => setActiveSegment('diaspora')}
            >
              Diaspora
            </button>
          </div>
          <div className="bk-topbar-right">
            <a href="tel:+243820000000" className="bk-topbar-contact">
              <Phone size={13} />
              <span>+243 820 000 000</span>
            </a>
            <div className="bk-topbar-rate">
              <span>Taux indicatif : <strong>1 USD = 2 850 CDF</strong></span>
            </div>
            <span className="bk-topbar-divider">|</span>
            <Link href="/login" className="bk-topbar-login-link">
              <Lock size={13} />
              <span>Espace membre</span>
            </Link>
            <button type="button" className="bk-topbar-icon-btn" aria-label="Recherche">
              <Search size={14} />
            </button>
            <button
              type="button"
              className="bk-lang-pill"
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
            >
              <span>{lang}</span>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. NAVBAR BLANCHE HAUTE-GAMME */}
      <header className="bk-header">
        <div className="bk-container bk-header-inner">
          <Link href="/" className="bk-brand">
            <div className="bk-logo-box">
              <img src="/logo.png" alt="Mwangaza Wetu" className="bk-logo-img" />
            </div>
            <div className="bk-brand-titles">
              <div className="bk-brand-name-two-lines">
                <span>MWANGAZA</span>
                <span>WETU</span>
              </div>
              <span className="bk-brand-motto">ÉPARGNE · CRÉDIT · PROGRÈS</span>
            </div>
          </Link>

          <nav className="bk-nav" aria-label="Menu principal">
            <ul className="bk-nav-list">
              <li>
                <a href="#services" className="bk-nav-item">
                  <span>Comptes &amp; Formules</span>
                  <ChevronDown size={14} className="bk-nav-chev" />
                </a>
              </li>
              <li>
                <a href="#simulateur" className="bk-nav-item">
                  <span>Simulateur</span>
                </a>
              </li>
              <li>
                <a href="#securite" className="bk-nav-item">
                  <span>Sécurité &amp; Biométrie</span>
                  <ChevronDown size={14} className="bk-nav-chev" />
                </a>
              </li>
              <li>
                <a href="#fonctionnement" className="bk-nav-item">
                  <span>Comment adhérer</span>
                </a>
              </li>
              <li>
                <a href="#contact" className="bk-nav-item">
                  <span>Nos agences</span>
                  <ChevronDown size={14} className="bk-nav-chev" />
                </a>
              </li>
            </ul>
          </nav>

          <div className="bk-header-actions">
            <button
              type="button"
              className="bk-btn-devenir-membre"
              onClick={() => setModalOpen(true)}
            >
              Devenir membre
            </button>
            <button
              type="button"
              className="bk-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Menu Mobile */}
        {mobileMenuOpen && (
          <div className="bk-mobile-drawer">
            <div className="bk-mobile-drawer-links">
              <a href="#services" onClick={() => setMobileMenuOpen(false)}>Comptes &amp; Formules</a>
              <a href="#simulateur" onClick={() => setMobileMenuOpen(false)}>Simulateur</a>
              <a href="#securite" onClick={() => setMobileMenuOpen(false)}>Sécurité &amp; Biométrie</a>
              <a href="#fonctionnement" onClick={() => setMobileMenuOpen(false)}>Comment adhérer</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Nos Agences</a>
            </div>
            <div className="bk-mobile-drawer-actions">
              <Link href="/login" className="bk-btn-login w-full justify-center">
                <Lock size={16} /> Espace Membre Sécurisé
              </Link>
              <button
                type="button"
                className="bk-btn-devenir-membre w-full justify-center"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setModalOpen(true);
                }}
              >
                Devenir membre
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. BANDEAU DE SÉCURITÉ DISMISSIBLE */}
      {showSecurityAlert && (
        <section className="bk-security-bar">
          <div className="bk-container bk-security-inner">
            <div className="bk-security-left">
              <ShieldAlert size={17} className="bk-security-icon" />
              <p className="bk-security-text">
                <strong>Sécurité :</strong> nos agents ne vous demanderont <strong>jamais</strong> votre mot de passe ni votre code PIN par téléphone ou WhatsApp.{' '}
                <a href="#securite" className="bk-security-link">Voir les règles</a>
              </p>
            </div>
            <div className="bk-security-right">
              <span className="bk-security-bcc">Coopérative agréée BCC N° 048/COOPEC</span>
              <button
                type="button"
                className="bk-security-close"
                onClick={() => setShowSecurityAlert(false)}
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. HERO BANCAIRE CAROUSEL TMB STYLE */}
      <section
        className="bk-hero"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slides d'arrière-plan avec images style TMB Bank */}
        <div className="bk-hero-slides" aria-hidden="true">
          {heroSlides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`bk-hero-slide ${idx === currentSlide ? 'active' : ''}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          ))}
        </div>

        <div className="bk-container bk-hero-inner">
          <div className="bk-hero-content" key={heroSlides[currentSlide].id}>
            <div className="bk-badge-pill">
              <img src="/logo.png" alt="MW" className="bk-badge-logo" />
              <span>{heroSlides[currentSlide].badge}</span>
            </div>

            <h1 className="bk-hero-title">
              {heroSlides[currentSlide].title}
              <span className="bk-highlight">{heroSlides[currentSlide].highlight}</span>
              {heroSlides[currentSlide].titleSuffix}
            </h1>

            <p className="bk-hero-lead">
              {heroSlides[currentSlide].subtitle}
            </p>

            <div className="bk-hero-cta-group">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="bk-cta-primary"
              >
                <span>{heroSlides[currentSlide].primaryCta}</span>
                <ArrowRight size={18} />
              </button>
              <Link href={heroSlides[currentSlide].secondaryHref} className="bk-cta-secondary">
                <Lock size={16} />
                <span>{heroSlides[currentSlide].secondaryCta}</span>
              </Link>
            </div>

            {/* Profils & Témoignages des Membres (Style Bank of Kigali) */}
            <div className="bk-hero-testimonials">
              <span className="bk-testimonials-label">TÉMOIGNAGES · +520 MEMBRES ACTIFS</span>
              <div className="bk-avatar-stack">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Membre Mwangaza"
                  className="bk-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Membre Mwangaza"
                  className="bk-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Membre Mwangaza"
                  className="bk-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Membre Mwangaza"
                  className="bk-avatar"
                />
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Membre Mwangaza"
                  className="bk-avatar"
                />
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="bk-avatar-arrow"
                  aria-label="Rejoindre les membres"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>

            {/* Puces (Dots) de navigation */}
            <div className="bk-hero-dots">
              {heroSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`bk-hero-dot ${idx === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Bannière ${idx + 1} : ${slide.badge}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Flèches latérales du slider (gauche et droite, style TMB Bank) */}
        <button
          type="button"
          className="bk-hero-arrow prev"
          onClick={prevSlide}
          aria-label="Bannière précédente"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          type="button"
          className="bk-hero-arrow next"
          onClick={nextSlide}
          aria-label="Bannière suivante"
        >
          <ChevronRight size={22} />
        </button>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. LE QUICK-ACTION TRAY FLOTTANT (Style Bank of Kigali)
          Placé entre le Hero et la section suivante avec chevauchement
         ───────────────────────────────────────────────────────────── */}
      <div className="bk-tray-overlap-wrapper">
        <div className="bk-container">
          <div className="bk-quick-tray-card">
            <div className="bk-tray-header-pill">
              <span>DES SOLUTIONS ADAPTÉES À VOTRE PROFIL</span>
            </div>

            <div className="bk-quick-tray-grid">
              <div
                className="bk-tray-col"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveSegment('particuliers');
                  const el = document.getElementById('services');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="bk-tray-col-title">
                  <span>Je suis un particulier</span>
                  <ChevronRight size={16} />
                </div>
                <p className="bk-tray-col-desc">
                  Épargne sécurisée, transferts et microcrédits du quotidien
                </p>
              </div>

              <div
                className="bk-tray-col"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveSegment('entrepreneurs');
                  const el = document.getElementById('services');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="bk-tray-col-title">
                  <span>Je suis commerçant / PME</span>
                  <ChevronRight size={16} />
                </div>
                <p className="bk-tray-col-desc">
                  Lignes de crédit Biashara et financement de stock commercial
                </p>
              </div>

              <div
                className="bk-tray-col"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveSegment('diaspora');
                  const el = document.getElementById('services');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="bk-tray-col-title">
                  <span>Je vis dans la diaspora</span>
                  <ChevronRight size={16} />
                </div>
                <p className="bk-tray-col-desc">
                  Épargnez et soutenez vos proches au pays en toute confiance
                </p>
              </div>

              <div
                className="bk-tray-col"
                role="button"
                tabIndex={0}
                onClick={() => {
                  const el = document.getElementById('simulateur');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="bk-tray-col-title">
                  <span>Je prépare l’avenir</span>
                  <ChevronRight size={16} />
                </div>
                <p className="bk-tray-col-desc">
                  Logement avec Nyumba et scolarité garantie avec Kelasi
                </p>
              </div>
            </div>

            {/* Bouton d'action flottant au centre bas (Style Bank of Kigali) */}
            <button
              type="button"
              className="bk-tray-floating-btn"
              onClick={() => setModalOpen(true)}
              aria-label="Devenir membre"
            >
              <ArrowRight size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SECTION DES FORMULES & COMPTES CONCRETS (Style UI/UX Pro)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section bk-products-section" id="services">
        <div className="bk-container">
          <div className="bk-section-header text-center">
            <div className="bk-kicker">FORMULES DE COMPTES &amp; CRÉDITS ADAPTÉS</div>
            <h2 className="bk-section-title">
              Des solutions concrètes pour sécuriser et faire grandir votre argent
            </h2>
            <p className="bk-section-sub">
              Chaque compte répond à un besoin réel de votre quotidien : financer votre commerce, sécuriser votre loyer, garantir la scolarité de vos enfants ou épargner en toute liberté.
            </p>

            {/* Onglets de filtrage par profil (Synchronisés avec le plateau flottant) */}
            <div className="bk-category-tabs">
              <button
                type="button"
                className={`bk-cat-tab ${activeSegment === 'particuliers' ? 'active' : ''}`}
                onClick={() => setActiveSegment('particuliers')}
              >
                <Users size={16} />
                <span>Particuliers &amp; Familles</span>
              </button>
              <button
                type="button"
                className={`bk-cat-tab ${activeSegment === 'entrepreneurs' ? 'active' : ''}`}
                onClick={() => setActiveSegment('entrepreneurs')}
              >
                <Store size={16} />
                <span>Commerçants &amp; PME</span>
              </button>
              <button
                type="button"
                className={`bk-cat-tab ${activeSegment === 'diaspora' ? 'active' : ''}`}
                onClick={() => setActiveSegment('diaspora')}
              >
                <Landmark size={16} />
                <span>Diaspora &amp; Projets</span>
              </button>
            </div>
          </div>

          {/* Grille des 6 Comptes Phares Mwangaza */}
          <div className="bk-cards-grid">
            {filteredAccounts.map((acc) => {
              const IconComp = acc.icon;
              return (
                <div className="bk-product-card" key={acc.slug}>
                  <div className="bk-card-accent" style={{ background: acc.color }} />
                  <div className="bk-prod-top">
                    <div
                      className="bk-prod-icon"
                      style={{ background: `${acc.color}15`, color: acc.color }}
                    >
                      <IconComp size={26} />
                    </div>
                    <span
                      className="bk-prod-tag"
                      style={{ color: acc.color, borderColor: `${acc.color}40`, background: `${acc.color}08` }}
                    >
                      {acc.rateBonus}
                    </span>
                  </div>

                  <h3 className="bk-prod-name">{acc.name}</h3>
                  <div className="bk-prod-sub">{acc.sub}</div>
                  <p className="bk-prod-desc">{acc.desc}</p>

                  {/* 3 Avantages clés concrets avec checkmarks */}
                  <ul className="bk-prod-features">
                    {acc.features.map((feat, fIdx) => (
                      <li key={fIdx}>
                        <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="bk-prod-action">
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="bk-btn-subscribe"
                      style={{ '--accent-color': acc.color } as React.CSSProperties}
                    >
                      <span>Souscrire à ce compte</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bannière de Réassurance & Orientation en bas de section */}
          <div className="bk-products-help-banner">
            <div className="bk-help-content">
              <ShieldCheck size={28} className="text-emerald-500 flex-shrink-0" />
              <div>
                <h4>Besoin d'un accompagnement personnalisé pour choisir votre formule ?</h4>
                <p>Nos conseillers vous reçoivent en agence ou répondent directement à vos questions par téléphone et WhatsApp.</p>
              </div>
            </div>
            <div className="bk-help-actions">
              <a href="tel:+243820000000" className="bk-help-btn-outline">
                <Phone size={15} />
                <span>+243 820 000 000</span>
              </a>
              <a href="#contact" className="bk-help-btn-primary">
                <span>Trouver mon agence</span>
                <ChevronRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. CONVERTISSEUR DE DEVISES EN DIRECT (CDF / USD)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section bk-fx-section" id="devises">
        <div className="bk-container">
          <div className="bk-fx-box">
            <div className="bk-fx-header">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Convertisseur de devises du jour
                </h3>
                <p className="text-sm text-slate-500">
                  Taux indicatif appliqué sur les opérations de dépôt et de change en agence.
                </p>
              </div>
              <div className="bk-rate-badge">
                1 USD = <strong>2 850 CDF</strong>
              </div>
            </div>

            <div className="bk-fx-converter-grid">
              <div className="bk-fx-input-wrap">
                <label className="text-xs font-semibold uppercase text-slate-500">Montant en USD ($)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={1}
                    value={fxAmountUSD}
                    onChange={(e) => setFxAmountUSD(Math.max(0, Number(e.target.value)))}
                    className="bk-fx-input"
                  />
                  <span className="font-bold text-slate-700">USD</span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="bk-fx-arrow">
                  <ArrowLeftRight size={20} />
                </div>
              </div>

              <div className="bk-fx-input-wrap">
                <label className="text-xs font-semibold uppercase text-slate-500">Équivalent en Francs Congolais (CDF)</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="bk-fx-result">
                    {(fxAmountUSD * FX_RATE).toLocaleString()} <strong>CDF</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. CANAUX DIGITAUX & PROXIMITÉ (Style Rawbank / Bank of Kigali)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section bk-digital-section" id="canaux">
        <div className="bk-container">
          <div className="bk-digital-grid">
            <div className="bk-digital-text">
              <div className="bk-kicker">MODERNITÉ & SÉCURITÉ</div>
              <h2 className="bk-section-title">
                Votre coopérative dans votre poche et à chaque coin de rue
              </h2>
              <p className="bk-section-sub">
                Mwangaza Wetu allie la force de la technologie digitale à la proximité humaine de ses agents de terrain.
              </p>

              <div className="bk-channel-list">
                <div className="bk-channel-item">
                  <div className="bk-ch-icon">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h4>Espace Membre Web Sécurisé</h4>
                    <p>Consultez vos soldes, téléchargez vos relevés d’épargne et suivez vos échéances 24h/24.</p>
                  </div>
                </div>

                <div className="bk-channel-item">
                  <div className="bk-ch-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4>Vérification Biométrique au Guichet</h4>
                    <p>Vos dépôts et retraits sont authentifiés par empreinte digitale pour prévenir toute usurpation.</p>
                  </div>
                </div>

                <div className="bk-channel-item">
                  <div className="bk-ch-icon">
                    <Phone size={20} />
                  </div>
                  <div>
                    <h4>Alertes SMS & WhatsApp Instantanées</h4>
                    <p>Recevez un accusé de réception officiel dès que votre versement est enregistré dans le système.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup Espace Membre */}
            <div className="bk-digital-preview">
              <div className="bk-phone-frame">
                <div className="bk-phone-screen">
                  <div className="bk-screen-topbar">
                    <span>9:41</span>
                    <span>Mwangaza Mobile</span>
                  </div>
                  <div className="bk-screen-card">
                    <div className="text-xs opacity-75">Solde Global Épargne</div>
                    <div className="text-2xl font-bold mt-1">1,480.00 USD</div>
                    <div className="text-xs text-emerald-300 mt-2">● Compte Actif & Garanti BCC</div>
                  </div>
                  <div className="bk-screen-actions">
                    <div className="bk-screen-btn">Déposer</div>
                    <div className="bk-screen-btn">Relevé</div>
                    <div className="bk-screen-btn">Crédit</div>
                  </div>
                  <div className="bk-screen-history">
                    <div className="text-xs font-bold text-slate-500 mb-2">DERNIÈRES TRANSACTIONS</div>
                    <div className="bk-history-row">
                      <span>Dépôt Kelasi</span>
                      <strong className="text-emerald-600">+50.00 $</strong>
                    </div>
                    <div className="bk-history-row">
                      <span>Cotisation Nyumba</span>
                      <strong className="text-emerald-600">+100.00 $</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. AGENCES & CONTACT (Style Equity BCDC)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section bk-contact-section" id="contact">
        <div className="bk-container">
          <div className="bk-section-header text-center">
            <div className="bk-kicker">RÉSEAU DE PROXIMITÉ</div>
            <h2 className="bk-section-title">Nos agences et points de service</h2>
            <p className="bk-section-sub">
              Rencontrez nos conseillers d'agence ou sollicitez un agent collecteur agréé pour vos versements.
            </p>
          </div>

          <div className="bk-contact-grid">
            <div className="bk-contact-card">
              <div className="bk-contact-card-icon">
                <Building2 size={24} />
              </div>
              <h3>Siège Social & Agence Principale</h3>
              <p className="bk-contact-desc">
                Kinshasa, République Démocratique du Congo.<br />
                Ouvert du Lundi au Samedi dès 8h00.
              </p>
              <div className="bk-contact-detail">
                <Phone size={15} /> <strong>+243 820 000 000</strong>
              </div>
              <div className="bk-contact-detail">
                <Mail size={15} /> contact@mwangazawetu.cd
              </div>
            </div>

            <div className="bk-contact-card">
              <div className="bk-contact-card-icon">
                <Users size={24} />
              </div>
              <h3>Réseau d’Agents Délégués</h3>
              <p className="bk-contact-desc">
                Des agents itinérants équipés de terminaux sécurisés collectent vos cotisations sur votre lieu de travail ou commerce.
              </p>
              <div className="bk-contact-badge">
                Vérification d’identité par badge QR officiel
              </div>
            </div>

            <div className="bk-contact-card">
              <div className="bk-contact-card-icon">
                <Landmark size={24} />
              </div>
              <h3>Gouvernance & Conformité</h3>
              <p className="bk-contact-desc">
                Institution agréée et contrôlée par les autorités monétaires compétentes en RDC.
              </p>
              <div className="bk-contact-detail">
                <ShieldCheck size={15} /> Agrément n° 048/COOPEC
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. FOOTER BANCAIRE COMPLET (Style Bank of Kigali / BOA)
         ───────────────────────────────────────────────────────────── */}
      <footer className="bk-footer">
        <div className="bk-container">
          <div className="bk-footer-top">
            <div className="bk-footer-brand">
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full bg-white p-1" />
                <span className="text-xl font-bold text-white tracking-wide">MWANGAZA WETU</span>
              </div>
              <p className="bk-footer-text">
                Institution coopérative d’épargne et de crédit au service des familles, entrepreneurs et artisans congolais. Fonds garantis et gestion certifiée.
              </p>
              <div className="bk-footer-license">
                Agrément Banque Centrale du Congo / COOPEC n° 048
              </div>
            </div>

            <div className="bk-footer-col">
              <h4>Comptes & Épargne</h4>
              <ul>
                <li><a href="#services">Compte Courant Principal</a></li>
                <li><a href="#services">Épargne Scolaire Kelasi</a></li>
                <li><a href="#services">Épargne Santé Hôpital</a></li>
                <li><a href="#services">Épargne Habitat Nyumba</a></li>
                <li><a href="#services">Épargne Commerce Biashara</a></li>
              </ul>
            </div>

            <div className="bk-footer-col">
              <h4>Outils & Services</h4>
              <ul>
                <li><a href="#simulateur">Simulateur de crédit</a></li>
                <li><a href="#devises">Taux de change CDF / USD</a></li>
                <li><Link href="/login">Accès Espace Membre</Link></li>
                <li><a href="#securite">Sécurité biométrique</a></li>
                <li><a href="#contact">Trouver une agence</a></li>
              </ul>
            </div>

            <div className="bk-footer-col">
              <h4>Assistance 24/7</h4>
              <p className="text-xs text-slate-400 mb-2">Une question sur vos dépôts ou votre compte ?</p>
              <div className="text-lg font-bold text-amber-400 mb-3">+243 820 000 000</div>
              <p className="text-xs text-slate-400">Courriel officiel :</p>
              <div className="text-sm text-white font-medium">contact@mwangazawetu.cd</div>
            </div>
          </div>

          <div className="bk-footer-bottom">
            <div className="text-xs text-slate-400">
              © {new Date().getFullYear()} Mwangaza Wetu. Tous droits réservés. République Démocratique du Congo.
            </div>
            <div className="flex gap-6 text-xs text-slate-400">
              <a href="#" className="hover:text-white">Statuts coopératifs</a>
              <a href="#" className="hover:text-white">Règlement intérieur</a>
              <a href="#" className="hover:text-white">Protection des données</a>
              <a href="#" className="hover:text-white">Sécurité anti-fraude</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          13. MODALE D'ADHÉSION "DEVENIR MEMBRE" (Style Banque Pro)
         ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="bk-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="bk-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bk-modal-header">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Devenir Membre Mwangaza Wetu
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rejoignez notre communauté financière solidaire en quelques étapes simples.
                </p>
              </div>
              <button
                type="button"
                className="bk-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="bk-modal-body">
              <div className="bk-doc-checklist">
                <h4 className="text-sm font-bold text-slate-800 mb-3">
                  📋 Documents requis pour l'adhésion :
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Une pièce d'identité en cours de validité (Carte d'électeur ou Passeport).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Deux photos passeport récentes (ou prise de photo sur place).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Un numéro de téléphone actif (pour la réception des SMS de confirmation).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Dépôt initial de souscription selon la formule choisie.</span>
                  </div>
                </div>
              </div>

              <div className="bk-modal-options mt-5">
                <a
                  href="#contact"
                  onClick={() => setModalOpen(false)}
                  className="bk-modal-btn-primary"
                >
                  <MapPin size={18} />
                  <span>Se rendre dans l'agence la plus proche</span>
                </a>
                <Link
                  href="/login"
                  onClick={() => setModalOpen(false)}
                  className="bk-modal-btn-secondary"
                >
                  <Lock size={16} />
                  <span>J'ai déjà un compte : Me connecter</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
