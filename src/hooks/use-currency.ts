"use client";

import { useState, useEffect } from 'react';

export type Currency = 'USD' | 'TZS';

const CACHE_KEY = 'fleet_exchange_rate';
const CACHE_TIMESTAMP_KEY = 'fleet_exchange_rate_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours instead of 1 hour to reduce API calls
const FALLBACK_RATE = 2600;

// Global fetch promise to prevent multiple simultaneous requests
let globalFetchPromise: Promise<number | null> | null = null;

async function fetchExchangeRateWithCache(): Promise<number> {
  // Check cache first
  const cachedRate = localStorage.getItem(CACHE_KEY);
  const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  
  if (cachedRate && cachedTimestamp) {
    const age = Date.now() - parseInt(cachedTimestamp, 10);
    if (age < CACHE_DURATION_MS) {
      const rate = parseFloat(cachedRate);
      if (rate > 0) {
        console.log(`Using cached exchange rate: 1 USD = ${rate} TZS (age: ${Math.round(age / 1000 / 60)} mins)`);
        return rate;
      }
    }
  }
  
  // Use global promise to prevent multiple simultaneous fetches
  if (globalFetchPromise) {
    const result = await globalFetchPromise;
    return result || FALLBACK_RATE;
  }
  
  globalFetchPromise = fetchExchangeRateFromAPI();
  
  try {
    const rate = await globalFetchPromise;
    return rate || FALLBACK_RATE;
  } finally {
    globalFetchPromise = null;
  }
}

async function fetchExchangeRateFromAPI(): Promise<number | null> {
  const apis = [
    // Primary API with user's key - free tier has limits
    {
      url: 'https://v6.exchangerate-api.com/v6/aeb0b1098eebe19d1f2e1b4e/latest/USD',
      parser: (data: any) => data.conversion_rates?.TZS,
      priority: 1
    },
    // Fallback APIs (no key required, higher limits)
    {
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      parser: (data: any) => data.rates?.TZS,
      priority: 2
    },
    {
      url: 'https://open.er-api.com/v6/latest/USD',
      parser: (data: any) => data.rates?.TZS,
      priority: 3
    }
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        console.warn(`API rate limited (429): ${api.url}. Trying next API...`);
        continue;
      }
      
      if (!response.ok) {
        console.warn(`API error ${response.status}: ${api.url}`);
        continue;
      }
      
      const data = await response.json();
      const rate = api.parser(data);
      
      if (rate && rate > 0) {
        // Cache the successful rate
        localStorage.setItem(CACHE_KEY, rate.toString());
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        console.log(`Exchange rate updated: 1 USD = ${rate} TZS (via ${api.url})`);
        return rate;
      }
    } catch (error) {
      console.log(`API ${api.url} failed, trying next...`);
      continue;
    }
  }
  
  console.warn('All exchange rate APIs failed, using fallback rate');
  return null;
}

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState(FALLBACK_RATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load cached rate immediately on mount
  useEffect(() => {
    const cachedRate = localStorage.getItem(CACHE_KEY);
    if (cachedRate) {
      setExchangeRate(parseFloat(cachedRate));
    }
    setIsLoading(false);
  }, []);

  // Fetch exchange rate (only once across all component instances)
  useEffect(() => {
    let isMounted = true;
    
    const updateRate = async () => {
      const rate = await fetchExchangeRateWithCache();
      if (isMounted) {
        setExchangeRate(rate);
      }
    };
    
    // Small delay to let cache load first
    const timer = setTimeout(updateRate, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Manual refresh function
  const refreshRate = async () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    const rate = await fetchExchangeRateWithCache();
    setExchangeRate(rate);
  };

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
    exchangeRate,
    refreshRate,
    isLoading
  };
}
