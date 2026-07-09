"use client";

/**
 * Admin dashboard = executive dashboard. Both roles need the same
 * cross-module operational view, so we reuse CeoView.
 */
import { CeoView } from "./ceo-view";

export default function AdminDashboard() {
  return <CeoView />;
}
