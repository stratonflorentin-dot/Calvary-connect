-- Migration: Create contracts and contract_history tables with RLS
-- This script creates the complete contract management system tables with proper security

-- ============================================================================
-- Create contracts table
-- ============================================================================
-- Create base table if it does not exist. Columns and constraints are managed below
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Ensure expected columns exist (idempotent)
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS term_months INT,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS client_signatory_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS client_signatory_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS transporter_signatory_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transporter_signatory_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transporter_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS transporter_signed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS preview_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set NOT NULL / defaults where appropriate (use separate statements to avoid errors when column already exists)
-- Set NOT NULL only when the column exists and contains no NULLs (idempotent & safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contract_number')
     AND (SELECT COUNT(*) FROM contracts WHERE contract_number IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN contract_number SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'client_id')
     AND (SELECT COUNT(*) FROM contracts WHERE client_id IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN client_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'effective_date')
     AND (SELECT COUNT(*) FROM contracts WHERE effective_date IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN effective_date SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'expiry_date')
     AND (SELECT COUNT(*) FROM contracts WHERE expiry_date IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN expiry_date SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'term_months')
     AND (SELECT COUNT(*) FROM contracts WHERE term_months IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN term_months SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'created_by')
     AND (SELECT COUNT(*) FROM contracts WHERE created_by IS NULL) = 0 THEN
    ALTER TABLE contracts ALTER COLUMN created_by SET NOT NULL;
  END IF;
END
$$;

-- Add UNIQUE constraint for contract_number if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_contract_number_unique ON contracts(contract_number);

-- Add FK for client_id referencing clients(id) if not exists and referenced table exists
-- Ensure `clients` table exists (create minimal placeholder if missing)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT
);

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'contracts'::regclass AND a.attname = 'client_id'
  ) THEN
    BEGIN
      ALTER TABLE contracts
        ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- Add FK for created_by referencing auth.users(id) if not exists and auth.users exists
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'contracts'::regclass AND a.attname = 'created_by'
  ) THEN
    BEGIN
      ALTER TABLE contracts
        ADD CONSTRAINT contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- Indexes for performance
-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);

-- ============================================================================
-- Create contract_history table
-- ============================================================================
-- Create contract_history base table if not exists
CREATE TABLE IF NOT EXISTS contract_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE contract_history
  ADD COLUMN IF NOT EXISTS contract_id UUID,
  ADD COLUMN IF NOT EXISTS event VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add FK from contract_history.contract_id -> contracts.id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'contract_history'::regclass AND a.attname = 'contract_id'
  ) THEN
    BEGIN
      ALTER TABLE contract_history
        ADD CONSTRAINT contract_history_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- Add FK for user_id -> auth.users if not exists and auth.users exists
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'contract_history'::regclass AND a.attname = 'user_id'
  ) THEN
    BEGIN
      ALTER TABLE contract_history
        ADD CONSTRAINT contract_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_history_contract_id ON contract_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_history_created_at ON contract_history(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_history_user_id ON contract_history(user_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE IF EXISTS contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Contracts Table Policies
-- ============================================================================

-- Policy 1: Authenticated users can view contracts (basic visibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'contracts_authenticated_view' AND polrelid = 'contracts'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY contracts_authenticated_view ON contracts FOR SELECT USING (auth.role() = ''authenticated_user'')';
  END IF;
END
$$;

-- Policy 2: CEO/ADMIN/SALESMAN can create contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'contracts_creator_create' AND polrelid = 'contracts'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY contracts_creator_create ON contracts FOR INSERT WITH CHECK (auth.uid() = created_by AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>''role'' IN (''CEO'',''ADMIN'',''SALESMAN'')))';
  END IF;
END
$$;

-- Policy 3: Creator or admin can update contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'contracts_creator_update' AND polrelid = 'contracts'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY contracts_creator_update ON contracts FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>''role'' IN (''CEO'',''ADMIN''))) WITH CHECK (auth.uid() = created_by OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>''role'' IN (''CEO'',''ADMIN'')))';
  END IF;
END
$$;

-- Policy 4: Delete policy (admin only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'contracts_admin_delete' AND polrelid = 'contracts'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY contracts_admin_delete ON contracts FOR DELETE USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>''role'' = ''ADMIN''))';
  END IF;
END
$$;

-- ============================================================================
-- Contract History Table Policies
-- ============================================================================

-- Policy 1: Authenticated users can view history for contracts they can see
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'history_authenticated_view' AND polrelid = 'contract_history'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY history_authenticated_view ON contract_history FOR SELECT USING (auth.role() = ''authenticated_user'' AND EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_id AND auth.uid() = contracts.created_by OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>''role'' IN (''CEO'',''ADMIN''))))';
  END IF;
END
$$;

-- Policy 2: System can insert history records automatically
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'history_auto_insert' AND polrelid = 'contract_history'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY history_auto_insert ON contract_history FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_id))';
  END IF;
END
$$;

-- ============================================================================
-- Trigger for updated_at column
-- ============================================================================
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger is created idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'contracts') THEN
    PERFORM 1;
  END IF;
  -- drop existing trigger if present, then create
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname = 'contracts_updated_at_trigger') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS contracts_updated_at_trigger ON contracts';
  END IF;
  EXECUTE 'CREATE TRIGGER contracts_updated_at_trigger BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at()';
END
$$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE contracts IS 'Digital contracts with client and transporter signatures';
COMMENT ON TABLE contract_history IS 'Audit trail for contract status changes and events';
-- Add comments only if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='contract_number') THEN
    COMMENT ON COLUMN contracts.contract_number IS 'Format: CT-YYYY-XXXX where YYYY is year and XXXX is 4-digit sequence';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='client_signature_data') THEN
    COMMENT ON COLUMN contracts.client_signature_data IS 'Base64-encoded PNG image of client signature from signature pad';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='transporter_signature_data') THEN
    COMMENT ON COLUMN contracts.transporter_signature_data IS 'Base64-encoded PNG image of transporter signature from signature pad';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='status') THEN
    COMMENT ON COLUMN contracts.status IS 'Workflow: draft → sent → active → (expired OR terminated)';
  END IF;
END
$$;
