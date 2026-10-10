export const CURRENCY = "UGX";

export function formatMoney(amount: number, currency = CURRENCY) {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function formatCompact(amount: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}
