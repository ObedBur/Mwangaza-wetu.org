export function formatCurrency(value: number, currency = "USD") {
  if (currency === "FC") {
    const amount = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${amount} FC`;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedCurrency(amount: number, sign: "+" | "−", currency = "USD"): string {
  return `${sign} ${formatCurrency(amount, currency)}`;
}

/**
 * Affiche un montant par devise (ex. « 1 200,00 USD · 250 000,00 FC »).
 * Les montants nuls dans une devise sont masqués ; si tout est nul, 0 USD.
 */
export function formatMixedCurrency(
  items: Array<{ amount: number; currency: string }>,
): string {
  const sum = (currency: string) =>
    items
      .filter((item) => item.currency === currency)
      .reduce((total, item) => total + Number(item.amount || 0), 0);

  const parts: string[] = [];
  const usd = sum("USD");
  const fc = sum("FC");
  if (usd) parts.push(formatCurrency(usd, "USD"));
  if (fc) parts.push(formatCurrency(fc, "FC"));
  return parts.length ? parts.join(" · ") : formatCurrency(0, "USD");
}
