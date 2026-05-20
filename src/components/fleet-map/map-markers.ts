function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** Inline-styled markers — Tailwind does not apply inside Leaflet divIcon HTML. */
export function driverMarkerHtml(
  driverName: string,
  isOnline: boolean,
  isSelected: boolean,
) {
  const bg = isOnline ? "#10b981" : "#64748b";
  const ring = isSelected
    ? "box-shadow:0 0 0 4px rgba(41,82,163,0.55), 0 0 20px rgba(41,82,163,0.35);"
    : "box-shadow:0 4px 16px rgba(15,23,42,0.35);";
  const pulse = isOnline
    ? `<span style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;background:#6ee7b7;border:2px solid #fff;border-radius:50%;animation:fleet-pulse 1.5s ease-out infinite;"></span>`
    : "";
  const label = esc(driverName.split(" ")[0] || "Driver");

  return `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="position:relative;width:52px;height:52px;border-radius:50%;background:${bg};border:3px solid #ffffff;${ring}display:flex;align-items:center;justify-content:center;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>
        </svg>
        ${pulse}
      </div>
      <div style="margin-top:5px;padding:3px 10px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;border-radius:8px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 10px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;">
        ${label}
      </div>
    </div>
  `;
}

export function borderMarkerHtml(label: string) {
  return `<div style="width:28px;height:28px;border-radius:50%;background:#0ea5e9;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${esc(label)}</div>`;
}

export function cityMarkerHtml(label: string) {
  return `<div style="width:24px;height:24px;border-radius:50%;background:#6366f1;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.15);">${esc(label)}</div>`;
}

export function popupHtml(driver: {
  driverName: string;
  isOnline: boolean;
  vehiclePlate: string;
  speed: number;
  lastUpdate: string;
}) {
  const status = driver.isOnline ? "Online" : "Offline";
  const statusBg = driver.isOnline ? "#d1fae5" : "#f1f5f9";
  const statusColor = driver.isOnline ? "#047857" : "#475569";
  const time = driver.lastUpdate
    ? new Date(driver.lastUpdate).toLocaleString()
    : "—";

  return `
    <div style="font-family:system-ui,sans-serif;padding:4px;min-width:200px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0;">${esc(driver.driverName)}</p>
        <span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;background:${statusBg};color:${statusColor};">${status}</span>
      </div>
      <div style="font-size:12px;color:#64748b;line-height:1.5;">
        <p style="margin:0 0 4px;"><strong>Vehicle:</strong> ${esc(driver.vehiclePlate || "—")}</p>
        <p style="margin:0 0 4px;"><strong>Speed:</strong> ${driver.speed} km/h</p>
        <p style="margin:0;"><strong>Updated:</strong> ${esc(time)}</p>
      </div>
    </div>
  `;
}

export const DRIVER_MARKER_SIZE: [number, number] = [56, 78];
export const DRIVER_MARKER_ANCHOR: [number, number] = [28, 26];
