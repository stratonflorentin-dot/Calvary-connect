"use client";

import { useState } from "react";
import { IndustryShell } from "@/components/industry/shell";
import { IndustryCard, IndustryCardKicker, IndustryCardTitle, IndustryCardBody } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import {
  IndustryDialog,
  IndustryDialogTrigger,
  IndustryDialogContent,
  IndustryDialogTitle,
  IndustryDialogBody,
  IndustryDialogActions,
} from "@/components/industry/dialog";

/**
 * Internal style-guide page for the "Industry" design system components —
 * not part of the app's real navigation. Kept as a running reference while
 * building the tracking console / role pages (Phase 1/2 of the redesign).
 */
export default function IndustryPreviewPage() {
  const [open, setOpen] = useState(false);

  return (
    <IndustryShell grid className="min-h-screen p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] leading-none tracking-[-0.01em]" style={{ fontFamily: "var(--font-barlow-condensed)" }}>
          Industry component preview
        </h2>
        <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">Phase 0 scaffolding — cards, tables, tags, buttons, dialog.</p>
      </div>

      <div className="ci-metric-strip grid-cols-4">
        <div>
          <p className="ci-lbl">Elapsed</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">02:14:07</p>
        </div>
        <div>
          <p className="ci-lbl">Distance left</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">184 km</p>
        </div>
        <div>
          <p className="ci-lbl">ETA</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">14:40</p>
        </div>
        <div>
          <p className="ci-lbl">Fuel</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">62%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <IndustryCard hover>
          <IndustryCardKicker>Vehicle</IndustryCardKicker>
          <IndustryCardTitle>T 123 ABC · DUMP_TRUCK</IndustryCardTitle>
          <IndustryCardBody>Mileage 184,203 km · Next service in 1,800 km</IndustryCardBody>
          <div className="flex gap-2 mt-1">
            <IndustryTag variant="accent" pulse>Active</IndustryTag>
            <IndustryTag variant="warning">Insurance — 12d</IndustryTag>
            <IndustryTag variant="danger">Overdue</IndustryTag>
          </div>
        </IndustryCard>

        <IndustryCard>
          <IndustryCardKicker>Photo slot</IndustryCardKicker>
          <div className="ci-hatch ci-blueprint h-24 flex items-center justify-center text-[11px] text-[var(--ci-text-tertiary)]">
            <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
            loading-bay photo
          </div>
        </IndustryCard>
      </div>

      <IndustryCard>
        <IndustryCardTitle>Route requests</IndustryCardTitle>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Date</IndustryTh>
              <IndustryTh>Description</IndustryTh>
              <IndustryTh align="right">Amount</IndustryTh>
              <IndustryTh>Status</IndustryTh>
            </tr>
          </thead>
          <tbody>
            <IndustryTr selected>
              <IndustryTd mono>2026-09-04</IndustryTd>
              <IndustryTd>Border crossing fee</IndustryTd>
              <IndustryTd align="right" mono>TZS 45,000</IndustryTd>
              <IndustryTd><IndustryTag variant="accent">Posted</IndustryTag></IndustryTd>
            </IndustryTr>
            <IndustryTr>
              <IndustryTd mono>2026-09-03</IndustryTd>
              <IndustryTd>Weighbridge</IndustryTd>
              <IndustryTd align="right" mono>TZS 12,000</IndustryTd>
              <IndustryTd><IndustryTag variant="neutral">Pending</IndustryTag></IndustryTd>
            </IndustryTr>
          </tbody>
        </IndustryTable>
      </IndustryCard>

      <div className="flex gap-2 items-center">
        <IndustryButton variant="primary">Primary</IndustryButton>
        <IndustryButton variant="secondary">Secondary</IndustryButton>
        <IndustryButton variant="ghost">Ghost</IndustryButton>
        <IndustryButton variant="primary" size="driver">Driver 48px</IndustryButton>

        <IndustryDialog open={open} onOpenChange={setOpen}>
          <IndustryDialogTrigger asChild>
            <IndustryButton variant="secondary">Open dialog</IndustryButton>
          </IndustryDialogTrigger>
          <IndustryDialogContent open={open}>
            <IndustryDialogTitle>Confirm action</IndustryDialogTitle>
            <IndustryDialogBody>This is the Industry-styled dialog — hairline border, no shadow, single easing curve.</IndustryDialogBody>
            <IndustryDialogActions>
              <IndustryButton variant="secondary" onClick={() => setOpen(false)}>Cancel</IndustryButton>
              <IndustryButton variant="primary" onClick={() => setOpen(false)}>Confirm</IndustryButton>
            </IndustryDialogActions>
          </IndustryDialogContent>
        </IndustryDialog>
      </div>
    </IndustryShell>
  );
}
