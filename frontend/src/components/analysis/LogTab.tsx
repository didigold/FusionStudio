import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Trash2,
  Download,
  Search,
  ArrowDown,
  ArrowUp,
  Activity,
  Layers,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppStore } from "../../store/useAppStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogMessage {
  ts: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

function getLogSource(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("fuse") ||
    lower.includes("fusion") ||
    lower.includes("participant") ||
    lower.includes("master") ||
    lower.includes("signal")
  ) {
    return "Fusion";
  }
  if (lower.includes("report") || lower.includes("excel")) {
    return "Reporting";
  }
  if (lower.includes("classify") || lower.includes("classification")) {
    return "Classification";
  }
  if (
    lower.includes("audio") ||
    lower.includes("frequency") ||
    lower.includes("rms")
  ) {
    return "Audio";
  }
  if (
    lower.includes("gaze") ||
    lower.includes("tracking") ||
    lower.includes("logic") ||
    lower.includes("chronos")
  ) {
    return "Gaze Analysis";
  }
  if (lower.includes("om") || lower.includes("occupant")) {
    return "Occupant Monitoring";
  }
  return "System / General";
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

export function LogTab() {
  const { logs: rawLogs, clearLogs } = useAppStore();

  const logs: LogMessage[] = rawLogs.map((l) => ({
    ts: l.ts,
    timestamp: new Date(l.ts).toLocaleTimeString(),
    level: l.message.toLowerCase().includes("error")
      ? "error"
      : l.message.toLowerCase().includes("warn")
        ? "warn"
        : "info",
    source: getLogSource(l.message),
    message: l.message,
  }));

  // Filtering states
  const [filterText, setFilterText] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState("all");

  // Scroll states and refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const lastScrollTopRef = useRef(0);
  const bottomScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [showScrollButtonAtBottom, setShowScrollButtonAtBottom] =
    useState(false);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (bottomScrollTimeoutRef.current) {
        clearTimeout(bottomScrollTimeoutRef.current);
      }
    };
  }, []);

  // Apply filters
  const filteredLogs = logs.filter((log) => {
    // 1. Text filter (case insensitive match on message or timestamp)
    if (filterText) {
      const query = filterText.toLowerCase();
      const msgMatch = log.message.toLowerCase().includes(query);
      const tsMatch = log.timestamp.toLowerCase().includes(query);
      if (!msgMatch && !tsMatch) return false;
    }

    // 2. Level filter
    if (selectedLevel !== "all" && log.level !== selectedLevel) {
      return false;
    }

    // 3. Source filter
    if (selectedSource !== "all" && log.source !== selectedSource) {
      return false;
    }

    // 4. Time range filter
    if (selectedTimeRange !== "all") {
      const now = Date.now();
      const diffMs = now - log.ts;
      if (selectedTimeRange === "5m" && diffMs > 5 * 60 * 1000) return false;
      if (selectedTimeRange === "15m" && diffMs > 15 * 60 * 1000) return false;
      if (selectedTimeRange === "1h" && diffMs > 60 * 60 * 1000) return false;
    }

    return true;
  });

  // Auto scroll effect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [rawLogs]);

  // Handle scrolling to update bottom indicator and show floating helper button
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const threshold = 30; // pixels
    const atBottom =
      container.scrollHeight - container.clientHeight - container.scrollTop <
      threshold;

    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);

    // Detect scroll direction
    const currentScrollTop = container.scrollTop;
    const isScrollingUp = currentScrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = currentScrollTop;

    if (isScrollingUp) {
      setScrollDirection("up");
    } else {
      setScrollDirection("down");
    }

    const hasScrollableContent =
      container.scrollHeight > container.clientHeight;

    // Handle show at bottom with 3s timeout
    if (atBottom) {
      setShowScrollButtonAtBottom(true);
      if (bottomScrollTimeoutRef.current)
        clearTimeout(bottomScrollTimeoutRef.current);
      bottomScrollTimeoutRef.current = setTimeout(() => {
        setShowScrollButtonAtBottom(false);
      }, 3000);
    } else {
      if (bottomScrollTimeoutRef.current) {
        clearTimeout(bottomScrollTimeoutRef.current);
        bottomScrollTimeoutRef.current = null;
      }
    }

    // Show button if we are scrolled away from bottom and above threshold,
    // OR if we are at bottom and the bottom scroll timeout hasn't cleared yet
    const shouldShow =
      hasScrollableContent &&
      ((!atBottom && container.scrollTop > threshold) ||
        (atBottom && showScrollButtonAtBottom));
    setShowScrollButton(shouldShow);
  };

  // Dynamic Scroll to bottom or top
  const scrollToDestination = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (scrollDirection === "up") {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  };

  // Download logs to file
  const handleDownloadLogs = async () => {
    const textContent = logs
      .map(
        (l, i) =>
          `${i + 1} | [${formatLogTime(l.ts)}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`,
      )
      .join("\n");

    const now = new Date();
    const Y = now.getFullYear();
    const M = String(now.getMonth() + 1).padStart(2, "0");
    const D = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const suggestedName = `fusionstudio_console_${Y}${M}${D}_${h}${m}${s}.log`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Log Files",
              accept: { "text/plain": [".log", ".txt"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(textContent);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    // Fallback blob download
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 relative">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-2/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              System Console
            </h3>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">
              Real-time Backend Streams
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Text Filter with Hover Clear Button */}
          <div className="relative group/filter">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter logs..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-9 w-40 pl-8 pr-8 text-xs bg-surface-3 border-white/5 rounded-xl focus-visible:ring-primary/20"
            />
            {filterText && (
              <button
                onClick={() => setFilterText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground opacity-0 group-hover/filter:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-white/5"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Level Filter with Icon */}
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="h-9 w-32 text-xs bg-surface-3 border-white/5 rounded-xl text-muted-foreground focus:ring-primary/20 flex items-center gap-1.5 pl-3">
              <Activity className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent className="bg-surface-2 border border-white/10 text-xs">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          {/* Source Filter with Icon */}
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="h-9 w-36 text-xs bg-surface-3 border-white/5 rounded-xl text-muted-foreground focus:ring-primary/20 flex items-center gap-1.5 pl-3">
              <Layers className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent className="bg-surface-2 border border-white/10 text-xs">
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="Fusion">Fusion</SelectItem>
              <SelectItem value="Reporting">Reporting</SelectItem>
              <SelectItem value="Classification">Classification</SelectItem>
              <SelectItem value="Gaze Analysis">Gaze Analysis</SelectItem>
              <SelectItem value="Occupant Monitoring">
                Occupant Monitoring
              </SelectItem>
              <SelectItem value="System / General">System / General</SelectItem>
            </SelectContent>
          </Select>

          {/* Time range Filter with Icon */}
          <Select
            value={selectedTimeRange}
            onValueChange={setSelectedTimeRange}
          >
            <SelectTrigger className="h-9 w-28 text-xs bg-surface-3 border-white/5 rounded-xl text-muted-foreground focus:ring-primary/20 flex items-center gap-1.5 pl-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent className="bg-surface-2 border border-white/10 text-xs">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="5m">Last 5m</SelectItem>
              <SelectItem value="15m">Last 15m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Action */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownloadLogs}
            className="h-9 w-9 rounded-xl border-white/5 bg-surface-3 hover:bg-surface-3/80 shrink-0"
            title="Download Logs"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Clear logs with AlertDialog (Blur Card design) */}
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-white/5 bg-surface-3 hover:bg-surface-3/80 text-red-500 shrink-0"
                title="Clear Logs"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[340px] border border-white/10 bg-surface-2/80 backdrop-blur-xl p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                <Trash2 className="w-5 h-5" />
              </div>
              <AlertDialogHeader className="items-center text-center gap-1.5">
                <AlertDialogTitle className="text-base font-bold text-white uppercase tracking-wider">
                  Clear Console Logs?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-white/70 max-w-[280px]">
                  Are you sure you want to delete all system console logs? This
                  action is permanent and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
                <AlertDialogCancel className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clearLogs();
                    setClearDialogOpen(false);
                  }}
                  className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5"
                >
                  Clear Logs
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Console container with relative wrapper for bottom-center overlay */}
      <div className="flex-1 relative min-h-0 bg-[#0a0a0a]">
        {/* Logs Viewport */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-auto p-4 font-mono text-[11px] leading-relaxed selection:bg-primary/20 custom-scrollbar"
        >
          <div className="space-y-1">
            {filteredLogs.map((log, i) => (
              <div
                key={i}
                className="flex gap-4 group hover:bg-white/5 rounded px-2 py-0.5 transition-colors"
              >
                {/* Line number: right-aligned, select-none */}
                <span className="text-muted-foreground/20 select-none shrink-0 w-8 text-right font-mono pr-1">
                  {i + 1}
                </span>
                {/* Timestamp */}
                <span className="text-muted-foreground/40 select-none shrink-0">
                  {log.timestamp}
                </span>
                {/* Log level badge */}
                <span
                  className={cn(
                    "font-black uppercase tracking-tighter shrink-0 w-12 text-center",
                    {
                      "text-blue-400": log.level === "info",
                      "text-orange-400": log.level === "warn",
                      "text-red-500": log.level === "error",
                      "text-purple-400": log.level === "debug",
                    },
                  )}
                >
                  {log.level}
                </span>
                {/* Message & source */}
                <span className="text-white/80 group-hover:text-white transition-colors">
                  <span className="text-primary/40 font-semibold mr-1.5 select-none font-sans">
                    [{log.source}]
                  </span>
                  {log.message}
                </span>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground/40 italic py-20 text-xs">
                No matching log messages.
              </div>
            )}
            <div />
          </div>
        </div>

        {/* Floating Scroll Limit Button (Overlayed bottom center on top of the black console view) */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-8 left-1/2 z-50"
            >
              <Button
                onClick={scrollToDestination}
                className="w-9 h-9 rounded-full shadow-xl bg-surface-3/80 hover:bg-surface-3 text-foreground flex items-center justify-center border border-white/10 shrink-0 transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
                size="icon"
                title={
                  scrollDirection === "up"
                    ? "Scroll to top"
                    : "Scroll to bottom"
                }
              >
                {scrollDirection === "up" ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer bar */}
      <div className="p-3 bg-surface-2 border-t border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2da44e] animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Backend Connected
            </span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
            Listening on port 8001
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[9px] uppercase tracking-tighter bg-white/5 border-0"
          >
            UTF-8
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] uppercase tracking-tighter bg-white/5 border-0"
          >
            LF
          </Badge>
        </div>
      </div>
    </div>
  );
}
