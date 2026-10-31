-- Parts issue flow: close the gap where an approved parts request never
-- actually left the store — stock was never decremented and no movement was
-- recorded. issue_parts_request atomically checks stock, deducts it from
-- spare_parts, writes a stock_movements 'out' row, and marks the request issued.
alter table public.parts_requests
  add column if not exists issued_by uuid,
  add column if not exists issued_at timestamptz;

create or replace function issue_parts_request(p_request_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req  parts_requests%rowtype;
  v_part spare_parts%rowtype;
begin
  select * into v_req from parts_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Parts request not found';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'Only an approved request can be issued (current status: %)', v_req.status;
  end if;

  select * into v_part from spare_parts where id = v_req.part_id for update;
  if v_part.id is null then
    raise exception 'Spare part not found for this request';
  end if;
  if coalesce(v_part.quantity, 0) < v_req.quantity then
    raise exception 'Not enough stock to issue: % in stock, % requested', coalesce(v_part.quantity, 0), v_req.quantity;
  end if;

  update spare_parts
     set quantity = quantity - v_req.quantity,
         updated_at = now()
   where id = v_part.id;

  insert into stock_movements (spare_part_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
  values (v_part.id, 'out', v_req.quantity, v_part.unit_price, 'parts_request', v_req.id,
          'Issued against parts request', auth.uid());

  update parts_requests
     set status = 'issued',
         issued_by = auth.uid(),
         issued_at = now(),
         updated_at = now()
   where id = v_req.id
   returning * into v_req;

  return v_req;
end;
$$;

grant execute on function issue_parts_request(uuid) to authenticated;
