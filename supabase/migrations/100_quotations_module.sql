-- Wires up the dormant quotations/quotation_lines tables (schema existed,
-- zero rows, no UI anywhere except a dashboard count in management/page.tsx)
-- into a real Quotation builder + list + public accept/reject flow.
--
-- Scope for this pass (explicitly chosen over quote-request intake and a
-- managed line-item-type/route-template catalog, which stay out for now):
-- create/edit/send a quotation, email it with a public link, let the
-- customer accept/reject without logging in, generate a PDF client-side.

insert into document_sequences (doc_type, prefix, next_number, padding)
values ('quotation', 'QT-', 1, 4)
on conflict (doc_type) do nothing;

alter table quotations
  add column if not exists zero_rated_vat boolean not null default false,
  add column if not exists internal_notes text,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists expired_at timestamptz,
  add column if not exists public_token uuid not null default gen_random_uuid();

-- Not already unique — the public /q/[token] page's whole security model
-- depends on this being unguessable and unique.
create unique index if not exists quotations_public_token_key on quotations(public_token);

alter table quotations
  drop constraint if exists quotations_status_check2,
  add constraint quotations_status_check2
    check (status is null or status in ('draft','sent','viewed','accepted','rejected','expired'));

alter table quotation_lines
  add column if not exists duration_days numeric;

-- quotation_lines had no RLS policy at all (quotations itself did) — since
-- RLS is enabled by default on every table in this project's baseline,
-- that means it was either wide open or fully locked, depending on
-- whether RLS was ever turned on for it; either way this makes the
-- intended access explicit rather than accidental.
alter table quotation_lines enable row level security;
drop policy if exists quotation_lines_read on quotation_lines;
create policy quotation_lines_read on quotation_lines for select
  using (current_user_role() in ('CEO','ADMIN','SALESMAN','OPERATOR','ACCOUNTANT'));
drop policy if exists quotation_lines_write on quotation_lines;
create policy quotation_lines_write on quotation_lines for all
  using (current_user_role() in ('CEO','ADMIN','SALESMAN'))
  with check (current_user_role() in ('CEO','ADMIN','SALESMAN'));

-- Widen quotations' own read access to match (quotations_all from
-- migration 040 only ever granted CEO/ADMIN/SALESMAN — OPERATOR/
-- ACCOUNTANT could never even view a quotation).
drop policy if exists quotations_read on quotations;
create policy quotations_read on quotations for select
  using (current_user_role() in ('CEO','ADMIN','SALESMAN','OPERATOR','ACCOUNTANT'));

-- Minimal defaults the builder reads (VAT rate, currency, numbering
-- prefix, terms text) — a full Settings > Documents editing tab is out of
-- scope for this pass, but the builder still needs somewhere real to read
-- these from instead of hardcoding them in the frontend.
alter table company_settings
  add column if not exists default_vat_rate numeric not null default 18,
  add column if not exists quotation_number_prefix text not null default 'QT-',
  add column if not exists quotation_terms_conditions text,
  add column if not exists default_payment_terms_days integer not null default 30;

NOTIFY pgrst, 'reload schema';
