-- Petty Cash was resolving its linked Chart of Accounts row by name-matching
-- ("%petty cash%") at runtime — works, but isn't a real persisted link, and
-- would silently misbehave if a second "Petty Cash"-named account ever
-- exists. This makes it an explicit, stored link instead, same pattern as
-- bank_accounts.coa_account_code.

create table petty_cash_settings (
  id boolean primary key default true,
  account_code text not null references accounts(code),
  updated_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  -- Single-row table: only `true` is ever a valid id.
  constraint petty_cash_settings_singleton check (id)
);

-- Seed from whatever the app was already resolving by name — if there's
-- more than one match, this expects the app owner to correct it via the
-- page's "Change linked account" control after review.
insert into petty_cash_settings (account_code)
select code from accounts where name ilike '%petty cash%' and is_postable = true order by code limit 1
on conflict (id) do nothing;

alter table petty_cash_settings enable row level security;

create policy petty_cash_settings_read on petty_cash_settings
  for select using (auth.uid() is not null);

create policy petty_cash_settings_write on petty_cash_settings
  for all using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

NOTIFY pgrst, 'reload schema';
