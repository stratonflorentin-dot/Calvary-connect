-- ==========================================
-- PATCH: Contracts System - Full Wiring
-- For Calvary Investment Company Limited
-- Run in Supabase SQL Editor
-- ==========================================

-- ── 1. ALTER transport_contracts to add missing columns ──

-- Add template/rate sheet references and generated HTML
ALTER TABLE transport_contracts
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES contract_templates(id),
  ADD COLUMN IF NOT EXISTS rate_sheet_id UUID REFERENCES contract_templates(id),
  ADD COLUMN IF NOT EXISTS contract_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS client_signatory_name TEXT,
  ADD COLUMN IF NOT EXISTS client_signatory_title TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT,
  ADD COLUMN IF NOT EXISTS generated_html TEXT;

-- Fix the rate_sheet_id foreign key to point to the correct table
-- (The above may have pointed to contract_templates by mistake, fix it)
DO $$
BEGIN
  -- Drop the incorrect FK if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transport_contracts_rate_sheet_id_fkey'
    AND table_name = 'transport_contracts'
  ) THEN
    ALTER TABLE transport_contracts DROP CONSTRAINT transport_contracts_rate_sheet_id_fkey;
  END IF;
  
  -- Check if rate_sheets table has the right structure
  -- The contract_templates SQL already created rate_sheets with JSONB rates
  -- We need to ensure the FK points to rate_sheets
  ALTER TABLE transport_contracts
    ADD CONSTRAINT transport_contracts_rate_sheet_id_fkey
    FOREIGN KEY (rate_sheet_id) REFERENCES rate_sheets(id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK constraint adjustment skipped: %', SQLERRM;
END $$;


-- ── 2. Create contract number generator function ──

DROP FUNCTION IF EXISTS generate_contract_number();

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  seq_num INT;
  contract_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM transport_contracts
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  contract_num := 'CALC-' || year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN contract_num;
END;
$$ LANGUAGE plpgsql;


-- ── 3. Ensure contract_templates has seed data ──

-- Only insert if no templates exist
INSERT INTO contract_templates (
  template_name, company_name, company_address,
  ceo_name, ceo_title, contract_title, preamble, clauses, terms_conditions,
  is_active
)
SELECT
  'Standard Transportation Agreement',
  'CALVARY INVESTMENT CO LTD',
  'P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania',
  'Managing Director',
  'Managing Director',
  'TRANSPORTATION AGREEMENT',
  'This Agreement is made between {{client_name}} of {{client_address}} and CALVARY INVESTMENT CO LTD, registered office situated on Kinondoni Road, P.O. Box 12929, Dar Es Salaam, Tanzania.',
  '[
    {"number":"1","title":"Purpose of the Agreement","content":"This agreement describes the terms and conditions under which the Transporter agrees to transport and deliver container with its loaded cargo on behalf of The Client."},
    {"number":"2","title":"Performance of the Agreement","content":"(a) Collect and deliver the consignment as instructed by The Client and immediately inform The Client of any unusual delay.\n(b) In the event of loss/damage or mis-delivery, immediately inform The Client and supply a detailed statement.\n(c) Be responsible for any loss/damage to the consignment and shall indemnify The Client unless loss/damage is due to proven Force Majeure.\n(d) Provide The Client with minimum twice daily updates (AM & PM) on status of cargo.\n(e) Ensure all driver allowances, fuel for transport, and toll charges are provided for by the Transporter."},
    {"number":"3","title":"The Client shall","content":"(a) Request truck on FOT terms and provide tentative loading date from the port.\n(b) Make sure all shipping line and port charges are paid.\n(c) Confirm free demurrage days with the Transporter before booking at the POL.\n(d) Border clearance is The Client''s responsibility."},
    {"number":"4","title":"Transit Time & Free Days","content":"The Transporter shall give 5 working days free for border clearance for Zambia, Rwanda, Malawi and Burundi, and 8 working days for DRC. 2-3 working days free for offloading."},
    {"number":"5","title":"Transport Rates","content":"As per attached Annexure A rates to apply for local and transit cargo. Rates subject to change due to fuel rate changes. Rates to be agreed at time of loading via email confirmation."},
    {"number":"6","title":"Payment Terms","content":"Payment shall be made 100% upon delivery of cargo and submission of: POD, empty container interchange, Tax invoice with EFD receipt."},
    {"number":"7","title":"Demurrage & Waiting Charges","content":"The Client''s Customer has to offload the truck within 3 working days. Exceeding this period will be charged US$100 additional per day per truck."},
    {"number":"8","title":"Penalties","content":"Each vehicle must reach its destination within the normal agreed transit time. Failure will result in a penalty of USD 200 per day per TEU unless delay is due to proven Force Majeure."},
    {"number":"9","title":"Insurance & Liability","content":"The Transporter shall take out insurance covering all liabilities under this Agreement."},
    {"number":"10","title":"Duration & Termination","content":"This Agreement shall be valid for a period of One year and may be subject to renewal. Either party may terminate on 30 working days written notice."},
    {"number":"11","title":"Confidentiality","content":"The Transporter shall keep confidential any information concerning The Client."},
    {"number":"12","title":"Governing Law","content":"This Contract is governed by the Laws of the United Republic of Tanzania."}
  ]'::jsonb,
  'Additional terms: All vehicles must be road-worthy with valid C28 licenses. Drivers must have necessary PPE.',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM contract_templates WHERE is_active = true LIMIT 1);


-- ── 4. Ensure rate_sheets has JSONB-format seed data ──
-- The contract generator expects rate_sheets with a JSONB 'rates' column
-- Check if the rate_sheet_name column exists (JSONB format)

DO $$
BEGIN
  -- Only seed if no JSONB-format rate sheets exist
  IF NOT EXISTS (
    SELECT 1 FROM rate_sheets WHERE rate_sheet_name IS NOT NULL LIMIT 1
  ) THEN
    INSERT INTO rate_sheets (
      rate_sheet_name, effective_date, currency, rates, special_conditions, is_active
    ) VALUES (
      'East & Central Africa Freight Rates 2026',
      '2026-01-01',
      'USD',
      '[
        {"from":"Dar es Salaam Port","destination":"KIGALI - RWANDA","container_20ft":3100,"container_40ft":3100,"loose":3100,"truck_type":"C28","transit_days":4},
        {"from":"Dar es Salaam Port","destination":"LUSAKA - ZAMBIA","container_20ft":4000,"container_40ft":4000,"loose":4000,"truck_type":"C28","transit_days":6},
        {"from":"Dar es Salaam Port","destination":"SOLWEZI - ZAMBIA","container_20ft":4800,"container_40ft":4800,"loose":4800,"truck_type":"C28","transit_days":7},
        {"from":"Dar es Salaam Port","destination":"BUJUMBURA - BURUNDI","container_20ft":3200,"container_40ft":3200,"loose":3200,"truck_type":"C28","transit_days":4},
        {"from":"Dar es Salaam Port","destination":"LILONGWE - MALAWI","container_20ft":4000,"container_40ft":4000,"loose":4000,"truck_type":"C28","transit_days":5},
        {"from":"Dar es Salaam Port","destination":"BLANTYRE - MALAWI","container_20ft":4400,"container_40ft":4400,"loose":4400,"truck_type":"C28","transit_days":6},
        {"from":"Dar es Salaam Port","destination":"KITWE - ZAMBIA","container_20ft":4000,"container_40ft":4000,"loose":4400,"truck_type":"C28","transit_days":7},
        {"from":"Dar es Salaam Port","destination":"GOMA - DRC","container_20ft":4400,"container_40ft":4400,"loose":4400,"truck_type":"C28","transit_days":5},
        {"from":"Dar es Salaam Port","destination":"BUKAVU - DRC","container_20ft":4800,"container_40ft":4800,"loose":4800,"truck_type":"C28","transit_days":6},
        {"from":"Dar es Salaam Port","destination":"LUBUMBASHI - DRC","container_20ft":6400,"container_40ft":6400,"loose":6400,"truck_type":"C28","transit_days":8},
        {"from":"Dar es Salaam Port","destination":"KOLWEZI - DRC","container_20ft":7200,"container_40ft":7200,"loose":7200,"truck_type":"C28","transit_days":10},
        {"from":"Dar es Salaam Port","destination":"LIKASI - DRC","container_20ft":8500,"container_40ft":8500,"loose":8500,"truck_type":"C28","transit_days":11}
      ]'::jsonb,
      'All rates are in USD. Rates exclude port charges, customs fees, and applicable taxes. Rates are subject to change with 30 days notice.',
      TRUE
    );
  END IF;
END $$;


-- ── 5. Relax transport_contracts CHECK constraint for new status values ──

DO $$
BEGIN
  -- Drop old check constraint if exists
  ALTER TABLE transport_contracts DROP CONSTRAINT IF EXISTS transport_contracts_status_check;
  -- Add updated constraint
  ALTER TABLE transport_contracts ADD CONSTRAINT transport_contracts_status_check
    CHECK (status IN ('draft', 'pending_signature', 'active', 'suspended', 'expired', 'terminated'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Status constraint update skipped: %', SQLERRM;
END $$;

-- Relax contract_type constraint too
DO $$
BEGIN
  ALTER TABLE transport_contracts DROP CONSTRAINT IF EXISTS transport_contracts_contract_type_check;
  ALTER TABLE transport_contracts ADD CONSTRAINT transport_contracts_contract_type_check
    CHECK (contract_type IN ('spot', 'long_term', 'project_based', 'standard'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Contract type constraint update skipped: %', SQLERRM;
END $$;


SELECT 'Contracts system patch applied successfully!' as status;
