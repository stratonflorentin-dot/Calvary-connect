-- Add VAT columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS vat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_before_vat NUMERIC DEFAULT 0;

-- Update existing sales to calculate VAT (18% of amount)
UPDATE sales 
SET vat = amount * 0.18,
    price_before_vat = amount * 0.82
WHERE vat = 0 OR vat IS NULL;
