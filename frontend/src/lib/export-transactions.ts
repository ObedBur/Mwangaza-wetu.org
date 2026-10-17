import { formatCurrency } from "@/lib/format-currency";
import { memberAccounts } from "@/lib/member-portal-config";
import type { MemberTransaction } from "@/mocks/member-dashboard";

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportTransactionsCsv(
  transactions: MemberTransaction[],
  fileName = "activite-mwangaza-wetu.csv",
) {
  const accountNames = new Map(
    memberAccounts.map((account) => [account.id, account.shortName]),
  );
  const rows = [
    ["Date", "Description", "Compte", "Type", "Montant", "Statut"],
    ...transactions.map((transaction) => [
      new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(transaction.date)),
      transaction.description,
      transaction.accountLabel ?? accountNames.get(transaction.accountId) ?? "",
      transaction.kind,
      formatCurrency(transaction.amount, transaction.currency ?? "USD"),
      transaction.status,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
