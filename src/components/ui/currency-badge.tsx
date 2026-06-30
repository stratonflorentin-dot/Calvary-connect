import { cn } from "@/lib/utils";

export const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TZS", name: "Tanzanian Shilling", flag: "🇹🇿", dec: 0 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", dec: 2 },
  ZMW: { code: "ZMW", symbol: "K", name: "Zambian Kwacha", flag: "🇿🇲", dec: 2 },
  CDF: { code: "CDF", symbol: "FC", name: "Congolese Franc", flag: "🇨🇩", dec: 0 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪", dec: 0 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", flag: "🇺🇬", dec: 0 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", dec: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

interface CurrencyBadgeProps {
  currency: CurrencyCode | string;
  showFlag?: boolean;
  showCode?: boolean;
  showSymbol?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CurrencyBadge({
  currency,
  showFlag = true,
  showCode = true,
  showSymbol = false,
  className,
  size = "md",
}: CurrencyBadgeProps) {
  const currencyInfo = CURRENCIES[currency as CurrencyCode] || CURRENCIES.TZS;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted font-medium",
        sizeClasses[size],
        className
      )}
    >
      {showFlag && <span className="text-base">{currencyInfo.flag}</span>}
      {showCode && <span>{currencyInfo.code}</span>}
      {showSymbol && <span className="text-muted-foreground">({currencyInfo.symbol})</span>}
    </span>
  );
}

// Format amount with currency
export function formatCurrency(
  amount: number,
  currency: CurrencyCode | string = "TZS"
): string {
  const currencyInfo = CURRENCIES[currency as CurrencyCode] || CURRENCIES.TZS;
  const n = Number(amount || 0);
  
  if (currencyInfo.dec === 0) {
    return `${currencyInfo.flag} ${currencyInfo.symbol} ${Math.round(n).toLocaleString()}`;
  }
  
  return `${currencyInfo.flag} ${currencyInfo.symbol}${n.toLocaleString("en-US", {
    minimumFractionDigits: currencyInfo.dec,
    maximumFractionDigits: currencyInfo.dec,
  })}`;
}

// Get currency info
export function getCurrencyInfo(currency: CurrencyCode | string) {
  return CURRENCIES[currency as CurrencyCode] || CURRENCIES.TZS;
}

// List of all available currencies
export const AVAILABLE_CURRENCIES = Object.values(CURRENCIES);
