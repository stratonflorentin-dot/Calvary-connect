import { cn } from "@/lib/utils";

export function driverMarkerHtml(
  isOnline: boolean,
  isSelected: boolean,
  heading = 0,
) {
  const ring = isSelected
    ? "ring-4 ring-blue-400/60 ring-offset-2 shadow-[0_0_24px_rgba(59,130,246,0.55)]"
    : "shadow-lg";
  const bg = isOnline ? "bg-emerald-500" : "bg-slate-400";
  const pulse = isOnline
    ? `<span class="absolute -top-0.5 -right-0.5 flex h-3 w-3">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-300 border-2 border-white"></span>
      </span>`
    : "";

  return `
    <div class="relative group cursor-pointer transition-transform duration-200 hover:scale-110 ${isSelected ? "scale-110" : ""}" style="transform: rotate(${heading}deg)">
      <div class="${cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white",
        bg,
        ring,
      )}">
        <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>
        </svg>
        ${pulse}
      </div>
    </div>
  `;
}

export function borderMarkerHtml(label: string) {
  return `<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-[10px] font-bold text-white shadow-md">${label}</div>`;
}

export function cityMarkerHtml(label: string) {
  return `<div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[9px] font-bold text-white shadow">${label}</div>`;
}

export function popupHtml(driver: {
  driverName: string;
  isOnline: boolean;
  vehiclePlate: string;
  speed: number;
  lastUpdate: string;
}) {
  const status = driver.isOnline ? "Online" : "Offline";
  const statusClass = driver.isOnline
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-600";
  return `
    <div class="font-sans p-1 min-w-[200px]">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="font-semibold text-sm text-[#0f172a]">${driver.driverName}</p>
        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass}">${status}</span>
      </div>
      <div class="space-y-1 text-xs text-slate-500">
        <p><span class="text-slate-400">Vehicle</span> ${driver.vehiclePlate || "—"}</p>
        <p><span class="text-slate-400">Speed</span> ${driver.speed} km/h</p>
        <p><span class="text-slate-400">Updated</span> ${new Date(driver.lastUpdate).toLocaleTimeString()}</p>
      </div>
    </div>
  `;
}
