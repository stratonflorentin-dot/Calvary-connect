"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lon: number;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceSuggestion) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

// Rough bounding box around the African continent (lon/lat), used to bias —
// not restrict — Nominatim results toward African places. A cross-border
// freight stop outside Africa still resolves, it just won't get the
// relevance boost that keeps "Mbeya" from being outranked by a same-named
// place on another continent.
const AFRICA_VIEWBOX = "-25.0,38.0,55.0,-36.0";

/**
 * Live place search over OpenStreetMap Nominatim, covering every level the
 * API indexes — city, town, district, ward/suburb — not a fixed city list.
 * Debounced and request-sequenced so a fast typist never sees a stale
 * response race ahead of their latest keystroke.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  className,
  disabled,
  required,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&accept-language=en&viewbox=${AFRICA_VIEWBOX}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        const data = await res.json();
        if (seq !== seqRef.current) return; // superseded by a newer keystroke
        const results: PlaceSuggestion[] = Array.isArray(data)
          ? data.map((d: any) => ({ label: d.display_name as string, lat: Number(d.lat), lon: Number(d.lon) }))
          : [];
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (err: any) {
        if (err?.name !== "AbortError" && seq === seqRef.current) setSuggestions([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 350);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHighlighted(-1);
    search(e.target.value);
  };

  const pick = (s: PlaceSuggestion) => {
    onChange(s.label);
    onSelect?.(s);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (highlighted >= 0) {
        e.preventDefault();
        pick(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className={cn(loading && "pr-9", className)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={`${s.label}-${i}`}
              onClick={() => pick(s)}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === highlighted ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60",
              )}
            >
              <MapPin className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
