'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowDown, IconArrowUp, IconCalendar, IconChartBar, IconCreditCard, IconRefresh, IconUsers } from '@tabler/icons-react';
import { apiClient } from '@/lib/auth';
import { downloadReportCsv, downloadReportPdf } from '@/lib/cooperative-report-export';

type Currency = 'FC' | 'USD';
type Granularity = 'jour' | 'semaine' | 'mois';
type AmountByCurrency = Record<Currency, number>;
type ReportPoint = {
  date: string;
  depots: AmountByCurrency;
  retraits: AmountByCurrency;
  creditsDecaisses: AmountByCurrency;
  remboursements: AmountByCurrency;
  adhesions: number;
};
type Report = {
  periode: { debut: string; fin: string; granularite: Granularity };
  totaux: {
    depots: AmountByCurrency;
    retraits: AmountByCurrency;
    creditsDecaisses: AmountByCurrency;
    remboursements: AmountByCurrency;
    adhesions: number;
  };
  serie: ReportPoint[];
};
type JournalLine = {
  id: string; reference: string; date: string; libelle: string; section: string | null;
  statut: string; type: string; compte: { id: number; numero: string; libelle: string };
  devise: Currency; debit: number; credit: number;
};
type JournalResult = { data: JournalLine[]; totaux: Record<Currency, { debit: number; credit: number }>; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type CashMovement = {
  id: number; date: string; type: string; devise: Currency; montant: number; soldeAvant: number; soldeApres: number;
  motif: string | null; caisseId: number; agent: { id: number; nom: string; guichetAssigne: string };
  source: { type: string; reference?: string; id?: number; statut: string; annuleLe?: string | null; ecartMontant?: number | null } | null;
};
type CashReport = {
  data: CashMovement[];
  rapprochement: { caisseId: number; devise: Currency; opening: number; closing: number; inflows: number; outflows: number; ecart: number; mouvementsParType: Record<string, number> }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  operationsSansMouvement: { retraitsEchoues: number };
};
type SavingsReport = {
  periode: { debut: string; fin: string };
  depots: { produit: string; sousCompte: string; devise: Currency; montant: number }[];
  retraits: { produit: string; devise: Currency; montant: number }[];
  dats: { produit: string; dureeMois: number; devise: Currency; statut: string; contrats: number; capital: number; gain: number }[];
  note: string;
};
type CreditPortfolio = {
  credits: { id: number; membreId: number; membre: string; numeroCompte: string; montantAccorde: number; totalDu: number; rembourse: number; restant: number; devise: string; dateDecaissement: string; echeance: string | null; statut: string; joursRetard: number }[];
  echeances: { id: number; membreId: number; membre: string; numeroCompte: string; restant: number; devise: string; echeance: string }[];
  retards: { devise: string; tranche: string; montant: number; credits: number }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  definitionRestant: string;
};
type AccountingLine = {
  compte: { id: number; numeroCompte: string; planCompte: { libelle: string; nature: string } };
  soldes: { devise: Currency; debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number }[];
};
type AccountingReport = {
  balance: AccountingLine[];
  result: { produits: { compte: string; libelle: string; section: string | null; devise: Currency; montant: number }[]; charges: { compte: string; libelle: string; section: string | null; devise: Currency; montant: number }[]; consolide: Record<Currency, { produits: number; charges: number; resultat: number }> };
};
type EvaluationReport = {
  periode: { debut: string; fin: string };
  comparaison: { debut: string; fin: string; dureeJours: number };
  indicateurs: { label: string; formule: string; source: string; devise: Currency | '—'; valeur: number; valeurPrecedente: number; variation: number; variationPourcent: number | null }[];
  note: string;
};

const money = (amount: number, currency: Currency) => new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
}).format(amount) + (currency === 'USD' ? ' $US' : ' FC');
const toneStyles: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-indigo-50 text-indigo-700',
  green: 'bg-emerald-50 text-emerald-700',
};

function dateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialFilters() {
  if (typeof window === 'undefined') {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 11, 1);
    return { debut: dateString(start), fin: dateString(now), granularite: 'mois' as Granularity, devise: 'USD' as Currency };
  }
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 11, 1);
  return {
    debut: params.get('debut') || dateString(start),
    fin: params.get('fin') || dateString(now),
    granularite: (['jour', 'semaine', 'mois'].includes(params.get('granularite') || '') ? params.get('granularite') : 'mois') as Granularity,
    devise: params.get('devise') === 'FC' ? 'FC' as Currency : 'USD' as Currency,
  };
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'synthese' | 'journal' | 'caisse' | 'epargne' | 'credits' | 'comptabilite' | 'evaluation'>('synthese');
  const [journal, setJournal] = useState<JournalResult | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalFilters, setJournalFilters] = useState({ type: '', statut: '', section: '', compteId: '', page: 1 });
  const [cashReport, setCashReport] = useState<CashReport | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState('');
  const [cashFilters, setCashFilters] = useState({ agentId: '', guichet: '', page: 1 });
  const [savingsReport, setSavingsReport] = useState<SavingsReport | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [savingsError, setSavingsError] = useState('');
  const [creditPortfolio, setCreditPortfolio] = useState<CreditPortfolio | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [creditPage, setCreditPage] = useState(1);
  const [accountingSection, setAccountingSection] = useState('');
  const [accountingReport, setAccountingReport] = useState<AccountingReport | null>(null);
  const [accountingLoading, setAccountingLoading] = useState(false);
  const [accountingError, setAccountingError] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<Report>('/rapports/synthese', {
        params: { debut: filters.debut, fin: filters.fin, granularite: filters.granularite },
      });
      setReport(data);
    } catch (err: any) {
      setReport(null);
      setError(err?.response?.data?.message || 'Impossible de charger la synthèse. Vérifiez votre accès et les filtres choisis.');
    } finally {
      setLoading(false);
    }
  }, [filters.debut, filters.fin, filters.granularite]);

  useEffect(() => {
    const params = new URLSearchParams({ ...filters });
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    void loadReport();
  }, [filters, loadReport]);

  const loadJournal = useCallback(async () => {
    setJournalLoading(true);
    setJournalError('');
    try {
      const { data } = await apiClient.get<JournalResult>('/comptabilite/journal', { params: {
        debut: filters.debut, fin: filters.fin, devise: filters.devise, page: journalFilters.page, pageSize: 50,
        ...(journalFilters.type ? { type: journalFilters.type } : {}),
        ...(journalFilters.statut ? { statut: journalFilters.statut } : {}),
        ...(journalFilters.section ? { section: journalFilters.section } : {}),
        ...(journalFilters.compteId ? { compteId: journalFilters.compteId } : {}),
      } });
      setJournal(data);
    } catch (err: any) {
      setJournal(null);
      setJournalError(err?.response?.data?.message || 'Impossible de charger le journal comptable.');
    } finally { setJournalLoading(false); }
  }, [filters.debut, filters.fin, filters.devise, journalFilters]);

  useEffect(() => { if (activeTab === 'journal') void loadJournal(); }, [activeTab, loadJournal]);

  const loadCashReport = useCallback(async () => {
    setCashLoading(true);
    setCashError('');
    try {
      const { data } = await apiClient.get<CashReport>('/comptabilite/rapprochement-caisse', { params: {
        debut: filters.debut, fin: filters.fin, devise: filters.devise, page: cashFilters.page, pageSize: 50,
        ...(cashFilters.agentId ? { agentId: cashFilters.agentId } : {}),
        ...(cashFilters.guichet ? { guichet: cashFilters.guichet } : {}),
      } });
      setCashReport(data);
    } catch (err: any) {
      setCashReport(null);
      setCashError(err?.response?.data?.message || 'Impossible de rapprocher les mouvements de caisse.');
    } finally { setCashLoading(false); }
  }, [filters.debut, filters.fin, filters.devise, cashFilters]);

  useEffect(() => { if (activeTab === 'caisse') void loadCashReport(); }, [activeTab, loadCashReport]);

  const loadSavingsReport = useCallback(async () => {
    setSavingsLoading(true); setSavingsError('');
    try {
      const { data } = await apiClient.get<SavingsReport>('/rapports/epargne', { params: { debut: filters.debut, fin: filters.fin } });
      setSavingsReport(data);
    } catch (err: any) { setSavingsReport(null); setSavingsError(err?.response?.data?.message || 'Impossible de charger le portefeuille d’épargne.'); }
    finally { setSavingsLoading(false); }
  }, [filters.debut, filters.fin]);
  useEffect(() => { if (activeTab === 'epargne') void loadSavingsReport(); }, [activeTab, loadSavingsReport]);

  const loadCreditPortfolio = useCallback(async () => {
    setCreditLoading(true); setCreditError('');
    try {
      const { data } = await apiClient.get<CreditPortfolio>('/rapports/credits', { params: { debut: filters.debut, fin: filters.fin, page: creditPage, pageSize: 50 } });
      setCreditPortfolio(data);
    } catch (err: any) { setCreditPortfolio(null); setCreditError(err?.response?.data?.message || 'Impossible de charger le portefeuille de crédits.'); }
    finally { setCreditLoading(false); }
  }, [filters.debut, filters.fin, creditPage]);
  useEffect(() => { if (activeTab === 'credits') void loadCreditPortfolio(); }, [activeTab, loadCreditPortfolio]);

  const loadAccounting = useCallback(async () => {
    setAccountingLoading(true); setAccountingError('');
    try {
      const params = { debut: filters.debut, fin: filters.fin, ...(accountingSection ? { section: accountingSection } : {}) };
      const [balance, result] = await Promise.all([
        apiClient.get<AccountingLine[]>('/comptabilite/balance', { params }),
        apiClient.get<AccountingReport['result']>('/comptabilite/compte-resultat', { params }),
      ]);
      setAccountingReport({ balance: balance.data, result: result.data });
    } catch (err: any) { setAccountingReport(null); setAccountingError(err?.response?.data?.message || 'Impossible de charger les états comptables.'); }
    finally { setAccountingLoading(false); }
  }, [filters.debut, filters.fin, accountingSection]);
  useEffect(() => { if (activeTab === 'comptabilite') void loadAccounting(); }, [activeTab, loadAccounting]);

  const loadEvaluation = useCallback(async () => {
    setEvaluationLoading(true); setEvaluationError('');
    try {
      const { data } = await apiClient.get<EvaluationReport>('/rapports/evaluation', { params: { debut: filters.debut, fin: filters.fin } });
      setEvaluation(data);
    } catch (err: any) { setEvaluation(null); setEvaluationError(err?.response?.data?.message || 'Impossible de calculer les indicateurs.'); }
    finally { setEvaluationLoading(false); }
  }, [filters.debut, filters.fin]);
  useEffect(() => { if (activeTab === 'evaluation') void loadEvaluation(); }, [activeTab, loadEvaluation]);

  const hasActivity = useMemo(() => !!report && (
    report.totaux.adhesions > 0 || (['FC', 'USD'] as Currency[]).some((currency) =>
      report.totaux.depots[currency] || report.totaux.retraits[currency] || report.totaux.creditsDecaisses[currency] || report.totaux.remboursements[currency],
    )
  ), [report]);

  const currentCurrency = filters.devise;
  const chartRows = report?.serie ?? [];
  const maxValue = Math.max(1, ...chartRows.flatMap((point) => [point.depots[currentCurrency], point.creditsDecaisses[currentCurrency], point.remboursements[currentCurrency]]));
  const pointsFor = (key: 'depots' | 'creditsDecaisses' | 'remboursements') => chartRows.map((point, index) => {
    const x = chartRows.length < 2 ? 50 : (index / (chartRows.length - 1)) * 100;
    const y = 92 - (point[key][currentCurrency] / maxValue) * 78;
    return `${x},${y}`;
  }).join(' ');

  const exportJournal = (format: 'csv' | 'pdf') => {
    if (!journal?.data.length) return;
    const headers = ['Période', 'Devise', 'Filtres', 'Page', 'Généré le', 'Date', 'Référence', 'Libellé', 'Compte', 'Section', 'Type', 'Statut', 'Débit', 'Crédit'];
    const lineRows = journal.data.map((line) => [
      `${filters.debut} — ${filters.fin}`, currentCurrency,
      [`type=${journalFilters.type || 'tous'}`, `statut=${journalFilters.statut || 'validées+annulées'}`, `section=${journalFilters.section || 'toutes'}`, `compte=${journalFilters.compteId || 'tous'}`].join('; '),
      `${journal.pagination.page}/${journal.pagination.totalPages}`, new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
      new Intl.DateTimeFormat('fr-FR').format(new Date(line.date)), line.reference, line.libelle,
      `${line.compte.numero} ${line.compte.libelle}`, line.section || '', line.type, line.statut, line.debit, line.credit,
    ]);
    const rows = [...lineRows, [
      `${filters.debut} — ${filters.fin}`, currentCurrency, 'TOTAL DES ÉCRITURES FILTRÉES',
      `${journal.pagination.page}/${journal.pagination.totalPages}`, '', '', '', '', '', '',
      money(journal.totaux[currentCurrency].debit, currentCurrency), money(journal.totaux[currentCurrency].credit, currentCurrency),
    ]];
    const name = `journal-comptable-${currentCurrency}-page-${journal.pagination.page}`;
    if (format === 'csv') downloadReportCsv(name, headers, rows);
    else void downloadReportPdf(`Journal comptable · ${filters.debut} au ${filters.fin} · ${currentCurrency} · page ${journal.pagination.page}/${journal.pagination.totalPages}`, name, headers, rows);
  };

  const exportCash = (format: 'csv' | 'pdf') => {
    if (!cashReport?.data.length) return;
    const headers = ['Période', 'Devise', 'Filtres', 'Page', 'Généré le', 'Date', 'Agent', 'Guichet', 'Caisse', 'Type', 'Source', 'Statut source', 'Montant', 'Entrées', 'Sorties', 'Écart', 'Solde avant', 'Solde après'];
    const generatedAt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const metadata = [`${filters.debut} — ${filters.fin}`, currentCurrency, [`agentId=${cashFilters.agentId || 'tous'}`, `guichet=${cashFilters.guichet || 'tous'}`].join('; '), `${cashReport.pagination.page}/${cashReport.pagination.totalPages}`, generatedAt];
    const summaryRows = cashReport.rapprochement.map((item) => [
      ...metadata, '', '', '', item.caisseId, 'SYNTHÈSE CAISSE', '', `écart=${money(item.ecart, item.devise)}`, '',
      money(item.inflows, item.devise), money(item.outflows, item.devise), money(item.ecart, item.devise), money(item.opening, item.devise), money(item.closing, item.devise),
    ]);
    const movementRows = cashReport.data.map((movement) => [
      `${filters.debut} — ${filters.fin}`, currentCurrency,
      [`agentId=${cashFilters.agentId || 'tous'}`, `guichet=${cashFilters.guichet || 'tous'}`].join('; '),
      `${cashReport.pagination.page}/${cashReport.pagination.totalPages}`, new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.date)),
      movement.agent.nom, movement.agent.guichetAssigne, movement.caisseId, movement.type,
      movement.source?.reference || movement.source?.type || movement.motif || '', movement.source?.statut || 'Enregistré',
      movement.montant, '', '', movement.source?.ecartMontant ?? '', movement.soldeAvant, movement.soldeApres,
    ]);
    const rows = [...summaryRows, ...movementRows];
    const name = `rapprochement-caisses-${currentCurrency}-page-${cashReport.pagination.page}`;
    if (format === 'csv') downloadReportCsv(name, headers, rows);
    else void downloadReportPdf(`Rapprochement de caisse · ${filters.debut} au ${filters.fin} · ${currentCurrency} · page ${cashReport.pagination.page}/${cashReport.pagination.totalPages}`, name, headers, rows);
  };

  const exportEvaluation = (format: 'csv' | 'pdf') => {
    if (!evaluation?.indicateurs.length) return;
    const headers = ['Période', 'Comparée à', 'Indicateur', 'Devise', 'Valeur période', 'Valeur précédente', 'Variation', 'Variation %', 'Formule', 'Source', 'Généré le'];
    const generatedAt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const rows = evaluation.indicateurs.map((item) => [
      `${evaluation.periode.debut} — ${evaluation.periode.fin}`,
      `${evaluation.comparaison.debut} — ${evaluation.comparaison.fin}`,
      item.label, item.devise, item.valeur, item.valeurPrecedente, item.variation,
      item.variationPourcent === null ? 'Sans base de comparaison' : `${item.variationPourcent}%`, item.formule, item.source, generatedAt,
    ]);
    if (format === 'csv') downloadReportCsv('evaluation-cooperative', headers, rows);
    else void downloadReportPdf(`Évaluation opérationnelle · ${evaluation.periode.debut} au ${evaluation.periode.fin}`, 'evaluation-cooperative', headers, rows);
  };

  const exportAccounting = (format: 'csv' | 'pdf') => {
    if (!accountingReport) return;
    const generatedAt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const scope = `section=${accountingSection || 'toutes'}`;
    const headers = ['Période', 'Filtres', 'État', 'Compte', 'Libellé', 'Section', 'Devise', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur', 'Montant', 'Généré le'];
    const balanceRows = accountingReport.balance.flatMap((account) => account.soldes.map((item) => [
      `${filters.debut} — ${filters.fin}`, scope, 'Balance', account.compte.numeroCompte,
      account.compte.planCompte.libelle, accountingSection || '', item.devise,
      item.debit, item.credit, item.soldeDebiteur, item.soldeCrediteur, '', generatedAt,
    ]));
    const resultRows = [
      ...accountingReport.result.produits.map((item) => [
        `${filters.debut} — ${filters.fin}`, scope, 'Produit', item.compte, item.libelle,
        item.section || '', item.devise, '', '', '', '', item.montant, generatedAt,
      ]),
      ...accountingReport.result.charges.map((item) => [
        `${filters.debut} — ${filters.fin}`, scope, 'Charge', item.compte, item.libelle,
        item.section || '', item.devise, '', '', '', '', item.montant, generatedAt,
      ]),
    ];
    const rows = [...balanceRows, ...resultRows];
    const name = `etats-comptables-${filters.debut}-${filters.fin}`;
    if (format === 'csv') downloadReportCsv(name, headers, rows);
    else void downloadReportPdf(`États comptables · ${filters.debut} au ${filters.fin} · ${scope}`, name, headers, rows);
  };

  const cards = [
    { key: 'depots', title: 'Dépôts des membres', value: report?.totaux.depots[currentCurrency] ?? 0, icon: IconArrowDown, tone: 'blue', href: '/operations/depots-cotisations', note: 'Épargne collectée' },
    { key: 'retraits', title: 'Retraits effectués', value: report?.totaux.retraits[currentCurrency] ?? 0, icon: IconArrowUp, tone: 'amber', href: '/operations/retraits', note: 'Retraits complétés' },
    { key: 'credits', title: 'Crédits décaissés', value: report?.totaux.creditsDecaisses[currentCurrency] ?? 0, icon: IconCreditCard, tone: 'violet', href: '/operations/credits', note: 'Montant accordé' },
    { key: 'repayments', title: 'Remboursements', value: report?.totaux.remboursements[currentCurrency] ?? 0, icon: IconRefresh, tone: 'green', href: '/operations/remboursements', note: 'Paiements valides' },
  ];

  return (
    <main className="mx-auto min-w-0 w-full max-w-[1440px] space-y-5 px-4 py-5 md:space-y-6 md:px-8 md:py-8">
      <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-sm text-slate-500">Administration / Rapports</p>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-slate-900 sm:text-3xl">Rapports d’activité</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-600">Consultez l’activité réelle de la coopérative sur la période choisie.</p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:flex-wrap sm:gap-3 lg:w-auto">
          <div className="col-span-2 flex h-11 min-w-0 items-center justify-between gap-1 rounded-lg bg-slate-100 p-1 sm:col-span-auto sm:justify-start" aria-label="Périodes prédéfinies">
            {[{ label: '30 j', days: 30 }, { label: '90 j', days: 90 }, { label: '12 mois', days: 365 }].map((preset) => <button key={preset.label} type="button" onClick={() => {
              const end = new Date();
              const start = new Date(end);
              start.setDate(start.getDate() - preset.days + 1);
              setFilters((current) => ({ ...current, debut: dateString(start), fin: dateString(end), granularite: preset.days <= 30 ? 'jour' : preset.days <= 90 ? 'semaine' : 'mois' }));
            }} className="min-h-9 flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-blue-700 sm:flex-none sm:px-2.5">{preset.label}</button>)}
          </div>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">Du
            <input type="date" value={filters.debut} max={filters.fin} onChange={(event) => setFilters((current) => ({ ...current, debut: event.target.value }))} className="h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 sm:px-3" />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">Au
            <input type="date" value={filters.fin} min={filters.debut} onChange={(event) => setFilters((current) => ({ ...current, fin: event.target.value }))} className="h-11 w-full min-w-0 max-w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-900 sm:px-3" />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">Granularité
            <select value={filters.granularite} onChange={(event) => setFilters((current) => ({ ...current, granularite: event.target.value as Granularity }))} className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 sm:px-3">
              <option value="jour">Par jour</option><option value="semaine">Par semaine</option><option value="mois">Par mois</option>
            </select>
          </label>
          <div className="flex h-11 min-w-0 items-center justify-center rounded-lg bg-slate-100 p-1" aria-label="Devise affichée">
            {(['USD', 'FC'] as Currency[]).map((currency) => <button key={currency} type="button" onClick={() => setFilters((current) => ({ ...current, devise: currency }))} className={`min-h-9 flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${currentCurrency === currency ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>{currency}</button>)}
          </div>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void loadReport()} className="shrink-0 font-semibold underline">Réessayer</button></div>}

      <nav className="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-200 [scrollbar-width:thin]" aria-label="Sections des rapports">
        {([{ id: 'synthese', label: 'Synthèse' }, { id: 'journal', label: 'Journal comptable' }, { id: 'caisse', label: 'Trésorerie / caisses' }, { id: 'epargne', label: 'Épargne & DAT' }, { id: 'credits', label: 'Portefeuille crédits' }, { id: 'comptabilite', label: 'États comptables' }, { id: 'evaluation', label: 'Évaluation' }] as const).map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${activeTab === tab.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}
      </nav>

      {activeTab === 'synthese' ? <>

      <section aria-label="Indicateurs de la période" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return <Link key={card.key} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-600">{card.title}</span><span className={`rounded-xl p-2 ${toneStyles[card.tone]}`}><Icon size={20} stroke={1.8} /></span></div>
            {loading ? <div className="mt-5 h-8 w-36 animate-pulse rounded bg-slate-100" /> : <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{money(card.value, currentCurrency)}</p>}
            <p className="mt-2 text-xs text-slate-500">{card.note} <span aria-hidden="true" className="float-right text-blue-700 opacity-0 transition group-hover:opacity-100">Ouvrir →</span></p>
          </Link>;
        })}
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-900">Évolution de l’activité</h2><p className="mt-1 text-sm leading-5 text-slate-500">Dépôts, crédits décaissés et remboursements · {currentCurrency}</p></div><span className="shrink-0 rounded-lg bg-slate-50 p-2 text-slate-500"><IconChartBar size={20} /></span></div>
          {loading ? <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-50" /> : chartRows.length ? <div className="mt-5 min-w-0 overflow-hidden">
            <div className="flex h-56 min-w-0 items-stretch gap-2 sm:h-64 sm:gap-3">
              <div className="flex shrink-0 flex-col justify-between pb-5 text-[10px] text-slate-500 sm:text-[11px]"><span>{money(maxValue, currentCurrency)}</span><span>{money(maxValue / 2, currentCurrency)}</span><span>0</span></div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full min-w-0 flex-1 overflow-hidden" role="img" aria-label={`Tendance en ${currentCurrency}`}>
                {[14, 53, 92].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e8edf3" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}
                <polyline points={pointsFor('depots')} fill="none" stroke="#1769aa" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pointsFor('creditsDecaisses')} fill="none" stroke="#a5b1bf" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pointsFor('remboursements')} fill="none" stroke="#15805d" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-2 flex min-w-0 justify-between gap-1 pl-10 text-[10px] text-slate-500 sm:pl-12 sm:text-[11px]">{chartRows.length <= 8 ? chartRows.map((point) => <span key={point.date} className="min-w-0 truncate">{new Intl.DateTimeFormat('fr-FR', { month: 'short', day: filters.granularite === 'jour' ? 'numeric' : undefined }).format(new Date(`${point.date}T00:00:00`))}</span>) : <><span>{chartRows[0].date}</span><span>{chartRows[Math.floor(chartRows.length / 2)].date}</span><span>{chartRows.at(-1)?.date}</span></>}</div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#1769aa]" />Dépôts</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-400" />Crédits décaissés</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#15805d]" />Remboursements</span></div>
          </div> : <div className="mt-6 flex h-64 flex-col items-center justify-center rounded-xl bg-slate-50 text-center"><IconCalendar size={24} className="text-slate-400" /><p className="mt-3 font-medium text-slate-700">Aucune opération sur cette période</p><p className="mt-1 text-sm text-slate-500">Essayez une période plus large.</p></div>}
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <h2 className="font-semibold text-slate-900">Membres inscrits</h2><p className="mt-1 text-sm text-slate-500">Adhésions sur la période</p>
          {loading ? <div className="mt-6 h-24 animate-pulse rounded-xl bg-slate-50" /> : <><div className="mt-6 flex items-center gap-4"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><IconUsers size={24} /></span><strong className="text-3xl font-semibold text-slate-900">{report?.totaux.adhesions ?? 0}</strong></div><p className="mt-4 text-sm text-slate-500">Nouvelles adhésions enregistrées selon leur date d’inscription.</p><div className="mt-6 border-t border-slate-100 pt-4"><Link href="/membres" className="text-sm font-medium text-blue-700 hover:underline">Consulter les membres →</Link></div></>}
        </div>
      </section>

      {!loading && !error && report && !hasActivity && <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Aucune activité financière ou nouvelle adhésion n’a été enregistrée pour ces dates.</p>}
      <p className="text-xs text-slate-500">Les montants FC et USD sont consultés séparément. Les remboursements supprimés et retraits annulés ou échoués sont exclus. Les dépôts des membres représentent leur épargne, pas un revenu de la coopérative.</p>
      </> : activeTab === 'journal' ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Journal des écritures</h2><p className="mt-1 text-sm text-slate-500">Détail des écritures comptabilisées. Les annulations restent visibles pour audit.</p></div><div className="flex gap-2"><button type="button" disabled={!journal?.data.length || journalLoading} onClick={() => exportJournal('csv')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">CSV · page</button><button type="button" disabled={!journal?.data.length || journalLoading} onClick={() => exportJournal('pdf')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">PDF · page</button></div></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <select aria-label="Type d’opération" value={journalFilters.type} onChange={(event) => setJournalFilters((current) => ({ ...current, type: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Tous les types</option>{['DEPOT_EPARGNE', 'RETRAIT_EPARGNE', 'DECAISSEMENT_CREDIT', 'INTERET_CREDIT', 'ADHESION', 'AJUSTEMENT', 'CONTREPASSATION'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select>
            <select aria-label="Statut de l’opération" value={journalFilters.statut} onChange={(event) => setJournalFilters((current) => ({ ...current, statut: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Validées et annulées</option><option value="VALIDEE">Validée</option><option value="ANNULEE">Annulée</option></select>
            <input aria-label="Code de section" placeholder="Section analytique" value={journalFilters.section} onChange={(event) => setJournalFilters((current) => ({ ...current, section: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <input aria-label="Identifiant du compte" inputMode="numeric" placeholder="ID du compte" value={journalFilters.compteId} onChange={(event) => setJournalFilters((current) => ({ ...current, compteId: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
            <button type="button" onClick={() => void loadJournal()} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Appliquer les filtres</button>
          </div>
        </div>
        {journalError && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{journalError}</div>}
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Débits filtrés · {currentCurrency}</p><p className="mt-1 font-semibold text-slate-900">{journalLoading ? '…' : money(journal?.totaux[currentCurrency].debit ?? 0, currentCurrency)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Crédits filtrés · {currentCurrency}</p><p className="mt-1 font-semibold text-slate-900">{journalLoading ? '…' : money(journal?.totaux[currentCurrency].credit ?? 0, currentCurrency)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Écritures correspondant aux filtres</p><p className="mt-1 font-semibold text-slate-900">{journal?.pagination.total ?? 0}</p></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Date / référence', 'Libellé', 'Compte', 'Section', 'Type / statut', 'Devise', 'Débit', 'Crédit'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{journalLoading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Chargement du journal…</td></tr> : journal?.data.length ? journal.data.map((line) => <tr key={line.id} className="text-slate-700 hover:bg-slate-50/70"><td className="px-4 py-3"><span className="block">{new Intl.DateTimeFormat('fr-FR').format(new Date(line.date))}</span><span className="text-xs text-slate-500">{line.reference}</span></td><td className="max-w-xs px-4 py-3">{line.libelle}</td><td className="px-4 py-3"><span className="block font-medium">{line.compte.numero}</span><span className="text-xs text-slate-500">{line.compte.libelle}</span></td><td className="px-4 py-3">{line.section || '—'}</td><td className="px-4 py-3"><span className="block">{line.type.replaceAll('_', ' ')}</span><span className={line.statut === 'ANNULEE' ? 'text-xs text-amber-700' : 'text-xs text-emerald-700'}>{line.statut}</span></td><td className="px-4 py-3">{line.devise}</td><td className="px-4 py-3 tabular-nums">{line.debit ? money(line.debit, line.devise) : '—'}</td><td className="px-4 py-3 tabular-nums">{line.credit ? money(line.credit, line.devise) : '—'}</td></tr>) : <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Aucune écriture pour ces filtres.</td></tr>}</tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500"><span>{journal?.pagination.total ?? 0} écritures · page {journal?.pagination.page ?? 1} / {journal?.pagination.totalPages || 1}</span><div className="flex gap-2"><button type="button" disabled={(journal?.pagination.page ?? 1) <= 1 || journalLoading} onClick={() => setJournalFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Précédent</button><button type="button" disabled={(journal?.pagination.page ?? 1) >= (journal?.pagination.totalPages ?? 1) || journalLoading} onClick={() => setJournalFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Suivant</button></div></footer>
      </section> : activeTab === 'caisse' ? <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3"><div className="mr-auto"><h2 className="font-semibold text-slate-900">Rapprochement des caisses</h2><p className="mt-1 text-sm text-slate-500">Mouvements par agent, guichet et devise. Les écarts sont calculés depuis les soldes avant/après enregistrés.</p></div><button type="button" disabled={!cashReport?.data.length || cashLoading} onClick={() => exportCash('csv')} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:opacity-40">CSV · page</button><button type="button" disabled={!cashReport?.data.length || cashLoading} onClick={() => exportCash('pdf')} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:opacity-40">PDF · page</button>
            <input aria-label="Identifiant de l’agent" inputMode="numeric" placeholder="ID agent" value={cashFilters.agentId} onChange={(event) => setCashFilters((current) => ({ ...current, agentId: event.target.value, page: 1 }))} className="h-10 w-32 rounded-lg border border-slate-200 px-3 text-sm" />
            <input aria-label="Nom du guichet" placeholder="Guichet" value={cashFilters.guichet} onChange={(event) => setCashFilters((current) => ({ ...current, guichet: event.target.value, page: 1 }))} className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm" />
            <button type="button" onClick={() => void loadCashReport()} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Appliquer</button>
          </div>
        </div>
        {cashError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{cashError}</div>}
        {!!cashReport?.operationsSansMouvement.retraitsEchoues && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{cashReport.operationsSansMouvement.retraitsEchoues} retrait(s) échoué(s) sans mouvement de caisse sur la période.</p>}
        <div className="grid gap-3 md:grid-cols-2">{cashReport?.rapprochement.map((item) => <article key={`${item.caisseId}-${item.devise}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h3 className="font-semibold text-slate-900">Caisse #{item.caisseId}</h3><p className="mt-1 text-sm text-slate-500">{item.devise} · période {filters.debut} au {filters.fin}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.ecart === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{item.ecart === 0 ? 'Équilibrée' : `Écart ${money(item.ecart, item.devise)}`}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Solde au premier mouvement</dt><dd className="mt-1 font-semibold text-slate-900">{money(item.opening, item.devise)}</dd></div><div><dt className="text-slate-500">Solde au dernier mouvement</dt><dd className="mt-1 font-semibold text-slate-900">{money(item.closing, item.devise)}</dd></div><div><dt className="text-slate-500">Entrées rapprochées</dt><dd className="mt-1 font-medium text-emerald-700">{money(item.inflows, item.devise)}</dd></div><div><dt className="text-slate-500">Sorties rapprochées</dt><dd className="mt-1 font-medium text-slate-700">{money(item.outflows, item.devise)}</dd></div></dl></article>)}</div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Date', 'Agent / guichet', 'Type et source', 'Montant', 'Solde avant', 'Solde après', 'État'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{cashLoading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Chargement des mouvements…</td></tr> : cashReport?.data.length ? cashReport.data.map((movement) => <tr key={movement.id} className="text-slate-700 hover:bg-slate-50/70"><td className="px-4 py-3">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.date))}</td><td className="px-4 py-3"><span className="block font-medium">{movement.agent.nom}</span><span className="text-xs text-slate-500">{movement.agent.guichetAssigne} · caisse #{movement.caisseId}</span></td><td className="px-4 py-3"><span className="block">{movement.type.replaceAll('_', ' ')}</span><span className="text-xs text-slate-500">{movement.source?.reference || movement.source?.type || movement.motif || 'Aucune référence source'}</span>{movement.source?.ecartMontant !== null && movement.source?.ecartMontant !== undefined && movement.source.ecartMontant !== 0 && <span className="mt-1 block text-xs font-medium text-amber-700">Écart source : {money(movement.source.ecartMontant, movement.devise)}</span>}</td><td className="px-4 py-3 font-medium tabular-nums">{money(movement.montant, movement.devise)}</td><td className="px-4 py-3 tabular-nums">{money(movement.soldeAvant, movement.devise)}</td><td className="px-4 py-3 tabular-nums">{money(movement.soldeApres, movement.devise)}</td><td className="px-4 py-3">{movement.source?.statut || 'Mouvement enregistré'}</td></tr>) : <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Aucun mouvement de caisse sur cette période.</td></tr>}</tbody></table></div>
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500"><span>{cashReport?.pagination.total ?? 0} mouvements · page {cashReport?.pagination.page ?? 1} / {cashReport?.pagination.totalPages || 1}</span><div className="flex gap-2"><button type="button" disabled={(cashReport?.pagination.page ?? 1) <= 1 || cashLoading} onClick={() => setCashFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Précédent</button><button type="button" disabled={(cashReport?.pagination.page ?? 1) >= (cashReport?.pagination.totalPages ?? 1) || cashLoading} onClick={() => setCashFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Suivant</button></div></footer>
        </div>
      </section> : activeTab === 'epargne' ? <section className="space-y-4">
        {savingsError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{savingsError}</div>}
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">{savingsReport?.note || 'Les dépôts des membres sont des fonds qui leur appartiennent, pas un revenu de la coopérative.'}</p>
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Dépôts par produit</h2><p className="mt-1 text-sm text-slate-500">Sous-compte et devise, hors remboursements de crédits.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Produit', 'Sous-compte', 'Devise', 'Montant'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{savingsLoading ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chargement…</td></tr> : savingsReport?.depots.length ? savingsReport.depots.map((row, i) => <tr key={`${row.produit}-${row.sousCompte}-${row.devise}-${i}`}><td className="px-4 py-3 font-medium text-slate-800">{row.produit}</td><td className="px-4 py-3 text-slate-600">{row.sousCompte}</td><td className="px-4 py-3">{row.devise}</td><td className="px-4 py-3 font-medium tabular-nums">{money(row.montant, row.devise)}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-slate-500">Aucun dépôt sur cette période.</td></tr>}</tbody></table></div></article>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Retraits complétés</h2><p className="mt-1 text-sm text-slate-500">Les retraits annulés ou échoués sont exclus.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[400px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Produit', 'Devise', 'Montant'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{savingsLoading ? <tr><td colSpan={3} className="p-8 text-center text-slate-500">Chargement…</td></tr> : savingsReport?.retraits.length ? savingsReport.retraits.map((row, i) => <tr key={`${row.produit}-${row.devise}-${i}`}><td className="px-4 py-3 font-medium text-slate-800">{row.produit}</td><td className="px-4 py-3">{row.devise}</td><td className="px-4 py-3 font-medium tabular-nums">{money(row.montant, row.devise)}</td></tr>) : <tr><td colSpan={3} className="p-8 text-center text-slate-500">Aucun retrait sur cette période.</td></tr>}</tbody></table></div></article>
        </div>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Dépôts à terme</h2><p className="mt-1 text-sm text-slate-500">Contrats ouverts ou clôturés; les DAT annulés sont exclus.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Produit', 'Durée', 'Statut', 'Contrats', 'Devise', 'Capital', 'Gain prévu'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{savingsLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Chargement…</td></tr> : savingsReport?.dats.length ? savingsReport.dats.map((row, i) => <tr key={`${row.produit}-${row.dureeMois}-${row.statut}-${row.devise}-${i}`}><td className="px-4 py-3 font-medium text-slate-800">{row.produit}</td><td className="px-4 py-3">{row.dureeMois} mois</td><td className="px-4 py-3">{row.statut}</td><td className="px-4 py-3">{row.contrats}</td><td className="px-4 py-3">{row.devise}</td><td className="px-4 py-3 font-medium tabular-nums">{money(row.capital, row.devise)}</td><td className="px-4 py-3 tabular-nums">{money(row.gain, row.devise)}</td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucun DAT sur cette période.</td></tr>}</tbody></table></div></article>
      </section> : activeTab === 'credits' ? <section className="space-y-4">
        {creditError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{creditError}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold text-slate-900">Portefeuille de crédits</h2><p className="mt-1 text-sm text-slate-500">Crédits décaissés du {filters.debut} au {filters.fin}; soldes calculés depuis les remboursements valides.</p></div><Link href="/operations/remboursements" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800">Ouvrir les remboursements</Link></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{['1-30', '31-60', '61-90', '90+'].map((bucket) => <article key={bucket} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Retard · {bucket} jours</p>{creditLoading ? <div className="mt-3 h-7 animate-pulse rounded bg-slate-100" /> : <div className="mt-3 space-y-1">{(['USD', 'FC'] as const).map((currency) => { const row = creditPortfolio?.retards.find((item) => item.tranche === bucket && item.devise === currency); return <p key={currency} className="flex justify-between text-sm"><span className="text-slate-500">{currency}</span><strong className="text-slate-900">{money(row?.montant ?? 0, currency)}</strong></p>; })}</div>}</article>)}</div>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-5"><div><h3 className="font-semibold text-slate-900">Échéances proches</h3><p className="mt-1 text-sm text-slate-500">Les 30 prochains jours, selon la date d’échéance et le solde restant.</p></div></header><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Membre', 'N° membre', 'Échéance', 'Restant dû', 'Devise', 'Accès'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{creditLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Chargement…</td></tr> : creditPortfolio?.echeances.length ? creditPortfolio.echeances.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium text-slate-800">{row.membre}</td><td className="px-4 py-3">{row.numeroCompte}</td><td className="px-4 py-3">{new Intl.DateTimeFormat('fr-FR').format(new Date(row.echeance))}</td><td className="px-4 py-3 font-medium">{money(row.restant, row.devise as Currency)}</td><td className="px-4 py-3">{row.devise}</td><td className="px-4 py-3"><Link href="/operations/remboursements" className="text-blue-700 hover:underline">Voir les remboursements</Link></td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune échéance à venir sur les crédits de cette période.</td></tr>}</tbody></table></div></article>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h3 className="font-semibold text-slate-900">Détail des crédits</h3><p className="mt-1 text-xs text-slate-500">{creditPortfolio?.definitionRestant}</p></header><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Membre', 'Décaissé', 'Total dû', 'Remboursé', 'Restant', 'Échéance', 'Statut', 'Retard'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{creditLoading ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Chargement…</td></tr> : creditPortfolio?.credits.length ? creditPortfolio.credits.map((credit) => <tr key={credit.id} className="text-slate-700"><td className="px-4 py-3"><Link href="/membres" className="font-medium text-blue-700 hover:underline">{credit.membre}</Link><span className="block text-xs text-slate-500">{credit.numeroCompte}</span></td><td className="px-4 py-3">{money(credit.montantAccorde, credit.devise as Currency)}</td><td className="px-4 py-3">{money(credit.totalDu, credit.devise as Currency)}</td><td className="px-4 py-3">{money(credit.rembourse, credit.devise as Currency)}</td><td className="px-4 py-3 font-semibold">{money(credit.restant, credit.devise as Currency)}</td><td className="px-4 py-3">{credit.echeance ? new Intl.DateTimeFormat('fr-FR').format(new Date(credit.echeance)) : '—'}</td><td className="px-4 py-3">{credit.statut}</td><td className="px-4 py-3">{credit.joursRetard > 0 ? `${credit.joursRetard} j` : '—'}</td></tr>) : <tr><td colSpan={8} className="p-8 text-center text-slate-500">Aucun crédit accordé dans cette période.</td></tr>}</tbody></table></div><footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500"><span>{creditPortfolio?.pagination.total ?? 0} crédits · page {creditPortfolio?.pagination.page ?? creditPage} / {creditPortfolio?.pagination.totalPages || 1}</span><div className="flex gap-2"><button type="button" disabled={creditPage <= 1 || creditLoading} onClick={() => setCreditPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Précédent</button><button type="button" disabled={creditPage >= (creditPortfolio?.pagination.totalPages ?? 1) || creditLoading} onClick={() => setCreditPage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Suivant</button></div></footer></article>
      </section> : activeTab === 'comptabilite' ? <section className="space-y-4">
        {accountingError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{accountingError}</div>}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold text-slate-900">États comptables</h2><p className="mt-1 text-sm text-slate-500">Balance et compte de résultat issus des écritures validées, du {filters.debut} au {filters.fin}.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Filtrer par section analytique" placeholder="Toutes les sections" value={accountingSection} onChange={(event) => setAccountingSection(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={() => void loadAccounting()} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Appliquer</button><button type="button" disabled={!accountingReport || accountingLoading} onClick={() => exportAccounting('csv')} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">CSV</button><button type="button" disabled={!accountingReport || accountingLoading} onClick={() => exportAccounting('pdf')} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:opacity-40">PDF</button></div></div>
        <div className="grid gap-3 sm:grid-cols-2">{(['USD', 'FC'] as Currency[]).map((currency) => {
          const lines = accountingReport?.balance.flatMap((account) => account.soldes.filter((entry) => entry.devise === currency)) ?? [];
          const debit = lines.reduce((sum, line) => sum + line.debit, 0);
          const credit = lines.reduce((sum, line) => sum + line.credit, 0);
          const hasBalanceData = lines.length > 0;
          const balanced = hasBalanceData && Math.abs(debit - credit) < 0.01;
          const result = accountingReport?.result.consolide[currency];
          return <article key={currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Balance · {currency}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${!hasBalanceData ? 'bg-slate-100 text-slate-600' : balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{accountingLoading ? 'Chargement' : !hasBalanceData ? 'Aucune donnée' : balanced ? 'Équilibrée' : 'À vérifier'}</span></div><p className="mt-4 text-xs text-slate-500">Débits / crédits</p><p className="mt-1 text-sm font-semibold text-slate-900">{accountingLoading ? '…' : `${money(debit, currency)} / ${money(credit, currency)}`}</p><div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-sm"><div><span className="block text-xs text-slate-500">Produits</span><strong>{money(result?.produits ?? 0, currency)}</strong></div><div><span className="block text-xs text-slate-500">Charges</span><strong>{money(result?.charges ?? 0, currency)}</strong></div><div><span className="block text-xs text-slate-500">Résultat</span><strong>{money(result?.resultat ?? 0, currency)}</strong></div></div></article>;
        })}</div>
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h3 className="font-semibold text-slate-900">Balance générale</h3><p className="mt-1 text-xs text-slate-500">Sélectionnez un compte pour ouvrir ses écritures dans le journal.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Compte', 'Libellé', 'Devise', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{accountingLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Chargement…</td></tr> : accountingReport?.balance.length ? accountingReport.balance.flatMap((account) => account.soldes.map((item) => <tr key={`${account.compte.numeroCompte}-${item.devise}`} className="text-slate-700"><td className="px-3 py-3 font-medium"><button type="button" onClick={() => { setJournalFilters((current) => ({ ...current, compteId: String(account.compte.id), page: 1 })); setActiveTab('journal'); }} className="text-blue-700 hover:underline">{account.compte.numeroCompte}</button></td><td className="px-3 py-3">{account.compte.planCompte.libelle}</td><td className="px-3 py-3">{item.devise}</td><td className="px-3 py-3">{money(item.debit, item.devise)}</td><td className="px-3 py-3">{money(item.credit, item.devise)}</td><td className="px-3 py-3">{money(item.soldeDebiteur, item.devise)}</td><td className="px-3 py-3">{money(item.soldeCrediteur, item.devise)}</td></tr>)) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucune écriture comptable sur cette période.</td></tr>}</tbody></table></div></article>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h3 className="font-semibold text-slate-900">Compte de résultat</h3><p className="mt-1 text-sm text-slate-500">Les dépôts des membres restent hors des produits de la coopérative.</p></header><div className="space-y-5 p-5">{(['USD', 'FC'] as Currency[]).map((currency) => <div key={currency}><h4 className="mb-2 text-sm font-semibold text-slate-800">{currency}</h4><div className="grid gap-1 text-sm">{(accountingReport?.result.produits.filter((row) => row.devise === currency) ?? []).map((row, i) => <p key={`p-${row.compte}-${row.section}-${i}`} className="flex justify-between gap-3 text-slate-700"><span>Produit · {row.libelle}{row.section ? ` · ${row.section}` : ''}</span><span className="font-medium">{money(row.montant, currency)}</span></p>)}{(accountingReport?.result.charges.filter((row) => row.devise === currency) ?? []).map((row, i) => <p key={`c-${row.compte}-${row.section}-${i}`} className="flex justify-between gap-3 text-slate-700"><span>Charge · {row.libelle}{row.section ? ` · ${row.section}` : ''}</span><span className="font-medium">− {money(row.montant, currency)}</span></p>)}{!accountingLoading && ((accountingReport?.result.produits ?? []).every((row) => row.devise !== currency) && (accountingReport?.result.charges ?? []).every((row) => row.devise !== currency)) ? <p className="text-sm text-slate-500">Aucun produit ou charge sur cette période.</p> : null}</div></div>)}</div></article>
        </div>
      </section> : <section className="space-y-4">
        {evaluationError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{evaluationError}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold text-slate-900">Évaluation opérationnelle</h2><p className="mt-1 text-sm text-slate-500">Période précédente de même durée : {evaluation?.comparaison.debut} au {evaluation?.comparaison.fin}.</p></div><div className="flex gap-2"><button type="button" disabled={!evaluation?.indicateurs.length || evaluationLoading} onClick={() => exportEvaluation('csv')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">Exporter CSV</button><button type="button" disabled={!evaluation?.indicateurs.length || evaluationLoading} onClick={() => exportEvaluation('pdf')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40">Exporter PDF</button></div></div>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">{evaluation?.note || 'Ces indicateurs d’activité sont séparés des états comptables.'}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{evaluationLoading ? Array.from({ length: 7 }, (_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />) : evaluation?.indicateurs.map((item) => <article key={`${item.label}-${item.devise}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{item.label}</h3><span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.devise}</span></div><p className="mt-4 text-2xl font-semibold text-slate-900">{item.devise === '—' ? new Intl.NumberFormat('fr-FR').format(item.valeur) : money(item.valeur, item.devise)}</p><p className="mt-1 text-xs text-slate-500">Précédent : {item.devise === '—' ? new Intl.NumberFormat('fr-FR').format(item.valeurPrecedente) : money(item.valeurPrecedente, item.devise)}</p><div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600"><p><strong>Écart :</strong> {item.variationPourcent === null ? 'Sans base de comparaison (valeur précédente nulle)' : `${item.variationPourcent}% · ${item.devise === '—' ? item.variation : money(item.variation, item.devise)}`}</p><p className="mt-2"><strong>Formule :</strong> {item.formule}</p><p className="mt-1"><strong>Source :</strong> {item.source}</p></div></article>)}</div>
      </section>}
    </main>
  );
}
