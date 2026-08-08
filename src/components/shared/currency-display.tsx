"use client";

import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CurrencyDisplay() {
  const { currency, toggleCurrency, exchangeRate, refreshRate } = useCurrency();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshRate(true);
    setRefreshing(false);
  };

  return (
    <div className="flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1 py-1 border border-border text-xs">
      <TrendingUp className="size-3.5 text-success shrink-0" />
      <span className="font-medium text-muted-foreground whitespace-nowrap tabular-nums">
        1 USD = {Math.round(exchangeRate).toLocaleString()} TZS
      </span>

      <button
        onClick={toggleCurrency}
        title={`Switch to ${currency === "USD" ? "TZS" : "USD"}`}
        className="ml-1 rounded-full px-2 py-1 font-bold text-primary hover:bg-primary/10 transition-colors"
      >
        {currency}
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleRefresh}
        disabled={refreshing}
        title="Refresh exchange rate"
        className="size-6 rounded-full"
      >
        <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
      </Button>
    </div>
  );
}
