"use client";

import { ExternalLink, MapPin, Radio } from "lucide-react";
import { ExternalPanel } from "./ExternalPanel";

const BORDERS = ["Holili", "Sirari", "Rusumo", "Kasumulo", "Songwe", "Mutukula"];

export default function BorderWaitTimes({ onClose }: { onClose: () => void }) {
  return <ExternalPanel title="Border status" eyebrow="Live feed unavailable" onClose={onClose}>
    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">No verified public live wait-time feed is available. TRA portal access may be required; contact an administrator for authorized access, and confirm directly with the border post before dispatch.</p>
    <div className="space-y-2">{BORDERS.map((name) => <div key={name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
      <span className="flex items-center gap-2 text-xs font-medium"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{name}</span>
      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Radio className="h-3 w-3" />No live feed</span>
    </div>)}</div>
    <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline" href="https://identity.tra.go.tz/Account/Login" target="_blank" rel="noreferrer">Open TRA portal <ExternalLink className="h-3 w-3" /></a>
  </ExternalPanel>;
}
