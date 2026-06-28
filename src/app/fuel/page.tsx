import { FuelManagement } from "@/components/financial/fuel-management";

export const metadata = {
  title: "Fuel Management - Calvary Connect",
  description: "Track fuel consumption, costs, and efficiency across the fleet.",
};

export default function FuelManagementPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <FuelManagement />
    </div>
  );
}
