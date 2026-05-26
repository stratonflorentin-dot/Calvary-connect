"use client";

import { useState, useEffect, useCallback } from "react";

export type Currency = "USD" | "TZS" | "KES" | "ZMW" | "UGX";

const CACHE_KEY = "fleet_exchange_rate_v2"; // Versioned cache key
const CACHE_TIMESTAMP_KEY = "fleet_exchange_rate_timestamp_v2";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const FALLBACK_RATES: Record<Currency, number> = {
  TZS: 1,
  USD: 2600,
  KES: 20,
  ZMW: 140,
  UGX: 0.71
};

// Global fetch promise
let globalFetchPromise: Promise<Record<string, number> | null> | null = null;

export function useCurrency() {
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("TZS");
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    const cachedRates = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedRates && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp, 10);
      if (age < CACHE_DURATION_MS) {
        const parsed = JSON.parse(cachedRates);
        setRates(parsed);
        setLoading(false);
        return;
      }
    }

    if (globalFetchPromise) {
      const result = await globalFetchPromise;
      if (result) setRates(result);
      setLoading(false);
      return;
    }

    globalFetchPromise = (async () => {
      try {
        const response = await fetch("https://v6.exchangerate-api.com/v6/aeb0b1098eebe19d1f2e1b4e/latest/USD");
        if (!response.ok) throw new Error("API failed");
        const data = await response.json();
        const newRates = data.conversion_rates;
        
        // Convert USD-based rates to TZS-based rates (1 unit of currency = X TZS)
        const tzsRate = newRates.TZS;
        const normalizedRates: Record<string, number> = {};
        
        Object.keys(FALLBACK_RATES).forEach(cur => {
          if (cur === 'TZS') normalizedRates[cur] = 1;
          else if (newRates[cur]) {
            // How many TZS for 1 unit of cur
            normalizedRates[cur] = tzsRate / newRates[cur];
          } else {
            normalizedRates[cur] = FALLBACK_RATES[cur as Currency];
          }
        });

        localStorage.setItem(CACHE_KEY, JSON.stringify(normalizedRates));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        return normalizedRates;
      } catch (e) {
        console.error("Currency fetch error:", e);
        return FALLBACK_RATES;
      }
    })();

    const result = await globalFetchPromise;
    if (result) setRates(result);
    setLoading(false);
    globalFetchPromise = null;
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const convert = useCallback((amount: number, from: string, to: string = "TZS") => {
    if (from === to) return amount;
    const amountInTzs = amount * (rates[from] || FALLBACK_RATES[from as Currency] || 1);
    const targetRate = rates[to] || FALLBACK_RATES[to as Currency] || 1;
    return amountInTzs / targetRate;
  }, [rates]);

  const format = useCallback((amount: number, currencyCode: string = "TZS") => {
    try {
      const locale = {
        TZS: 'en-TZ',
        USD: 'en-US',
        KES: 'en-KE',
        ZMW: 'en-ZM',
        UGX: 'en-UG'
      }[currencyCode] || 'en-US';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currencyCode === 'TZS' ? 0 : 2,
        maximumFractionDigits: currencyCode === 'TZS' ? 0 : 2,
      }).format(amount);
    } catch (e) {
      return `${currencyCode} ${amount.toLocaleString()}`;
    }
  }, []);

  const toggleCurrency = useCallback(() => {
    setBaseCurrency(prev => {
      const next = prev === "USD" ? "TZS" : "USD";
      localStorage.setItem("fleet_currency", next);
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("fleet_currency") as Currency;
    if (saved) setBaseCurrency(saved);
  }, []);

  const exchangeRate = (rates["TZS"] || 1) / (rates["USD"] || (1 / FALLBACK_RATES["USD"]));

  return {
    rates,
    convert,
    format,
    loading,
    isLoading: loading,
    currency: baseCurrency,
    setCurrency: setBaseCurrency,
    toggleCurrency,
    exchangeRate,
    refreshRate: fetchRates,
    availableCurrencies: Object.keys(FALLBACK_RATES) as Currency[]
  };
}

