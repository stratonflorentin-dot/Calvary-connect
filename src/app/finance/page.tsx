"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/finance/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to Finance Dashboard...</p>
    </div>
  );
}
