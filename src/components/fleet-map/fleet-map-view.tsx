"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FleetMapDriver, FleetMapViewProps } from "@/components/fleet-map/types";
import type { FleetMapCanvasHandle } from "@/components/fleet-map/fleet-map-canvas";
import {
  Search,
  Radio,
  Truck,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Navigation,
  Phone,
  MessageSquare,
  MapPin,
  X,
  RefreshCw,
  ChevronUp,
  Wifi,
  WifiOff,
  Gauge,
  Clock,
  Crosshair,
} from "lucide-react";

const FleetMapCanvas = dynamic(
  () =>
    import("@/components/fleet-map/fleet-map-canvas").then((m) => m.FleetMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/5">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1e3a5f] border-t-transparent" />
          <p className="text-sm font-medium text-[#1e3a5f]">Loading fleet map…</p>
        </div>
      </div>
    ),
  },
);

const glass =
  "bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(15,23,42,0.12)]";

function LegendItem({
  color,
  label,
  shape = "dot",
}: {
  color: string;
  label: string;
  shape?: "dot" | "ring";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "shrink-0",
          shape === "dot" ? "h-2.5 w-2.5 rounded-full" : "h-3 w-3 rounded-full border-2 border-white",
          color,
        )}
      />
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}

function DriverDetailPanel({
  driver,
  onClose,
  onViewMap,
}: {
  driver: FleetMapDriver;
  onClose: () => void;
  onViewMap: () => void;
}) {
  const updated = driver.lastUpdate
    ? formatDistanceToNow(new Date(driver.lastUpdate), { addSuffix: true })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className={cn(
        glass,
        "rounded-2xl overflow-hidden w-full md:w-[320px] flex flex-col max-h-[calc(100vh-120px)]",
      )}
    >
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2952A3] px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">{driver.driverName}</h3>
              <p className="text-xs text-blue-100/90 truncate">
                {driver.vehiclePlate !== "—" ? driver.vehiclePlate : "Vehicle TBD"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 shrink-0 h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Badge
            className={cn(
              "border-0 text-[10px] font-semibold",
              driver.isOnline
                ? "bg-emerald-400/20 text-emerald-100"
                : "bg-white/10 text-slate-200",
            )}
          >
            {driver.isOnline ? (
              <Wifi className="h-3 w-3 mr-1 inline" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1 inline" />
            )}
            {driver.isOnline ? "Online" : "Offline"}
          </Badge>
          <Badge className="bg-white/10 text-blue-100 border-0 text-[10px] capitalize">
            {driver.status}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Gauge className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Speed</span>
            </div>
            <p className="text-xl font-bold text-[#1e3a5f]">{driver.speed} km/h</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Updated</span>
            </div>
            <p className="text-sm font-semibold text-[#1e3a5f] leading-tight">{updated}</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">
            Coordinates
          </p>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs text-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px]">Lat</span>
              {driver.latitude.toFixed(5)}
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Lng</span>
              {driver.longitude.toFixed(5)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Navigation, label: "Navigate" },
            { icon: Phone, label: "Call" },
            { icon: MessageSquare, label: "Message" },
          ].map(({ icon: Icon, label }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className="flex flex-col h-auto py-2.5 gap-1 rounded-xl border-slate-200 hover:border-[#2952A3]/40 hover:bg-blue-50/50 transition-all"
            >
              <Icon className="h-4 w-4 text-[#2952A3]" />
              <span className="text-[10px] font-medium">{label}</span>
            </Button>
          ))}
        </div>

        <Button
          className="w-full rounded-xl bg-[#2952A3] hover:bg-[#1e3a5f] gap-2 h-11 shadow-md"
          onClick={onViewMap}
        >
          <Crosshair className="h-4 w-4" />
          Center on driver
        </Button>
      </div>
    </motion.div>
  );
}

export default function FleetMapView({
  locations,
  defaultCenter,
  isLoading = false,
  showEmptyOverlay = false,
  loadError = null,
  driversWithoutGps = [],
  onRefresh,
}: FleetMapViewProps) {
  const canvasRef = useRef<FleetMapCanvasHandle>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Removed auto-selection to allow users to see the full map on load

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) =>
        l.driverName.toLowerCase().includes(q) ||
        l.vehiclePlate.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q),
    );
  }, [locations, search]);

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  const onlineCount = locations.filter((l) => l.isOnline).length;

  const handleSelect = useCallback((driver: FleetMapDriver) => {
    setSelectedId(driver.id);
    setMobileSheetOpen(false);
    canvasRef.current?.flyToDriver(driver.latitude, driver.longitude, 14);
  }, []);

  return (
    <div className="fleet-map-root relative h-full w-full min-h-[calc(100dvh-0px)] overflow-hidden bg-slate-300">
      <FleetMapCanvas
        ref={canvasRef}
        locations={locations}
        defaultCenter={defaultCenter}
        selectedId={selectedId}
        onSelectDriver={handleSelect}
      />

      {/* Top bar — search & live stats */}
      <div
        className={cn(
          "absolute top-4 left-4 right-4 z-[1000] gap-3 pointer-events-none max-w-[calc(100vw-2rem)]",
          selected ? "hidden md:flex flex-col sm:flex-row" : "flex flex-col sm:flex-row"
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(glass, "rounded-2xl p-4 pointer-events-auto flex-1 sm:max-w-md")}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h1 className="text-base font-bold text-[#0f172a] tracking-tight">
                Fleet tracking
              </h1>
              <p className="text-[11px] text-slate-500">Real-time driver positions</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver or vehicle…"
              className="h-10 pl-10 rounded-full border-slate-200/80 bg-white/80 text-sm focus-visible:ring-[#2952A3]/30"
            />
          </div>

          {loadError && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              {loadError}
            </p>
          )}
          {driversWithoutGps.length > 0 && locations.length === 0 && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
              Waiting for GPS from: {driversWithoutGps.join(", ")}. Drivers must open the app on
              their phone and allow location.
            </p>
          )}
          {driversWithoutGps.length > 0 && locations.length > 0 && (
            <p className="text-[10px] text-slate-500 mb-2">
              No GPS yet: {driversWithoutGps.join(", ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-200/60 hover:bg-emerald-500/10 gap-1.5 px-3 py-1">
              <Radio className="h-3 w-3" />
              {onlineCount} online
            </Badge>
            <Badge className="rounded-full bg-[#2952A3]/10 text-[#1e3a5f] border-[#2952A3]/20 hover:bg-[#2952A3]/10 gap-1.5 px-3 py-1">
              <Truck className="h-3 w-3" />
              {locations.length} tracked
            </Badge>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full text-xs text-slate-500 ml-auto"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        </motion.div>

        {/* Compact legend — desktop top center-right area */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(
            glass,
            "hidden lg:block rounded-xl px-4 py-3 pointer-events-auto self-start",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Legend
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <LegendItem color="bg-emerald-500" label="Online driver" />
            <LegendItem color="bg-slate-400" label="Offline driver" />
            <LegendItem color="bg-sky-500" label="Border point" shape="ring" />
            <LegendItem color="bg-indigo-500" label="Major city" shape="ring" />
          </div>
        </motion.div>
      </div>

      {/* Right — driver detail */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none hidden md:block">
        <AnimatePresence mode="wait">
          {selected && (
            <div className="pointer-events-auto">
              <DriverDetailPanel
                driver={selected}
                onClose={() => setSelectedId(null)}
                onViewMap={() =>
                  canvasRef.current?.flyToDriver(
                    selected.latitude,
                    selected.longitude,
                    15,
                  )
                }
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Map controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2 pointer-events-auto">
        {[
          { icon: ZoomIn, action: () => canvasRef.current?.zoomIn() },
          { icon: ZoomOut, action: () => canvasRef.current?.zoomOut() },
          { icon: LocateFixed, action: () => canvasRef.current?.fitDrivers() },
        ].map(({ icon: Icon, action }, i) => (
          <Button
            key={i}
            variant="outline"
            size="icon"
            className={cn(
              glass,
              "h-11 w-11 rounded-xl border-0 hover:scale-105 active:scale-95 transition-transform",
              i === 2 && "bg-[#2952A3] text-white hover:bg-[#1e3a5f] hover:text-white",
            )}
            onClick={action}
          >
            <Icon className="h-5 w-5" />
          </Button>
        ))}
      </div>

      {/* Bottom — driver list + mobile legend */}
      <div
        className={cn(
          "absolute bottom-4 left-4 right-4 z-[1000] gap-3 pointer-events-none md:pr-[340px]",
          selected ? "hidden md:flex flex-col" : "flex flex-col"
        )}
      >
        <div className="lg:hidden pointer-events-auto">
          <div className={cn(glass, "rounded-xl px-3 py-2 inline-flex flex-wrap gap-3")}>
            <LegendItem color="bg-emerald-500" label="Online" />
            <LegendItem color="bg-slate-400" label="Offline" />
            <LegendItem color="bg-sky-500" label="Border" shape="ring" />
            <LegendItem color="bg-indigo-500" label="City" shape="ring" />
          </div>
        </div>

        <motion.div
          layout
          className={cn(glass, "rounded-2xl pointer-events-auto overflow-hidden")}
        >
          <button
            type="button"
            className="md:hidden w-full flex items-center justify-between px-4 py-2.5 border-b border-slate-100/80"
            onClick={() => setMobileSheetOpen((o) => !o)}
          >
            <span className="text-sm font-semibold text-[#0f172a]">
              Drivers ({filtered.length})
            </span>
            <ChevronUp
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                !mobileSheetOpen && "rotate-180",
              )}
            />
          </button>

          <div
            className={cn(
              "transition-all md:block",
              mobileSheetOpen ? "block" : "hidden md:block",
            )}
          >
            <div className="px-4 py-2.5 border-b border-slate-100/80 hidden md:flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active fleet
              </span>
              <span className="text-xs text-slate-500">{filtered.length} drivers</span>
            </div>
            <ScrollArea className="max-h-[140px] md:max-h-[160px]">
              <div className="flex gap-2 p-3 md:flex-col md:gap-1.5 md:p-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-500 px-2 py-4 text-center w-full">
                    {search ? "No drivers match your search" : "No drivers to display"}
                  </p>
                ) : (
                  filtered.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelect(loc)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all min-w-[200px] md:min-w-0 md:w-full shrink-0 md:shrink",
                        selectedId === loc.id
                          ? "bg-[#2952A3]/10 border border-[#2952A3]/30 shadow-[0_0_0_1px_rgba(41,82,163,0.15)]"
                          : "bg-slate-50/80 border border-transparent hover:bg-slate-100/90 hover:border-slate-200/60",
                      )}
                    >
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {loc.isOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span
                          className={cn(
                            "relative inline-flex rounded-full h-2.5 w-2.5",
                            loc.isOnline ? "bg-emerald-500" : "bg-slate-300",
                          )}
                        />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0f172a] truncate">
                          {loc.driverName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {loc.vehiclePlate} · {loc.speed} km/h
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">
                        {loc.lastUpdate
                          ? formatDistanceToNow(new Date(loc.lastUpdate), {
                              addSuffix: true,
                            })
                          : "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      </div>

      {/* Mobile detail bottom sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="md:hidden absolute inset-x-0 bottom-0 z-[1001] p-4 pointer-events-auto max-h-[70vh] overflow-y-auto"
          >
            <DriverDetailPanel
              driver={selected}
              onClose={() => setSelectedId(null)}
              onViewMap={() =>
                canvasRef.current?.flyToDriver(
                  selected.latitude,
                  selected.longitude,
                  15,
                )
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {showEmptyOverlay && !isLoading && locations.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-[999] flex items-center justify-center bg-[#0f172a]/20 backdrop-blur-[2px] pointer-events-none"
        >
          <div className={cn(glass, "rounded-2xl p-8 max-w-sm text-center pointer-events-auto mx-4")}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2952A3]/10">
              <MapPin className="h-7 w-7 text-[#2952A3]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] mb-2">Awaiting GPS data</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Drivers appear here once they sign in on mobile and allow location access.
              Updates refresh every 15–30 seconds.
            </p>
            {onRefresh && (
              <Button
                className="mt-4 rounded-xl bg-[#2952A3] hover:bg-[#1e3a5f]"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh now
              </Button>
            )}
          </div>
        </motion.div>
      )}

      <style jsx global>{`
        .leaflet-container {
          font-family: inherit;
          background: #e8eef4;
        }
        .fleet-driver-marker,
        .fleet-static-marker {
          background: transparent !important;
          border: none !important;
        }
        .fleet-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.8);
        }
        .fleet-popup .leaflet-popup-content {
          margin: 10px 12px;
        }
        .leaflet-control-attribution {
          font-size: 9px;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
