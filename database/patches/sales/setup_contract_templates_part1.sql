-- ==========================================
-- CONTRACT TEMPLATES - PART 1: Tables
-- ==========================================

-- Contract Templates Table
CREATE TABLE IF NOT EXISTS contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL DEFAULT 'transportation',
    company_name VARCHAR(255) DEFAULT 'Calvary Investment Company Limited',
    company_address TEXT DEFAULT 'P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania',
    company_logo_url TEXT,
    company_stamp_url TEXT,
    ceo_name VARCHAR(255) DEFAULT 'Tumaini Josephat Tesha',
    ceo_title VARCHAR(100) DEFAULT 'Chief Executive Officer',
    contract_title VARCHAR(255) DEFAULT 'TRANSPORTATION AGREEMENT',
    preamble TEXT,
    clauses JSONB DEFAULT '[]'::jsonb,
    terms_conditions TEXT,
    signature_blocks JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Rate Sheets Table
CREATE TABLE IF NOT EXISTS rate_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_sheet_name VARCHAR(100) NOT NULL,
    contract_template_id UUID REFERENCES contract_templates(id),
    effective_date DATE NOT NULL,
    expiry_date DATE,
    currency VARCHAR(3) DEFAULT 'USD',
    fuel_adjustment_enabled BOOLEAN DEFAULT TRUE,
    fuel_base_price DECIMAL(10,2),
    rates JSONB NOT NULL DEFAULT '[]'::jsonb,
    special_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Contract Documents Table
CREATE TABLE IF NOT EXISTS contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id),
    template_id UUID REFERENCES contract_templates(id),
    document_type VARCHAR(50) DEFAULT 'main_agreement',
    document_number VARCHAR(50),
    document_html TEXT,
    document_pdf_url TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT 'Part 1 complete - Tables created' as status;
