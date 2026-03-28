"use client";

import { useCurrency } from '@/hooks/use-currency';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CurrencyDisplay() {
  const { currency, toggleCurrency, format, exchangeRate } = useCurrency();

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-sm border">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-green-600" />
        <span className="text-sm font-medium text-gray-600">
          1 USD = {exchangeRate.toLocaleString()} TZS
        </span>
      </div>
      
      <div className="h-4 w-px bg-gray-300" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleCurrency}
        className="font-mono font-bold text-sm"
      >
        {currency === 'USD' ? '$ USD' : 'TSh TZS'}
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.location.reload()}
        className="p-1"
        title="Refresh exchange rate"
      >
        <RefreshCw className="size-3" />
      </Button>
    </div>
  );
}
