import { industryFontVariables } from "./fonts";
import { cn } from "@/lib/utils";

/**
 * Wraps a page (or a section of one) in the "Industry" design system —
 * steel-blue on paper, hairlines only, condensed headings over tabular-nums
 * monospace data. See design_handoff_calvary_connect/README.md for the full
 * spec this is ported from. Scoped via the .cc-industry class (globals.css)
 * rather than promoted app-wide, so it composes with — and never overrides —
 * the shadcn tokens the rest of the app already uses.
 *
 * Usage: wrap a page's outermost element —
 *   <IndustryShell><div className="...">...</div></IndustryShell>
 */
export function IndustryShell({
  children,
  className,
  grid = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Paint the 48px blueprint grid on this element's own background. */
  grid?: boolean;
}) {
  return (
    <div className={cn("cc-industry", industryFontVariables, grid && "ci-grid-bg", className)}>
      {children}
    </div>
  );
}
