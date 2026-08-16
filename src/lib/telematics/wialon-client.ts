// Server-only Wialon Remote API client. Never import this from client
// components — it reads WIALON_API_TOKEN, which must stay server-side.
//
// Confirmed live against Calvary's account (token/login + core/search_items
// with flags 1025 = base fields + position, which also carries the last
// message's io_ parameters — including io_239, the "Engine ignition sensor"
// configured on every checked unit). No fuel-level sensor is configured on
// any unit checked so far, so fuel_level_pct stays null from this source —
// see the fraud engine's POSSIBLE_SIPHONING rule, which correctly produces
// nothing without it.

const WIALON_BASE_URL = process.env.WIALON_API_BASE_URL || "https://hst-api.wialon.com";
const WIALON_TOKEN = process.env.WIALON_API_TOKEN;

async function wialonCall(svc: string, params: object, sid?: string): Promise<any> {
  const url = new URL(`${WIALON_BASE_URL}/wialon/ajax.html`);
  url.searchParams.set("svc", svc);
  url.searchParams.set("params", JSON.stringify(params));
  if (sid) url.searchParams.set("sid", sid);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  if (json?.error) {
    throw new Error(`Wialon ${svc} failed (error ${json.error}): ${json.reason ?? "no reason given"}`);
  }
  return json;
}

export async function wialonLogin(): Promise<string> {
  if (!WIALON_TOKEN) throw new Error("WIALON_API_TOKEN is not configured");
  const result = await wialonCall("token/login", { token: WIALON_TOKEN });
  if (!result.eid) throw new Error("Wialon login did not return a session id");
  return result.eid as string;
}

export interface WialonUnitTelemetry {
  unitId: string;
  name: string;
  recordedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  engineOn: boolean | null;
  raw: any;
}

/**
 * Fetches position + last-message telemetry for every Wialon unit visible
 * to this account, then narrows to the given unit IDs. Wialon's
 * core/search_items propValueMask doesn't support an OR-list of exact IDs,
 * so filtering the full result client-side is the reliable approach —
 * proven against the live account rather than assumed.
 */
export async function wialonFetchUnitsTelemetry(sid: string, unitIds: string[]): Promise<WialonUnitTelemetry[]> {
  if (unitIds.length === 0) return [];
  const wanted = new Set(unitIds);

  const result = await wialonCall(
    "core/search_items",
    {
      spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
      force: 1,
      flags: 1025, // 1 (base) + 1024 (position, which also carries last-message io_ params)
      from: 0,
      to: 0,
    },
    sid,
  );

  const items = (result.items ?? []) as any[];
  return items
    .filter((item) => wanted.has(String(item.id)))
    .map((item): WialonUnitTelemetry => {
      const pos = item.pos ?? item.lmsg?.pos;
      const ioParams = item.lmsg?.p ?? {};
      // io_239 is the "Engine ignition sensor" mapping confirmed on every
      // unit checked; if a unit's sensor config differs this simply stays
      // null rather than guessing.
      const ignitionRaw = ioParams.io_239;
      return {
        unitId: String(item.id),
        name: item.nm,
        recordedAt: pos?.t ? new Date(pos.t * 1000) : null,
        latitude: pos?.y ?? null,
        longitude: pos?.x ?? null,
        speedKmh: pos?.s ?? null,
        engineOn: ignitionRaw === undefined ? null : Number(ignitionRaw) === 1,
        raw: item,
      };
    });
}
