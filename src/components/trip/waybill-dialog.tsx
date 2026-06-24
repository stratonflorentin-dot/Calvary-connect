"use client";

import { format } from "date-fns";
import { Printer, Download, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Company Details (customizable) ──────────────────────────────────────────
const COMPANY = {
  name:      "Calvary Investment Company Ltd",
  address:   "P.O. Box 75941, Dar es Salaam, Tanzania",
  phone:     "+255 XXX XXX XXX",
  email:     "ops@calvary.co.tz",
  tin:       "XXX-XXX-XXX",
  vrn:       "XX-XXXXXX-X",
  tanroads:  "TRL/XXXX/2024",
};

interface WaybillProps {
  trip: {
    id: string;
    trip_number?: string;
    tripNumber?: string;
    origin: string;
    destination: string;
    cargo_type?: string;
    cargoType?: string;
    status: string;
    revenue?: number;
    created_at: string;
    date?: string;
    driver_name?: string;
    driver?: any;
    truck_plate?: string;
    cargo_weight?: number;
    cargoWeight?: number;
    notes?: string;
    client?: string;
    client_name?: string;
    client_id?: string;
    is_cross_border?: boolean;
    border_point?: string;
  };
  client?: {
    company_name?: string;
    address?: string;
    contact_person?: string;
    phone?: string;
    tin?: string;
  };
  open: boolean;
  onClose: () => void;
}

// ─── Waybill HTML Builder ─────────────────────────────────────────────────────
function buildWaybillHTML(trip: WaybillProps["trip"], client: WaybillProps["client"]): string {
  const tripNum = trip.trip_number || trip.tripNumber || trip.id?.slice(0, 8).toUpperCase();
  const tripDate = trip.date || trip.created_at;
  const cargoType = trip.cargo_type || trip.cargoType || "General Cargo";
  const weight = trip.cargo_weight || trip.cargoWeight;
  const driver = trip.driver_name || (typeof trip.driver === "string" ? trip.driver : trip.driver?.name) || "—";
  const plate = trip.truck_plate || "—";
  const clientName = client?.company_name || trip.client_name || "—";
  const clientAddr = client?.address || "—";
  const clientTin = client?.tin || "—";
  const waybillNo = `WB-${tripNum}-${format(new Date(), "yyMMdd")}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Waybill — ${waybillNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
    .page { max-width: 794px; margin: 0 auto; border: 2px solid #1e3a5f; }

    /* Header */
    .header { background: #1e3a5f; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
    .company-name { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
    .company-sub { font-size: 10px; opacity: 0.8; margin-top: 2px; }
    .waybill-title { text-align: right; }
    .waybill-title h2 { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
    .waybill-title .wb-no { font-size: 13px; font-weight: 600; color: #fbbf24; margin-top: 4px; }

    /* Sections */
    .section { padding: 12px 20px; border-bottom: 1px solid #ddd; }
    .section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a5f; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .field { margin-bottom: 6px; }
    .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
    .field-value { font-size: 12px; font-weight: 600; color: #111; margin-top: 2px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }

    /* Route Banner */
    .route-banner { background: #f0f4ff; border-left: 4px solid #1e3a5f; padding: 10px 20px; display: flex; align-items: center; gap: 20px; }
    .route-origin { font-size: 18px; font-weight: 900; color: #1e3a5f; }
    .route-arrow { font-size: 24px; color: #9ca3af; flex: 1; text-align: center; }
    .route-dest { font-size: 18px; font-weight: 900; color: #1e3a5f; }
    .cross-border { background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 99px; letter-spacing: 1px; text-transform: uppercase; }

    /* Cargo table */
    .cargo-table { width: 100%; border-collapse: collapse; }
    .cargo-table th { background: #f3f4f6; padding: 6px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #374151; }
    .cargo-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
    .cargo-table tr:last-child td { border-bottom: none; }

    /* Signatures */
    .sig-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; padding: 14px 20px; }
    .sig-box { border-top: 2px solid #1e3a5f; padding-top: 6px; }
    .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e3a5f; }
    .sig-line { height: 40px; border-bottom: 1px solid #9ca3af; margin: 6px 0; }
    .sig-name { font-size: 10px; color: #6b7280; }

    /* Status stamp */
    .status-stamp { position: absolute; top: 180px; right: 40px; transform: rotate(-15deg); border: 3px solid; padding: 6px 16px; font-size: 18px; font-weight: 900; letter-spacing: 3px; opacity: 0.25; border-radius: 4px; }
    .status-delivered { color: #059669; border-color: #059669; }
    .status-transit { color: #2563eb; border-color: #2563eb; }

    /* Footer */
    .footer { background: #f9fafb; padding: 8px 20px; text-align: center; font-size: 9px; color: #9ca3af; }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page" style="position:relative">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${COMPANY.name}</div>
      <div class="company-sub">${COMPANY.address}</div>
      <div class="company-sub">TIN: ${COMPANY.tin} | VRN: ${COMPANY.vrn}</div>
    </div>
    <div class="waybill-title">
      <h2>WAYBILL</h2>
      <div class="wb-no">${waybillNo}</div>
      <div style="font-size:10px;color:#93c5fd;margin-top:2px">${format(new Date(tripDate), "dd MMM yyyy")}</div>
    </div>
  </div>

  <!-- Route -->
  <div class="route-banner">
    <div class="route-origin">📍 ${trip.origin}</div>
    <div class="route-arrow">→</div>
    <div class="route-dest">📍 ${trip.destination}</div>
    ${trip.is_cross_border ? `<span class="cross-border">🌍 Cross-Border${trip.border_point ? ` · ${trip.border_point}` : ""}</span>` : ""}
  </div>

  <!-- Consignor & Consignee -->
  <div class="section">
    <div class="grid-2">
      <div>
        <div class="section-title">Consignor (Sender)</div>
        <div class="field">
          <div class="field-label">Company</div>
          <div class="field-value">${COMPANY.name}</div>
        </div>
        <div class="field">
          <div class="field-label">Address</div>
          <div class="field-value">${COMPANY.address}</div>
        </div>
        <div class="field">
          <div class="field-label">TIN</div>
          <div class="field-value">${COMPANY.tin}</div>
        </div>
      </div>
      <div>
        <div class="section-title">Consignee (Recipient)</div>
        <div class="field">
          <div class="field-label">Company</div>
          <div class="field-value">${clientName}</div>
        </div>
        <div class="field">
          <div class="field-label">Address</div>
          <div class="field-value">${clientAddr}</div>
        </div>
        <div class="field">
          <div class="field-label">TIN</div>
          <div class="field-value">${clientTin}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Vehicle & Driver -->
  <div class="section">
    <div class="section-title">Transport Details</div>
    <div class="grid-3">
      <div class="field">
        <div class="field-label">Truck Plate</div>
        <div class="field-value">${plate}</div>
      </div>
      <div class="field">
        <div class="field-label">Driver Name</div>
        <div class="field-value">${driver}</div>
      </div>
      <div class="field">
        <div class="field-label">Trip Reference</div>
        <div class="field-value">${tripNum}</div>
      </div>
      <div class="field">
        <div class="field-label">Dispatch Date</div>
        <div class="field-value">${format(new Date(tripDate), "dd/MM/yyyy")}</div>
      </div>
      <div class="field">
        <div class="field-label">TANROADS Licence</div>
        <div class="field-value">${COMPANY.tanroads}</div>
      </div>
      <div class="field">
        <div class="field-label">Service Type</div>
        <div class="field-value">${cargoType}</div>
      </div>
    </div>
  </div>

  <!-- Cargo -->
  <div class="section">
    <div class="section-title">Cargo Details</div>
    <table class="cargo-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Type</th>
          <th>Weight (MT)</th>
          <th>Declared Value</th>
          <th>Condition</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>${trip.notes || cargoType + " — as described by consignor"}</td>
          <td>${cargoType}</td>
          <td>${weight ? weight + " MT" : "—"}</td>
          <td>${trip.revenue ? "TZS " + Number(trip.revenue).toLocaleString() : "—"}</td>
          <td>Good Order</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Terms -->
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p style="font-size:9px;color:#6b7280;line-height:1.6">
      The carrier acknowledges receipt of the above consignment in apparent good order and condition unless otherwise stated.
      Transport is subject to Tanzania Road Traffic Act, TANROADS regulations, and carrier's standard terms. Liability limited to declared cargo value.
      Claims must be notified within 24 hours of delivery. This waybill constitutes a legally binding contract of carriage.
    </p>
  </div>

  <!-- Signatures -->
  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-label">Consignor / Sender</div>
      <div class="sig-line"></div>
      <div class="sig-name">Name: ________________________</div>
      <div class="sig-name">Date: _________________________</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Driver Acknowledgement</div>
      <div class="sig-line"></div>
      <div class="sig-name">Driver: ${driver}</div>
      <div class="sig-name">Date: _________________________</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Consignee / Recipient</div>
      <div class="sig-line"></div>
      <div class="sig-name">Name: ________________________</div>
      <div class="sig-name">Date: _________________________</div>
    </div>
  </div>

  <!-- Status Stamp -->
  <div class="status-stamp ${trip.status?.toLowerCase()?.includes("deliver") ? "status-delivered" : "status-transit"}">
    ${trip.status?.toUpperCase() || "IN TRANSIT"}
  </div>

  <!-- Footer -->
  <div class="footer">
    ${COMPANY.name} · ${COMPANY.address} · Tel: ${COMPANY.phone} · ${COMPANY.email} · TIN: ${COMPANY.tin}
    <br/>This document was generated electronically by Calvary Connect Fleet Management System
  </div>
</div>
</body>
</html>`;
}

// ─── Waybill Dialog Component ─────────────────────────────────────────────────
export function WaybillDialog({ trip, client, open, onClose }: WaybillProps) {
  const printWaybill = () => {
    const html = buildWaybillHTML(trip, client);
    const win = window.open("", "_blank", "width=850,height=1100");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  const downloadWaybill = () => {
    const html = buildWaybillHTML(trip, client);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tripNum = trip.trip_number || trip.tripNumber || trip.id?.slice(0, 8);
    a.download = `Waybill-${tripNum}-${format(new Date(), "yyyyMMdd")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tripNum = trip?.trip_number || trip?.tripNumber || trip?.id?.slice(0, 8).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-blue-600" />
            Waybill — {tripNum}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Preview summary */}
          <div className="bg-slate-50 rounded-xl p-4 border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Route</span>
              <span className="font-semibold">{trip.origin} → {trip.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cargo</span>
              <span className="font-medium">{trip.cargo_type || trip.cargoType || "General"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client</span>
              <span className="font-medium">{client?.company_name || trip.client_name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="font-medium">{format(new Date(trip.date || trip.created_at), "dd MMM yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                trip.status?.toLowerCase()?.includes("deliver") ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>{trip.status}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-200 flex items-start gap-2">
            <CheckCircle2 className="size-4 text-blue-500 mt-0.5 shrink-0" />
            <span>This waybill includes TANROADS compliance details, consignor/consignee info, cargo details, and signature boxes.</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={printWaybill} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="size-4 mr-2" />
              Print Waybill
            </Button>
            <Button onClick={downloadWaybill} variant="outline">
              <Download className="size-4 mr-2" />
              Download HTML
            </Button>
          </div>

          <Button variant="ghost" className="w-full text-slate-500" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
