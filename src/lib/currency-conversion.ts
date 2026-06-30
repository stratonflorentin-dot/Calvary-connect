import { supabase } from "@/lib/supabase";

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

/**
 * Fetch exchange rate for a specific currency pair on a given date
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<number | null> {
  try {
    const effectiveDate = date || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .lte('effective_date', effectiveDate)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data?.rate || null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return null;
  }
}

/**
 * Convert amount from one currency to another using exchange rates
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  
  const rate = await getExchangeRate(fromCurrency, toCurrency, date);
  if (rate === null) {
    console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
    return amount; // Return original amount if no rate available
  }
  
  return amount * rate;
}

/**
 * Convert multiple currency amounts to a base currency
 */
export async function convertToBaseCurrency(
  amounts: Array<{ amount: number; currency: string }>,
  baseCurrency: string,
  date?: string
): Promise<number> {
  const conversions = amounts.map(({ amount, currency }) =>
    convertCurrency(amount, currency, baseCurrency, date)
  );
  
  const convertedAmounts = await Promise.all(conversions);
  return convertedAmounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Batch fetch exchange rates for multiple currency pairs
 */
export async function getExchangeRates(
  pairs: Array<{ from: string; to: string }>,
  date?: string
): Promise<Map<string, number>> {
  const effectiveDate = date || new Date().toISOString().split('T')[0];
  const ratesMap = new Map<string, number>();

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .in('from_currency', pairs.map(p => p.from))
      .in('to_currency', pairs.map(p => p.to))
      .lte('effective_date', effectiveDate)
      .order('effective_date', { ascending: false });

    if (error) throw error;

    // Get the most recent rate for each pair
    pairs.forEach(pair => {
      const key = `${pair.from}-${pair.to}`;
      const pairRates = data?.filter(
        r => r.from_currency === pair.from && r.to_currency === pair.to
      ) || [];
      if (pairRates.length > 0) {
        ratesMap.set(key, pairRates[0].rate);
      }
    });

    return ratesMap;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return ratesMap;
  }
}

/**
 * Check if exchange rate exists for a currency pair
 */
export async function hasExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<boolean> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return rate !== null;
}
