'use client';

import {
  IconArrowDown,
  IconReceipt,
  IconSearch,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
import { CooperativePagination } from "@/components/cooperative/CooperativePagination";
import {
  AccountPills,
  CooperativeBreadcrumb,
  CooperativeStatCard,
  formatCurrency,
  formatDate,
} from "@/components/cooperative/CooperativePrimitives";
import { useCooperativeDarkTheme } from "@/components/cooperative/CooperativeThemeContext";
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { apiClient } from "@/lib/auth";
import { downloadReportCsv, downloadReportPdf } from "@/lib/cooperative-report-export";

type DepositRecord = {
  id: number;
  compte: string;
  typeOperation: "depot" | "retrait";
  devise: "USD" | "FC";
  montant: number | string;
  dateOperation: string;
  description: string | null;
  executeParRole?: string | null;
  membre?: {
    id: number;
    nomComplet: string;
    numeroCompte: string;
    typeCompte: string;
  } | null;
};

type DepositResponse = {
  data: DepositRecord[];
  meta: { total: number; totalPages: number };
};

const periods = ["Aujourd’hui", "Toutes les périodes", "Ce mois", "30 derniers jours"] as const;

export function meta() {
  return [{ title: "Dépôts & cotisations — Mwangaza Wetu" }];
}

function accountSlugFor(record: DepositRecord): AccountSlug | null {
  const normalized = record.membre?.typeCompte?.trim().toLocaleLowerCase("fr-FR");
  return accountSlugs.find((slug) => slug === normalized) ?? null;
}

function actorLabel(role?: string | null) {
  if (role === "agent") return "Agent";
  if (role) return "Administration";
  return "—";
}

export default function DepositsContributionsRoute() {
  const dark = useCooperativeDarkTheme();
  const [records, setRecords] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<AccountSlug | "">("");
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[2]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadDeposits() {
    setLoading(true);
    setLoadError("");
    try {
      const allRecords: DepositRecord[] = [];
      let currentPage = 1;
      let totalPages = 1;
      do {
        const response = await apiClient.get<DepositResponse>("/epargnes", {
          params: { page: currentPage, pageSize: 100, type: "depot" },
        });
        allRecords.push(...response.data.data);
        totalPages = response.data.meta.totalPages || 1;
        currentPage += 1;
      } while (currentPage <= totalPages);
      setRecords(allRecords);
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setLoadError(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Impossible de charger les dépôts depuis le backend.",
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDeposits();
  }, []);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);
  const thirtyDaysKey = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr-FR");
    return records
      .filter((record) => {
        const reference = `DEP-${record.id}`;
        return `${record.membre?.nomComplet || ""} ${record.compte} ${reference} ${record.description || ""}`
          .toLocaleLowerCase("fr-FR")
          .includes(search);
      })
      .filter((record) => !account || accountSlugFor(record) === account)
      .filter((record) => {
        const date = record.dateOperation.slice(0, 10);
        if (period === periods[0]) return date === todayKey;
        if (period === periods[1]) return true;
        if (period === periods[2]) return date.startsWith(monthKey);
        return date >= thirtyDaysKey;
      });
  }, [account, monthKey, period, query, records, thirtyDaysKey, todayKey]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const currentMonth = records.filter((record) => record.dateOperation.startsWith(monthKey));
  const monthUsd = currentMonth
    .filter((record) => record.devise === "USD")
    .reduce((sum, record) => sum + Number(record.montant), 0);
  const monthFc = currentMonth
    .filter((record) => record.devise === "FC")
    .reduce((sum, record) => sum + Number(record.montant), 0);
  const memberCount = new Set(currentMonth.map((record) => record.membre?.id).filter(Boolean)).size;
  const depositExportHeaders = ["Référence", "Membre", "Compte", "Type", "Montant", "Date", "Enregistré par"];
  const depositExportRows = filtered.map((record) => [
    `DEP-${record.id}`,
    record.membre?.nomComplet || "Membre introuvable",
    record.compte,
    "Dépôt",
    formatCurrency(Number(record.montant), record.devise),
    formatDate(record.dateOperation),
    actorLabel(record.executeParRole),
  ]);

  function exportDepositsCsv() {
    downloadReportCsv("journal-depots-cotisations", depositExportHeaders, depositExportRows);
  }

  async function exportDepositsPdf() {
    await downloadReportPdf("Journal des dépôts & cotisations · Mwangaza Wetu", "journal-depots-cotisations", depositExportHeaders, depositExportRows);
  }

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <div className="coop-operations-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Dépôts & cotisations" />
          <h1>Dépôts & cotisations</h1>
          <p>Suivi des dépôts enregistrés dans le journal de la coopérative.</p>
        </div>
        <div className="coop-page-actions coop-export-actions">
          <button className="mw-secondary" type="button" onClick={exportDepositsPdf} disabled={loading || Boolean(loadError) || filtered.length === 0}>
            <IconReceipt aria-hidden="true" /> Exporter PDF
          </button>
          <button className="mw-secondary" type="button" onClick={exportDepositsCsv} disabled={loading || Boolean(loadError) || filtered.length === 0}>
            <IconReceipt aria-hidden="true" /> Exporter CSV
          </button>
          <Link className="mw-primary" href="/comptes-epargne/principal">
            <IconArrowDown aria-hidden="true" /> Nouveau dépôt
          </Link>
        </div>
      </div>

      <section className="coop-stat-grid" aria-label="Indicateurs réels des dépôts">
        <CooperativeStatCard
          label="Dépôts USD ce mois"
          value={formatCurrency(monthUsd, "USD")}
          detail="Selon le journal des opérations"
          icon={IconArrowDown}
        />
        <CooperativeStatCard
          label="Dépôts FC ce mois"
          value={formatCurrency(monthFc, "FC")}
          detail="Selon le journal des opérations"
          icon={IconArrowDown}
          accent="#16834a"
        />
        <CooperativeStatCard
          label="Dépôts enregistrés"
          value={records.length}
          detail="Toutes périodes et devises"
          icon={IconReceipt}
        />
        <CooperativeStatCard
          label="Membres concernés ce mois"
          value={memberCount}
          detail="Membres distincts"
          icon={IconReceipt}
        />
      </section>

      <section className="mw-panel coop-operations-panel" aria-label="Liste réelle des dépôts">
        <div className="coop-filter-bar">
          <label className="coop-filter-search">
            <IconSearch aria-hidden="true" />
            <input
              type="search"
              value={query}
              aria-label="Rechercher un membre, un compte ou une référence"
              placeholder="Membre, compte ou référence…"
              onChange={(event) => changeFilter(() => setQuery(event.target.value))}
            />
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Compte d’épargne</span>
            <select value={account} onChange={(event) => changeFilter(() => setAccount(event.target.value as AccountSlug | ""))}>
              <option value="">Tous les comptes</option>
              {accountSlugs.map((slug) => <option key={slug} value={slug}>{accountConfigs[slug].shortLabel}</option>)}
            </select>
          </label>
          <label className="coop-filter-select">
            <span className="sr-only">Période</span>
            <select value={period} onChange={(event) => changeFilter(() => setPeriod(event.target.value as (typeof periods)[number]))}>
              {periods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {loadError && <p className="coop-form-error" role="alert">{loadError} <button type="button" onClick={() => void loadDeposits()}>Réessayer</button></p>}

        <CooperativeDataState loading={loading} error={Boolean(loadError)} empty={filtered.length === 0} emptyMessage={records.length === 0 ? "Aucun dépôt réel n’est enregistré pour le moment." : "Aucun dépôt ne correspond à ces filtres."}>
          <div className="coop-table-scroll">
            <table className="mw-table coop-operation-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Membre</th>
                  <th>Compte</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Date</th>
                  <th>Enregistré par</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => {
                  const slug = accountSlugFor(record);
                  return (
                    <tr key={record.id}>
                      <td><strong>DEP-{record.id}</strong></td>
                      <td>
                        <span className="mw-member">
                          <span className="mw-member-avatar">{(record.membre?.nomComplet || "?").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                          <span>{record.membre?.nomComplet || "Membre introuvable"}<small>{record.compte}</small></span>
                        </span>
                      </td>
                      <td>
                        {slug ? <span className="coop-account-cell" style={{ "--coop-accent": accountConfigs[slug].color } as React.CSSProperties}><AccountPills accounts={[slug]} />{accountConfigs[slug].shortLabel}</span> : "Compte membre"}
                      </td>
                      <td>Dépôt</td>
                      <td className="coop-amount-cell">{formatCurrency(Number(record.montant), record.devise)}</td>
                      <td>{formatDate(record.dateOperation)}</td>
                      <td>{actorLabel(record.executeParRole)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CooperativeDataState>

        <CooperativePagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
          itemLabel="dépôts"
          previousLabel={t.previous}
          nextLabel={t.next}
        />
      </section>
    </div>
  );
}
