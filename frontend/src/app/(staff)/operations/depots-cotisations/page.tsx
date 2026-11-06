'use client';

import {
  IconArrowDown,
  IconCheck,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { apiClient } from "@/lib/auth";
import { downloadReportCsv, downloadReportPdf } from "@/lib/cooperative-report-export";
import { MWANGAZA_BRAND } from "@/lib/theme-constants";

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
  return [{ title: "Dépôts & Epargnes — Mwangaza Wetu" }];
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

  // Notifications et formulaires
  const [success, setSuccess] = useState("");

  // Modal Nouveau Dépôt
  const [createOpen, setCreateOpen] = useState(false);
  const [compteInput, setCompteInput] = useState("");
  const [memberCheck, setMemberCheck] = useState<{
    compte: string;
    nomComplet: string;
    typeCompte: string;
    soldeUSD: number;
    soldeFC: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Reçu de caisse à imprimer
  const [receiptTarget, setReceiptTarget] = useState<DepositRecord | null>(null);

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
    downloadReportCsv("journal-depots-Epargnes", depositExportHeaders, depositExportRows);
  }

  async function exportDepositsPdf() {
    await downloadReportPdf("Journal des dépôts & Epargnes · Mwangaza Wetu", "journal-depots-Epargnes", depositExportHeaders, depositExportRows);
  }

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  async function verifyMember() {
    const compte = compteInput.trim();
    if (!compte) {
      setFormError("Saisissez le numéro de compte du membre.");
      return;
    }
    setChecking(true);
    setMemberCheck(null);
    setFormError("");
    try {
      const response = await apiClient.get<{
        exists: boolean;
        membre?: { numeroCompte: string; nomComplet: string; statut: string; typeCompte: string };
      }>(`/membres/by-numero/${encodeURIComponent(compte)}`);
      const membre = response.data.exists ? response.data.membre : null;
      if (!membre) {
        setFormError("Aucun membre trouvé pour ce numéro de compte.");
        return;
      }
      if (membre.statut !== "actif") {
        setFormError("Ce membre est inactif : opération refusée.");
        return;
      }
      const soldes = await apiClient.get<{ soldeUSD: number; soldeFC: number }>(
        `/epargnes/soldes/${encodeURIComponent(membre.numeroCompte)}`,
      );
      setMemberCheck({
        compte: membre.numeroCompte,
        nomComplet: membre.nomComplet,
        typeCompte: membre.typeCompte || "PRINCIPAL",
        soldeUSD: Number(soldes.data.soldeUSD || 0),
        soldeFC: Number(soldes.data.soldeFC || 0),
      });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setFormError(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Impossible de vérifier ce compte.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function createDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const devise = String(form.get("devise")) as "USD" | "FC";
    const montant = Number(form.get("montant"));
    const description = String(form.get("description") || "").trim();
    const compte = compteInput.trim();

    if (!memberCheck || memberCheck.compte !== compte) {
      setFormError("Vérifiez d’abord le compte du membre.");
      return;
    }
    if (!(montant > 0)) {
      setFormError("Indiquez un montant supérieur à zéro.");
      return;
    }

    setCreateBusy(true);
    setFormError("");
    try {
      const dateOperation = new Date().toISOString();
      const payload = {
        compte,
        devise,
        montant,
        dateOperation,
        description: description || "Dépôt d'espèces au guichet",
        typeOperation: "depot",
        idempotencyKey: crypto.randomUUID(),
      };

      const response = await apiClient.post<DepositRecord>("/epargnes", payload);
      setCreateOpen(false);
      setCompteInput("");
      const savedMember = memberCheck;
      setMemberCheck(null);
      setSuccess(`Dépôt de ${formatCurrency(montant, devise)} enregistré avec succès pour ${savedMember.nomComplet}.`);

      // Préparer le reçu de caisse prêt pour impression
      const newRecord: DepositRecord = {
        id: response.data?.id || Date.now(),
        compte,
        typeOperation: "depot",
        devise,
        montant,
        dateOperation,
        description: payload.description,
        executeParRole: "agent",
        membre: {
          id: 0,
          nomComplet: savedMember.nomComplet,
          numeroCompte: compte,
          typeCompte: savedMember.typeCompte,
        },
      };
      setReceiptTarget(newRecord);
      await loadDeposits();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setFormError(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Le dépôt n’a pas pu être enregistré.",
      );
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="coop-operations-page">
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb section="Opérations" current="Dépôts & Epargnes" />
          <h1>Dépôts & Epargnes</h1>
          <p>Suivi des dépôts enregistrés dans le journal de la coopérative.</p>
        </div>
        <div className="coop-page-actions coop-export-actions">
          <button className="mw-secondary" type="button" onClick={exportDepositsPdf} disabled={loading || Boolean(loadError) || filtered.length === 0}>
            <IconReceipt aria-hidden="true" /> Exporter PDF
          </button>
          <button className="mw-secondary" type="button" onClick={exportDepositsCsv} disabled={loading || Boolean(loadError) || filtered.length === 0}>
            <IconReceipt aria-hidden="true" /> Exporter CSV
          </button>
          {/* Ouvre directement le modal de dépôt sur la page sans redirection */}
          <button
            className="mw-primary"
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setFormError("");
              setMemberCheck(null);
              setCompteInput("");
            }}
          >
            <IconArrowDown aria-hidden="true" /> Nouveau dépôt
          </button>
        </div>
      </div>

      {success && (
        <div className="coop-inline-success" role="status">
          <IconCheck aria-hidden="true" />
          {success}
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setSuccess("")}
          >
            <IconX aria-hidden="true" />
          </button>
        </div>
      )}

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
                  <th>Action</th>
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
                      <td>
                        <button
                          className="mw-ghost coop-icon-btn"
                          type="button"
                          title="Imprimer le reçu de versement"
                          aria-label={`Imprimer le reçu de dépôt DEP-${record.id}`}
                          onClick={() => setReceiptTarget(record)}
                        >
                          <IconPrinter aria-hidden="true" size={16} />
                        </button>
                      </td>
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

      {/* Modal Nouveau Dépôt Direct */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="mw-dialog-content coop-action-dialog coop-operation-dialog"
        >
          <DialogHeader>
            <DialogTitle>Nouveau versement / dépôt</DialogTitle>
            <DialogDescription>
              Enregistrez un versement d&apos;espèces sur le compte d&apos;un membre de la coopérative.
            </DialogDescription>
          </DialogHeader>

          <form className="coop-operation-form" onSubmit={createDeposit}>
            <div className="coop-form-field">
              <label htmlFor="depot-compte">Numéro de compte du membre</label>
              <span className="coop-form-grid">
                <input
                  id="depot-compte"
                  value={compteInput}
                  onChange={(event) => {
                    setCompteInput(event.target.value);
                    setMemberCheck(null);
                  }}
                  placeholder="Ex. MW-PRI-0001"
                  required
                />
                <button
                  className="mw-secondary"
                  type="button"
                  onClick={() => void verifyMember()}
                  disabled={checking}
                >
                  {checking ? "Vérification…" : "Vérifier"}
                </button>
              </span>
            </div>

            {memberCheck && (
              <div className="coop-credit-eligibility">
                <span>Membre</span>
                <strong>{memberCheck.nomComplet}</strong>
                <span>Section / Type</span>
                <strong>{memberCheck.typeCompte}</strong>
                <span>Solde actuel</span>
                <strong>
                  {formatCurrency(memberCheck.soldeUSD, "USD")} ·{" "}
                  {formatCurrency(memberCheck.soldeFC, "FC")}
                </strong>
              </div>
            )}

            <div className="coop-form-grid">
              <label className="coop-form-field">
                Montant à verser
                <input
                  name="montant"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </label>
              <label className="coop-form-field">
                Devise
                <select name="devise" defaultValue="USD" required>
                  <option value="USD">USD</option>
                  <option value="FC">FC</option>
                </select>
              </label>
            </div>

            <label className="coop-form-field">
              Motif / Libellé
              <textarea
                name="description"
                rows={2}
                placeholder="Ex. Dépôt d'espèces au guichet"
              />
            </label>

            {formError && (
              <p className="coop-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="coop-form-actions">
              <button
                className="mw-secondary"
                type="button"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </button>
              <button
                className="mw-primary"
                type="submit"
                disabled={createBusy || !memberCheck}
              >
                {createBusy ? "Enregistrement…" : "Valider le versement"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Reçu de Versement Officiel (Impression) */}
      <Dialog
        open={receiptTarget !== null}
        onOpenChange={(open) => !open && setReceiptTarget(null)}
      >
        <DialogContent
          data-theme={dark ? "dark" : "light"}
          className="coop-receipt-dialog"
        >
          <DialogHeader>
            <DialogTitle>Bordereau de versement / Dépôt</DialogTitle>
            <DialogDescription>
              Reçu officiel de versement pour le membre et la caisse.
            </DialogDescription>
          </DialogHeader>

          {receiptTarget && (
            <div className="coop-print-receipt">
              <div className="coop-receipt-brand">
                <div className="coop-receipt-mark">MW</div>
                <div>
                  <strong>{MWANGAZA_BRAND.name.toUpperCase()}</strong>
                  <small>{MWANGAZA_BRAND.subtitle}</small>
                  <small>{MWANGAZA_BRAND.pillars}</small>
                </div>
              </div>

              <div className="coop-receipt-rule" />

              <h3>BORDEREAU DE VERSEMENT D’ESPÈCES</h3>

              <div className="coop-receipt-total" style={{ color: "#16a34a" }}>
                + {formatCurrency(Number(receiptTarget.montant), receiptTarget.devise)}
              </div>

              <dl>
                <div>
                  <dt>Réf. opération</dt>
                  <dd><strong>DEP-{receiptTarget.id}</strong></dd>
                </div>
                <div>
                  <dt>Date & Heure</dt>
                  <dd>{formatDate(receiptTarget.dateOperation)}</dd>
                </div>
                <div>
                  <dt>Compte membre</dt>
                  <dd><strong>{receiptTarget.compte}</strong></dd>
                </div>
                <div>
                  <dt>Titulaire</dt>
                  <dd>{receiptTarget.membre?.nomComplet || "Membre"}</dd>
                </div>
                <div>
                  <dt>Montant versé</dt>
                  <dd>
                    <strong>{formatCurrency(Number(receiptTarget.montant), receiptTarget.devise)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Type d&apos;opération</dt>
                  <dd>DÉPÔT / VERSEMENT ESPÈCES</dd>
                </div>
                <div>
                  <dt>Motif</dt>
                  <dd>{receiptTarget.description || "Versement au guichet"}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd><span style={{ color: "#16a34a", fontWeight: 700 }}>VALIDÉ / CRÉDITÉ</span></dd>
                </div>
              </dl>

              <div className="coop-receipt-rule" />

              {/* Cadre de double émargement */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  marginTop: "12px",
                  fontSize: "10px",
                }}
              >
                <div style={{ textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: "8px", padding: "8px" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 24px 0", color: "#334155" }}>
                    Signature du Déposant
                  </p>
                  <small style={{ color: "#64748b", fontSize: "9px" }}>
                    Bon pour versement
                  </small>
                </div>
                <div style={{ textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: "8px", padding: "8px" }}>
                  <p style={{ fontWeight: 700, margin: "0 0 24px 0", color: "#334155" }}>
                    Visa du Guichetier
                  </p>
                  <small style={{ color: "#64748b", fontSize: "9px" }}>
                    Cachet de la caisse
                  </small>
                </div>
              </div>

              <p style={{ marginTop: "10px", fontSize: "9px", color: "#64748b" }}>
                Conservez ce reçu. Document certifié conforme émis par {MWANGAZA_BRAND.name}.
              </p>
            </div>
          )}

          <div className="coop-form-actions">
            <button
              className="mw-secondary"
              type="button"
              onClick={() => setReceiptTarget(null)}
            >
              Fermer
            </button>
            <button
              className="mw-primary"
              type="button"
              onClick={() => window.print()}
            >
              <IconPrinter aria-hidden="true" />
              Imprimer le bordereau
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
