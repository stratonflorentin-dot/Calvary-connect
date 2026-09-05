"use client";

import { useMemo, useState } from "react";
import { PageShell, PageHeader, SectionCard, StatCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import {
  Banknote,
  Calculator,
  Landmark,
  Percent,
  PiggyBank,
  TrendingDown,
} from "lucide-react";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];

const FREQUENCIES = [
  { value: "12", label: "Monthly" },
  { value: "4", label: "Quarterly" },
  { value: "2", label: "Semi-annual" },
  { value: "1", label: "Annual" },
];

const FEE_MODES = [
  { value: "percent", label: "% of principal" },
  { value: "fixed", label: "Fixed amount" },
];

type Method = "reducing" | "flat";

interface ScheduleRow {
  period: number;
  opening: number;
  payment: number;
  principal: number;
  interest: number;
  closing: number;
  cumulativeInterest: number;
}

function fmt(value: number, currency: string) {
  if (!Number.isFinite(value)) return "—";
  return `${currency} ${value.toLocaleString("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Reducing-balance (EMI) amortization — interest charged only on the
 * outstanding balance each period, same method Salio's calculator
 * recommends over flat rate. `extraPayment` (if any) is applied on top of
 * the fixed installment and shortens the schedule instead of just
 * lowering the last payment.
 */
function buildReducingSchedule(principal: number, periodicRate: number, periods: number, extraPayment: number): { schedule: ScheduleRow[]; payment: number } {
  const payment = periodicRate === 0
    ? principal / periods
    : (principal * periodicRate * Math.pow(1 + periodicRate, periods)) / (Math.pow(1 + periodicRate, periods) - 1);

  const schedule: ScheduleRow[] = [];
  let balance = principal;
  let cumulativeInterest = 0;
  let period = 0;
  // Capped at 2x the nominal term — a large extra payment shortens the
  // loan, never lengthens it, so this only guards against a pathological
  // input (e.g. rate/period combination that never amortizes) from
  // looping forever.
  const guard = periods * 2 + 24;

  while (balance > 0.5 && period < guard) {
    period += 1;
    const interestPortion = balance * periodicRate;
    let principalPortion = payment - interestPortion + extraPayment;
    if (principalPortion > balance) principalPortion = balance;
    if (principalPortion < 0) principalPortion = 0;
    const periodPayment = interestPortion + principalPortion;
    const closing = balance - principalPortion;
    cumulativeInterest += interestPortion;
    schedule.push({ period, opening: balance, payment: periodPayment, principal: principalPortion, interest: interestPortion, closing, cumulativeInterest });
    balance = closing;
  }

  return { schedule, payment };
}

/** Flat rate — interest computed once on the original principal and
 * spread evenly; principal is also repaid in equal instalments regardless
 * of balance. Extra payments don't reduce the precomputed interest, which
 * is exactly why flat-rate loans cost more than reducing-balance ones for
 * the same headline rate — shown side by side so that's visible, not
 * asserted. */
function buildFlatSchedule(principal: number, annualRatePct: number, totalMonths: number, periods: number): { schedule: ScheduleRow[]; payment: number; totalInterest: number } {
  const totalInterest = principal * (annualRatePct / 100) * (totalMonths / 12);
  const payment = (principal + totalInterest) / periods;
  const principalPerPeriod = principal / periods;
  const interestPerPeriod = totalInterest / periods;

  const schedule: ScheduleRow[] = [];
  let balance = principal;
  let cumulativeInterest = 0;
  for (let period = 1; period <= periods; period++) {
    const principalPortion = period === periods ? balance : principalPerPeriod;
    const closing = balance - principalPortion;
    cumulativeInterest += interestPerPeriod;
    schedule.push({ period, opening: balance, payment: principalPortion + interestPerPeriod, principal: principalPortion, interest: interestPerPeriod, closing, cumulativeInterest });
    balance = closing;
  }
  return { schedule, payment, totalInterest };
}

export default function CompanyLoanCalculatorPage() {
  const { role, isLoading: roleLoading } = useRole();
  const canView = !roleLoading && ["CEO", "ADMIN", "HR", "ACCOUNTANT"].includes(String(role || "").toUpperCase());

  const [principal, setPrincipal] = useState("50000000");
  const [annualRate, setAnnualRate] = useState("18");
  const [years, setYears] = useState("3");
  const [months, setMonths] = useState("0");
  const [frequency, setFrequency] = useState("12");
  const [method, setMethod] = useState<Method>("reducing");
  const [currency, setCurrency] = useState("TZS");
  const [extraPayment, setExtraPayment] = useState("0");

  const [processingFeeMode, setProcessingFeeMode] = useState<"percent" | "fixed">("percent");
  const [processingFee, setProcessingFee] = useState("1");
  const [legalFeeMode, setLegalFeeMode] = useState<"percent" | "fixed">("fixed");
  const [legalFee, setLegalFee] = useState("0");
  const [insuranceAnnualPct, setInsuranceAnnualPct] = useState("0");

  const result = useMemo(() => {
    const P = Number(principal) || 0;
    const rate = Number(annualRate) || 0;
    const y = Number(years) || 0;
    const m = Number(months) || 0;
    const periodsPerYear = Number(frequency);
    const extra = Number(extraPayment) || 0;
    const totalMonths = y * 12 + m;
    const totalPeriods = Math.max(1, Math.round(totalMonths / (12 / periodsPerYear)));
    const periodicRate = rate / 100 / periodsPerYear;

    if (P <= 0 || totalMonths <= 0) return null;

    const withExtra = method === "reducing"
      ? buildReducingSchedule(P, periodicRate, totalPeriods, extra)
      : buildFlatSchedule(P, rate, totalMonths, totalPeriods);
    const withoutExtra = method === "reducing" && extra > 0
      ? buildReducingSchedule(P, periodicRate, totalPeriods, 0)
      : null;

    const totalInterest: number = withExtra.schedule[withExtra.schedule.length - 1]?.cumulativeInterest ?? 0;

    const procFee = processingFeeMode === "percent" ? P * (Number(processingFee) || 0) / 100 : Number(processingFee) || 0;
    const legFee = legalFeeMode === "percent" ? P * (Number(legalFee) || 0) / 100 : Number(legalFee) || 0;
    const insurancePerPeriod = P * (Number(insuranceAnnualPct) || 0) / 100 / periodsPerYear;
    const totalInsurance = insurancePerPeriod * withExtra.schedule.length;

    const totalCost = P + totalInterest + procFee + legFee + totalInsurance;

    const savings = withoutExtra
      ? {
          periodsSaved: withoutExtra.schedule.length - withExtra.schedule.length,
          interestSaved: (withoutExtra.schedule[withoutExtra.schedule.length - 1]?.cumulativeInterest ?? 0) - totalInterest,
        }
      : null;

    return {
      totalPeriods,
      periodicRate,
      payment: withExtra.payment,
      insurancePerPeriod,
      totalPerPeriod: withExtra.payment + insurancePerPeriod,
      schedule: withExtra.schedule,
      totalInterest,
      procFee,
      legFee,
      totalInsurance,
      totalCost,
      savings,
      periodsPerYear,
    };
  }, [principal, annualRate, years, months, frequency, method, extraPayment, processingFeeMode, processingFee, legalFeeMode, legalFee, insuranceAnnualPct]);

  const frequencyLabel = FREQUENCIES.find((f) => f.value === frequency)?.label ?? "period";

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <div className="text-center bg-card p-8 rounded-2xl border shadow-sm max-w-md w-full mx-auto mt-24">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access denied</h1>
          <p className="text-muted-foreground text-sm">You do not have permission to view the loan calculator.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="HR"
        title="Company Loan Calculator"
        subtitle="Plan a loan the company is taking — reducing-balance vs flat rate, fees, and the full repayment schedule. Nothing here is saved."
        icon={Landmark}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Loan details" icon={Calculator} className="lg:col-span-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs mb-1.5 block">Loan amount</Label>
                <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Annual interest rate (%)</Label>
                <Input type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Tenure — years</Label>
                <Input type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Tenure — months</Label>
                <Input type="number" min={0} max={11} value={months} onChange={(e) => setMonths(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Payment frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Calculation method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reducing">Reducing balance (EMI) — recommended</SelectItem>
                  <SelectItem value="flat">Flat rate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {method === "reducing" && (
              <div>
                <Label className="text-xs mb-1.5 block">Extra principal payment per period (optional)</Label>
                <Input type="number" value={extraPayment} onChange={(e) => setExtraPayment(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">Paid on top of the fixed instalment — shortens the loan instead of just reducing the last payment.</p>
              </div>
            )}

            <div className="pt-3 border-t border-border space-y-3">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Upfront fees & insurance</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Processing fee</Label>
                  <Input type="number" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">&nbsp;</Label>
                  <Select value={processingFeeMode} onValueChange={(v) => setProcessingFeeMode(v as "percent" | "fixed")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_MODES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Legal fee</Label>
                  <Input type="number" value={legalFee} onChange={(e) => setLegalFee(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">&nbsp;</Label>
                  <Select value={legalFeeMode} onValueChange={(v) => setLegalFeeMode(v as "percent" | "fixed")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_MODES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Insurance (% of principal per year)</Label>
                  <Input type="number" value={insuranceAnnualPct} onChange={(e) => setInsuranceAnnualPct(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <SectionCard title="Repayment summary" icon={Banknote}>
              <p className="text-sm text-muted-foreground">Enter a loan amount and tenure to see the repayment plan.</p>
            </SectionCard>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={`Payment / ${frequencyLabel.toLowerCase()}`} value={fmt(result.payment, currency)} icon={Banknote} accent="bg-primary/10 text-primary" />
                <StatCard label="Total interest" value={fmt(result.totalInterest, currency)} icon={Percent} accent="bg-warning/10 text-warning" />
                <StatCard label="Total cost" value={fmt(result.totalCost, currency)} sub="Principal + interest + fees" icon={Landmark} accent="bg-info/10 text-info" />
                <StatCard label="Number of payments" value={result.schedule.length} icon={Calculator} />
              </div>

              {result.savings && (result.savings.interestSaved > 0.5 || result.savings.periodsSaved > 0) && (
                <SectionCard title="Extra payment impact" icon={PiggyBank}>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-2xl font-black text-success">{fmt(result.savings.interestSaved, currency)}</p>
                      <p className="text-xs text-muted-foreground">Interest saved</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-success">{result.savings.periodsSaved}</p>
                      <p className="text-xs text-muted-foreground">{frequencyLabel.toLowerCase()} period(s) saved</p>
                    </div>
                  </div>
                </SectionCard>
              )}

              <SectionCard
                title="Cost breakdown"
                icon={TrendingDown}
                subtitle={method === "reducing" ? "Reducing balance — interest charged only on the outstanding balance" : "Flat rate — interest charged on the original principal throughout"}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground block">Principal</span><span className="font-bold">{fmt(Number(principal) || 0, currency)}</span></div>
                  <div><span className="text-muted-foreground block">Total interest</span><span className="font-bold">{fmt(result.totalInterest, currency)}</span></div>
                  <div><span className="text-muted-foreground block">Processing fee</span><span className="font-bold">{fmt(result.procFee, currency)}</span></div>
                  <div><span className="text-muted-foreground block">Legal fee</span><span className="font-bold">{fmt(result.legFee, currency)}</span></div>
                  <div><span className="text-muted-foreground block">Insurance ({result.periodsPerYear === 12 ? "monthly" : frequencyLabel.toLowerCase()})</span><span className="font-bold">{fmt(result.insurancePerPeriod, currency)}</span></div>
                  <div><span className="text-muted-foreground block">Total insurance</span><span className="font-bold">{fmt(result.totalInsurance, currency)}</span></div>
                </div>
              </SectionCard>

              <SectionCard title="Amortization schedule" subtitle={`${result.schedule.length} ${frequencyLabel.toLowerCase()} payment(s)`} padded={false}>
                <div className="max-h-[420px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                        <TableHead className="text-right">% complete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.schedule.map((row) => (
                        <TableRow key={row.period}>
                          <TableCell className="font-mono text-xs">{row.period}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(row.opening, currency)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{fmt(row.payment, currency)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(row.principal, currency)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{fmt(row.interest, currency)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(row.closing, currency)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{(((Number(principal) || 1) - row.closing) / (Number(principal) || 1) * 100).toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
