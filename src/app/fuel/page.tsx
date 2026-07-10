import { FuelManagement } from "@/components/financial/fuel-management";
import { PageShell } from "@/components/shell";

export const metadata = {
  title: "Fuel Management - Calvary Connect",
  description: "Track fuel consumption, costs, and efficiency across the fleet.",
};

export default function FuelManagementPage() {
  return (
    <PageShell>
      <FuelManagement />
    </PageShell>
  );
}
