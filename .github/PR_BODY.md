## Apply icon fallback and Supabase query fixes

Summary
- Adds a client-side icon fallback to avoid runtime ReferenceError crashes.
- Replaces fragile PostgREST relationship selectors with safer selects (`customers(...)`).
- Makes AI DB context queries resilient to missing tables/relationships.

Key changes
- Added: `src/components/icons/IconFallback.client.tsx`
- Updated: `src/components/shared/notifications-bell.tsx`, `src/components/fleet-map/fleet-map-view.tsx`, `src/app/admin/settings/page.tsx`
- Updated: `src/app/sales/page.tsx` (changed `customers!customer_id(...)` → `customers(...)`)
- Updated: `src/lib/ai-database-context.ts` (added `safeQuery` & fallbacks)

Why
- Prevent UI crashes from missing icon imports and reduce PostgREST 400/404 caused by malformed relationship selectors or absent FK relationships; make AI context tolerant to partial DB access.

Checklist
- [ ] Run local dev server and verify main flows
- [ ] Inspect Network tab for remaining 400/404 PostgREST errors
- [ ] Merge after review

Testing notes
- Start dev: `npm run dev -p 3000`
- Confirm no ReferenceError for `AlertCircle` in DevTools Console
- Run targeted curl checks for Supabase endpoints (replace <ANON_KEY>):
```bash
curl -i "https://qaqonhjeqtlatqsrqcnx.supabase.co/rest/v1/maintenance_records?select=*,vehicles(plate_number)&order=date.desc&limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Accept: application/json"
```
