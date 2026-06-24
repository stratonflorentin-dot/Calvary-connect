import { FleetComplianceDashboard } from "@/components/fleet/vehicle-compliance-tracker";

export const metadata = {
  title: "Fleet Compliance — Calvary Connect",
  description: "Track vehicle document expiry: insurance, road license, TRA certificates, COMESA yellow card, and TATOA compliance.",
};

export default function FleetCompliancePage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <FleetComplianceDashboard />
    </div>
  );
}
