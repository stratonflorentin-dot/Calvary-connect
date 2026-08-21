-- Real bug found live: accepting a quotation is supposed to auto-create
-- its Shipment (the accept route already does this), but the insert has
-- been silently failing since it first shipped — confirmed by testing the
-- exact insert against the live DB: "null value in column origin_country
-- violates not-null constraint". QT-0005 sits accepted with shipment_id
-- still null; zero shipments exist despite a real accepted quotation.
--
-- origin_country/destination_country are NOT NULL, but nothing populates
-- them: quotations only ever captured a single free-text origin/
-- destination (e.g. "ARUSHA" / "LIMPOPO" — a Tanzanian city and a South
-- African province, so even guessing "Tanzania" for both would be wrong
-- for the destination), neither shipment-creation path (the public accept
-- route, the staff "Convert to Shipment" fallback) ever set them, and the
-- shipment detail page only ever displays origin_city/destination_city —
-- these two columns are pure dead weight enforced as required with no
-- code path able to satisfy them honestly. Making them nullable instead
-- of fabricating a guessed country is the correct fix, not a workaround.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE shipments
  ALTER COLUMN origin_country DROP NOT NULL,
  ALTER COLUMN destination_country DROP NOT NULL;

-- Backfill: any quotation that's been sitting accepted this whole time
-- with no shipment to show for it (silently failed on the bug above)
-- gets the shipment it should already have — same shape the accept
-- route itself builds, so this isn't a special case, just catching up
-- on what should have happened automatically.
DO $$
DECLARE
  q RECORD;
  v_shipment_number text;
  v_shipment_id uuid;
BEGIN
  FOR q IN
    SELECT * FROM quotations WHERE status = 'accepted' AND shipment_id IS NULL
  LOOP
    SELECT next_doc_number('shipment') INTO v_shipment_number;
    INSERT INTO shipments (
      shipment_number, quotation_id, customer_id, origin_city, destination_city,
      quoted_amount, currency, status, created_by
    ) VALUES (
      COALESCE(v_shipment_number, 'SH-' || substr(q.id::text, 1, 6)),
      q.id, q.customer_id, q.origin, q.destination,
      q.total_amount, q.currency, 'created', q.created_by
    )
    RETURNING id INTO v_shipment_id;

    UPDATE quotations SET shipment_id = v_shipment_id WHERE id = q.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
