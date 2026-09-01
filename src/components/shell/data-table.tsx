"use client";

import { ReactNode, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "./empty-state";
import { LucideIcon, AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Renders the cell. Given the whole row so derived/computed cells are easy. */
  accessor: (row: T) => ReactNode;
  /** Primitive value used for sorting — omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | Date;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** Hide this column below the given breakpoint (a responsive escape hatch, not a replacement for a real mobile layout). */
  hideBelow?: "sm" | "md" | "lg";
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;

  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;

  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  toolbarActions?: ReactNode;

  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  className?: string;
}

const HIDE_BELOW_CLASS: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * Shared enterprise table: search/filter slot, client-side sort, client-side
 * pagination, loading/empty/error states, optional row click + action menu.
 * Every page in this app already fetches its full working set into memory
 * and filters/sorts in JS — this matches that existing pattern rather than
 * introducing server-side pagination, and wraps the existing
 * Table/TableHeader/TableBody primitives instead of a new table engine.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading,
  error,
  onRetry,
  emptyIcon,
  emptyTitle = "No records",
  emptyDescription,
  emptyAction,
  onRowClick,
  rowActions,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  toolbarActions,
  initialSort,
  pageSize = 25,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [sorted, clampedPage, pageSize],
  );

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const hasToolbar = onSearchChange || filters || toolbarActions;

  return (
    <div className={cn("space-y-3", className)}>
      {hasToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {onSearchChange && (
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search ?? ""} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} className="pl-8 h-9" />
            </div>
          )}
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
          {toolbarActions && <div className="flex items-center gap-2 sm:ml-auto">{toolbarActions}</div>}
        </div>
      )}

      <div className="cv-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                    col.sortValue && "cursor-pointer select-none",
                    col.headerClassName,
                  )}
                  onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
                >
                  <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                    {col.header}
                    {col.sortValue && (
                      sort?.key === col.key ? (
                        sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )
                    )}
                  </span>
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (rowActions ? 1 : 0)} className="py-16 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length + (rowActions ? 1 : 0)} className="py-16 text-center">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-destructive" />
                  <p className="text-sm text-foreground font-medium">{error}</p>
                  {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 gap-2">
                      <RefreshCw className="w-3.5 h-3.5" /> Try again
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (rowActions ? 1 : 0)} className="p-0">
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right tabular-nums",
                        col.align === "center" && "text-center",
                        col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.accessor(row)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && !error && sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground px-1">
          <p>
            Showing <span className="font-bold text-foreground">{(clampedPage - 1) * pageSize + 1}–{Math.min(clampedPage * pageSize, sorted.length)}</span> of <span className="font-bold text-foreground">{sorted.length}</span>
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="px-2 font-bold text-foreground">{clampedPage} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One-line filter pill for the toolbar `filters` slot — matches the app's existing chip-select pattern. */
export function DataTableFilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-auto min-w-[9rem]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
