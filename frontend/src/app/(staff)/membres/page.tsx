'use client';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowDown,
  IconArrowsDownUp,
  IconSearch,
  IconUserPlus,
  IconUsers,
  IconAlertTriangle,
  IconCircleCheck,
  IconFingerprint,
  IconKey,
} from "@tabler/icons-react";

import { ExcelFileIcon, PdfFileIcon } from "@/components/cooperative/ExportFormatIcons";
import { CooperativePagination } from "@/components/cooperative/CooperativePagination";
import {
  AccountPills,
  CooperativeBreadcrumb,
  CooperativeStatCard,
  CooperativeStatus,
  formatCurrency,
  formatDate,
} from "@/components/cooperative/CooperativePrimitives";
import { useCooperativeDarkTheme } from "@/components/cooperative/CooperativeThemeContext";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { apiClient } from "@/lib/auth";
import { downloadReportCsv, downloadReportPdf } from "@/lib/cooperative-report-export";
import { formatMixedCurrency } from "@/lib/format-currency";
import {
  MemberCredentialsDialog,
  MemberEnrollmentDialog,
  memberEnrollmentFrenchCopy,
  type CreatedMemberCredentials,
} from "@/components/cooperative/MemberEnrollmentDialog";
type MemberRecord = {
  id: string;
  memberNumber: string;
  name: string;
  phone: string;
  joinedAt: string;
  status: "Actif" | "Inactif";
  email: string;
  address: string;
  accountTypes: string[];
  savingsTotal: { FC: number; USD: number };
  sexe?: string | null;
  activite?: string | null;
  dateNaissance?: string | null;
  idNationale?: string | null;
  empreinteEnregistree: boolean;
  alertesCredits: { overdue: number; dueSoon: number; nextDueDate: string | null };
};

type ApiMember = {
  id: number;
  numeroCompte: string;
  nomComplet: string;
  dateAdhesion: string;
  telephone: string;
  email?: string | null;
  adresse?: string | null;
  statut: "actif" | "inactif";
  typeCompte: string;
  comptesEpargne?: { typeCompte: string; solde: string | number }[];
  soldes?: { FC: number | string; USD: number | string };
  sexe?: string | null;
  activite?: string | null;
  dateNaissance?: string | null;
  idNationale?: string | null;
  empreinteEnregistree?: boolean;
  alertesCredits?: { overdue: number; dueSoon: number; nextDueDate: string | null };
};

type MembersResponse = {
  data: ApiMember[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};

type MemberStats = {
  total: number;
  actifs: number;
  inactifs: number;
  nouveauxCeMois: number;
};

type ResetPasswordCredentials = {
  numeroCompte: string;
  email: string | null;
  motDePasseTemporaire: string;
};

type MemberTransaction = {
  id: string;
  date: string;
  type: "depot" | "retrait" | "remboursement";
  devise: "USD" | "FC";
  montant: number;
  statut: string;
  description: string;
};

type MemberTransactionsResponse = {
  data: MemberTransaction[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};

type MemberCreditRecord = {
  id: number;
  montant: number | string;
  montantRembourse: number | string;
  tauxInteret: number | string;
  devise: string;
  statut: string;
  duree: number;
  dateDebut: string;
  dateEcheance: string | null;
};

function mapMember(record: ApiMember): MemberRecord {
  const accountTypes = (record.comptesEpargne ?? []).map((account) => account.typeCompte);
  if (accountTypes.length === 0 && record.typeCompte) accountTypes.push(record.typeCompte);
  return {
    id: String(record.id),
    memberNumber: record.numeroCompte,
    name: record.nomComplet,
    phone: record.telephone,
    joinedAt: record.dateAdhesion.slice(0, 10),
    status: record.statut === "actif" ? "Actif" : "Inactif",
    savingsTotal: {
      FC: Number(record.soldes?.FC ?? 0),
      USD: Number(record.soldes?.USD ?? 0),
    },
    email: record.email ?? "",
    address: record.adresse ?? "",
    accountTypes,
    sexe: record.sexe,
    activite: record.activite,
    dateNaissance: record.dateNaissance,
    idNationale: record.idNationale,
    empreinteEnregistree: Boolean(record.empreinteEnregistree),
    alertesCredits: record.alertesCredits ?? { overdue: 0, dueSoon: 0, nextDueDate: null },
  };
}

function MembersContent() {
  const dark = useCooperativeDarkTheme();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState<AccountSlug | "">("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedMember, setSelectedMember] =
    useState<MemberRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberStats, setMemberStats] = useState<MemberStats>({ total: 0, actifs: 0, inactifs: 0, nouveauxCeMois: 0 });
  const [loadedQueryKey, setLoadedQueryKey] = useState("");
  const loadedQueryKeyRef = useRef("");
  const statsLoadedRef = useRef(false);
  const [loadErrorKey, setLoadErrorKey] = useState("");
  const [statsLoadedToken, setStatsLoadedToken] = useState(-1);
  const [statsErrorToken, setStatsErrorToken] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedMemberCredentials | null>(null);
  const [resetPasswordCredentials, setResetPasswordCredentials] = useState<ResetPasswordCredentials | null>(null);
  const [copiedResetPassword, setCopiedResetPassword] = useState(false);
  const [requestedMemberId, setRequestedMemberId] = useState<string | null>(null);
  const queryKey = JSON.stringify([page, pageSize, debouncedQuery, status, account, sort]);
  const loading = loadedQueryKey !== queryKey;
  const loadError = loadErrorKey === queryKey;
  const statsLoading = statsLoadedToken === -1;
  const statsError = statsErrorToken === reloadToken;

  useEffect(() => {
    const syncRequestedMember = () => {
      setRequestedMemberId(new URLSearchParams(window.location.search).get("membre"));
    };
    syncRequestedMember();
    window.addEventListener("popstate", syncRequestedMember);
    return () => window.removeEventListener("popstate", syncRequestedMember);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    apiClient.get<MembersResponse>("/membres", {
      params: { page, pageSize, search: debouncedQuery || undefined, status: status || undefined, account: account || undefined, sort },
    })
      .then((membersResponse) => {
        if (!active) return;
        const records = membersResponse.data.data.map(mapMember);
        setMembers(records);
        setTotalMembers(membersResponse.data.meta.total);
        loadedQueryKeyRef.current = queryKey;
        setSelectedMember((current) => current
          ? records.find((member) => member.id === current.id) ?? current
          : null);
        setLoadErrorKey("");
      })
      .catch(() => {
        if (active && loadedQueryKeyRef.current !== queryKey) setLoadErrorKey(queryKey);
      })
      .finally(() => {
        if (active) setLoadedQueryKey(queryKey);
      });
    return () => {
      active = false;
    };
  }, [account, debouncedQuery, page, pageSize, queryKey, reloadToken, sort, status]);

  useEffect(() => {
    if (!requestedMemberId) return;
    const requestedMember = members.find((member) => member.id === requestedMemberId);
    if (requestedMember) setSelectedMember(requestedMember);
  }, [members, requestedMemberId]);

  useEffect(() => {
    let active = true;
    apiClient.get<MemberStats>("/membres/stats")
      .then((response) => {
        if (!active) return;
        setMemberStats(response.data);
        statsLoadedRef.current = true;
        setStatsErrorToken(-1);
      })
      .catch(() => { if (active && !statsLoadedRef.current) setStatsErrorToken(reloadToken); })
      .finally(() => { if (active) setStatsLoadedToken(reloadToken); });
    return () => { active = false; };
  }, [reloadToken]);

  useEffect(() => {
    const refreshVisiblePage = () => {
      if (document.visibilityState === "visible") {
        setReloadToken((value) => value + 1);
      }
    };
    const interval = window.setInterval(refreshVisiblePage, 60_000);
    document.addEventListener("visibilitychange", refreshVisiblePage);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, []);

  const pageMembers = members;

  async function fetchAllFilteredMembers() {
    const params = {
      pageSize: 100,
      search: query.trim() || undefined,
      status: status || undefined,
      account: account || undefined,
      sort,
    };
    const firstPage = await apiClient.get<MembersResponse>("/membres", { params: { ...params, page: 1 } });
    const remainingPages = Array.from({ length: Math.max(0, firstPage.data.meta.totalPages - 1) }, (_, index) => index + 2);
    const remaining = await Promise.all(remainingPages.map((exportPage) =>
      apiClient.get<MembersResponse>("/membres", { params: { ...params, page: exportPage } }),
    ));
    return [...firstPage.data.data, ...remaining.flatMap((response) => response.data.data)].map(mapMember);
  }

  const memberExportHeaders = [
    t.memberNumber,
    t.memberSummary,
    t.phone,
    t.joinDate,
    t.accounts,
    t.savings,
    t.status,
  ];
  function rowsForExport(records: MemberRecord[]) {
    return records.map((member) => [
      member.memberNumber,
      member.name,
      member.phone,
      member.joinedAt,
      member.accountTypes.join(", ") || "—",
      formatMixedCurrency([
        { amount: member.savingsTotal.USD, currency: "USD" },
        { amount: member.savingsTotal.FC, currency: "FC" },
      ]),
      member.status,
    ]);
  }

  async function exportMembersCsv() {
    setExporting(true);
    setExportError(false);
    try {
      const allFilteredMembers = await fetchAllFilteredMembers();
      downloadReportCsv("membres-mwangaza-wetu", memberExportHeaders, rowsForExport(allFilteredMembers));
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  async function exportMembersPdf() {
    setExporting(true);
    setExportError(false);
    try {
      const allFilteredMembers = await fetchAllFilteredMembers();
      await downloadReportPdf("Liste des membres · Mwangaza Wetu", "membres-mwangaza-wetu", memberExportHeaders, rowsForExport(allFilteredMembers));
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function changeFilters(change: () => void) {
    change();
    setPage(1);
  }

  return (
    <>
      <div className="coop-page-heading coop-members-heading">
        <div>
          <CooperativeBreadcrumb
            section={t.membersTitle}
            current={t.membersTitle}
          />
          <h1>{t.membersTitle}</h1>
          <p>{t.membersDescription}</p>
        </div>
        <div className="coop-page-actions coop-export-actions">
          <button
            className="mw-secondary mw-export-pdf"
            type="button"
            onClick={exportMembersPdf}
            disabled={loading || loadError || totalMembers === 0 || exporting}
            title="Exporter la liste des membres en PDF"
          >
            <PdfFileIcon />
            {exporting ? "Préparation…" : "Exporter PDF"}
          </button>
          <button
            className="mw-secondary mw-export-excel"
            type="button"
            onClick={exportMembersCsv}
            disabled={loading || loadError || totalMembers === 0 || exporting}
            title="Exporter la liste des membres en CSV / Excel"
          >
            <ExcelFileIcon />
            {exporting ? "Préparation…" : "Exporter CSV"}
          </button>
          <button
            className="mw-primary"
            type="button"
            onClick={() => setEnrollmentOpen(true)}
          >
            <IconUserPlus aria-hidden="true" />
            {t.newMember}
          </button>
        </div>
      </div>

      <section className="coop-stat-grid coop-members-stats" aria-label={t.membersTitle} aria-busy={statsLoading}>
          <CooperativeStatCard
            label={t.totalMembers}
            value={statsError ? "—" : memberStats.total}
            detail=""
            trend=""
            icon={IconUsers}
            accent="var(--mw-primary)"
            loading={statsLoading}
          />
          <CooperativeStatCard
            label={t.activeMembers}
            value={statsError ? "—" : memberStats.actifs}
            detail=""
            trend=""
            icon={IconCircleCheck}
            accent="var(--mw-green)"
            loading={statsLoading}
          />
          <CooperativeStatCard
            label="Membres inactifs"
            value={statsError ? "—" : memberStats.inactifs}
            detail=""
            trend=""
            icon={IconAlertTriangle}
            accent="var(--mw-amber)"
            loading={statsLoading}
          />
          <CooperativeStatCard
            label="Nouveaux ce mois-ci"
            value={statsError ? "—" : memberStats.nouveauxCeMois}
            detail=""
            trend=""
            icon={IconArrowDown}
            accent="var(--mw-primary)"
            loading={statsLoading}
          />
      </section>
      {statsError && <p className="coop-members-inline-error" role="alert">Les indicateurs sont temporairement indisponibles. Une nouvelle tentative sera faite automatiquement.</p>}

      <section
        className="mw-panel coop-members-panel"
        aria-label={t.membersTitle}
      >
        {exportError && <p className="coop-inline-error" role="alert">L’export n’a pas abouti. Vérifiez la connexion au serveur puis réessayez.</p>}
        <div className="coop-filter-bar">
          <label className="coop-filter-search">
            <IconSearch aria-hidden="true" />
            <input
              type="search"
              value={query}
              aria-label={t.searchMembers}
              placeholder={t.searchMembers}
              onChange={(event) =>
                changeFilters(() => setQuery(event.target.value))
              }
            />
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">{t.statusFilter}</span>
            <select
              value={status}
              onChange={(event) =>
                changeFilters(() => setStatus(event.target.value))
              }
            >
              <option value="">{t.statusFilter}</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">{t.accountFilter}</span>
            <select
              value={account}
              onChange={(event) =>
                changeFilters(() =>
                  setAccount(event.target.value as AccountSlug | ""),
                )
              }
            >
              <option value="">{t.accountFilter}</option>
              {accountSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {accountConfigs[slug].shortLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="coop-filter-select coop-sort-select">
            <IconArrowsDownUp aria-hidden="true" />
            <span className="sr-only">{t.sortBy}</span>
            <select
              value={sort}
              onChange={(event) =>
                changeFilters(() => setSort(event.target.value))
              }
            >
              <option value="recent">{t.sortRecent}</option>
              <option value="name">{t.sortName}</option>
            </select>
          </label>
        </div>
          <div className="coop-table-scroll">
            <table className="mw-table coop-members-table" aria-busy={loading}>
              <thead>
                <tr>
                  <th>{t.membersTitle}</th>
                  <th>{t.memberNumber}</th>
                  <th>{t.phone}</th>
                  <th>{t.joinDate}</th>
                  <th>{t.accounts}</th>
                  <th>{t.savings}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: Math.min(pageSize, 4) }, (_, index) => (
                    <tr className="coop-members-skeleton-row" key={`member-skeleton-${index}`} aria-hidden="true">
                      <td><span className="coop-skeleton-member"><span className="coop-skeleton-avatar" /><span className="coop-skeleton-member-copy"><span className="coop-skeleton-block coop-skeleton-name" /><span className="coop-skeleton-block coop-skeleton-subline" /></span></span></td>
                      <td><span className="coop-skeleton-block coop-skeleton-number" /></td>
                      <td><span className="coop-skeleton-block coop-skeleton-phone" /></td>
                      <td><span className="coop-skeleton-block coop-skeleton-date" /></td>
                      <td><span className="coop-skeleton-pill" /></td>
                      <td><span className="coop-skeleton-amounts"><span className="coop-skeleton-block coop-skeleton-amount" /><span className="coop-skeleton-block coop-skeleton-amount-small" /></span></td>
                      <td><span className="coop-skeleton-status" /></td>
                    </tr>
                  ))
                ) : loadError ? (
                  <tr><td colSpan={7}><div className="coop-members-table-state" role="alert"><span>La liste des membres n’a pas pu être chargée.</span><button type="button" className="mw-secondary" onClick={() => { setLoadErrorKey(""); setLoadedQueryKey(""); setReloadToken((value) => value + 1); }}>Réessayer</button></div></td></tr>
                ) : totalMembers === 0 ? (
                  <tr><td colSpan={7}><div className="coop-members-table-state" role="status">{t.noMembers}</div></td></tr>
                ) : pageMembers.map((member) => (
                  <tr
                    key={member.id}
                    tabIndex={0}
                    aria-label={`${member.name}, ${member.memberNumber}`}
                    onClick={() => { setRequestedMemberId(null); setSelectedMember(member); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setRequestedMemberId(null);
                        setSelectedMember(member);
                      }
                    }}
                  >
                    <td>
                      <span className="mw-member">
                        <span className="mw-member-avatar">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="coop-member-primary">
                          <strong>{member.name}</strong>
                          <span className={`coop-biometric-status${member.empreinteEnregistree ? " is-registered" : " is-pending"}`}>
                            <IconFingerprint aria-hidden="true" />
                            {member.empreinteEnregistree ? "Empreinte enregistrée" : "Empreinte à enregistrer"}
                          </span>
                          {member.alertesCredits.overdue > 0 ? (
                            <span className="coop-credit-alert is-overdue">
                              {member.alertesCredits.overdue} crédit{member.alertesCredits.overdue > 1 ? "s" : ""} en retard
                            </span>
                          ) : member.alertesCredits.dueSoon > 0 ? (
                            <span className="coop-credit-alert is-due-soon">
                              Échéance sous 30 jours
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td>{member.memberNumber}</td>
                    <td>{member.phone}</td>
                    <td>{formatDate(member.joinedAt)}</td>
                    <td>
                      {accountSlugs.some((slug) => member.accountTypes.some((type) => type.toLocaleLowerCase("fr-FR").includes(slug)))
                        ? <AccountPills showLabels accounts={accountSlugs.filter((slug) => member.accountTypes.some((type) => type.toLocaleLowerCase("fr-FR").includes(slug)))} />
                        : <span title={member.accountTypes.join(", ") || undefined}>{member.accountTypes.join(", ") || "—"}</span>}
                    </td>
                    <td className="coop-amount-cell">
                      <span className="coop-dual-amount">
                        <span>{formatCurrency(member.savingsTotal.USD, "USD")}</span>
                        <small>{formatCurrency(member.savingsTotal.FC, "FC")}</small>
                      </span>
                    </td>
                    <td>
                      <CooperativeStatus status={member.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        {!loading && !loadError && totalMembers > 0 && <CooperativePagination
          totalItems={totalMembers}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
          itemLabel={t.records}
          itemLabelSingular="membre"
          previousLabel={t.previous}
          nextLabel={t.next}
        />}
      </section>

      <Sheet
        open={Boolean(selectedMember)}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      >
        <SheetContent
          side="right"
          data-theme={dark ? "dark" : "light"}
          className="coop-member-drawer"
        >
          <SheetTitle className="coop-drawer-title">Fiche membre</SheetTitle>
          {selectedMember && (
            <MemberDetails
              member={selectedMember}
              onMemberUpdated={(updatedMember) => {
                setSelectedMember(updatedMember);
                setMembers((current) => current.map((item) =>
                  item.id === updatedMember.id ? updatedMember : item,
                ));
              }}
              onBiometricUpdated={() => {
                setSelectedMember((current) => current ? { ...current, empreinteEnregistree: true } : current);
                setMembers((current) => current.map((item) =>
                  item.id === selectedMember.id ? { ...item, empreinteEnregistree: true } : item,
                ));
              }}
              onPasswordReset={(credentials) => {
                setSelectedMember(null);
                setResetPasswordCredentials(credentials);
                setCopiedResetPassword(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <MemberEnrollmentDialog
        open={enrollmentOpen}
        onOpenChange={setEnrollmentOpen}
        dark={dark}
        t={memberEnrollmentFrenchCopy}
        onCreated={(credentials) => {
          setCreatedCredentials(credentials);
          setQuery("");
          setDebouncedQuery("");
          setStatus("");
          setAccount("");
          setSort("recent");
          setPage(1);
          setReloadToken((value) => value + 1);
          window.dispatchEvent(new Event("mwangaza:members-updated"));
        }}
      />
      <MemberCredentialsDialog
        credentials={createdCredentials}
        onClose={() => setCreatedCredentials(null)}
      />

      <Dialog open={Boolean(resetPasswordCredentials)} onOpenChange={(open) => { if (!open) setResetPasswordCredentials(null); }}>
        <DialogContent className="coop-agent-credentials-dialog">
          <DialogHeader>
            <span className="coop-agent-credentials-icon"><IconKey size={22} /></span>
            <DialogTitle>Mot de passe réinitialisé</DialogTitle>
            <DialogDescription>
              Remettez le nouveau mot de passe au membre {resetPasswordCredentials?.numeroCompte} par un moyen sûr. Il ne sera plus affiché après la fermeture.
            </DialogDescription>
          </DialogHeader>
          <div className="coop-agent-credentials-box">
            <span>Adresse e-mail</span><strong>{resetPasswordCredentials?.email || "Non renseignée"}</strong>
            <span>Mot de passe temporaire</span><code>{resetPasswordCredentials?.motDePasseTemporaire}</code>
          </div>
          <p className="coop-agent-credentials-warning">L’ancien mot de passe est maintenant invalide et les sessions ouvertes ont été révoquées. Conseillez au membre de modifier ce mot de passe après sa connexion.</p>
          <div className="coop-agent-dialog-actions">
            <button type="button" className="mw-dialog-cancel" onClick={() => setResetPasswordCredentials(null)}>Fermer</button>
            <button type="button" className="mw-primary" onClick={async () => {
              if (!resetPasswordCredentials) return;
              try {
                await navigator.clipboard.writeText(`Compte : ${resetPasswordCredentials.numeroCompte}\nE-mail : ${resetPasswordCredentials.email || "Non renseignée"}\nMot de passe temporaire : ${resetPasswordCredentials.motDePasseTemporaire}`);
                setCopiedResetPassword(true);
              } catch {
                setCopiedResetPassword(false);
              }
            }}>{copiedResetPassword ? "Mot de passe copié" : "Copier les identifiants"}</button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}

export default function MembersRoute() {
  return <MembersContent />;
}

type MemberHistoryPeriod = "all" | "30d" | "90d" | "year";

function dateFiltersForPeriod(period: MemberHistoryPeriod) {
  if (period === "all") return {};
  const today = new Date();
  const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const fromDate = period === "year"
    ? new Date(today.getFullYear(), 0, 1)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (period === "30d" ? 29 : 89));
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function transactionLabel(type: MemberTransaction["type"]) {
  if (type === "depot") return "Dépôt";
  if (type === "retrait") return "Retrait";
  return "Remboursement";
}

function transactionStatusLabel(status: string) {
  if (status === "COMPLETED") return "Effectué";
  if (status === "PENDING") return "En attente";
  if (status === "CANCELLED") return "Annulé";
  if (status === "FAILED") return "Échoué";
  return status;
}

function MemberFinancialHistory({ member }: { member: MemberRecord }) {
  const [transactions, setTransactions] = useState<MemberTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState("");
  const [currency, setCurrency] = useState("");
  const [period, setPeriod] = useState<MemberHistoryPeriod>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const dateFilters = dateFiltersForPeriod(period);
    apiClient.get<MemberTransactionsResponse>(`/membres/${member.id}/transactions`, {
      params: {
        page,
        pageSize,
        type: type || undefined,
        currency: currency || undefined,
        ...dateFilters,
      },
    }).then((response) => {
      if (!active) return;
      setTransactions(response.data.data);
      setTotal(response.data.meta.total);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [currency, member.id, page, pageSize, period, retry, type]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setPage(1);
    setter(value);
  }

  return (
    <section className="coop-drawer-section coop-member-finance-section" aria-labelledby="coop-member-history-title">
      <div className="coop-drawer-section-heading coop-member-history-heading">
        <div>
          <h3 id="coop-member-history-title">Historique financier</h3>
          {!loading && !error && <span>{total} {total === 1 ? "opération" : "opérations"}</span>}
        </div>
        <div className="coop-member-finance-actions">
          <Link href="/operations/depots-cotisations">Dépôt</Link>
          <Link href="/operations/retraits">Retrait</Link>
          <Link href="/operations/remboursements">Remboursement</Link>
        </div>
      </div>
      <div className="coop-member-history-filters" aria-label="Filtres de l’historique">
        <label><span className="sr-only">Type d’opération</span><select value={type} onChange={(event) => updateFilter(setType, event.target.value)}>
          <option value="">Tous les types</option><option value="depot">Dépôts</option><option value="retrait">Retraits</option><option value="remboursement">Remboursements</option>
        </select></label>
        <label><span className="sr-only">Période</span><select value={period} onChange={(event) => { setPage(1); setPeriod(event.target.value as MemberHistoryPeriod); }}>
          <option value="all">Toutes les périodes</option><option value="30d">30 derniers jours</option><option value="90d">90 derniers jours</option><option value="year">Cette année</option>
        </select></label>
        <label><span className="sr-only">Devise</span><select value={currency} onChange={(event) => updateFilter(setCurrency, event.target.value)}>
          <option value="">Toutes les devises</option><option value="USD">USD</option><option value="FC">FC</option>
        </select></label>
      </div>
      {loading ? (
        <div className="coop-member-history-loading" aria-label="Chargement de l’historique" aria-busy="true">
          {[0, 1, 2].map((item) => <span key={item} />)}
        </div>
      ) : error ? (
        <div className="coop-member-finance-state" role="alert">
          <span>L’historique n’a pas pu être chargé.</span>
          <button type="button" className="mw-secondary" onClick={() => setRetry((value) => value + 1)}>Réessayer</button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="coop-member-finance-state">Aucune opération pour ces filtres.</div>
      ) : (
        <>
          <ul className="coop-member-transaction-list">
            {transactions.map((transaction) => (
              <li key={transaction.id}>
                <div className="coop-member-transaction-copy">
                  <strong>{transactionLabel(transaction.type)}</strong>
                  <span>{formatDate(transaction.date)} · {transaction.description}</span>
                </div>
                <div className="coop-member-transaction-value">
                  <strong>{formatCurrency(transaction.montant, transaction.devise)}</strong>
                  <span className={`coop-member-transaction-status${transaction.statut === "COMPLETED" ? " is-complete" : ""}`}>{transactionStatusLabel(transaction.statut)}</span>
                </div>
              </li>
            ))}
          </ul>
          <CooperativePagination
            totalItems={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
            itemLabel="opérations"
            itemLabelSingular="opération"
          />
        </>
      )}
    </section>
  );
}

function creditAmounts(credit: MemberCreditRecord) {
  const principal = Number(credit.montant) || 0;
  const paid = Number(credit.montantRembourse) || 0;
  const totalDue = principal * (1 + (Number(credit.tauxInteret) || 0) / 100);
  const remaining = Math.max(0, totalDue - paid);
  const dueDate = credit.dateEcheance ? new Date(credit.dateEcheance) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = remaining > 0 && (credit.statut === "en_retard" || Boolean(dueDate && dueDate < today));
  const dueDay = dueDate ? new Date(dueDate) : null;
  dueDay?.setHours(0, 0, 0, 0);
  const daysUntilDue = dueDay ? Math.round((dueDay.getTime() - today.getTime()) / 86_400_000) : null;
  const isDueSoon = remaining > 0 && !isOverdue && daysUntilDue !== null && daysUntilDue <= 30;
  const isRepaid = remaining <= 0 || credit.statut === "rembourse";
  return { principal, paid, totalDue, remaining, dueDate, isOverdue, isDueSoon, isRepaid, daysUntilDue };
}

function MemberCreditFollowUp({ member }: { member: MemberRecord }) {
  const [credits, setCredits] = useState<MemberCreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    apiClient.get<MemberCreditRecord[]>(`/credits/membre/${encodeURIComponent(member.memberNumber)}`)
      .then((response) => { if (active) setCredits(response.data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [member.id, member.memberNumber, retry]);

  const overdueCount = credits.filter((credit) => creditAmounts(credit).isOverdue).length;
  const dueSoonCount = credits.filter((credit) => creditAmounts(credit).isDueSoon).length;

  return (
    <section className="coop-drawer-section coop-member-credit-section" aria-labelledby="coop-member-credit-title">
      <div className="coop-drawer-section-heading coop-member-credit-heading">
        <div>
          <h3 id="coop-member-credit-title">Crédits et échéances</h3>
          {!loading && !error && <span>{overdueCount > 0 ? `${overdueCount} en retard` : dueSoonCount > 0 ? `${dueSoonCount} échéance${dueSoonCount > 1 ? "s" : ""} sous 30 jours` : "Suivi des remboursements"}</span>}
        </div>
        <Link href="/operations/remboursements">Suivre les remboursements</Link>
      </div>
      {loading ? (
        <div className="coop-member-history-loading" aria-label="Chargement des crédits" aria-busy="true"><span /><span /></div>
      ) : error ? (
        <div className="coop-member-finance-state" role="alert">
          <span>Les crédits n’ont pas pu être chargés.</span>
          <button type="button" className="mw-secondary" onClick={() => setRetry((value) => value + 1)}>Réessayer</button>
        </div>
      ) : credits.length === 0 ? (
        <div className="coop-member-finance-state">Aucun crédit enregistré.</div>
      ) : (
        <ul className="coop-member-credit-list">
          {credits.map((credit) => {
            const amounts = creditAmounts(credit);
            const status = amounts.isRepaid
              ? { label: "Soldé", tone: "is-complete" }
              : amounts.isOverdue
                ? { label: "En retard", tone: "is-overdue" }
                : amounts.isDueSoon
                  ? { label: amounts.daysUntilDue === 0 ? "Échéance aujourd’hui" : `Dans ${amounts.daysUntilDue} j`, tone: "is-due-soon" }
                  : { label: "En cours", tone: "is-current" };
            const progress = amounts.totalDue > 0 ? Math.min(100, (amounts.paid / amounts.totalDue) * 100) : 0;
            return (
              <li key={credit.id}>
                <div className="coop-member-credit-topline">
                  <strong>Crédit #{credit.id}</strong>
                  <span className={`coop-credit-alert ${status.tone}`}>{status.label}</span>
                </div>
                <div className="coop-member-credit-dates">
                  <span>Accordé le {formatDate(credit.dateDebut)}</span>
                  <span>{amounts.dueDate ? `Échéance le ${formatDate(credit.dateEcheance!)}` : "Échéance non renseignée"}</span>
                </div>
                <div className="coop-member-credit-amounts">
                  <span><small>Montant dû</small><strong>{formatCurrency(amounts.remaining, credit.devise)}</strong></span>
                  <span><small>Remboursé</small><strong>{formatCurrency(amounts.paid, credit.devise)}</strong></span>
                  <span><small>Total à rembourser</small><strong>{formatCurrency(amounts.totalDue, credit.devise)}</strong></span>
                </div>
                <div className="coop-member-credit-progress" role="progressbar" aria-label={`Remboursement du crédit ${credit.id}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MemberDetails({
  member,
  onMemberUpdated,
  onBiometricUpdated,
  onPasswordReset,
}: {
  member: MemberRecord;
  onMemberUpdated: (updatedMember: MemberRecord) => void;
  onBiometricUpdated: () => void;
  onPasswordReset: (credentials: ResetPasswordCredentials) => void;
}) {
  const dark = useCooperativeDarkTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileDraft, setProfileDraft] = useState(() => ({
    name: member.name,
    phone: member.phone,
    email: member.email,
    address: member.address,
    sexe: member.sexe ?? "",
    activity: member.activite ?? "",
    dateNaissance: member.dateNaissance?.slice(0, 10) ?? "",
    idNationale: member.idNationale ?? "",
  }));
  const [capturingFingerprint, setCapturingFingerprint] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");

  function openProfileEditor() {
    setProfileDraft({
      name: member.name,
      phone: member.phone,
      email: member.email,
      address: member.address,
      sexe: member.sexe ?? "",
      activity: member.activite ?? "",
      dateNaissance: member.dateNaissance?.slice(0, 10) ?? "",
      idNationale: member.idNationale ?? "",
    });
    setProfileError("");
    setEditOpen(true);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileDraft.name.trim();
    const phone = profileDraft.phone.trim();
    if (!name || !phone) {
      setProfileError("Le nom et le téléphone sont obligatoires.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    const payload = {
      nomComplet: name,
      telephone: phone,
      email: profileDraft.email.trim() || null,
      adresse: profileDraft.address.trim() || null,
      sexe: profileDraft.sexe || null,
      activite: profileDraft.activity.trim() || null,
      dateNaissance: profileDraft.dateNaissance || null,
      idNationale: profileDraft.idNationale.trim() || null,
    };

    try {
      await apiClient.put(`/membres/${member.id}`, payload);
      onMemberUpdated({
        ...member,
        name,
        phone,
        email: profileDraft.email.trim(),
        address: profileDraft.address.trim(),
        sexe: profileDraft.sexe || null,
        activite: profileDraft.activity.trim(),
        dateNaissance: profileDraft.dateNaissance || null,
        idNationale: profileDraft.idNationale.trim(),
      });
      setEditOpen(false);
    } catch (error: unknown) {
      const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setProfileError(
        Array.isArray(responseMessage)
          ? responseMessage.join(" ")
          : responseMessage || "La fiche n’a pas pu être mise à jour. Vérifiez les informations et réessayez.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function captureFingerprint() {
    setCapturingFingerprint(true);
    setFingerprintError("");
    try {
      const capture = await apiClient.post<{ userId: string }>("/zkteco/capture-fingerprint");
      const userId = String(capture.data.userId || "").trim();
      if (!userId) throw new Error("Aucun identifiant biométrique n’a été retourné par le lecteur.");

      const check = await apiClient.get<{ exists: boolean; where: string | null }>(
        `/membres/check-userid/${encodeURIComponent(userId)}`,
        { params: { exclude: member.id } },
      );
      if (check.data.exists) {
        throw new Error(`Cette empreinte est déjà enregistrée pour un autre ${check.data.where || "profil"}.`);
      }

      await apiClient.put(`/membres/${member.id}`, { userId });
      onBiometricUpdated();
    } catch (error: unknown) {
      const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const message = Array.isArray(responseMessage) ? responseMessage.join(" ") : responseMessage;
      setFingerprintError(
        message || (error instanceof Error ? error.message : "La capture de l’empreinte a échoué. Réessayez."),
      );
    } finally {
      setCapturingFingerprint(false);
    }
  }

  async function resetPassword() {
    if (!window.confirm(`Réinitialiser le mot de passe de ${member.name} ? Son mot de passe actuel et ses sessions seront invalidés.`)) return;
    setResettingPassword(true);
    setPasswordResetError("");
    try {
      const response = await apiClient.post<ResetPasswordCredentials>(`/membres/${member.id}/reset-password`);
      onPasswordReset(response.data);
    } catch (error: unknown) {
      const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setPasswordResetError(Array.isArray(responseMessage) ? responseMessage.join(" ") : responseMessage || "La réinitialisation du mot de passe a échoué. Réessayez.");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="coop-drawer-content">
      <div className="coop-drawer-member">
        <span className="mw-member-avatar">
          {member.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <strong>{member.name}</strong>
          <span>{member.memberNumber}</span>
        </div>
        <CooperativeStatus status={member.status} />
      </div>
      <section className="coop-drawer-section coop-member-overview" aria-labelledby="coop-member-overview-title">
        <h3 id="coop-member-overview-title">Vue d’ensemble</h3>
        <div className="coop-member-overview-grid">
          <div><span>Adhésion</span><strong>{formatDate(member.joinedAt)}</strong></div>
          <div><span>Comptes détenus</span><strong>{member.accountTypes.length} {member.accountTypes.length === 1 ? "compte" : "comptes"}</strong><small>{member.accountTypes.join(", ") || "Aucun compte"}</small></div>
          <div><span>Solde USD</span><strong>{formatCurrency(member.savingsTotal.USD, "USD")}</strong></div>
          <div><span>Solde FC</span><strong>{formatCurrency(member.savingsTotal.FC, "FC")}</strong></div>
        </div>
      </section>
      <section className="coop-drawer-section">
        <div className="coop-drawer-section-heading">
          <h3>Profil</h3>
          <button type="button" className="mw-secondary" onClick={openProfileEditor}>
            Modifier le profil
          </button>
        </div>
        <dl className="coop-detail-list">
          <div>
            <dt>{t.phone}</dt>
            <dd>{member.phone}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{member.email || "Non renseigné"}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>{member.address || "Non renseignée"}</dd>
          </div>
          <div>
            <dt>Sexe</dt>
            <dd>{member.sexe || "Non renseigné"}</dd>
          </div>
          <div>
            <dt>Activité</dt>
            <dd>{member.activite || "Non renseignée"}</dd>
          </div>
          <div>
            <dt>Pièce d’identité</dt>
            <dd>{member.idNationale || "Non renseignée"}</dd>
          </div>
          <div>
            <dt>Date de naissance</dt>
            <dd>{member.dateNaissance ? formatDate(member.dateNaissance.slice(0, 10)) : "Non renseignée"}</dd>
          </div>
        </dl>
      </section>
      <MemberFinancialHistory member={member} />
      <MemberCreditFollowUp member={member} />
      <Dialog open={editOpen} onOpenChange={(open) => { if (!savingProfile) setEditOpen(open); }}>
        <DialogContent data-theme={dark ? "dark" : "light"} className="mw-dialog-content coop-member-edit-dialog">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>Corrigez les coordonnées et informations personnelles du membre.</DialogDescription>
          </DialogHeader>
          <form className="coop-member-edit-form" onSubmit={(event) => void saveProfile(event)}>
            <label><span>Nom complet</span><input autoComplete="name" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} required maxLength={120} /></label>
            <label><span>Téléphone</span><input autoComplete="tel" inputMode="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} required maxLength={30} /></label>
            <label><span>E-mail</span><input type="email" autoComplete="email" value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} maxLength={160} /></label>
            <label><span>Adresse</span><input autoComplete="street-address" value={profileDraft.address} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} maxLength={250} /></label>
            <label><span>Sexe</span><select value={profileDraft.sexe} onChange={(event) => setProfileDraft((current) => ({ ...current, sexe: event.target.value }))}><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="AUTRE">Autre</option></select></label>
            <label><span>Activité</span><input value={profileDraft.activity} onChange={(event) => setProfileDraft((current) => ({ ...current, activity: event.target.value }))} maxLength={120} /></label>
            <label><span>Pièce d’identité</span><input value={profileDraft.idNationale} onChange={(event) => setProfileDraft((current) => ({ ...current, idNationale: event.target.value }))} maxLength={80} /></label>
            <label><span>Date de naissance</span><input type="date" value={profileDraft.dateNaissance} onChange={(event) => setProfileDraft((current) => ({ ...current, dateNaissance: event.target.value }))} /></label>
            {profileError && <p className="coop-biometric-error" role="alert">{profileError}</p>}
            <div className="coop-member-edit-actions">
              <button type="button" className="mw-dialog-cancel" onClick={() => setEditOpen(false)} disabled={savingProfile}>Annuler</button>
              <button type="submit" className="mw-primary" disabled={savingProfile}>{savingProfile ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <section className="coop-drawer-section coop-drawer-security" aria-labelledby="coop-member-biometric-title">
        <h3 id="coop-member-biometric-title">Sécurité et accès</h3>
        <div className="coop-drawer-security-item">
          <h4>Empreinte biométrique</h4>
        {member.empreinteEnregistree ? (
          <CooperativeStatus status="Enregistrée" />
        ) : (
          <>
            <p className="coop-biometric-pending-note">
              En attente de capture au bureau. Les dépôts sont autorisés, mais les retraits restent bloqués.
            </p>
            <button
              type="button"
              className="mw-secondary"
              onClick={captureFingerprint}
              disabled={capturingFingerprint}
            >
              <IconFingerprint aria-hidden="true" />
              {capturingFingerprint ? "Placez le doigt sur le lecteur…" : "Capturer l’empreinte"}
            </button>
            {fingerprintError && <p className="coop-biometric-error" role="alert">{fingerprintError}</p>}
          </>
        )}
        </div>
        <div className="coop-drawer-security-item" aria-labelledby="coop-member-password-title">
          <h4 id="coop-member-password-title">Accès au compte</h4>
          <p className="coop-biometric-pending-note">Générez un mot de passe temporaire si le membre a perdu l’accès à son compte.</p>
          <button type="button" className="mw-secondary" onClick={() => void resetPassword()} disabled={resettingPassword}>
            <IconKey aria-hidden="true" />
            {resettingPassword ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
          </button>
          {passwordResetError && <p className="coop-biometric-error" role="alert">{passwordResetError}</p>}
        </div>
      </section>
    </div>
  );
}
