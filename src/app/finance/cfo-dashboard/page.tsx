import { redirect } from "next/navigation";

// Consolidated: the finance hub at /finance is the single finance dashboard.
export default function CfoDashboardPage() {
  redirect("/finance");
}
