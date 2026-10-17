'use client';

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconArrowDown,
  IconArrowsDownUp,
  IconDownload,
  IconSearch,
  IconUserPlus,
  IconUsers,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react";

import { CooperativeDataState } from "@/components/cooperative/CooperativeDataState";
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
import {
  accountConfigs,
  accountSlugs,
  type AccountSlug,
} from "@/lib/account-config";
import { cooperativeCopy as t } from "@/lib/cooperative-copy";
import { apiClient } from "@/lib/auth";
const rowsPerPage = 10;

type MemberRecord = {
  id: string;
  memberNumber: string;
  name: string;
  phone: string;
  joinedAt: string;
  status: "Actif" | "Suspendu";
  email: string;
  address: string;
  accountTypes: string[];
  savingsTotal: number | null;
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
};

type MembersResponse = {
  data: ApiMember[];
  meta: { total: number };
};

type MemberStats = {
  total: number;
  actifs: number;
  inactifs: number;
};

function mapMember(record: ApiMember): MemberRecord {
  const accountTypes = (record.comptesEpargne ?? []).map((account) => account.typeCompte);
  return {
    id: String(record.id),
    memberNumber: record.numeroCompte,
    name: record.nomComplet,
    phone: record.telephone,
    joinedAt: record.dateAdhesion.slice(0, 10),
    status: record.statut === "actif" ? "Actif" : "Suspendu",
    // The current account model has no currency field, so combining balances
    // here would display a misleading total.
    savingsTotal: null,
    email: record.email ?? "",
    address: record.adresse ?? "",
    accountTypes,
  };
}

function MembersContent() {
  const dark = useCooperativeDarkTheme();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState<AccountSlug | "">("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] =
    useState<MemberRecord | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats>({ total: 0, actifs: 0, inactifs: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const searchParams = useSearchParams();
  const requestedMemberId = searchParams ? searchParams.get("membre") : null;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get<MembersResponse>("/membres", { params: { page: 1, pageSize: 1000 } }),
      apiClient.get<MemberStats>("/membres/stats"),
    ])
      .then(([membersResponse, statsResponse]) => {
        if (!active) return;
        setMembers(membersResponse.data.data.map(mapMember));
        setMemberStats(statsResponse.data);
        setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!requestedMemberId) return;
    setSelectedMember(
      members.find((member) => member.id === requestedMemberId) ?? null,
    );
  }, [members, requestedMemberId]);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr-FR");
    return members
      .filter((member) =>
        `${member.name} ${member.memberNumber} ${member.phone}`
          .toLocaleLowerCase("fr-FR")
          .includes(normalized),
      )
      .filter((member) => !status || member.status === status)
        .filter((member) => !account || member.accountTypes.some((type) => type.toLocaleLowerCase("fr-FR").includes(account)))
      .sort((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name, "fr");
        if (sort === "balance") return (right.savingsTotal ?? -1) - (left.savingsTotal ?? -1);
        return right.joinedAt.localeCompare(left.joinedAt);
      });
  }, [account, members, query, sort, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / rowsPerPage),
  );
  const pageMembers = filteredMembers.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );
  const joinedThisMonth = members.filter((member) => {
    const date = new Date(`${member.joinedAt}T12:00:00`);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;

  function exportMembers() {
    const csv = [
      [
        t.memberNumber,
        t.memberSummary,
        t.phone,
        t.joinDate,
        t.savings,
        t.status,
      ],
      ...filteredMembers.map((member) => [
        member.memberNumber,
        member.name,
        member.phone,
        member.joinedAt,
        member.savingsTotal === null ? "" : formatCurrency(member.savingsTotal),
        member.status,
      ]),
    ]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "membres-mwangaza-wetu.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function changeFilters(change: () => void) {
    change();
    setPage(1);
  }

  return (
    <>
      <div className="coop-page-heading">
        <div>
          <CooperativeBreadcrumb
            section={t.membersTitle}
            current={t.membersTitle}
          />
          <h1>{t.membersTitle}</h1>
          <p>{t.membersDescription}</p>
        </div>
        <div className="coop-page-actions">
          <button
            className="mw-secondary"
            type="button"
            onClick={exportMembers}
          >
            <IconDownload aria-hidden="true" />
            {t.export}
          </button>
          <button
            className="mw-primary"
            type="button"
            onClick={() => {
              window.sessionStorage.setItem("mw_open_member_enrollment", "1");
              window.location.assign("/dashboard");
            }}
          >
            <IconUserPlus aria-hidden="true" />
            {t.newMember}
          </button>
        </div>
      </div>

      <CooperativeDataState
        loading={loading}
        error={loadError}
        empty={!loading && !loadError && members.length === 0}
      >
        <section className="coop-stat-grid" aria-label={t.membersTitle}>
          <CooperativeStatCard
            label={t.totalMembers}
            value={memberStats.total}
            detail=""
            trend=""
            icon={IconUsers}
          />
          <CooperativeStatCard
            label={t.activeMembers}
            value={memberStats.actifs}
            detail=""
            trend=""
            icon={IconCircleCheck}
          />
          <CooperativeStatCard
            label="Membres inactifs"
            value={memberStats.inactifs}
            detail=""
            trend=""
            icon={IconAlertTriangle}
          />
          <CooperativeStatCard
            label={t.newThisMonth}
            value={joinedThisMonth}
            detail=""
            trend=""
            icon={IconArrowDown}
          />
        </section>
      </CooperativeDataState>

      <section
        className="mw-panel coop-members-panel"
        aria-label={t.membersTitle}
      >
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
              <option>Actif</option>
              <option>Suspendu</option>
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
              <option value="balance">{t.sortBalance}</option>
            </select>
          </label>
        </div>
        <CooperativeDataState
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && filteredMembers.length === 0}
          emptyMessage={t.noMembers}
          skeletonRows={6}
        >
          <div className="coop-table-scroll">
            <table className="mw-table coop-members-table">
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
                {pageMembers.map((member) => (
                  <tr
                    key={member.id}
                    tabIndex={0}
                    aria-label={`${member.name}, ${member.memberNumber}`}
                    onClick={() => setSelectedMember(member)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
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
                        <strong>{member.name}</strong>
                      </span>
                    </td>
                    <td>{member.memberNumber}</td>
                    <td>{member.phone}</td>
                    <td>{formatDate(member.joinedAt)}</td>
                    <td>
                      <AccountPills accounts={accountSlugs.filter((slug) => member.accountTypes.some((type) => type.toLocaleLowerCase("fr-FR").includes(slug)))} />
                    </td>
                    <td className="coop-amount-cell">
                      {member.savingsTotal === null ? "—" : formatCurrency(member.savingsTotal)}
                    </td>
                    <td>
                      <CooperativeStatus status={member.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CooperativeDataState>
        <div className="coop-pagination">
          <span>
            {filteredMembers.length} {t.records}
          </span>
          <div>
            <button
              type="button"
              className="mw-secondary"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t.previous}
            </button>
            <span>
              {t.pageOf} {page} {t.of} {totalPages}
            </span>
            <button
              type="button"
              className="mw-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              {t.next}
            </button>
          </div>
        </div>
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
          <SheetTitle className="coop-drawer-title">
            {t.memberSummary}
          </SheetTitle>
          {selectedMember && <MemberDetails member={selectedMember} />}
        </SheetContent>
      </Sheet>

    </>
  );
}

export default function MembersRoute() {
  return (
    <Suspense fallback={<div className="coop-skeleton-stack" />}>
      <MembersContent />
    </Suspense>
  );
}

function MemberDetails({ member }: { member: MemberRecord }) {
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
      <section className="coop-drawer-section">
        <h3>{t.contactDetails}</h3>
        <dl className="coop-detail-list">
          <div>
            <dt>{t.phone}</dt>
            <dd>{member.phone}</dd>
          </div>
          <div>
          <dt>{t.joinDate}</dt>
          <dd>{formatDate(member.joinedAt)}</dd>
          <dt>Email</dt>
          <dd>{member.email || "—"}</dd>
          <dt>Adresse</dt>
          <dd>{member.address || "—"}</dd>
          </div>
        </dl>
      </section>
      <section className="coop-drawer-section">
        <h3>{t.accountBalances}</h3>
        <CooperativeDataState empty={member.accountTypes.length === 0} emptyMessage={t.empty}>
          <div className="coop-balance-list">
            {member.accountTypes.map((type) => <div key={type}><span>{type}</span><strong>—</strong></div>)}
          </div>
        </CooperativeDataState>
        <div className="coop-drawer-total"><span>{t.savings}</span><strong>—</strong></div>
      </section>
    </div>
  );
}
