import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAmount(amount: number, currency: string = "TZS") {
  const CURRENCIES: Record<string, { code: string; symbol: string; dec: number }> = {
    TZS: { code: "TZS", symbol: "TZS", dec: 0 },
    USD: { code: "USD", symbol: "$", dec: 2 },
    EUR: { code: "EUR", symbol: "€", dec: 2 },
  };
  
  const c = CURRENCIES[currency] || CURRENCIES.TZS;
  const n = Number(amount || 0);
  return c.dec === 0
    ? `${c.symbol} ${Math.round(n).toLocaleString()}`
    : `${c.symbol}${n.toLocaleString("en-US", { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec })}`;
}

export function formatDate(date: string | Date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
