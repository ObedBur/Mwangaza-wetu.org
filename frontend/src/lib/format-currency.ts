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
