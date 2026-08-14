import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUser, getClientAs, getServiceClient, TEST_PREFIX, type TestUser } from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * credit_notes + post_credit_note (migration 051) replace the old fake
 * credit notes (negative-amount rows inserted into `invoices`, which never
 * posted to the ledger at all). Drafting is open to SALESMAN (matches
 * customers_all's role set); posting to the ledger is not — that goes
 * through post_journal_entry's own CEO/ADMIN/ACCOUNTANT check, so this
 * suite creates the draft as a SALESMAN and posts it as an ACCOUNTANT to
 * prove both halves of that split actually hold.
 */
describe('Credit notes: draft as SALESMAN, post as ACCOUNTANT', () => {
  const svc = getServiceClient();
  let salesman: TestUser;
  let accountant: TestUser;
  let salesClient: SupabaseClient;
  let acctClient: SupabaseClient;
  const createdNoteIds: string[] = [];

  const SALES_RETURNS_ACCOUNT = '4009';
  const VAT_ACCOUNT = '2106';
  const AR_ACCOUNT = '1104';

  beforeAll(async () => {
    salesman = await createTestUser('SALESMAN');
    accountant = await createTestUser('ACCOUNTANT');
    salesClient = await getClientAs(salesman);
    acctClient = await getClientAs(accountant);
  });

  afterEach(async () => {
    if (createdNoteIds.length > 0) {
      const { data: notes } = await svc.from('credit_notes').select('id, journal_entry_id').in('id', createdNoteIds);
      for (const note of notes ?? []) {
        if (note.journal_entry_id) {
          await svc.from('journal_entry_lines').delete().eq('journal_entry_id', note.journal_entry_id);
          await svc.from('journal_entries').delete().eq('id', note.journal_entry_id);
        }
      }
      await svc.from('credit_notes').delete().in('id', createdNoteIds);
      createdNoteIds.length = 0;
    }
  });

  afterAll(async () => {
    await deleteTestUser(salesman.id);
    await deleteTestUser(accountant.id);
  });

  it('SALESMAN can draft a credit note but cannot post it', async () => {
    const { data: note, error } = await salesClient
      .from('credit_notes')
      .insert({
        customer_name: `${TEST_PREFIX}Customer`,
        amount: 400_000,
        vat_amount: 72_000,
        total_amount: 472_000,
        currency: 'TZS',
        issue_date: '2031-02-01',
        reason: 'return',
        status: 'draft',
      })
      .select()
      .single();
    expect(error).toBeNull();
    createdNoteIds.push(note!.id);

    expect(note!.credit_note_number, 'the assign-number trigger should stamp a CN- number even on a draft').toMatch(/^CN-/);
    expect(note!.status).toBe('draft');

    const { error: postErr } = await salesClient.rpc('post_credit_note', { p_id: note!.id });
    expect(postErr, 'a SALESMAN posting a credit note should fail post_journal_entry\'s role check').not.toBeNull();

    const { data: stillDraft } = await svc.from('credit_notes').select('status').eq('id', note!.id).single();
    expect(stillDraft?.status).toBe('draft');
  });

  it('ACCOUNTANT posts a balanced entry: Dr Sales Returns / Dr VAT Payable / Cr AR', async () => {
    const arBefore = (await svc.from('accounts').select('current_balance').eq('code', AR_ACCOUNT).single()).data?.current_balance ?? 0;
    const returnsBefore = (await svc.from('accounts').select('current_balance').eq('code', SALES_RETURNS_ACCOUNT).single()).data?.current_balance ?? 0;

    const { data: note, error } = await acctClient
      .from('credit_notes')
      .insert({
        customer_name: `${TEST_PREFIX}Customer`,
        amount: 300_000,
        vat_amount: 54_000,
        total_amount: 354_000,
        currency: 'TZS',
        issue_date: '2031-02-02',
        reason: 'correction',
        status: 'draft',
      })
      .select()
      .single();
    expect(error).toBeNull();
    createdNoteIds.push(note!.id);

    const { data: entryId, error: postErr } = await acctClient.rpc('post_credit_note', { p_id: note!.id });
    expect(postErr).toBeNull();
    expect(entryId).toBeTruthy();

    const { data: lines } = await svc
      .from('journal_entry_lines')
      .select('account_code, debit_amount, credit_amount')
      .eq('journal_entry_id', entryId as string);
    const totalDebit = (lines ?? []).reduce((s, l: any) => s + Number(l.debit_amount || 0), 0);
    const totalCredit = (lines ?? []).reduce((s, l: any) => s + Number(l.credit_amount || 0), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(354_000, 2);

    const returnsLine = (lines ?? []).find((l: any) => l.account_code === SALES_RETURNS_ACCOUNT);
    const vatLine = (lines ?? []).find((l: any) => l.account_code === VAT_ACCOUNT);
    const arLine = (lines ?? []).find((l: any) => l.account_code === AR_ACCOUNT);
    expect(Number(returnsLine?.debit_amount)).toBeCloseTo(300_000, 2);
    expect(Number(vatLine?.debit_amount)).toBeCloseTo(54_000, 2);
    expect(Number(arLine?.credit_amount)).toBeCloseTo(354_000, 2);

    const { data: updatedNote } = await svc.from('credit_notes').select('status, journal_entry_id').eq('id', note!.id).single();
    expect(updatedNote?.status).toBe('issued');
    expect(updatedNote?.journal_entry_id).toBe(entryId);

    const arAfter = (await svc.from('accounts').select('current_balance').eq('code', AR_ACCOUNT).single()).data?.current_balance;
    const returnsAfter = (await svc.from('accounts').select('current_balance').eq('code', SALES_RETURNS_ACCOUNT).single()).data?.current_balance;
    expect(Number(arAfter)).toBeCloseTo(Number(arBefore) - 354_000, 2);
    expect(Number(returnsAfter)).toBeCloseTo(Number(returnsBefore) + 300_000, 2);
  });

  it('rejects re-posting an already-issued credit note', async () => {
    const { data: note } = await acctClient
      .from('credit_notes')
      .insert({
        customer_name: `${TEST_PREFIX}Customer`,
        amount: 100_000,
        vat_amount: 0,
        total_amount: 100_000,
        currency: 'TZS',
        issue_date: '2031-02-03',
        status: 'draft',
      })
      .select()
      .single();
    createdNoteIds.push(note!.id);

    await acctClient.rpc('post_credit_note', { p_id: note!.id });
    const { error: secondPostErr } = await acctClient.rpc('post_credit_note', { p_id: note!.id });
    expect(secondPostErr).not.toBeNull();
    expect(secondPostErr!.message).toMatch(/already/i);
  });
});
