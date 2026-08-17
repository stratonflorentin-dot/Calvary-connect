"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The old flat, all-time-lines-per-account reconciliation view has been
// replaced by the statement-batch model at /finance/banking/bank-statements
// (list) and /finance/banking/bank-statements/[id] (per-batch reconciliation,
// with draft/posted locking and split matching). Redirecting rather than
// leaving a stale dead-end, mirroring how bank-statements used to redirect
// here before this rebuild.
export default function BankReconciliationRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/banking/bank-statements");
  }, [router]);
  return null;
}
