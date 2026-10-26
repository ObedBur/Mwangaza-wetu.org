'use client';

import './vitrine.css';
import Link from 'next/link';
import { useState, useMemo } from 'react';
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
}

const accountsList: AccountFormula[] = [
  {
    slug: 'principal',
    name: 'Compte Courant & Pivot',
    sub: 'Épargne libre et quotidienne',
    desc: 'Effectuez vos dépôts et retraits en toute liberté au guichet ou auprès des agents de proximité certifiés.',
    color: '#074780',
    segment: 'all',
    icon: Wallet,
    rateBonus: 'Liquidité 100% immédiate',
  },
  {
    slug: 'kelasi',
    name: 'Épargne Kelasi',
    sub: 'Scolarité & Université',
    desc: 'Planifiez sereinement les frais académiques de vos enfants et protégez leur avenir sans stress de rentrée.',
    color: '#D97706',
    segment: 'particuliers',
    icon: GraduationCap,
    rateBonus: 'Bonus rentrée scolaire',
  },
  {
    slug: 'hopital',
    name: 'Épargne Hôpital',
    sub: 'Santé & Urgences médicales',
    desc: 'Un filet de sécurité indispensable pour parer aux imprévus de santé de toute votre famille avec décaissement prioritaire.',
    color: '#DC2626',
    segment: 'particuliers',
    icon: HeartPulse,
    rateBonus: 'Déblocage prioritaire 24h',
  },
  {
    slug: 'nyumba',
    name: 'Épargne Nyumba',
    sub: 'Habitat & Construction',
    desc: 'Constituez votre apport personnel pour l’achat de parcelle, les matériaux ou la construction de votre maison.',
    color: '#9333EA',
    segment: 'particuliers',
    icon: Home,
    rateBonus: 'Accès crédit immobilier',
  },
  {
    slug: 'biashara',
    name: 'Épargne Biashara',
    sub: 'Commerce & Activités PME',
    desc: 'Développez votre fonds de roulement commercial, sécurisez vos recettes journalières et accédez aux lignes de crédit.',
    color: '#0D9488',
    segment: 'entrepreneurs',
    icon: Store,
    rateBonus: 'Facilités de caisse & stock',
  },
  {
    slug: 'mutoto',
    name: 'Épargne Mutoto',
    sub: 'Avenir des mineurs & enfants',
    desc: 'Un compte bloqué au nom de votre enfant pour lui garantir un capital d’envol à sa majorité ou pour ses études.',
    color: '#2563EB',
    segment: 'particuliers',
    icon: Baby,
    rateBonus: 'Intérêts capitalisés garantis',
  },
];

export default function VitrinePage() {
  const [lang, setLang] = useState<Lang>('FR');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<Segment>('particuliers');
  const [modalOpen, setModalOpen] = useState(false);

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
      {/* ─────────────────────────────────────────────────────────────
          1. TOPBAR INSTITUTIONNELLE STYLE EQUITY BCDC / BANK OF KIGALI
         ───────────────────────────────────────────────────────────── */}
      <aside className="bk-topbar">
        <div className="bk-container bk-topbar-inner">
          <div className="bk-topbar-left">
            <span className="bk-topbar-tag">
              <ShieldCheck size={13} className="text-emerald-400" />
              COOPÉRATIVE AGRÉÉE BCC N° 048/COOPEC
            </span>
            <span className="bk-topbar-divider">|</span>
            <span className="bk-topbar-link">
              <Phone size={13} /> Hotline & WhatsApp : <strong>+243 820 000 000</strong>
            </span>
            <span className="bk-topbar-divider">|</span>
            <span className="bk-topbar-hours">
              <Clock size={13} /> Agences : Lun – Sam 8h00 – 16h30
            </span>
          </div>

          <div className="bk-topbar-right">
            <div className="bk-fx-pill">
              <ArrowLeftRight size={12} />
              <span>Taux indicatif : <strong>1 USD = 2 850 CDF</strong></span>
            </div>
            <div className="bk-lang-switch">
              <button
                type="button"
                className={lang === 'FR' ? 'active' : ''}
                onClick={() => setLang('FR')}
              >
                FR
              </button>
              <span>/</span>
              <button
                type="button"
                className={lang === 'EN' ? 'active' : ''}
                onClick={() => setLang('EN')}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. BANDEAU DE SEGMENTATION (Style BOA & Equity BCDC)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-segment-strip">
        <div className="bk-container bk-segment-inner">
          <div className="bk-segment-tabs">
            <button
              type="button"
              className={`bk-seg-tab ${activeSegment === 'particuliers' ? 'active' : ''}`}
              onClick={() => setActiveSegment('particuliers')}
            >
              <Users size={14} /> Particuliers & Familles
            </button>
            <button
              type="button"
              className={`bk-seg-tab ${activeSegment === 'entrepreneurs' ? 'active' : ''}`}
              onClick={() => setActiveSegment('entrepreneurs')}
            >
              <Store size={14} /> Commerçants & Entrepreneurs
            </button>
            <button
              type="button"
              className={`bk-seg-tab ${activeSegment === 'diaspora' ? 'active' : ''}`}
              onClick={() => setActiveSegment('diaspora')}
            >
              <Landmark size={14} /> Diaspora & Investissement
            </button>
          </div>
          <div className="bk-segment-help">
            <span>Besoin d’un conseil personnalisé ?</span>
            <a href="#contact" className="bk-link-help">Nos conseillers d’agence →</a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. NAVBAR PRINCIPALE HAUTE-GAMME
         ───────────────────────────────────────────────────────────── */}
      <header className="bk-header">
        <div className="bk-container bk-header-inner">
          {/* Logo officiel */}
          <Link href="/" className="bk-brand">
            <div className="bk-logo-frame">
              <img src="/logo.png" alt="Mwangaza Wetu" className="bk-logo-img" />
            </div>
            <div className="bk-brand-titles">
              <span className="bk-brand-name">MWANGAZA WETU</span>
              <span className="bk-brand-motto">Épargne • Crédit • Progrès Communautaire</span>
            </div>
          </Link>

          {/* Menus Desktop */}
          <nav className="bk-nav" aria-label="Menu principal">
            <ul className="bk-nav-list">
              <li>
                <a href="#services" className="bk-nav-item">
                  Comptes & Formules
                </a>
              </li>
              <li>
                <a href="#simulateur" className="bk-nav-item">
                  Simulateur Express
                </a>
              </li>
              <li>
                <a href="#securite" className="bk-nav-item">
                  Sécurité & Biométrie
                </a>
              </li>
              <li>
                <a href="#fonctionnement" className="bk-nav-item">
                  Comment adhérer
                </a>
              </li>
              <li>
                <a href="#contact" className="bk-nav-item">
                  Nos Agences
                </a>
              </li>
            </ul>
          </nav>

          {/* Boutons d'accès directs */}
          <div className="bk-header-actions">
            <Link href="/login" className="bk-btn-login">
              <Lock size={15} className="bk-lock-icon" />
              <span>Espace Membre</span>
            </Link>

            <button
              type="button"
              className="bk-btn-open-account"
              onClick={() => setModalOpen(true)}
            >
              <span>Devenir membre</span>
              <ArrowRight size={15} />
            </button>

            {/* Mobile Hamburger */}
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

        {/* Menu Mobile Accordéon */}
        {mobileMenuOpen && (
          <div className="bk-mobile-drawer">
            <div className="bk-mobile-drawer-links">
              <a href="#services" onClick={() => setMobileMenuOpen(false)}>Comptes & Formules</a>
              <a href="#simulateur" onClick={() => setMobileMenuOpen(false)}>Simulateur de crédit / épargne</a>
              <a href="#securite" onClick={() => setMobileMenuOpen(false)}>Sécurité & Biométrie</a>
              <a href="#fonctionnement" onClick={() => setMobileMenuOpen(false)}>Comment adhérer</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Nos Agences</a>
            </div>
            <div className="bk-mobile-drawer-actions">
              <Link href="/login" className="bk-btn-login w-full justify-center">
                <Lock size={16} /> Espace Membre Sécurisé
              </Link>
              <button
                type="button"
                className="bk-btn-open-account w-full justify-center"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setModalOpen(true);
                }}
              >
                Devenir membre →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          4. BANDEAU DE SÉCURITÉ OFFICIEL & ANTI-FRAUDE (Style Equity BCDC)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-fraud-alert" id="securite">
        <div className="bk-container bk-fraud-inner">
          <div className="bk-fraud-icon">
            <ShieldAlert size={20} />
          </div>
          <div className="bk-fraud-text">
            <strong>Avertissement Officiel de Sécurité :</strong> Les agents et guichetiers Mwangaza Wetu ne vous demanderont <u>JAMAIS</u> votre mot de passe, ni code PIN par téléphone ou WhatsApp. Toute opération en agence ou auprès d'un agent délégué fait l'objet d'une validation biométrique certifiée.
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. HERO BANCAIRE RICHE (Bank of Kigali + Equity BCDC)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-hero">
        <div className="bk-hero-bg-overlay" />
        <div className="bk-container bk-hero-inner">
          {/* Colonne gauche : Titre & Propositions de valeur */}
          <div className="bk-hero-content">
            <div className="bk-badge-pill">
              <Sparkles size={14} className="text-amber-400" />
              <span>COOPÉRATIVE D’ÉPARGNE ET DE CRÉDIT DE RÉFÉRENCE EN RDC</span>
            </div>

            <h1 className="bk-hero-title">
              La finance solidaire qui <br />
              <span className="bk-highlight">sécurise vos ambitions</span> au quotidien.
            </h1>

            <p className="bk-hero-lead">
              Sécurisez votre épargne, planifiez les études de vos enfants avec <strong>Kelasi</strong>, financez votre stock avec <strong>Biashara</strong> et bâtissez votre logement avec des crédits responsables.
            </p>

            <div className="bk-hero-cta-group">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="bk-cta-primary"
              >
                <span>Ouvrir mon compte maintenant</span>
                <ArrowRight size={18} />
              </button>
              <Link href="/login" className="bk-cta-secondary">
                <Lock size={16} />
                <span>Consulter mes comptes en direct</span>
              </Link>
            </div>

            {/* Social Proof certifié */}
            <div className="bk-social-proof">
              <div className="bk-rating-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#FBBF24" color="#FBBF24" />
                ))}
                <span className="bk-rating-score">4.9 / 5</span>
              </div>
              <p className="bk-social-text">
                Plus de <strong>520 familles et commerçants actifs</strong> nous confient leur avenir financier.
              </p>
            </div>
          </div>

          {/* Colonne droite : Carte bancaire prestige & Passbook digital */}
          <div className="bk-hero-showcase">
            {/* Carte de Membre Digitale Mwangaza Gold */}
            <div className="bk-virtual-card">
              <div className="bk-card-header">
                <div className="bk-card-chip" />
                <span className="bk-card-tier">MEMBRE PRIVILÈGE</span>
              </div>
              <div className="bk-card-number">•••• •••• •••• 5824</div>
              <div className="bk-card-footer">
                <div>
                  <div className="bk-card-label">TITULAIRE DU COMPTE</div>
                  <div className="bk-card-name">MEMBRE ACTIF CERTIFIÉ</div>
                </div>
                <div className="bk-card-brand">
                  <span className="bk-card-tag">MWANGAZA GOLD</span>
                </div>
              </div>
            </div>

            {/* Widget transactionnel en temps réel */}
            <div className="bk-hero-widget">
              <div className="bk-widget-top">
                <div className="bk-widget-badge">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Dernière opération vérifiée</span>
                </div>
                <span className="bk-widget-time">Il y a 3 min</span>
              </div>
              <div className="bk-widget-body">
                <div>
                  <div className="bk-widget-acc">Épargne Scolaire Kelasi</div>
                  <div className="bk-widget-amount">+ 150.00 USD</div>
                </div>
                <span className="bk-widget-status">Validé par biométrie</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            6. LE QUICK-ACTION TRAY FLOTTANT (Exactement comme Bank of Kigali)
           ───────────────────────────────────────────────────────────── */}
        <div className="bk-container bk-quick-tray-container">
          <div className="bk-quick-tray">
            <div
              className="bk-tray-card"
              role="button"
              tabIndex={0}
              onClick={() => setModalOpen(true)}
            >
              <div className="bk-tray-icon bg-blue-50 text-blue-700">
                <CreditCard size={24} />
              </div>
              <div className="bk-tray-info">
                <h3>Ouvrir un compte</h3>
                <p>Adhésion simple en 3 étapes</p>
              </div>
              <ChevronRight size={18} className="bk-tray-arrow" />
            </div>

            <a href="#simulateur" className="bk-tray-card">
              <div className="bk-tray-icon bg-amber-50 text-amber-600">
                <Calculator size={24} />
              </div>
              <div className="bk-tray-info">
                <h3>Simuler mon crédit</h3>
                <p>Calcul des mensualités en direct</p>
              </div>
              <ChevronRight size={18} className="bk-tray-arrow" />
            </a>

            <a href="#devises" className="bk-tray-card">
              <div className="bk-tray-icon bg-emerald-50 text-emerald-600">
                <ArrowLeftRight size={24} />
              </div>
              <div className="bk-tray-info">
                <h3>Taux de change</h3>
                <p>1 USD = 2 850 CDF (Achat/Vente)</p>
              </div>
              <ChevronRight size={18} className="bk-tray-arrow" />
            </a>

            <a href="#contact" className="bk-tray-card">
              <div className="bk-tray-icon bg-purple-50 text-purple-600">
                <MapPin size={24} />
              </div>
              <div className="bk-tray-info">
                <h3>Nos Agences</h3>
                <p>Guichets & agents de quartier</p>
              </div>
              <ChevronRight size={18} className="bk-tray-arrow" />
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. SECTION SIMULATEUR INTERACTIF (Style Loan Calculator de BK)
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section bk-calculator-section" id="simulateur">
        <div className="bk-container">
          <div className="bk-section-header text-center">
            <div className="bk-kicker">OUTIL FINANCIER EN LIGNE</div>
            <h2 className="bk-section-title">
              Planifiez votre avenir financier avec notre simulateur
            </h2>
            <p className="bk-section-sub">
              Ajustez le montant et la durée pour estimer immédiatement vos mensualités de crédit coopératif ou le rendement de votre épargne thématique.
            </p>
          </div>

          <div className="bk-calculator-box">
            {/* Toggle Épargne / Crédit */}
            <div className="bk-calc-tabs">
              <button
                type="button"
                className={`bk-calc-tab ${simType === 'credit' ? 'active' : ''}`}
                onClick={() => setSimType('credit')}
              >
                <Landmark size={18} /> Simuler un Crédit Coopératif
              </button>
              <button
                type="button"
                className={`bk-calc-tab ${simType === 'epargne' ? 'active' : ''}`}
                onClick={() => setSimType('epargne')}
              >
                <Wallet size={18} /> Simuler mon Épargne Progressive
              </button>
            </div>

            <div className="bk-calc-grid">
              {/* Sliders de configuration */}
              <div className="bk-calc-inputs">
                {/* Choix devise */}
                <div className="bk-input-group">
                  <div className="flex justify-between items-center mb-2">
                    <label className="bk-input-label">Devise de l'opération :</label>
                    <div className="bk-currency-toggle">
                      <button
                        type="button"
                        className={currency === 'USD' ? 'active' : ''}
                        onClick={() => setCurrency('USD')}
                      >
                        USD ($)
                      </button>
                      <button
                        type="button"
                        className={currency === 'CDF' ? 'active' : ''}
                        onClick={() => setCurrency('CDF')}
                      >
                        CDF (FC)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slider Montant */}
                <div className="bk-input-group">
                  <div className="flex justify-between items-center mb-2">
                    <label className="bk-input-label">
                      {simType === 'credit' ? 'Montant du financement souhaité :' : 'Capital initial à épargner :'}
                    </label>
                    <span className="bk-input-val">
                      {amount.toLocaleString()} {currency}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={currency === 'USD' ? 100 : 250000}
                    max={currency === 'USD' ? 10000 : 25000000}
                    step={currency === 'USD' ? 50 : 100000}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="bk-slider"
                  />
                  <div className="bk-slider-bounds">
                    <span>{currency === 'USD' ? '100 $' : '250 000 FC'}</span>
                    <span>{currency === 'USD' ? '10 000 $' : '25 000 000 FC'}</span>
                  </div>
                </div>

                {/* Slider Durée */}
                <div className="bk-input-group mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="bk-input-label">Durée de l'engagement :</label>
                    <span className="bk-input-val">{durationMonths} mois</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={36}
                    step={3}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                    className="bk-slider"
                  />
                  <div className="bk-slider-bounds">
                    <span>3 mois</span>
                    <span>12 mois</span>
                    <span>24 mois</span>
                    <span>36 mois</span>
                  </div>
                </div>
              </div>

              {/* Panneau de résultats chiffrés */}
              <div className="bk-calc-result-card">
                <div className="bk-result-badge">
                  {simType === 'credit' ? 'PROPOSITION DE CRÉDIT ESTIMÉE' : 'PROJECTION D’ÉPARGNE'}
                </div>

                <div className="bk-result-main">
                  <span className="bk-result-sublabel">{simResults.label1}</span>
                  <div className="bk-result-big">{simResults.val1}</div>
                </div>

                <div className="bk-result-secondary">
                  <span>{simResults.label2}</span>
                  <strong>{simResults.val2}</strong>
                </div>

                <p className="bk-result-disclaimer">{simResults.info}</p>

                <div className="bk-result-actions">
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="bk-btn-apply"
                  >
                    <span>Faire ma demande en agence</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. SECTION DES FORMULES ADAPTÉES PAR SEGMENT
         ───────────────────────────────────────────────────────────── */}
      <section className="bk-section" id="services">
        <div className="bk-container">
          <div className="bk-section-header">
            <div className="bk-kicker">NOS SOLUTIONS PAR ÉTAPE DE VIE</div>
            <h2 className="bk-section-title">
              Des comptes adaptés à votre situation réelle
            </h2>
            <p className="bk-section-sub">
              Chaque formule répond à un objectif concret : protéger la famille, scolariser vos enfants ou investir dans votre commerce.
            </p>
          </div>

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
                      <IconComp size={24} />
                    </div>
                    <span className="bk-prod-tag" style={{ color: acc.color, borderColor: `${acc.color}40` }}>
                      {acc.rateBonus}
                    </span>
                  </div>

                  <h3 className="bk-prod-name">{acc.name}</h3>
                  <div className="bk-prod-sub">{acc.sub}</div>
                  <p className="bk-prod-desc">{acc.desc}</p>

                  <div className="bk-prod-action">
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="bk-prod-link"
                    >
                      <span>Souscrire à ce compte</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
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
