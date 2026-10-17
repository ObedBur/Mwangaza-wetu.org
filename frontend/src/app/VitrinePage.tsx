'use client';

import './vitrine.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  IconUsers,
  IconChartBar,
  IconArrowRight,
  IconMapPin,
  IconPhone,
  IconMail,
  IconClock,
  IconStar,
  IconBuildingBank,
  IconTarget,
  IconEye,
  IconSchool,
  IconHeartPlus,
  IconHome,
  IconBabyCarriage,
  IconBuildingStore,
  IconWallet,
  IconCreditCard,
  IconCircleCheckFilled,
  IconShieldCheck,
  IconMenu2,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';

/* ─────────────────────────────────────────────
   Copy bilingue FR / EN
───────────────────────────────────────────── */
type Lang = 'FR' | 'EN';

const copy = {
  FR: {
    topbar: {
      hotline: 'Assistance : +243 820 000 000',
      hours: 'Lun – Sam : 8h00 – 16h30',
      ticker: 'Taux indicatif : 1 USD = 2 850 CDF',
      regulated: 'Agrément BCC / COOPEC',
    },
    nav: {
      brandSub: 'Épargne • Crédit • Développement',
      services: 'Comptes & Épargne',
      howItWorks: 'Comment ça marche',
      about: 'À propos',
      news: 'Actualités',
      contact: 'Contact',
      login: 'Espace Membre',
      openAccount: 'Devenir membre',
    },
    hero: {
      badge: 'COOPÉRATIVE FINANCIÈRE AGRÉÉE — RDC',
      title: (
        <>
          La coopérative qui grandit avec vous.<br />
          <span>Pour tous, partout.</span>
        </>
      ),
      desc:
        'Sécurisez votre épargne, financez la scolarité de vos enfants, construisez votre logement et développez votre commerce avec des solutions de crédit sur mesure.',
      ctaPrimary: 'Devenir membre',
      ctaSecondary: 'Accéder à mon espace',
      rating: '4.9 / 5',
      trust: 'Plus de 500 membres et familles font confiance à Mwangaza Wetu',
      card: {
        type: 'CARTE DE MEMBRE DIGITALE',
        tier: 'MEMBRE PRIVILÈGE',
        category: 'MWANGAZA GOLD',
        number: '•••• •••• •••• 4821',
        holder: 'MEMBRE ACTIF',
        expires: '12/28',
      },
      widget: {
        tag: 'Épargne active',
        title: 'Épargne Kelasi — Scolarité',
        targetLabel: '850 $ sur 1 000 $ atteints',
        rateLabel: '85%',
        notif: 'Dépôt de +50 $ validé avec succès',
      },
    },
    stats: {
      members: 'Membres actifs',
      projects: 'Projets financés',
      repayment: 'Taux de remboursement',
      years: 'Années d\'expérience',
    },
    services: {
      label: 'Nos Solutions',
      heading: 'Des formules d\'épargne pensées pour chaque étape de vie',
      sub: 'Six comptes d\'épargne thématiques et des crédits responsables adaptés à votre réalité financière.',
      accounts: [
        { slug: 'principal', name: 'Compte Principal', sub: 'Épargne libre', desc: 'Déposez et retirez à votre rythme. Votre compte pivot sécurisé et accessible en agence.', color: '#25825c' },
        { slug: 'kelasi',    name: 'Épargne Kelasi',  sub: 'Scolarité & Études', desc: 'Préparez sereinement les frais académiques de vos enfants avec des versements planifiés.', color: '#c18c2d' },
        { slug: 'hopital',  name: 'Épargne Hôpital', sub: 'Santé & Urgences',  desc: 'Constituez un matelas de sécurité médicale pour protéger votre famille contre les imprévus.', color: '#d16c68' },
        { slug: 'nyumba',   name: 'Épargne Nyumba',  sub: 'Logement & Bâtiment', desc: 'Concrétisez votre projet de construction ou d\'acquisition grâce à une épargne progressive.', color: '#99724f' },
        { slug: 'mutoto',   name: 'Épargne Mutoto',  sub: 'Avenir des enfants', desc: 'Un horizon d\'épargne à long terme pour garantir le tremplin financier de vos enfants.', color: '#9a75c1' },
        { slug: 'biashara', name: 'Épargne Biashara', sub: 'Commerce & Activité', desc: 'Alimentez le fonds de roulement de votre activité commerciale et bénéficiez de facilités.', color: '#4384b5' },
      ],
      credit: {
        name: 'Crédit Coopératif Responsable',
        sub: 'Accompagnement financier sur mesure',
        desc: 'Bénéficiez d\'un financement transparent indexé sur votre régularité d\'épargne. Taux préférentiels, formalités allégées et conseils personnalisés.',
      },
    },
    howItWorks: {
      label: 'Fonctionnement',
      heading: 'Rejoindre Mwangaza Wetu en 3 étapes simples',
      sub: 'Une adhésion transparente et un parcours clair pensé pour chaque citoyen.',
      steps: [
        { num: 1, title: 'Adhésion', desc: 'Présentez une pièce d\'identité en agence ou auprès d\'un agent délégué pour remplir votre fiche d\'adhésion.' },
        { num: 2, title: 'Épargne régulière', desc: 'Effectuez vos versements libres ou programmés selon vos objectifs sur vos comptes thématiques.' },
        { num: 3, title: 'Bénéfices & Crédits', desc: 'Accédez aux crédits bonifiés, aux retraits et à tous les services coopératifs après 6 mois d\'activité.' },
      ],
    },
    about: {
      label: 'Institution',
      heading: 'Une coopérative solidaire au cœur de l\'économie réelle',
      sub: 'Mwangaza Wetu mobilise l\'épargne locale pour créer de la valeur partagée et de la stabilité.',
      mission: {
        title: 'Notre Mission',
        text: 'Fournir à nos membres des services financiers sûrs, accessibles et solidaires, en soutenant l\'auto-prise en charge des familles et la croissance des entrepreneurs en RDC.',
      },
      vision: {
        title: 'Notre Vision',
        text: 'Être l\'institution d\'épargne et de crédit communautaire la plus fiable et innovante, catalyseur de progrès socio-économique durable.',
      },
      values: ['Solidarité', 'Sécurité', 'Intégrité', 'Proximité', 'Excellence'],
    },
    testimonials: {
      label: 'Témoignages de nos membres',
      heading: 'La confiance de notre communauté',
      sub: 'Commerçants, parents, fonctionnaires et entrepreneurs partagent leur vécu.',
      items: [
        { name: 'Amina K.', role: 'Membre depuis 3 ans • Épargne Kelasi', initials: 'AK', color: '#074780', text: '"Grâce à mon Épargne Kelasi, j\'ai pu payer les frais de scolarité de ma fille à temps. Aucun stress, Mwangaza Wetu a transformé notre quotidien."' },
        { name: 'Jean-Pierre M.', role: 'Commerçant • Épargne Biashara', initials: 'JM', color: '#16A34A', text: '"Le crédit coopératif m\'a permis de réapprovisionner mon stock avant les fêtes. Les conditions sont justes et les agents sont toujours disponibles."' },
        { name: 'Claudine B.', role: 'Membre fondatrice • Épargne Nyumba', initials: 'CB', color: '#E56A1E', text: '"La clarté des relevés et la sécurité de mes dépôts m\'ont immédiatement convaincue. Une vraie institution de confiance."' },
      ],
    },
    news: {
      label: 'Actualités & Publications',
      heading: 'La vie de notre coopérative',
      sub: 'Annonces officielles, assemblées générales et nouvelles fonctionnalités.',
      items: [
        { tag: 'Assemblée', icon: '🏛️', title: 'Assemblée Générale Ordinaire des Membres 2026', date: '15 novembre 2026' },
        { tag: 'Digital', icon: '📱', title: 'Portail membre en ligne : consultation de solde instantanée', date: 'Octobre 2026' },
        { tag: 'Éducation', icon: '📊', title: 'Séance d\'éducation financière et gestion budgétaire', date: 'Septembre 2026' },
      ],
    },
    contact: {
      label: 'Nous contacter',
      heading: 'Nos équipes à votre service',
      sub: 'Rencontrez un conseiller en agence ou échangez directement avec nous.',
      address: { label: 'Siège social', val: 'Kinshasa, République Démocratique du Congo' },
      phone:   { label: 'Hotline & WhatsApp', val: '+243 820 000 000' },
      email:   { label: 'Courriel officiel', val: 'contact@mwangazawetu.cd' },
      hours:   { label: 'Heures d\'ouverture', val: 'Lundi – Vendredi : 8h00 – 16h30\nSamedi : 9h00 – 13h00' },
      mapLabel: 'Agence principale — Kinshasa, RDC',
    },
    cta: {
      title: 'Prêt à bâtir votre avenir financier ?',
      sub: 'Rejoignez Mwangaza Wetu dès aujourd\'hui et découvrez une gestion financière humaine, transparente et performante.',
      btn: 'Accéder à l\'espace membre',
    },
    footer: {
      desc: 'Institution coopérative d\'épargne et de crédit au service des familles et entrepreneurs congolais. Fonds garantis et gestion certifiée.',
      links: {
        services: { title: 'Comptes', items: [['Compte Principal','#services'],['Épargne Kelasi','#services'],['Épargne Hôpital','#services'],['Crédit Coopératif','#services']] },
        useful: { title: 'Accès rapide', items: [['Espace Membre','/login'],['Comment adhérer','#comment-ca-marche'],['Actualités','#actualites'],['Contact','#contact']] },
        legal: { title: 'Conformité', items: [['Statuts de la Coopérative','#'],['Règlement Intérieur','#'],['Protection des données','#']] },
      },
      copy: `© ${new Date().getFullYear()} Mwangaza Wetu. Tous droits réservés. Agréé en RDC.`,
      legal: [['Mentions légales','#'],['Politique de confidentialité','#']],
    },
  },
  EN: {
    topbar: {
      hotline: 'Hotline: +243 820 000 000',
      hours: 'Mon – Sat: 8:00 AM – 4:30 PM',
      ticker: 'Indicative FX: 1 USD = 2,850 CDF',
      regulated: 'Licensed Cooperative — DRC',
    },
    nav: {
      brandSub: 'Savings • Credit • Development',
      services: 'Accounts & Savings',
      howItWorks: 'How it works',
      about: 'About Us',
      news: 'News',
      contact: 'Contact',
      login: 'Member Portal',
      openAccount: 'Become a member',
    },
    hero: {
      badge: 'LICENSED FINANCIAL COOPERATIVE — DRC',
      title: (
        <>
          The cooperative that grows with you.<br />
          <span>For everyone, anywhere.</span>
        </>
      ),
      desc:
        'Secure your savings, finance your children\'s education, build your home, and expand your business with responsible, tailor-made cooperative credit.',
      ctaPrimary: 'Become a member',
      ctaSecondary: 'Member Login',
      rating: '4.9 / 5',
      trust: 'Over 500 active members and families trust Mwangaza Wetu',
      card: {
        type: 'DIGITAL MEMBERSHIP CARD',
        tier: 'PRESTIGE MEMBER',
        category: 'MWANGAZA GOLD',
        number: '•••• •••• •••• 4821',
        holder: 'ACTIVE MEMBER',
        expires: '12/28',
      },
      widget: {
        tag: 'Active Savings',
        title: 'Kelasi Savings — Schooling',
        targetLabel: '$850 of $1,000 reached',
        rateLabel: '85%',
        notif: '+$50 deposit confirmed successfully',
      },
    },
    stats: {
      members: 'Active members',
      projects: 'Financed projects',
      repayment: 'Repayment rate',
      years: 'Years of experience',
    },
    services: {
      label: 'Our Solutions',
      heading: 'Savings plans designed for every stage of life',
      sub: 'Six themed savings accounts and responsible loans adapted to your real financial capacity.',
      accounts: [
        { slug: 'principal', name: 'Main Account', sub: 'Flexible savings', desc: 'Deposit and withdraw at your pace. Your core secure account accessible at any branch.', color: '#25825c' },
        { slug: 'kelasi',    name: 'Kelasi Savings', sub: 'Schooling & Studies', desc: 'Prepare for school and university fees with structured monthly deposits.', color: '#c18c2d' },
        { slug: 'hopital',  name: 'Hospital Savings', sub: 'Health & Emergencies', desc: 'Build a family medical safety cushion to face healthcare unexpected needs.', color: '#d16c68' },
        { slug: 'nyumba',   name: 'Nyumba Savings', sub: 'Housing & Building', desc: 'Realize your home construction or acquisition plan with steady progress.', color: '#99724f' },
        { slug: 'mutoto',   name: 'Mutoto Savings', sub: 'Children\'s future', desc: 'A long-term savings fund to secure the launchpad for your children\'s future.', color: '#9a75c1' },
        { slug: 'biashara', name: 'Biashara Savings', sub: 'Business & Trade', desc: 'Grow your working capital and access merchant credit facilities.', color: '#4384b5' },
      ],
      credit: {
        name: 'Responsible Cooperative Credit',
        sub: 'Tailored financial backing',
        desc: 'Access transparent loans based on your savings track record. Preferential interest rates, streamlined approvals, and personal guidance.',
      },
    },
    howItWorks: {
      label: 'Process',
      heading: 'Join Mwangaza Wetu in 3 straightforward steps',
      sub: 'A transparent membership pathway created for every citizen and business owner.',
      steps: [
        { num: 1, title: 'Registration', desc: 'Present a valid ID at any agency to complete your official membership registration.' },
        { num: 2, title: 'Regular Savings', desc: 'Make flexible or scheduled deposits into your themed accounts tailored to your ambitions.' },
        { num: 3, title: 'Benefits & Credit', desc: 'Qualify for tailored cooperative credit and full banking services after 6 months of steady savings.' },
      ],
    },
    about: {
      label: 'Institution',
      heading: 'A solidarity-driven financial institution rooted in the real economy',
      sub: 'Mwangaza Wetu mobilizes community savings to fuel local economic stability and empowerment.',
      mission: {
        title: 'Our Mission',
        text: 'Deliver secure, accessible, and ethical financial services to foster self-reliance among families and accelerate business growth in the DRC.',
      },
      vision: {
        title: 'Our Vision',
        text: 'Become the benchmark savings and credit cooperative, recognized for governance excellence, trust, and community impact.',
      },
      values: ['Solidarity', 'Security', 'Integrity', 'Proximity', 'Excellence'],
    },
    testimonials: {
      label: 'Member Stories',
      heading: 'Trusted by our community',
      sub: 'Merchants, parents, workers, and entrepreneurs share their real journey.',
      items: [
        { name: 'Amina K.', role: 'Member for 3 years • Kelasi Savings', initials: 'AK', color: '#074780', text: '"Thanks to Kelasi savings, I paid my daughter\'s tuition on time without stress. Mwangaza Wetu brought peace to our family."' },
        { name: 'Jean-Pierre M.', role: 'Merchant • Biashara Savings', initials: 'JM', color: '#16A34A', text: '"Cooperative credit allowed me to stock up before the festive season. Transparent terms and great agent support."' },
        { name: 'Claudine B.', role: 'Founding Member • Nyumba Savings', initials: 'CB', color: '#E56A1E', text: '"Transparent monthly statements and guaranteed security made me an early believer. A truly dependable partner."' },
      ],
    },
    news: {
      label: 'News & Official Releases',
      heading: 'Cooperative life & announcements',
      sub: 'Official bulletins, member meetings, and new feature launches.',
      items: [
        { tag: 'Meeting', icon: '🏛️', title: '2026 Annual General Meeting of Members', date: 'November 15, 2026' },
        { tag: 'Digital', icon: '📱', title: 'Online Member Portal: instant balance and statement check', date: 'October 2026' },
        { tag: 'Workshop', icon: '📊', title: 'Financial Literacy & Household Budgeting Session', date: 'September 2026' },
      ],
    },
    contact: {
      label: 'Get in Touch',
      heading: 'Our advisors are here to help',
      sub: 'Visit an agency or speak with a member representative today.',
      address: { label: 'Headquarters', val: 'Kinshasa, Democratic Republic of Congo' },
      phone:   { label: 'Hotline & WhatsApp', val: '+243 820 000 000' },
      email:   { label: 'Official Email', val: 'contact@mwangazawetu.cd' },
      hours:   { label: 'Working Hours', val: 'Monday – Friday: 8:00 AM – 4:30 PM\nSaturday: 9:00 AM – 1:00 PM' },
      mapLabel: 'Main Branch — Kinshasa, DRC',
    },
    cta: {
      title: 'Ready to build your financial future?',
      sub: 'Join Mwangaza Wetu today and experience transparent, human-centered financial growth.',
      btn: 'Open member portal',
    },
    footer: {
      desc: 'Savings and credit cooperative serving Congolese households and entrepreneurs. Guaranteed deposits and certified governance.',
      links: {
        services: { title: 'Accounts', items: [['Main Account','#services'],['Kelasi Savings','#services'],['Hospital Savings','#services'],['Cooperative Credit','#services']] },
        useful: { title: 'Quick Links', items: [['Member Portal','/login'],['How to Join','#comment-ca-marche'],['News','#actualites'],['Contact','#contact']] },
        legal: { title: 'Compliance', items: [['Cooperative Bylaws','#'],['Internal Rules','#'],['Data Protection','#']] },
      },
      copy: `© ${new Date().getFullYear()} Mwangaza Wetu. All rights reserved. Licensed in DRC.`,
      legal: [['Legal Notices','#'],['Privacy Policy','#']],
    },
  },
} as const;

/* ─────────────────────────────────────────────
   Public Stats Hook (Safe API fetch, no capital)
───────────────────────────────────────────── */
interface DashboardStats {
  totalMembers: number;
  activeMembersCount: number;
  activeProjectsCount: number;
  repaymentRate: number;
}

function usePublicStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    fetch(`${API}/public/stats`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) setStats(d.data);
        else if (d?.totalMembers !== undefined) setStats(d);
      })
      .catch(() => {
        setStats({
          totalMembers: 520,
          activeMembersCount: 480,
          activeProjectsCount: 12,
          repaymentRate: 98,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

/* ─────────────────────────────────────────────
   Service Icons Mapping
───────────────────────────────────────────── */
const ServiceIcons: Record<string, TablerIcon> = {
  principal: IconWallet,
  kelasi: IconSchool,
  hopital: IconHeartPlus,
  nyumba: IconHome,
  mutoto: IconBabyCarriage,
  biashara: IconBuildingStore,
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function VitrinePage() {
  const [lang, setLang] = useState<Lang>('FR');
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = copy[lang];
  const { stats, loading } = usePublicStats();

  const statItems = [
    {
      icon: <IconUsers size={22} />,
      value: loading ? '…' : stats ? (stats.activeMembersCount ?? stats.totalMembers).toLocaleString() : '500+',
      label: t.stats.members,
    },
    {
      icon: <IconChartBar size={22} />,
      value: loading ? '…' : stats ? stats.activeProjectsCount.toLocaleString() : '12',
      label: t.stats.projects,
    },
    {
      icon: <IconCircleCheckFilled size={22} />,
      value: loading ? '…' : stats ? `${stats.repaymentRate ?? 98}%` : '98%',
      label: t.stats.repayment,
    },
    {
      icon: <IconBuildingBank size={22} />,
      value: '5+ Ans',
      label: t.stats.years,
    },
  ];

  return (
    <div className="mw-vitrine">
      {/* ─────────────────────────────────────────────────────────────
          1. TOPBAR INSTITUTIONNELLE (Style Equity BCDC / Rawbank)
         ───────────────────────────────────────────────────────────── */}
      <div className="v-topbar">
        <div className="v-topbar-inner">
          <div className="v-topbar-left">
            <span className="v-topbar-item">
              <IconPhone size={13} /> {t.topbar.hotline}
            </span>
            <span className="v-topbar-item" style={{ opacity: 0.7 }}>
              <IconClock size={13} /> {t.topbar.hours}
            </span>
            <span className="v-topbar-ticker">
              <strong>CDF / USD</strong> {t.topbar.ticker}
            </span>
          </div>

          <div className="v-topbar-right">
            <span className="v-topbar-item" style={{ color: '#86EFAC', fontWeight: 600 }}>
              <IconShieldCheck size={14} /> {t.topbar.regulated}
            </span>
            <div className="v-topbar-lang">
              <button
                className={`v-topbar-lang-btn${lang === 'FR' ? ' active' : ''}`}
                onClick={() => setLang('FR')}
                aria-label="Français"
              >
                FR
              </button>
              <span style={{ opacity: 0.3 }}>|</span>
              <button
                className={`v-topbar-lang-btn${lang === 'EN' ? ' active' : ''}`}
                onClick={() => setLang('EN')}
                aria-label="English"
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGATION PRINCIPALE (Style Bank of Kigali / Rawbank)
         ───────────────────────────────────────────────────────────── */}
      <nav className="v-nav" role="navigation">
        <div className="v-nav-inner">
          {/* Logo & Slogan Institutionnel */}
          <a href="#" className="v-nav-brand">
            <img
              src="/logo.png"
              alt="Logo Mwangaza Wetu"
              className="v-nav-logo-img"
            />
            <div className="v-nav-brand-title">
              <span>Mwangaza Wetu</span>
              <span className="v-nav-brand-sub">{t.nav.brandSub}</span>
            </div>
          </a>

          {/* Menus Desktop */}
          <ul className="v-nav-links">
            {[
              ['#services', t.nav.services],
              ['#comment-ca-marche', t.nav.howItWorks],
              ['#a-propos', t.nav.about],
              ['#actualites', t.nav.news],
              ['#contact', t.nav.contact],
            ].map(([href, label]) => (
              <li key={href}><a href={href}>{label}</a></li>
            ))}
          </ul>

          {/* Actions : Espace Membre (Outline) + Devenir Membre (CTA Coloré) */}
          <div className="v-nav-actions">
            <Link href="/login" className="v-btn-nav-outline">
              {t.nav.login}
            </Link>
            <a href="#services" className="v-btn-nav-primary">
              {t.nav.openAccount} <IconArrowRight size={14} />
            </a>

            {/* Hamburger Mobile */}
            <button
              className="v-hamburger"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <IconX size={22} color="#074780" /> : <IconMenu2 size={22} color="#074780" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile Déroulant */}
        <div className={`v-mobile-menu${mobileOpen ? ' open' : ''}`}>
          {[
            ['#services', t.nav.services],
            ['#comment-ca-marche', t.nav.howItWorks],
            ['#a-propos', t.nav.about],
            ['#actualites', t.nav.news],
            ['#contact', t.nav.contact],
          ].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            style={{ color: '#074780', fontWeight: 750, marginTop: 4 }}
          >
            {t.nav.login} →
          </Link>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO BANCAIRE RICHE (Bank of Kigali + Rawbank Product Mockup)
         ───────────────────────────────────────────────────────────── */}
      <section className="v-hero-bank" id="accueil">
        <div className="v-hero-bank-pattern" aria-hidden />

        <div className="v-hero-bank-inner">
          {/* Colonne Gauche : Titre fort, lead, CTAs et Social proof Bank of Kigali */}
          <div>
            <div className="v-hero-tag">
              <span className="v-hero-tag-dot" />
              {t.hero.badge}
            </div>

            <h1 className="v-hero-title">{t.hero.title}</h1>
            <p className="v-hero-lead">{t.hero.desc}</p>

            <div className="v-hero-actions">
              <a href="#services" className="v-btn-hero-primary">
                {t.hero.ctaPrimary} <IconArrowRight size={16} />
              </a>
              <Link href="/login" className="v-btn-hero-secondary">
                {t.hero.ctaSecondary}
              </Link>
            </div>

            {/* Social Proof (Style Bank of Kigali : avatar stack avec étoiles et avis certifiés) */}
            <div className="v-hero-social-proof">
              <div className="v-avatar-stack">
                {[
                  { label: 'A', bg: '#0B5EA8' },
                  { label: 'J', bg: '#16A34A' },
                  { label: 'C', bg: '#E56A1E' },
                  { label: 'M', bg: '#9A75C1' },
                  { label: 'K', bg: '#4384B5' },
                ].map((av, idx) => (
                  <div
                    key={idx}
                    className="v-avatar-bubble"
                    style={{ background: av.bg }}
                  >
                    {av.label}
                  </div>
                ))}
              </div>
              <div className="v-social-proof-content">
                <div className="v-social-proof-stars">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                  <strong style={{ color: '#fff', marginLeft: 6 }}>{t.hero.rating}</strong>
                </div>
                <span className="v-social-proof-text">
                  <strong>500+ membres</strong> · {t.hero.trust}
                </span>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Showcase Bancaire (Carte Membre Virtuelle + Passbook Rawbank) */}
          <div className="v-bank-showcase" aria-hidden>
            {/* 1. Carte de Membre Digitale Mwangaza Gold */}
            <div className="v-member-card">
              <div className="v-card-top">
                <div className="v-card-chip" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <img
                    src="/logo.png"
                    alt="Logo"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#fff',
                      padding: 1.5,
                      objectFit: 'contain',
                    }}
                  />
                  <span className="v-card-network">
                    MWANGAZA COOP
                  </span>
                </div>
              </div>

              <div className="v-card-number">{t.hero.card.number}</div>

              <div className="v-card-bottom">
                <div>
                  <div className="v-card-holder-label">{t.hero.card.type}</div>
                  <div className="v-card-holder-name">{t.hero.card.holder}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="v-card-badge-gold">{t.hero.card.category}</span>
                </div>
              </div>
            </div>

            {/* 2. Passbook Épargne Vivant (Style Rawbank) */}
            <div className="v-passbook-widget">
              <div className="v-passbook-header">
                <span className="v-passbook-tag">
                  <IconSchool size={13} /> {t.hero.widget.tag}
                </span>
                <span className="v-passbook-status">
                  {lang === 'FR' ? 'Compte certifié' : 'Verified account'}
                </span>
              </div>

              <h4 className="v-passbook-title">{t.hero.widget.title}</h4>

              <div className="v-passbook-progress-wrap">
                <div className="v-passbook-progress-bar">
                  <div className="v-passbook-progress-fill" />
                </div>
                <div className="v-passbook-progress-labels">
                  <span>{t.hero.widget.targetLabel}</span>
                  <strong>{t.hero.widget.rateLabel}</strong>
                </div>
              </div>

              <div className="v-floating-notif">
                <div className="v-floating-notif-icon">✓</div>
                <span>{t.hero.widget.notif}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BARRE DE CHIFFRES CLÉS DOCKÉE (Style Bank of Kigali)
         ───────────────────────────────────────────────────────────── */}
      <section className="v-stats-dock">
        <div className="v-stats-dock-inner">
          {statItems.map((s, i) => (
            <div className="v-stat-card" key={i}>
              <div className="v-stat-icon-wrap">{s.icon}</div>
              <div className="v-stat-info">
                <span className="v-stat-num">{s.value}</span>
                <span className="v-stat-title">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. SERVICES & FORMULES D'ÉPARGNE
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section" id="services">
        <div className="v-section-inner">
          <div className="v-label">{t.services.label}</div>
          <h2 className="v-heading">{t.services.heading}</h2>
          <p className="v-sub">{t.services.sub}</p>

          <div className="v-services-grid">
            {t.services.accounts.map((acc) => {
              const Icon = ServiceIcons[acc.slug] ?? IconWallet;
              return (
                <div className="v-service-card" key={acc.slug}>
                  <div className="v-service-icon" style={{ background: `${acc.color}18` }}>
                    <Icon size={24} color={acc.color} />
                  </div>
                  <div>
                    <h3 className="v-service-name">{acc.name}</h3>
                    <p className="v-service-sub">{acc.sub}</p>
                  </div>
                  <p className="v-service-desc">{acc.desc}</p>
                </div>
              );
            })}

            {/* Carte Crédit Spéciale pleine largeur */}
            <div className="v-service-card credit" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                <div className="v-service-icon" style={{ background: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                  <IconCreditCard size={26} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="v-service-name">{t.services.credit.name}</h3>
                  <p className="v-service-sub">{t.services.credit.sub}</p>
                  <p className="v-service-desc" style={{ marginTop: 8 }}>{t.services.credit.desc}</p>
                </div>
                <Link href="/login" className="v-btn-hero-primary" style={{ flexShrink: 0, marginTop: 4 }}>
                  {lang === 'FR' ? 'Accéder au crédit' : 'Access credit'} <IconArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. COMMENT ÇA MARCHE
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section v-section-alt" id="comment-ca-marche">
        <div className="v-section-inner">
          <div className="v-label">{t.howItWorks.label}</div>
          <h2 className="v-heading">{t.howItWorks.heading}</h2>
          <p className="v-sub">{t.howItWorks.sub}</p>

          <div className="v-steps">
            {t.howItWorks.steps.map((s) => (
              <div className="v-step" key={s.num}>
                <div className="v-step-num">{s.num}</div>
                <h3 className="v-step-title">{s.title}</h3>
                <p className="v-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. MISSION & VISION
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section" id="a-propos">
        <div className="v-section-inner">
          <div className="v-label">{t.about.label}</div>
          <h2 className="v-heading">{t.about.heading}</h2>
          <p className="v-sub">{t.about.sub}</p>

          <div className="v-mission-grid">
            <div className="v-mission-card">
              <div className="v-mission-card-icon">
                <IconTarget size={24} />
              </div>
              <h3 className="v-mission-card-title">{t.about.mission.title}</h3>
              <p className="v-mission-card-text">{t.about.mission.text}</p>
            </div>
            <div className="v-mission-card">
              <div className="v-mission-card-icon">
                <IconEye size={24} />
              </div>
              <h3 className="v-mission-card-title">{t.about.vision.title}</h3>
              <p className="v-mission-card-text">{t.about.vision.text}</p>
            </div>
          </div>

          {/* Valeurs institutionnelles */}
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {t.about.values.map((v) => (
              <span key={v} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px',
                background: '#EBF3FA',
                color: '#074780',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
              }}>
                <IconCircleCheckFilled size={14} /> {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. TÉMOIGNAGES
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section v-section-alt" id="temoignages">
        <div className="v-section-inner">
          <div className="v-label">{t.testimonials.label}</div>
          <h2 className="v-heading">{t.testimonials.heading}</h2>
          <p className="v-sub">{t.testimonials.sub}</p>

          <div className="v-testimonials-grid">
            {t.testimonials.items.map((item) => (
              <div className="v-testimonial-card" key={item.name}>
                <div className="v-testimonial-stars">
                  {[...Array(5)].map((_, i) => <IconStar key={i} size={15} color="#F59E0B" />)}
                </div>
                <p className="v-testimonial-text">{item.text}</p>
                <div className="v-testimonial-author">
                  <div className="v-testimonial-avatar" style={{ background: item.color }}>
                    {item.initials}
                  </div>
                  <div>
                    <div className="v-testimonial-name">{item.name}</div>
                    <div className="v-testimonial-role">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. ACTUALITÉS
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section" id="actualites">
        <div className="v-section-inner">
          <div className="v-label">{t.news.label}</div>
          <h2 className="v-heading">{t.news.heading}</h2>
          <p className="v-sub">{t.news.sub}</p>

          <div className="v-news-grid">
            {t.news.items.map((n) => (
              <div className="v-news-card" key={n.title}>
                <div className="v-news-img">
                  <span role="img" aria-hidden style={{ fontSize: 44 }}>{n.icon}</span>
                </div>
                <div className="v-news-body">
                  <span className="v-news-tag">{n.tag}</span>
                  <h3 className="v-news-title">{n.title}</h3>
                  <p className="v-news-date">{n.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. BANNIÈRE CTA
         ───────────────────────────────────────────────────────────── */}
      <section className="v-cta-banner">
        <div className="v-cta-banner-inner">
          <h2 className="v-cta-banner-title">{t.cta.title}</h2>
          <p className="v-cta-banner-sub">{t.cta.sub}</p>
          <Link href="/login" className="v-btn-cta-white">
            {t.cta.btn} <IconArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. CONTACT & LOCALISATION
         ───────────────────────────────────────────────────────────── */}
      <section className="v-section" id="contact">
        <div className="v-section-inner">
          <div className="v-label">{t.contact.label}</div>
          <h2 className="v-heading">{t.contact.heading}</h2>
          <p className="v-sub">{t.contact.sub}</p>

          <div className="v-contact-grid">
            <div className="v-contact-info">
              {[
                { icon: <IconMapPin size={22} />, ...t.contact.address },
                { icon: <IconPhone size={22} />, ...t.contact.phone },
                { icon: <IconMail size={22} />, ...t.contact.email },
                { icon: <IconClock size={22} />, ...t.contact.hours },
              ].map((item) => (
                <div className="v-contact-item" key={item.label}>
                  <div className="v-contact-icon">{item.icon}</div>
                  <div>
                    <p className="v-contact-item-title">{item.label}</p>
                    <p className="v-contact-item-val" style={{ whiteSpace: 'pre-line' }}>{item.val}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Carte / Plan d'accès */}
            <div className="v-contact-map">
              <IconMapPin size={42} stroke={1.5} />
              <span className="v-contact-map-lbl">{t.contact.mapLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. PIED DE PAGE
         ───────────────────────────────────────────────────────────── */}
      <footer className="v-footer">
        <div className="v-footer-inner">
          <div className="v-footer-top">
            <div>
              <p className="v-footer-brand-name">Mwangaza Wetu</p>
              <p className="v-footer-brand-desc">{t.footer.desc}</p>
              <Link href="/login" className="v-btn-hero-primary" style={{ width: 'fit-content', padding: '10px 20px', fontSize: 13 }}>
                {t.nav.login} <IconArrowRight size={14} />
              </Link>
            </div>

            {(['services', 'useful', 'legal'] as const).map((col) => (
              <div key={col}>
                <p className="v-footer-col-title">{t.footer.links[col].title}</p>
                <ul className="v-footer-links">
                  {t.footer.links[col].items.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith('/') ? (
                        <Link href={href}>{label}</Link>
                      ) : (
                        <a href={href}>{label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="v-footer-bottom">
            <span>{t.footer.copy}</span>
            <div className="v-footer-legal">
              {t.footer.legal.map(([label, href]) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
