"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class ExternalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("External API panel failed", error, info.componentStack); }
  render() {
    if (this.state.failed) return <section role="alert" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-destructive/30 bg-card p-4 text-sm"><h2 className="font-semibold">External data panel unavailable</h2><p className="mt-1 text-muted-foreground">Close this panel and try again. The fleet map remains available.</p></section>;
    return this.props.children;
  }
}
