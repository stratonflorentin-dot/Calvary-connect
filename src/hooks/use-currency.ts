"use client";

import { useState, useEffect } from 'react';

export type Currency = 'USD' | 'TZS';

const USD_TO_TZS_RATE = 2600;

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('USD');

  useEffect(() => {
    const saved = localStorage.getItem('fleet_currency') as Currency;
    if (saved) setCurrency(saved);
  }, []);

  const toggleCurrency = () => {
    const next = currency === 'USD' ? 'TZS' : 'USD';
    setCurrency(next);
    localStorage.setItem('fleet_currency', next);
  };

  const format = (amount: number) => {
    if (currency === 'TZS') {
      const converted = amount * USD_TO_TZS_RATE;
      return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency: 'TZS',
        maximumFractionDigits: 0,
      }).format(converted);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return { currency, toggleCurrency, format };
}
