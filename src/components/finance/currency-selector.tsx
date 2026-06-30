"use client";

import { AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  className?: string;
}

export function CurrencySelector({ selectedCurrency, onCurrencyChange, className }: CurrencySelectorProps) {
  return (
    <Select value={selectedCurrency} onValueChange={onCurrencyChange}>
      <SelectTrigger className={`w-32 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_CURRENCIES.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{currency.flag}</span>
              <span>{currency.code}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
