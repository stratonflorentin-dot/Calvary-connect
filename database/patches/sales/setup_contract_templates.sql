-- ==========================================
-- CONTRACT TEMPLATES & RATE SHEETS
-- For Calvary Investment Company Limited
-- ==========================================

-- 1. CONTRACT TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'transportation', 'rental', 'service'
    
    -- Company Details (Calvary Investment)
    company_name VARCHAR(255) DEFAULT 'Calvary Investment Company Limited',
    company_address TEXT DEFAULT 'P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania',
    company_phone VARCHAR(50),
    company_email VARCHAR(255),
    company_logo_url TEXT,
    company_stamp_url TEXT,
    ceo_name VARCHAR(255) DEFAULT 'Tumaini Josephat Tesha',
    ceo_title VARCHAR(100) DEFAULT 'Chief Executive Officer',
    
    -- Contract Content
    contract_title VARCHAR(255) DEFAULT 'TRANSPORTATION AGREEMENT',
    preamble TEXT,
    clauses JSONB, -- Array of clause objects
    terms_conditions TEXT,
    signature_blocks JSONB,
    
    -- Template Settings
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. RATE SHEETS TABLE
CREATE TABLE IF NOT EXISTS rate_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_sheet_name VARCHAR(100) NOT NULL,
    contract_template_id UUID REFERENCES contract_templates(id),
    
    -- Rate sheet details
    effective_date DATE NOT NULL,
    expiry_date DATE,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Fuel adjustment clause
    fuel_adjustment_enabled BOOLEAN DEFAULT TRUE,
    fuel_base_price DECIMAL(10,2), -- Base fuel price for adjustments
    
    -- Rates as JSON array
    rates JSONB NOT NULL, -- Array of route rates
    
    -- Notes
    special_conditions TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. CONTRACT DOCUMENTS (Generated PDFs)
CREATE TABLE IF NOT EXISTS contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id),
    template_id UUID REFERENCES contract_templates(id),
    
    document_type VARCHAR(50), -- 'main_agreement', 'rate_sheet', 'annexure'
    document_number VARCHAR(50),
    
    -- Document content
    document_html TEXT, -- HTML version for preview
    document_pdf_url TEXT, -- Generated PDF URL
    
    -- Generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, generated, sent, signed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INSERT DEFAULT TRANSPORTATION TEMPLATE
INSERT INTO contract_templates (
    template_name,
    template_type,
    company_name,
    company_address,
    company_logo_url,
    company_stamp_url,
    ceo_name,
    ceo_title,
    contract_title,
    preamble,
    clauses,
    terms_conditions,
    signature_blocks,
    is_default,
    is_active
) VALUES (
    'Standard Transportation Agreement',
    'transportation',
    'Calvary Investment Company Limited',
    'P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania',
    '/assets/logos/calvary-logo.png',
    '/assets/logos/calvary-stamp.png',
    'Tumaini Josephat Tesha',
    'Chief Executive Officer',
    'TRANSPORTATION AGREEMENT',
    'This Agreement is made between {{client_name}} of {{client_address}} (hereinafter referred to as "The Client") and Calvary Investment Company Limited of P.O. Box 12929, Kinondoni Road, Dar Es Salaam (hereinafter referred to as "The Transporter").',
    '[
        {
            "number": "1",
            "title": "Purpose of the Agreement",
            "content": "This agreement describes the terms and conditions under which the Transporter agrees to transport and deliver container with its loaded cargo on behalf of The Client."
        },
        {
            "number": "2",
            "title": "Performance of the Agreement - The Transporter shall",
            "content": "(a) Collect and deliver the consignment as instructed by The Client and immediately inform The Client of any unusual delay.\n(b) In the event of loss/damage or mis-delivery, immediately inform The Client and supply a detailed statement.\n(c) Be responsible for any loss/damage to the consignment and shall indemnify The Client unless loss/damage is due to proven ''Force Majeure''.\n(d) Provide The Client with minimum twice daily updates (AM & PM) on status of cargo.\n(e) Ensure all driver allowances, fuel for transport, and toll charges are provided for by the Transporter.\n(f) Lift off of empty containers & TRA electronic seal and Transit (RIT) bond is responsibility of the Transporter.\n(g) Deliver transit cargo from Dar Es Salaam to various destinations as per agreed transit time.\n(h) The RIT transporter should arrange and clear trucks within 2 working days.\n(i) Any overweight on axle or total GVM, the Transporter is responsible to inform client with weigh bridge slip."
        },
        {
            "number": "3",
            "title": "The Client shall",
            "content": "(a) Request truck on FOT terms and provide tentative loading date from the port.\n(b) Make sure all shipping line and port charges are paid.\n(c) Confirm free demurrage days with the Transporter before booking at the POL.\n(d) Border clearance is The Client''s responsibility.\n(e) Make sure information required by the Transporter is available at any time.\n(f) Any demurrage charges due to delays in clearance/offloading will be on The Client account."
        },
        {
            "number": "4",
            "title": "Transit Time & Free Days",
            "content": "The Transporter shall give 5 working days free for border clearance for Zambia, Rwanda, Malawi and Burundi, and 8 working days for DRC. 2-3 working days free for offloading from time cargo arrives at client premises depending on volumes."
        },
        {
            "number": "5",
            "title": "Transport Rates",
            "content": "As per attached Annexure A rates to apply for local and transit cargo. Note the rates are subject to change due to increase or decrease of fuel rates. Rates to be agreed at time of loading via email written confirmation."
        },
        {
            "number": "6",
            "title": "Payment Terms",
            "content": "(a) Payment shall be made 100% upon delivery of cargo and submission of: POD, empty container interchange, Tax invoice with EFD receipt.\n(b) For Zambia, Rwanda, Malawi, Burundi and Tanzania local trips: paid upon delivery.\n(c) For DRC: paid at time of loading.\n(d) All payments will be paid in TZS based on agreed exchange rate at time of loading."
        },
        {
            "number": "7",
            "title": "Demurrage & Waiting Charges",
            "content": "(a) The Client''s Customer has to offload the truck within 3 working days. Exceeding this period will be charged US$100 additional per day per truck.\n(b) Grace period for returning empty containers: Rwanda/Burundi/Malawi - 20 days, Zambia - 30 days, DRC - 45 days.\n(c) The transporter shall bear demurrage charges for delays in returning shipping line containers."
        },
        {
            "number": "8",
            "title": "Penalties",
            "content": "Each vehicle must reach its destination within the normal agreed transit time. Failure will result in a penalty of USD 200 per day per TEU unless delay is due to proven ''Force Majeure''."
        },
        {
            "number": "9",
            "title": "Insurance & Liability",
            "content": "The Transporter shall take out insurance covering all liabilities under this Agreement. The Transporter shall indemnify The Client against any loss, damage, or liability arising from willful act, default, or negligence."
        },
        {
            "number": "10",
            "title": "Duration & Termination",
            "content": "This Agreement shall be valid for a period of One year from the date of contract and may be subject to renewal upon written consent of both parties. Either party may terminate on 30 working days written notice."
        },
        {
            "number": "11",
            "title": "Confidentiality",
            "content": "The Transporter shall keep confidential any information concerning The Client and shall not divulge the same to any third party except as required by law or for performance of this Agreement."
        },
        {
            "number": "12",
            "title": "Governing Law",
            "content": "This Transportation Contract is governed by the Laws of the United Republic of Tanzania."
        }
    ]'::jsonb,
    'Additional terms: (a) The Transporter must request empty drop off 5 working days prior to truck arrival to Dar. (b) Any extra cost must get approval from the client in writing. (c) All vehicles must be road-worthy with valid C28 licenses. (d) Drivers must have necessary PPE and pass alcohol test.',
    '{
        "client": {
            "label": "The Client",
            "name_placeholder": "{{client_name}}",
            "title_placeholder": "{{client_signatory_title}}"
        },
        "transporter": {
            "label": "The Transporter",
            "name": "Tumaini Josephat Tesha",
            "title": "Chief Executive Officer",
            "company": "Calvary Investment Company Limited"
        },
        "witnesses": {
            "client_witness": true,
            "transporter_witness": true
        }
    }'::jsonb,
    TRUE,
    TRUE
);

-- 5. INSERT DEFAULT RATE SHEET (2025 Rates)
INSERT INTO rate_sheets (
    rate_sheet_name,
    effective_date,
    currency,
    fuel_adjustment_enabled,
    fuel_base_price,
    rates,
    special_conditions,
    is_active
) VALUES (
    'Standard Transit Rates 2025',
    '2025-01-01',
    'USD',
    TRUE,
    1.00,
    '[
        {"from": "DAR PORT", "destination": "KIGALI - RWANDA", "container_20ft": 3100, "container_40ft": 3100, "loose": 3100, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "LUSAKA - ZAMBIA", "container_20ft": 4000, "container_40ft": 4000, "loose": 4000, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "SOLWEZI - ZAMBIA", "container_20ft": 4800, "container_40ft": 4800, "loose": 4800, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "BUJUMBURA - BURUNDI", "container_20ft": 3200, "container_40ft": 3200, "loose": 3200, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "LILONGWE - MALAWI", "container_20ft": 4000, "container_40ft": 4000, "loose": 4000, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "BLANTYRE - MALAWI", "container_20ft": 4400, "container_40ft": 4400, "loose": 4400, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "KITWE - ZAMBIA", "container_20ft": 4000, "container_40ft": 4000, "loose": 4400, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "GOMA - DRC", "container_20ft": 4400, "container_40ft": 4400, "loose": 4400, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "BUKAVU - DRC", "container_20ft": 4800, "container_40ft": 4800, "loose": 4800, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "LUBUMBASHI - DRC", "container_20ft": 6400, "container_40ft": 6400, "loose": 6400, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "KOLWEZI - DRC", "container_20ft": 7200, "container_40ft": 7200, "loose": 7200, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "LIKASI - DRC", "container_20ft": 8500, "container_40ft": 8500, "loose": 8500, "truck_type": "C28", "transit_days": 8}
    ]'::jsonb,
    'Rates to be reviewed and agreed on truck allocation prior to loading due to fuel changes, market rates and 3rd party statutory charges. Prices subject to change with fuel fluctuation.',
    TRUE
);

-- 6. ENABLE RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_templates;
CREATE POLICY "Allow all operations for authenticated users" ON contract_templates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON rate_sheets;
CREATE POLICY "Allow all operations for authenticated users" ON rate_sheets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_documents;
CREATE POLICY "Allow all operations for authenticated users" ON contract_documents
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Contract templates and rate sheets setup complete' as status;
