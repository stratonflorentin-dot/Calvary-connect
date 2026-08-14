import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUser, getClientAs, getServiceClient, TEST_PREFIX, type TestUser } from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * post_invoice_journal_entry (migration 050) — before this migration,
 * customer invoices never posted to the Chart of Accounts at all: no
 * trigger, no RPC call anywhere in the app. This suite exercises the
 * trigger directly through a real invoice insert, the same path
 * src/app/finance/invoicing/customer-invoices/page.tsx uses, as an
 * ACCOUNTANT — invoices_write (and route-config.ts) restrict invoice
 * creation to CEO/ADMIN/ACCOUNTANT, the same set post_journal_entry's own
 * role check requires, so this specific trigger happens to not need its
 * SECURITY DEFINER + inline posting to bypass a role mismatch. It's
 * still correct as a general pattern: a trigger's SECURITY DEFINER does
 * NOT change what current_user_role() sees (it still reads the real
 * invoking user), so anything wired to a broader set of creator roles
 * than post_journal_entry allows would need this same inline approach.
 */
describe('Invoices: auto-post to the ledger on insert', () => {
  const svc = getServiceClient();
  let accountant: TestUser;
  let client: SupabaseClient;
  const createdInvoiceIds: string[] = [];

  const AR_ACCOUNT = '1104';
  const REVENUE_ACCOUNT = '4002';
  const VAT_ACCOUNT = '2106';

  beforeAll(async () => {
    accountant = await createTestUser('ACCOUNTANT');
    client = await getClientAs(accountant);
  });

  afterEach(async () => {
    if (createdInvoiceIds.length > 0) {
      const { data: invoices } = await svc.from('invoices').select('id, journal_entry_id').in('id', createdInvoiceIds);
      for (const inv of invoices ?? []) {
        if (inv.journal_entry_id) {
          await svc.from('journal_entry_lines').delete().eq('journal_entry_id', inv.journal_entry_id);
          await svc.from('journal_entries').delete().eq('id', inv.journal_entry_id);
        }
      }
      await svc.from('invoices').delete().in('id', createdInvoiceIds);
      createdInvoiceIds.length = 0;
    }
  });

  afterAll(async () => {
    await deleteTestUser(accountant.id);
  });

  async function accountBalance(code: string): Promise<number> {
    const { data } = await svc.from('accounts').select('current_balance').eq('code', code).single();
    return Number(data?.current_balance ?? 0);
  }

  it('posts Dr AR / Cr Revenue / Cr VAT Payable, balanced, as a SALESMAN', async () => {
    const arBefore = await accountBalance(AR_ACCOUNT);
    const revenueBefore = await accountBalance(REVENUE_ACCOUNT);
    const vatBefore = await accountBalance(VAT_ACCOUNT);

    const invoiceNumber = `${TEST_PREFIX}INV-${Date.now()}`;
    const { data: invoice, error } = await client
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_name: `${TEST_PREFIX}Customer`,
        amount: 1_000_000,
        vat_amount: 180_000,
        total_amount: 1_180_000,
        currency: 'TZS',
        status: 'pending',
        type: 'receivable',
        issue_date: '2031-01-15',
        due_date: '2031-02-14',
      })
      .select()
      .single();
    expect(error).toBeNull();
    createdInvoiceIds.push(invoice!.id);

    expect(invoice!.journal_entry_id, 'the insert trigger should stamp journal_entry_id onto the returned row').toBeTruthy();

    const { data: lines } = await svc
      .from('journal_entry_lines')
      .select('account_code, debit_amount, credit_amount')
      .eq('journal_entry_id', invoice!.journal_entry_id);
    const totalDebit = (lines ?? []).reduce((s, l: any) => s + Number(l.debit_amount || 0), 0);
    const totalCredit = (lines ?? []).reduce((s, l: any) => s + Number(l.credit_amount || 0), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(1_180_000, 2);

    const arLine = (lines ?? []).find((l: any) => l.account_code === AR_ACCOUNT);
    const revenueLine = (lines ?? []).find((l: any) => l.account_code === REVENUE_ACCOUNT);
    const vatLine = (lines ?? []).find((l: any) => l.account_code === VAT_ACCOUNT);
    expect(Number(arLine?.debit_amount)).toBeCloseTo(1_180_000, 2);
    expect(Number(revenueLine?.credit_amount)).toBeCloseTo(1_000_000, 2);
    expect(Number(vatLine?.credit_amount)).toBeCloseTo(180_000, 2);

    expect(await accountBalance(AR_ACCOUNT)).toBeCloseTo(arBefore + 1_180_000, 2);
    expect(await accountBalance(REVENUE_ACCOUNT)).toBeCloseTo(revenueBefore + 1_000_000, 2);
    expect(await accountBalance(VAT_ACCOUNT)).toBeCloseTo(vatBefore + 180_000, 2);

    const { data: entry } = await svc.from('journal_entries').select('is_posted, status').eq('id', invoice!.journal_entry_id).single();
    expect(entry?.is_posted).toBe(true);
    expect(entry?.status).toBe('posted');
  });

  it('does not post when vat_amount is zero (no VAT line created)', async () => {
    const invoiceNumber = `${TEST_PREFIX}INV-novat-${Date.now()}`;
    const { data: invoice, error } = await client
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_name: `${TEST_PREFIX}Customer`,
        amount: 500_000,
        vat_amount: 0,
        total_amount: 500_000,
        currency: 'TZS',
        status: 'pending',
        type: 'receivable',
        issue_date: '2031-01-16',
      })
      .select()
      .single();
    expect(error).toBeNull();
    createdInvoiceIds.push(invoice!.id);

    const { data: lines } = await svc
      .from('journal_entry_lines')
      .select('account_code')
      .eq('journal_entry_id', invoice!.journal_entry_id);
    expect((lines ?? []).some((l: any) => l.account_code === VAT_ACCOUNT)).toBe(false);
    expect(lines).toHaveLength(2); // AR + Revenue only
  });

  it('skips legacy "CN-" prefixed rows entirely (no journal_entry_id, no lines)', async () => {
    const invoiceNumber = `CN-${TEST_PREFIX}${Date.now()}`;
    const { data: invoice, error } = await client
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_name: `${TEST_PREFIX}Customer`,
        amount: -200_000,
        total_amount: -200_000,
        currency: 'TZS',
        status: 'issued',
        issue_date: '2031-01-17',
      })
      .select()
      .single();
    expect(error).toBeNull();
    createdInvoiceIds.push(invoice!.id);

    expect(invoice!.journal_entry_id).toBeNull();
  });
});
