import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Play, 
  Pause, 
  Lock, 
  Unlock,
  Maximize2,
  Video,
  History,
  MousePointer2,
  Maximize,
  Eraser,
  Undo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { analysisApi } from "@/api/analysisApi";
import { UPlotChart } from "./UPlotChart";
import uPlot from 'uplot';
import { toast } from "sonner";

const Kbd = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <kbd className={cn(
    "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-white/60 opacity-100",
    className
  )}>
    {children}
  </kbd>
);

export function TimeSelectorTab() {
  const {
    analysisCheckedFiles,
    analysisSelectedFile,
    setAnalysisSelectedFile,
    analysisSelectedCamera,
  } = useAppStore();

  const [channels, setChannels] = useState<any[]>([]);
  const [topSignal, setTopSignal] = useState<string>("");
  const [bottomSignal, setBottomSignal] = useState<string>("");
  const [topData, setTopData] = useState<uPlot.AlignedData>([[], []]);
  const [bottomData, setBottomData] = useState<uPlot.AlignedData>([[], []]);
  const [marks, setMarks] = useState<number[]>([]);
  const marksRef = useRef<number[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const hoverTimeRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  const [duration, setDuration] = useState(100);
  const durationRef = useRef(100);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetFile, setTargetFile] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const topChartRef = useRef<uPlot | null>(null);
  const bottomChartRef = useRef<uPlot | null>(null);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [subjectCases, setSubjectCases] = useState<string[]>([]);

  useEffect(() => {
    if (analysisCheckedFiles.length > 0) {
      const subjs = Array.from(new Set(analysisCheckedFiles.map(f => {
        const parts = f.replace(/\\/g, "/").split("/");
        const subjPart = parts.find(p => /^[A-Z]\d{2}$/.test(p));
        return subjPart || "Unknown";
      }))).sort();
      setSubjects(subjs);
      if (!selectedSubject && subjs.length > 0) setSelectedSubject(subjs[0]);
    }
  }, [analysisCheckedFiles]);

  useEffect(() => {
    if (selectedSubject) {
      const cases = analysisCheckedFiles.filter(f => f.replace(/\\/g, "/").includes(selectedSubject));
      setSubjectCases(cases);
    }
  }, [selectedSubject, analysisCheckedFiles]);

  useEffect(() => {
    let fileToLoad = analysisSelectedFile || (analysisCheckedFiles.length > 0 ? analysisCheckedFiles[0] : null);
    if (fileToLoad && !fileToLoad.toLowerCase().endsWith("_tracking.mf4")) {
      fileToLoad = fileToLoad.replace(".mf4", "_tracking.mf4");
    }
    setTargetFile(fileToLoad);
  }, [analysisSelectedFile, analysisCheckedFiles]);

  useEffect(() => {
    if (targetFile) {
      analysisApi.channels(targetFile).then(res => {
        const available = res.data.channels || [];
        setChannels(available);
        if (available.length > 0) {
           const names = available.map((c: any) => c.name);
           if (names.includes("Head_H_Angle") && names.includes("Head_V_Angle")) {
             setTopSignal("Head_H_Angle"); setBottomSignal("Head_V_Angle");
           } else if (names.includes("H_Ratio") && names.includes("V_Ratio")) {
             setTopSignal("H_Ratio"); setBottomSignal("V_Ratio");
           } else {
             setTopSignal(names[0]); setBottomSignal(names[1] || names[0]);
           }
        }
      });
      analysisApi.loadMarks(targetFile).then(res => {
        if (res.data.status === 'success' && Array.isArray(res.data.marks)) setMarks(res.data.marks);
        else setMarks([]);
      });
      const baseName = targetFile.replace("_tracking.mf4", "").replace(".mf4", "");
      setVideoUrl(`/api/analysis/media?path=${encodeURIComponent(`${baseName}_cam${analysisSelectedCamera}.avi`)}`);
    }
  }, [targetFile, analysisSelectedCamera]);

  useEffect(() => {
    if (!targetFile) return;
    const fetchSignal = async (name: string, setData: any) => {
      if (!name) return;
      try {
        const res = await analysisApi.signal(targetFile, name, 10000);
        if (res.data.timestamps) {
          setData([res.data.timestamps, res.data.values]);
          if (res.data.timestamps.length > 0) setDuration(res.data.timestamps[res.data.timestamps.length - 1]);
        }
      } catch (err) {}
    };
    fetchSignal(topSignal, setTopData);
    fetchSignal(bottomSignal, setBottomData);
  }, [targetFile, topSignal, bottomSignal]);

  const sync = useMemo(() => uPlot.sync("gaze_sync"), []);

  const resetZoom = useCallback(() => {
    const d = durationRef.current;
    if (topChartRef.current) topChartRef.current.setScale('x', { min: 0, max: d });
    if (bottomChartRef.current) bottomChartRef.current.setScale('x', { min: 0, max: d });
    toast.info("Graphs view reset");
  }, []);

  const clearAllMarks = useCallback(() => {
    setMarks([]);
    if (targetFile) analysisApi.saveMarks(targetFile, []).catch(() => {});
    toast.info("All markers cleared");
  }, [targetFile]);

  const clearLastMark = useCallback(() => {
    if (marks.length > 0) {
      const newMarks = marks.slice(0, -1);
      setMarks(newMarks);
      if (targetFile) analysisApi.saveMarks(targetFile, newMarks).catch(() => {});
      toast.info("Last marker removed");
    }
  }, [marks, targetFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); clearAllMarks(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); clearLastMark(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearAllMarks, clearLastMark]);

  const addMarkAtTime = useCallback((t: number) => {
    setMarks(prev => {
        if (prev.includes(t)) return prev;
        const next = [...prev, t].sort((a, b) => a - b);
        if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
        return next;
    });
    toast.success(`Mark at ${t.toFixed(3)}s`);
  }, [targetFile]);

  const createOptions = useCallback((label: string, color: string): uPlot.Options => ({
    width: 600, height: 200,
    cursor: {
      show: true,
      sync: { key: sync.key },
      drag: { setScale: true, x: true, y: false },
      x: false,
      y: false,
      move: (u, left, top) => {
        if (left >= 0) {
          const t = u.posToVal(left, 'x');
          hoverTimeRef.current = t;
          currentTimeRef.current = t;
          
          // Throttled video seek
          if (videoRef.current && !isPlaying) {
             const now = performance.now();
             if (now - lastSeekTimeRef.current > 33) { // ~30fps seek
                videoRef.current.currentTime = t;
                lastSeekTimeRef.current = now;
             }
          }
          
          topChartRef.current?.redraw();
          bottomChartRef.current?.redraw();
        } else {
          hoverTimeRef.current = null;
          topChartRef.current?.redraw();
          bottomChartRef.current?.redraw();
        }
        return true;
      }
    },
    scales: { x: { time: false } },
    series: [{}, { label: label, stroke: color, width: 2 }],
    legend: { show: false },
    axes: [
      { stroke: "#666", grid: { stroke: "#333", width: 0.5 } },
      { stroke: "transparent", grid: { stroke: "#333", width: 0.5 }, values: () => "" }
    ],
    hooks: {
      ready: [u => {
        u.over.addEventListener("click", () => {
           if (u.select.width === 0 && u.cursor.left! >= 0) {
             const t = u.posToVal(u.cursor.left!, 'x');
             addMarkAtTime(t);
           }
        });
        u.over.addEventListener("wheel", (e: WheelEvent) => {
          e.preventDefault();
          const rect = u.over.getBoundingClientRect();
          const { left, width } = u.bbox;
          const xPos = e.clientX - rect.left - left;
          if (xPos < 0 || xPos > width) return;
          const xVal = u.posToVal(xPos, "x");
          const factor = e.deltaY > 0 ? 1.15 : 0.85;
          const oxRange = u.scales.x.max! - u.scales.x.min!;
          const nxRange = oxRange * factor;
          const leftPct = xPos / width;
          const nMin = xVal - leftPct * nxRange;
          u.batch(() => u.setScale("x", { min: nMin, max: nMin + nxRange }));
        });
      }],
      draw: [u => {
        const { ctx, bbox } = u; ctx.save();
        const currentMarks = marksRef.current;
        const curTime = currentTimeRef.current;
        const hTime = hoverTimeRef.current;

        for (let i = 0; i < currentMarks.length - 1; i += 2) {
          const x1 = u.valToPos(currentMarks[i], 'x', true);
          const x2 = u.valToPos(currentMarks[i+1], 'x', true);
          ctx.fillStyle = "rgba(255, 152, 0, 0.15)"; ctx.fillRect(x1, bbox.top, x2 - x1, bbox.height);
        }

        currentMarks.forEach(m => {
          const x = u.valToPos(m, 'x', true);
          if (x >= 0 && x <= bbox.width + bbox.left) {
            ctx.beginPath(); ctx.strokeStyle = "#ff9800"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
            ctx.moveTo(x, bbox.top); ctx.lineTo(x, bbox.top + bbox.height); ctx.stroke();
          }
        });

        const xNow = u.valToPos(curTime, 'x', true);
        if (xNow >= 0 && xNow <= bbox.width + bbox.left) {
           ctx.beginPath(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([]);
           ctx.moveTo(xNow, bbox.top); ctx.lineTo(xNow, bbox.top + bbox.height); ctx.stroke();
        }

        if (hTime !== null) {
           const xHover = u.valToPos(hTime, 'x', true);
           if (xHover >= 0 && xHover <= bbox.width + bbox.left) {
              ctx.beginPath(); ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 1; ctx.setLineDash([]);
              ctx.moveTo(xHover, bbox.top); ctx.lineTo(xHover, bbox.top + bbox.height); ctx.stroke();
           }
        }
        ctx.restore();
      }]
    }
  }), [addMarkAtTime, sync.key]);

  const topOptions = useMemo(() => createOptions(topSignal, "#00AAFF"), [topSignal, createOptions]);
  const bottomOptions = useMemo(() => createOptions(bottomSignal, "#00FF88"), [bottomSignal, createOptions]);

  useEffect(() => {
    topChartRef.current?.redraw();
    bottomChartRef.current?.redraw();
  }, [marks]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentTimeRef.current !== currentTime) setCurrentTime(currentTimeRef.current);
    }, 100);
    return () => clearInterval(timer);
  }, [currentTime]);

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500 h-full overflow-hidden">
      <style>{`
        .uplot .u-over { cursor: crosshair !important; }
        .uplot .u-select { background: rgba(0, 170, 255, 0.2) !important; }
      `}</style>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center shrink-0">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Subject</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs">{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Case</Label>
          <Select value={targetFile?.replace("_tracking.mf4", ".mf4")} onValueChange={(v) => setAnalysisSelectedFile(v)}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs max-h-[300px]">{subjectCases.map(c => <SelectItem key={c} value={c}>{c.split(/[\\/]/).pop()?.replace(".mf4", "")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex gap-2 h-full items-end pb-0.5">
          <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2 group" onClick={clearLastMark}>
            <Undo className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Clear Last <Kbd>Ctrl+D</Kbd>
          </Button>
          <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2 text-red-500 group" onClick={clearAllMarks}>
            <Eraser className="w-3 h-3 group-hover:scale-110 transition-transform" /> Clear All <Kbd>Ctrl+Space</Kbd>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2" onClick={resetZoom}>
            <Maximize className="w-3.5 h-3.5 text-white" /> Autorange
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex-[2] flex flex-col gap-2 bg-black/40 rounded-3xl border border-white/5 p-4 overflow-hidden shadow-inner h-full min-h-0">
          <div className="h-1/2 bg-surface-1/30 rounded-xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-2 left-2 z-10"><Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00AAFF]">{topSignal}</Badge></div>
            <UPlotChart options={topOptions} data={topData} className="w-full h-full" onReady={u => topChartRef.current = u} />
          </div>
          <div className="h-1/2 bg-surface-1/30 rounded-xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-2 left-2 z-10"><Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00FF88]">{bottomSignal}</Badge></div>
            <UPlotChart options={bottomOptions} data={bottomData} className="w-full h-full" onReady={u => bottomChartRef.current = u} />
          </div>
        </div>

        <div className="flex-1 bg-black rounded-3xl border border-white/5 overflow-hidden relative shadow-2xl group flex flex-col h-full min-h-0">
            <div className="flex-1 relative min-h-0">
                {videoUrl ? (
                    <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" onTimeUpdate={() => videoRef.current && isPlaying && (currentTimeRef.current = videoRef.current.currentTime)} onEnded={() => setIsPlaying(false)} />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-20"><Video className="w-12 h-12" /><span className="text-[10px] font-bold uppercase tracking-widest">Video Offline</span></div>
                )}
                <div className="absolute top-3 right-3"><Badge className="bg-black/80 backdrop-blur-md border-white/10 text-primary font-mono text-[10px]">{currentTime.toFixed(3)}s</Badge></div>
            </div>
            <div className="h-32 bg-surface-2/50 border-t border-white/5 p-3 overflow-y-auto shrink-0">
                <div className="flex items-center gap-2 mb-2"><History className="w-3 h-3 text-muted-foreground" /><span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Active Markers</span></div>
                <div className="flex flex-wrap gap-2">{marks.map((m, i) => <Badge key={i} variant="secondary" className="bg-surface-3 border-white/5 text-[10px] cursor-pointer hover:bg-primary hover:text-black" onClick={() => { currentTimeRef.current = m; if (videoRef.current) videoRef.current.currentTime = m; }}>T: {m.toFixed(3)}s</Badge>)}</div>
            </div>
        </div>
      </div>

      <div className="bg-surface-2 p-4 rounded-3xl border border-white/5 space-y-4 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => { if (videoRef.current) { if (isPlaying) videoRef.current.pause(); else videoRef.current.play(); setIsPlaying(!isPlaying); } }} className={cn("h-10 w-10 rounded-xl border-white/10 bg-surface-3", isPlaying && "bg-primary text-black")}>{isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}</Button>
            <Button size="icon" variant="outline" onClick={() => setIsSynced(!isSynced)} className={cn("h-10 w-10 rounded-xl border-white/10 transition-all", isSynced ? "bg-primary text-black" : "bg-surface-3")}>{isSynced ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</Button>
          </div>
          <div className="flex-1 flex flex-col gap-1 px-2">
            <Slider value={[currentTime]} onValueChange={([v]) => { currentTimeRef.current = v; setCurrentTime(v); if (videoRef.current) videoRef.current.currentTime = v; }} max={duration} step={0.001} />
            <div className="flex justify-between px-1"><span className="text-[9px] font-bold text-muted-foreground uppercase">0.000s</span><span className="text-[9px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">POS: {currentTime.toFixed(3)}s</span><span className="text-[9px] font-bold text-muted-foreground uppercase">{duration.toFixed(3)}s</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
