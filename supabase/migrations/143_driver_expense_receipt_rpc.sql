-- Allow a driver to attach a receipt to their own already-synced expense,
-- without granting permission to edit financial fields on expenses.
create or replace function public.attach_driver_expense_receipt(
  p_expense_id uuid,
  p_receipt_url text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_receipt_url is null or length(trim(p_receipt_url)) = 0 then
    raise exception 'Receipt URL is required';
  end if;

  update public.expenses
     set receipt_url = p_receipt_url,
         updated_at = now()
   where id = p_expense_id
     and driver_id = auth.uid()::text;

  if not found then
    raise exception 'Expense was not found for this driver';
  end if;
end;
$$;

revoke all on function public.attach_driver_expense_receipt(uuid, text) from public, anon;
grant execute on function public.attach_driver_expense_receipt(uuid, text) to authenticated;

insert into public.schema_migrations(version)
values ('143_driver_expense_receipt_rpc.sql')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
