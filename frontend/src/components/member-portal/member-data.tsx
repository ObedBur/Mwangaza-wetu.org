'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, getAuthUser } from '@/lib/auth';

export interface MemberPortalTransaction {
  id: string;
  date: string;
  description: string;
  type: string;
  devise: 'USD' | 'FC';
  compteType?: string;
  montant: number;
  statut: string;
}

export interface MemberDat {
  id: number;
  devise: 'USD' | 'FC';
  capital: number;
  gain: number;
  totalDu: number;
  dureeMois: number;
  dateOuverture: string;
  dateEcheance: string;
  statut: string;
}

export interface MemberPortalDashboard {
  profile: {
    id: number;
    numeroCompte: string;
    nomComplet: string;
    telephone?: string | null;
    email?: string | null;
    adresse?: string | null;
    sexe?: string | null;
    typeCompte: string;
    statut: string;
    dateAdhesion: string;
    photoProfil?: string | null;
  };
  balances: {
    savings: { USD: number; FC: number };
    activeCredits: { USD: number; FC: number };
  };
  activeCreditsDetails: Array<{
    id: number;
    montantInitial: number;
    montantTotal: number;
    montantRembourse: number;
    restant: number;
    tauxInteret: number;
    devise: 'USD' | 'FC';
    dateDebut: string;
    dateEcheance: string | null;
    statut: string;
    progression: number;
  }>;
  monthlyActivity: Array<{
    monthKey: string;
    month: string;
    USD: { deposits: number; withdrawals: number };
    FC: { deposits: number; withdrawals: number };
  }>;
  recentTransactions: MemberPortalTransaction[];
}

interface TransactionPage {
  data: MemberPortalTransaction[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

interface MemberDataContextValue {
  dashboard: MemberPortalDashboard | null;
  transactions: MemberPortalTransaction[];
  dats: MemberDat[];
  transactionMeta: TransactionPage['meta'] | null;
  state: 'loading' | 'ready' | 'error';
  error: string;
  reload: () => void;
  loadMoreTransactions: () => Promise<void>;
  loadingMore: boolean;
}

const MemberDataContext = createContext<MemberDataContextValue | null>(null);

export function MemberDataProvider({ children }: { children: React.ReactNode }) {
  const [dashboard, setDashboard] = useState<MemberPortalDashboard | null>(null);
  const [transactions, setTransactions] = useState<MemberPortalTransaction[]>([]);
  const [dats, setDats] = useState<MemberDat[]>([]);
  const [transactionMeta, setTransactionMeta] = useState<TransactionPage['meta'] | null>(null);
  const [state, setState] = useState<MemberDataContextValue['state']>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const reload = useCallback(() => setRequestVersion((version) => version + 1), []);
  const loadMoreTransactions = useCallback(async () => {
    if (!transactionMeta || transactionMeta.page >= transactionMeta.totalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await apiClient.get<TransactionPage>('/membres/me/transactions', {
        params: { page: transactionMeta.page + 1, pageSize: transactionMeta.pageSize },
      });
      setTransactions((current) => [...current, ...response.data.data]);
      setTransactionMeta(response.data.meta);
    } catch {
      setError('Impossible de charger la suite de votre historique.');
    } finally {
      setLoadingMore(false);
    }
  }, [transactionMeta, loadingMore]);

  useEffect(() => {
    let active = true;
    const user = getAuthUser();
    if (!user || user.role !== 'member' || (!user.accountNumber && !user.id)) {
      setError('Session membre introuvable. Reconnectez-vous pour charger vos données.');
      setState('error');
      return;
    }

    setState('loading');
    setError('');
    const identifier = encodeURIComponent(user.accountNumber || String(user.id));
    Promise.all([
      apiClient.get<MemberPortalDashboard>(`/membres/dashboard/${identifier}`),
      apiClient.get<TransactionPage>('/membres/me/transactions', {
        params: { page: 1, pageSize: 100 },
      }),
      apiClient.get<MemberDat[]>('/dat/moi'),
    ]).then(([dashboardResponse, transactionsResponse, datResponse]) => {
      if (!active) return;
      setDashboard(dashboardResponse.data);
      setTransactions(transactionsResponse.data.data);
      setDats(datResponse.data);
      setTransactionMeta(transactionsResponse.data.meta);
      setState('ready');
    }).catch((requestError: unknown) => {
      if (!active) return;
      const message = requestError instanceof Error ? requestError.message : '';
      setError(message || 'Impossible de charger vos données. Vérifiez votre connexion puis réessayez.');
      setState('error');
    });

    return () => { active = false; };
  }, [requestVersion]);

  return (
    <MemberDataContext.Provider value={{ dashboard, transactions, dats, transactionMeta, state, error, reload, loadMoreTransactions, loadingMore }}>
      {children}
    </MemberDataContext.Provider>
  );
}

export function useMemberPortalData() {
  const value = useContext(MemberDataContext);
  if (!value) throw new Error('useMemberPortalData doit être utilisé dans MemberDataProvider');
  return value;
}
