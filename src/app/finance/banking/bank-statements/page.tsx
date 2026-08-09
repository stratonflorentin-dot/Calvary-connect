"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page used to be a dead-end stub ("Coming soon"). Bank statement
// import and viewing already live at /finance/banking/bank-reconciliation
// (see its `bank_statements` queries) — redirecting here instead of
// duplicating that functionality or leaving a nav item that goes nowhere.
export default function BankStatementsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/banking/bank-reconciliation");
  }, [router]);
  return null;
}

