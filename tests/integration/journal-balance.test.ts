import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUser, getClientAs, getServiceClient, type TestUser } from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * post_journal_entry (supabase/migrations/006_finance_foundation.sql) is
 * the one place every posting path in this app funnels through —
 * post_payroll_period, post_bank_transaction, and any direct journal
 * entry all end up calling it. It already enforces debits === credits
 * at the database level (RAISE EXCEPTION if not balanced) before this
 * suite ever ran; these tests exist to (a) prove that guard actually
 * works, not just that the code exists, and (b) catch a regression if
 * anyone ever "simplifies" post_journal_entry and drops the check.
 */
describe('Journal entries: debits must equal credits', () => {
  const svc = getServiceClient();
  let accountant: TestUser;
  let client: SupabaseClient;
  const createdEntryIds: string[] = [];

  // Real seeded accounts from supabase/migrations/000_legacy_base_schema.sql
  const DEBIT_ACCOUNT = '1102'; // Bank Account
  const CREDIT_ACCOUNT = '4101'; // Local Transport Revenue

  beforeAll(async () => {
    accountant = await createTestUser('ACCOUNTANT');
    client = await getClientAs(accountant);
  });

  afterEach(async () => {
    // journal_entry_lines cascade-delete with their entry. Posted entries
    // are deliberately skipped — guard_posted_journal (006_finance_
    // foundation.sql) blocks deleting a posted entry even for the
    // service-role client, since it's a trigger, not an RLS policy, and
    // triggers aren't bypassed by RLS bypass. Left as harmless tagged
    // test data (far-future date, "itest" description) in what's always
    // a disposable local database anyway.
    if (createdEntryIds.length > 0) {
      const { data: draftOnly } = await svc.from('journal_entries').select('id').in('id', createdEntryIds).eq('is_posted', false);
      const idsToDelete = (draftOnly ?? []).map((e: any) => e.id);
      if (idsToDelete.length > 0) await svc.from('journal_entries').delete().in('id', idsToDelete);
      createdEntryIds.length = 0;
    }
  });

  afterAll(async () => {
    await deleteTestUser(accountant.id);
  });

  async function createDraftEntry(lines: { account_code: string; debit_amount?: number; credit_amount?: number }[]) {
    const { data: entry, error } = await svc
      .from('journal_entries')
      .insert({ entry_date: '2031-01-15', description: 'itest journal balance', status: 'draft', is_posted: false })
      .select('id')
      .single();
    if (error) throw error;
    createdEntryIds.push(entry.id);

    const { error: lineErr } = await svc.from('journal_entry_lines').insert(
      lines.map((l) => ({ journal_entry_id: entry.id, account_code: l.account_code, debit_amount: l.debit_amount ?? 0, credit_amount: l.credit_amount ?? 0 })),
    );
    if (lineErr) throw lineErr;

    return entry.id as string;
  }

  it('rejects posting an unbalanced entry', async () => {
    const entryId = await createDraftEntry([
      { account_code: DEBIT_ACCOUNT, debit_amount: 100_000 },
      { account_code: CREDIT_ACCOUNT, credit_amount: 90_000 }, // deliberately short by 10,000
    ]);

    const { error } = await client.rpc('post_journal_entry', { p_id: entryId });
    expect(error, 'posting an unbalanced entry must fail').not.toBeNull();
    expect(error!.message).toMatch(/not balanced/i);

    const { data: entry } = await svc.from('journal_entries').select('status, is_posted').eq('id', entryId).single();
    expect(entry?.is_posted, 'a rejected post must not have flipped is_posted').toBe(false);
  });

  it('rejects posting an entry with no lines', async () => {
    const entryId = await createDraftEntry([]);
    const { error } = await client.rpc('post_journal_entry', { p_id: entryId });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/no lines/i);
  });

  it('posts a balanced entry and the lines still balance afterward', async () => {
    const entryId = await createDraftEntry([
      { account_code: DEBIT_ACCOUNT, debit_amount: 250_000 },
      { account_code: CREDIT_ACCOUNT, credit_amount: 250_000 },
    ]);

    const { error } = await client.rpc('post_journal_entry', { p_id: entryId });
    expect(error).toBeNull();

    const { data: entry } = await svc.from('journal_entries').select('status, is_posted, total_debit, total_credit').eq('id', entryId).single();
    expect(entry?.is_posted).toBe(true);
    expect(entry?.status).toBe('posted');
    expect(Number(entry?.total_debit)).toBe(250_000);
    expect(Number(entry?.total_credit)).toBe(250_000);
  });

  it('rejects re-posting an already-posted entry', async () => {
    const entryId = await createDraftEntry([
      { account_code: DEBIT_ACCOUNT, debit_amount: 50_000 },
      { account_code: CREDIT_ACCOUNT, credit_amount: 50_000 },
    ]);
    await client.rpc('post_journal_entry', { p_id: entryId });

    const { error } = await client.rpc('post_journal_entry', { p_id: entryId });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/already posted/i);
  });

  it('every currently-posted journal entry in the database balances (regression net over whatever else has run: payroll postings, etc.)', async () => {
    const { data: postedEntries, error } = await svc.from('journal_entries').select('id').eq('is_posted', true);
    expect(error).toBeNull();

    for (const entry of postedEntries ?? []) {
      const { data: lines } = await svc.from('journal_entry_lines').select('debit_amount, credit_amount').eq('journal_entry_id', entry.id);
      const totalDebit = (lines ?? []).reduce((s, l: any) => s + Number(l.debit_amount || 0), 0);
      const totalCredit = (lines ?? []).reduce((s, l: any) => s + Number(l.credit_amount || 0), 0);
      expect(totalDebit, `journal entry ${entry.id} is unbalanced`).toBeCloseTo(totalCredit, 2);
    }
  });
});
