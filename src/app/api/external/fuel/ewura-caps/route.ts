import { NextRequest, NextResponse } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { apiError } from "@/lib/external-apis";
import { externalApiJson, EXTERNAL_API_ROLES } from "@/lib/external-api-routes";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const EWURA_PAGE = "https://www.ewura.go.tz/publications/petroleum-price?page=1";
const CITIES = ["Dar es Salaam", "Mwanza", "Arusha", "Mbeya", "Dodoma", "Tanga"];
type CityCap = { city: string; petrol: number; diesel: number; kerosene: number };
let cached: { expiresAt: number; data: CityCap[]; fetchedAt: string; effectiveDate: string } | undefined;

function htmlText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

function findCityRows(text: string): CityCap[] {
  const rows: CityCap[] = [];
  for (const city of CITIES) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\s)${escaped}\\s+([\\d,]+)\\s+([\\d,]+)\\s+([\\d,]+)(?=\\s|$)`, "i").exec(text);
    if (!match) continue;
    rows.push({ city, petrol: Number(match[1].replaceAll(",", "")), diesel: Number(match[2].replaceAll(",", "")), kerosene: Number(match[3].replaceAll(",", "")) });
  }
  return rows;
}

export const GET = withAuthAndRateLimit(async (_request: NextRequest) => {
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ success: true, data: cached.data, meta: { source: "EWURA monthly retail cap PDF", fetchedAt: cached.fetchedAt, effectiveDate: cached.effectiveDate, cached: true } });
  }
  try {
    const listing = await fetch(EWURA_PAGE, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "CalvaryConnect/1.0 fuel-price reference" } });
    if (!listing.ok) throw new Error(`EWURA price list returned HTTP ${listing.status}`);
    const html = await listing.text();
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ url: new URL(match[1].replaceAll("&amp;", "&"), EWURA_PAGE).toString(), title: htmlText(match[2]) }))
      .filter((link) => /cap prices.*petroleum products/i.test(link.title));
    if (!links.length) throw new Error("EWURA's current cap-price PDF was not found on its official pricing page.");
    const documentResponse = await fetch(links[0].url, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "CalvaryConnect/1.0 fuel-price reference" } });
    if (!documentResponse.ok) throw new Error(`EWURA cap-price PDF returned HTTP ${documentResponse.status}`);
    const bytes = new Uint8Array(await documentResponse.arrayBuffer());
    if (bytes.length > 12_000_000) throw new Error("EWURA cap-price document exceeded the 12 MB limit.");
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
    let text = "";
    for (let number = 1; number <= Math.min(document.numPages, 8); number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      text += ` ${content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" ")}`;
    }
    text = text.replace(/\s+/g, " ");
    const prices = findCityRows(text);
    if (prices.length !== CITIES.length) throw new Error(`EWURA PDF parsing found ${prices.length} of ${CITIES.length} fleet hubs.`);
    const date = /effective\s+WEDNESDAY,?\s+([\w, ]+?\s+\d{4})/i.exec(text)?.[1]?.trim() ?? links[0].title;
    cached = { data: prices, fetchedAt: new Date().toISOString(), effectiveDate: date, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    return NextResponse.json({ success: true, data: prices, meta: { source: "EWURA monthly retail cap PDF", fetchedAt: cached.fetchedAt, effectiveDate: date, cached: false } });
  } catch (error) {
    return externalApiJson(apiError("ewura", "EXTERNAL_API_UNAVAILABLE", error instanceof Error ? error.message : "EWURA cap prices are temporarily unavailable."));
  }
}, EXTERNAL_API_ROLES);
