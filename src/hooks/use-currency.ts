"use client";

import { useState, useEffect } from 'react';

export type Currency = 'USD' | 'TZS';

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState(2600); // Fallback rate

  // Fetch real-time exchange rate with API key and fallbacks
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const apis = [
        // Primary API with user's key
        {
          url: 'https://v6.exchangerate-api.com/v6/aeb0b1098eebe19d1f2e1b4e/latest/USD',
          parser: (data: any) => data.conversion_rates?.TZS
        },
        // Fallback APIs
        {
          url: 'https://api.exchangerate-api.com/v4/latest/USD',
          parser: (data: any) => data.rates?.TZS
        },
        {
          url: 'https://open.er-api.com/v6/latest/USD',
          parser: (data: any) => data.rates?.TZS
        }
      ];

      for (const api of apis) {
        try {
          const response = await fetch(api.url);
          const data = await response.json();
          const rate = api.parser(data);
          
          if (rate && rate > 0) {
            setExchangeRate(rate);
            console.log(`Exchange rate updated: 1 USD = ${rate} TZS`);
            return;
          }
        } catch (error) {
          console.log(`API ${api.url} failed, trying next...`);
          continue;
        }
      }
      
      console.log('All APIs failed, using fallback exchange rate');
    };

    fetchExchangeRate();
    // Update every hour
    const interval = setInterval(fetchExchangeRate, 3600000);
    return () => clearInterval(interval);
  }, []);

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
      const converted = amount * exchangeRate;
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

  return { 
    currency, 
    toggleCurrency, 
    format,
    exchangeRate // Expose rate for display
  };
}
