import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Mouse, 
  MouseOff,
  Video,
  Maximize,
  Eraser,
  Undo2,
  Loader2,
  RotateCcw,
  RotateCw,
  ArrowLeftToLine,
  Camera,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { analysisApi } from '@/api/analysisApi';
import { UPlotChart } from './UPlotChart';
import uPlot from 'uplot';
import { toast } from 'sonner';

const Kbd = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <kbd className={cn(
    'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-white/60 opacity-100',
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
    setAnalysisSelectedCamera,
    analysisAvailableCameras,
  } = useAppStore();

  const [channels, setChannels] = useState<any[]>([]);
  const [topSignal, setTopSignal] = useState<string>('');
  const [bottomSignal, setBottomSignal] = useState<string>('');
  const [topData, setTopData] = useState<uPlot.AlignedData>([[], []]);
  const [bottomData, setBottomData] = useState<uPlot.AlignedData>([[], []]);

  const topSignalRef = useRef(topSignal);
  useEffect(() => { topSignalRef.current = topSignal; }, [topSignal]);
  const bottomSignalRef = useRef(bottomSignal);
  useEffect(() => { bottomSignalRef.current = bottomSignal; }, [bottomSignal]);

  // Tooltip tracking states
  const [hoveringChart, setHoveringChart] = useState<'top' | 'bottom' | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    x: number; y: number; time: number; value: number; isLeft: boolean;
  } | null>(null);

  const setTooltipDataRef = useRef(setTooltipData);
  const hoveringChartRef = useRef(hoveringChart);
  useEffect(() => {
    setTooltipDataRef.current = setTooltipData;
    hoveringChartRef.current = hoveringChart;
  }, [setTooltipData, hoveringChart]);

  const [marks, setMarks] = useState<number[]>([]);
  const marksRef = useRef<number[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetFile, setTargetFile] = useState<string | null>(null);

  const videoFileName = useMemo(() => {
    if (!targetFile) return 'video.avi';
    const base = targetFile.replace('_tracking.mf4', '').replace('.mf4', '').split(/[\\/]/).pop();
    return `${base}_cam${analysisSelectedCamera}.avi`;
  }, [targetFile, analysisSelectedCamera]);

  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [isSynced, setIsSynced] = useState(true);
  const isSyncedRef = useRef(true);
  useEffect(() => { isSyncedRef.current = isSynced; }, [isSynced]);

  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const hoverTimeRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  const [duration, setDuration] = useState(100);
  const durationRef = useRef(100);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);
  const topChartRef = useRef<uPlot | null>(null);
  const bottomChartRef = useRef<uPlot | null>(null);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [subjectCases, setSubjectCases] = useState<string[]>([]);

  useEffect(() => {
    if (analysisCheckedFiles.length > 0) {
      const subjs = Array.from(new Set(analysisCheckedFiles.map(f => {
        const parts = f.replace(/\\/g, '/').split('/');
        const subjPart = parts.find(p => /^[A-Z]\d{2}$/.test(p));
        return subjPart || 'Unknown';
      }))).sort();
      setSubjects(subjs);
      if (!selectedSubject && subjs.length > 0) setSelectedSubject(subjs[0]);
    }
  }, [analysisCheckedFiles]);

  useEffect(() => {
    if (selectedSubject) {
      const cases = analysisCheckedFiles.filter(f => f.replace(/\\/g, '/').includes(selectedSubject));
      setSubjectCases(cases);
      if (cases.length > 0) {
        const belongs = targetFile && targetFile.replace(/\\/g, '/').includes(selectedSubject);
        if (!belongs) {
          setAnalysisSelectedFile(cases[0]);
        }
      }
    }
  }, [selectedSubject, analysisCheckedFiles, targetFile]);

  useEffect(() => {
    let fileToLoad = analysisSelectedFile || (analysisCheckedFiles.length > 0 ? analysisCheckedFiles[0] : null);
    if (fileToLoad && !fileToLoad.toLowerCase().endsWith('_tracking.mf4')) {
      fileToLoad = fileToLoad.replace('.mf4', '_tracking.mf4');
    }
    setTargetFile(fileToLoad);
  }, [analysisSelectedFile, analysisCheckedFiles]);

  // Phase 3: Case navigation
  const findCaseIndex = useCallback((file: string | null) => {
    if (!file) return -1;
    const norm = file.replace('_tracking.mf4', '.mf4').replace(/\\/g, '/');
    return subjectCases.findIndex(c => c.replace(/\\/g, '/') === norm);
  }, [subjectCases]);

  const goToPrevCase = useCallback(() => {
    const idx = findCaseIndex(targetFile);
    if (idx > 0) {
      setAnalysisSelectedFile(subjectCases[idx - 1].replace('_tracking.mf4', '.mf4'));
    }
  }, [findCaseIndex, targetFile, subjectCases, setAnalysisSelectedFile]);

  const goToNextCase = useCallback(() => {
    const idx = findCaseIndex(targetFile);
    if (idx < subjectCases.length - 1) {
      setAnalysisSelectedFile(subjectCases[idx + 1].replace('_tracking.mf4', '.mf4'));
    }
  }, [findCaseIndex, targetFile, subjectCases, setAnalysisSelectedFile]);

  const currentCaseIdx = findCaseIndex(targetFile);
  const prevCaseName = currentCaseIdx > 0
    ? subjectCases[currentCaseIdx - 1].split(/[\\/]/).pop()?.replace('.mf4', '').replace('_tracking', '')
    : null;
  const nextCaseName = currentCaseIdx < subjectCases.length - 1
    ? subjectCases[currentCaseIdx + 1].split(/[\\/]/).pop()?.replace('.mf4', '').replace('_tracking', '')
    : null;

  // Phase 2: Undo stack
  const undoStackRef = useRef<{type: string; data: any}[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const addToUndoStack = useCallback((action: {type: string; data: any}) => {
    undoStackRef.current.push(action);
    setUndoCount(undoStackRef.current.length);
  }, []);

  const undoLastAction = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const action = stack.pop()!;
    setUndoCount(stack.length);

    if (action.type === 'add') {
      const t = action.data.time;
      setMarks(prev => {
        const idx = prev.lastIndexOf(t);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx, 1);
        if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
        return next;
      });
    } else if (action.type === 'remove') {
      const t = action.data.time;
      setMarks(prev => {
        const next = [...prev, t].sort((a, b) => a - b);
        if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
        return next;
      });
    } else if (action.type === 'move') {
      const { index, oldTime } = action.data;
      setMarks(prev => {
        const next = [...prev];
        const idx = next.indexOf(action.data.newTime);
        if (idx >= 0) {
          next[idx] = oldTime;
          next.sort((a, b) => a - b);
          if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
        }
        return next;
      });
    }
  }, [targetFile]);

  // Pan state
  const panRef = useRef<{startClientX: number; startMin: number; startMax: number} | null>(null);

  // Drag state for markers
  const draggingRef = useRef<{index: number; startVal: number} | null>(null);
  // Live value during drag (avoids stale index after sort)
  const dragLiveValRef = useRef<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; markerIdx: number} | null>(null);

  // Dismiss context menu on any click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (targetFile) {
      analysisApi.channels(targetFile).then(res => {
        const available = res.data.channels || [];
        setChannels(available);
        if (available.length > 0) {
           const names = available.map((c: any) => c.name);
           if (names.includes('Head_H_Angle') && names.includes('Head_V_Angle')) {
             setTopSignal('Head_H_Angle'); setBottomSignal('Head_V_Angle');
           } else if (names.includes('H_Ratio') && names.includes('V_Ratio')) {
             setTopSignal('H_Ratio'); setBottomSignal('V_Ratio');
           } else {
             setTopSignal(names[0]); setBottomSignal(names[1] || names[0]);
           }
        }
      });
      analysisApi.loadMarks(targetFile).then(res => {
        if (res.data.status === 'success' && Array.isArray(res.data.marks)) setMarks(res.data.marks);
        else setMarks([]);
      });
      const baseName = targetFile.replace('_tracking.mf4', '').replace('.mf4', '');
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

  useEffect(() => {
    if (topData[0].length > 0 && topChartRef.current) {
      topChartRef.current.setScale('x', { min: 0, max: durationRef.current });
    }
  }, [topData]);

  useEffect(() => {
    if (bottomData[0].length > 0 && bottomChartRef.current) {
      bottomChartRef.current.setScale('x', { min: 0, max: durationRef.current });
    }
  }, [bottomData]);

  const sync = useMemo(() => uPlot.sync('gaze_sync'), []);

  const resetZoom = useCallback(() => {
    const d = durationRef.current;
    if (topChartRef.current) topChartRef.current.setScale('x', { min: 0, max: d });
    if (bottomChartRef.current) bottomChartRef.current.setScale('x', { min: 0, max: d });
  }, []);

  const clearAllMarks = useCallback(() => {
    undoStackRef.current.push({type: 'clear', data: {marks: [...marksRef.current]}});
    setUndoCount(undoStackRef.current.length);
    setMarks([]);
    if (targetFile) analysisApi.saveMarks(targetFile, []).catch(() => {});
  }, [targetFile]);

  const clearLastMark = useCallback(() => {
    const current = marksRef.current;
    if (current.length > 0) {
      const removed = current[current.length - 1];
      addToUndoStack({type: 'remove', data: {time: removed}});
      const newMarks = current.slice(0, -1);
      setMarks(newMarks);
      if (targetFile) analysisApi.saveMarks(targetFile, newMarks).catch(() => {});
    }
  }, [targetFile, addToUndoStack]);

  const removeMarkerByIndex = useCallback((index: number) => {
    const removed = marksRef.current[index];
    if (removed == null) return;
    addToUndoStack({type: 'remove', data: {time: removed, index}});
    setMarks(prev => {
      const next = [...prev];
      const idx = next.indexOf(removed);
      if (idx === -1) return prev;
      next.splice(idx, 1);
      if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
      return next;
    });
  }, [targetFile, addToUndoStack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); clearAllMarks(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); clearLastMark(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLastAction(); }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) { e.preventDefault(); goToPrevCase(); }
        else { e.preventDefault(); goToNextCase(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearAllMarks, clearLastMark, undoLastAction, goToNextCase, goToPrevCase]);

  const addMarkAtTime = useCallback((t: number) => {
    if (marksRef.current.includes(t)) return;
    addToUndoStack({type: 'add', data: {time: t}});
    setMarks(prev => {
        const next = [...prev, t].sort((a, b) => a - b);
        if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
        return next;
    });
  }, [targetFile, addToUndoStack]);

  // Find a marker by x pixel pos (plotting-area coords)
  const findMarkerIndexAtPos = useCallback((u: uPlot, px: number): number | null => {
    const currentMarks = marksRef.current;
    const tol = 6;
    for (let i = 0; i < currentMarks.length; i++) {
      const mPx = u.valToPos(currentMarks[i], 'x');
      if (Math.abs(mPx - px) <= tol) return i;
    }
    return null;
  }, []);

  const createOptions = useCallback((label: string, color: string): uPlot.Options => ({
    width: 600, height: 200,
    cursor: {
      show: true,
      sync: sync,
      drag: { setScale: false, x: false, y: false },
      x: true,
      y: false,
    },
    scales: { x: { time: false } },
    series: [{}, { label: label, stroke: color, width: 2 }],
    legend: { show: false },
    axes: [
      { stroke: '#666', grid: { stroke: '#333', width: 0.5 } },
      { stroke: 'transparent', grid: { stroke: '#333', width: 0.5 }, values: () => '' }
    ],
    hooks: {
      setCursor: [
        (u) => {
          const left = u.cursor.left;
          if (left == null || left < 0) {
            hoverTimeRef.current = null;
            setTooltipDataRef.current(null);
            return;
          }
          const t = u.posToVal(left, 'x');
          hoverTimeRef.current = t;

          // Skip video sync during pan
          if (!panRef.current && isSyncedRef.current) {
            currentTimeRef.current = t;
            if (videoRef.current && !isPlayingRef.current) {
               const now = performance.now();
               if (now - lastSeekTimeRef.current > 33) {
                  videoRef.current.currentTime = t;
                  if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
                  lastSeekTimeRef.current = now;
               }
            }
          }

          // Tooltip
          const activeChart = hoveringChartRef.current;
          const chartLabel = label;
          const isCurrentChart = (activeChart === 'top' && chartLabel === topSignalRef.current) ||
                                 (activeChart === 'bottom' && chartLabel === bottomSignalRef.current);

          if (isCurrentChart) {
            const idx = u.cursor.idx;
            if (idx != null && idx >= 0 && u.data[1]) {
              const yVal = u.data[1][idx];
              const xVal = u.data[0][idx];
              const tooltipX = u.bbox.left + left;
              const tooltipY = u.bbox.top + (u.cursor.top || 0);
              const isLeft = left > u.bbox.width - 130;
              setTooltipDataRef.current({
                x: tooltipX, y: tooltipY, time: xVal, value: yVal, isLeft
              });
            }
          }

          // Update dragging marker (live val only, commit on mouseup)
          if (draggingRef.current) {
            dragLiveValRef.current = t;
          }
        }
      ],
      ready: [u => {
        const syncOther = () => {
          const other = (u === topChartRef.current) ? bottomChartRef.current : topChartRef.current;
          return other;
        };
        const applyScaleToOther = (nMin: number, nMax: number) => {
          const other = syncOther();
          if (other) other.batch(() => other.setScale('x', { min: nMin, max: nMax }));
        };

        u.over.addEventListener('mousemove', (e: MouseEvent) => {
          if (panRef.current || draggingRef.current) return;
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const nearIdx = findMarkerIndexAtPos(u, px);
          u.over.style.cursor = nearIdx != null ? 'ew-resize' : 'crosshair';
        });

        u.over.addEventListener('mousedown', (e: MouseEvent) => {
          if (e.button !== 0) return;
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const nearIdx = findMarkerIndexAtPos(u, px);
          if (nearIdx != null) {
            draggingRef.current = {index: nearIdx, startVal: marksRef.current[nearIdx]};
            return;
          }
          panRef.current = {
            startClientX: e.clientX,
            startMin: u.scales.x.min!,
            startMax: u.scales.x.max!
          };
        });

        u.over.addEventListener('mousemove', (e: MouseEvent) => {
          const pan = panRef.current;
          if (!pan || draggingRef.current) return;
          const plotWidth = u.bbox.width;
          if (plotWidth <= 0) return;
          const dx = pan.startClientX - e.clientX;
          const range = pan.startMax - pan.startMin;
          const shift = (dx / plotWidth) * range;
          const nMin = pan.startMin + shift;
          const nMax = pan.startMax + shift;
          u.batch(() => u.setScale('x', { min: nMin, max: nMax }));
          applyScaleToOther(nMin, nMax);
        });

        u.over.addEventListener('mouseup', (e: MouseEvent) => {
          if (draggingRef.current) {
            const { index, startVal } = draggingRef.current;
            const newVal = dragLiveValRef.current;
            dragLiveValRef.current = null;
            if (newVal != null && Math.abs(newVal - startVal) > 0.001) {
              addToUndoStack({type: 'move', data: {index, oldTime: startVal, newTime: newVal}});
              setMarks(prev => {
                const next = prev.filter(t => Math.abs(t - startVal) > 0.0001);
                next.push(newVal);
                next.sort((a, b) => a - b);
                if (targetFile) analysisApi.saveMarks(targetFile, next).catch(() => {});
                return next;
              });
            }
            draggingRef.current = null;
            return;
          }

          const pan = panRef.current;
          const wasPan = pan && Math.abs(pan.startClientX - e.clientX) > 3;
          panRef.current = null;

          if (!wasPan && e.button === 0) {
            const rect = u.over.getBoundingClientRect();
            const px = e.clientX - rect.left;
            if (px >= 0) {
              const t = u.posToVal(px, 'x');
              addMarkAtTime(t);
            }
          }
        });

        u.over.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const nearIdx = findMarkerIndexAtPos(u, px);
          if (nearIdx != null) {
            setContextMenu({x: e.clientX, y: e.clientY, markerIdx: nearIdx});
          }
        });

        u.over.addEventListener('click', () => {
          setContextMenu(null);
        });

        u.over.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault();
          const rect = u.over.getBoundingClientRect();
          const plotWidth = u.bbox.width;
          const xPos = e.clientX - rect.left;
          if (xPos < 0 || xPos > plotWidth) return;
          const xVal = u.posToVal(xPos, 'x');
          const factor = e.deltaY > 0 ? 1.15 : 0.85;
          const oxRange = u.scales.x.max! - u.scales.x.min!;
          const nxRange = oxRange * factor;
          const leftPct = xPos / plotWidth;
          const nMin = xVal - leftPct * nxRange;
          const nMax = nMin + nxRange;
          u.batch(() => u.setScale('x', { min: nMin, max: nMax }));
          applyScaleToOther(nMin, nMax);
        });
      }],
      draw: [u => {
        const { ctx, bbox } = u; ctx.save();
        const currentMarks = marksRef.current;

        for (let i = 0; i < currentMarks.length - 1; i += 2) {
          const x1 = u.valToPos(currentMarks[i], 'x', true);
          const x2 = u.valToPos(currentMarks[i+1], 'x', true);
          ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
          ctx.fillRect(x1, bbox.top, x2 - x1, bbox.height);
        }

        const dragVal = dragLiveValRef.current;
        const dragIdx = draggingRef.current?.index;
        currentMarks.forEach((m, idx) => {
          const val = (dragIdx === idx && dragVal != null) ? dragVal : m;
          const x = u.valToPos(val, 'x', true);
          if (x >= 0 && x <= bbox.width + bbox.left) {
            const isDragging = dragIdx === idx && dragVal != null;
            ctx.beginPath();
            ctx.strokeStyle = isDragging ? '#ffb74d' : '#ff9800';
            ctx.lineWidth = isDragging ? 2.5 : 1.5;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(x, bbox.top);
            ctx.lineTo(x, bbox.top + bbox.height);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });

        ctx.restore();
      }]
    }
  }), [addMarkAtTime, sync.key, findMarkerIndexAtPos, addToUndoStack, targetFile]);

  const topOptions = useMemo(() => createOptions(topSignal, '#00AAFF'), [topSignal, createOptions]);
  const bottomOptions = useMemo(() => createOptions(bottomSignal, '#00FF88'), [bottomSignal, createOptions]);

  useEffect(() => {
    topChartRef.current?.redraw();
    bottomChartRef.current?.redraw();
  }, [marks]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentTimeRef.current !== currentTime) {
        setCurrentTime(currentTimeRef.current);
      }
      if (isPlayingRef.current) {
        topChartRef.current?.redraw();
        bottomChartRef.current?.redraw();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [currentTime]);

  useEffect(() => {
    topChartRef.current?.redraw();
    bottomChartRef.current?.redraw();
  }, [currentTime]);

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500 h-full overflow-hidden">
      <style>{`
        .uplot .u-over { cursor: crosshair !important; }
        .uplot .u-select { background: rgba(0, 170, 255, 0.2) !important; }
        .uplot .u-cursor-x { border-left: 1px dashed rgba(255, 255, 255, 0.4) !important; }
      `}</style>

      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <div className="space-y-1 min-w-[120px]">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Top Signal</Label>
          <Select value={topSignal} onValueChange={setTopSignal}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs max-h-[250px]">
              {channels.map((ch: any) => (
                <SelectItem key={ch.name} value={ch.name}>{ch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[120px]">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Bottom Signal</Label>
          <Select value={bottomSignal} onValueChange={setBottomSignal}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs max-h-[250px]">
              {channels.map((ch: any) => (
                <SelectItem key={ch.name} value={ch.name}>{ch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[70px]">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Subject</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs">
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[110px]">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1 font-bold">Case</Label>
          <Select value={targetFile?.replace('_tracking.mf4', '.mf4')} onValueChange={(v) => setAnalysisSelectedFile(v)}>
            <SelectTrigger className="h-8 bg-surface-2 border-white/5 rounded-lg text-[11px] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface-2 border-white/5 text-xs max-h-[300px]">
              {subjectCases.map(c => <SelectItem key={c} value={c}>{c.split(/[\\/]/).pop()?.replace('.mf4', '')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 pb-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg border border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold px-2 gap-1 disabled:opacity-30"
            disabled={currentCaseIdx <= 0}
            onClick={goToPrevCase}
            title={prevCaseName ? `Prev: ${prevCaseName}` : ''}
          >
            <ArrowLeft className="w-3 h-3" /><Kbd>Shift+Tab</Kbd>
          </Button>
          <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
            {currentCaseIdx + 1}/{subjectCases.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg border border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold px-2 gap-1 disabled:opacity-30"
            disabled={currentCaseIdx >= subjectCases.length - 1}
            onClick={goToNextCase}
            title={nextCaseName ? `Next: ${nextCaseName}` : ''}
          >
            <ArrowRight className="w-3 h-3" /><Kbd>Tab</Kbd>
          </Button>
        </div>

        <div className="flex gap-1 pb-0.5 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-1 disabled:opacity-30"
            disabled={undoCount === 0}
            onClick={undoLastAction}
          >
            <Undo2 className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2 group" onClick={clearLastMark}>
            Clear Last <Kbd>Ctrl+D</Kbd>
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2 text-red-500 group" onClick={clearAllMarks}>
            <Eraser className="w-3 h-3 group-hover:scale-110 transition-transform" /> Clear All <Kbd>Ctrl+Space</Kbd>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg border-white/5 bg-surface-2 hover:bg-surface-3 text-[10px] font-bold uppercase gap-2" onClick={resetZoom}>
            <Maximize className="w-3.5 h-3.5 text-white" /> Autorange
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex-[2] flex flex-col gap-2 bg-black/40 rounded-3xl border border-white/5 p-4 overflow-hidden shadow-inner h-full min-h-0 justify-center">
          <div 
            className="flex-1 min-h-[90px] bg-surface-1/30 rounded-xl border border-white/5 relative overflow-hidden group"
            onMouseEnter={() => setHoveringChart('top')}
            onMouseLeave={() => { setHoveringChart(null); setTooltipData(null); }}
          >
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00AAFF]">{topSignal}</Badge>
            </div>
            <UPlotChart options={topOptions} data={topData} className="w-full h-full" onReady={u => topChartRef.current = u} />
            {hoveringChart === 'top' && tooltipData && (
              <div 
                className="absolute z-30 pointer-events-none bg-surface-3/90 border border-white/10 backdrop-blur-md rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 transition-all duration-75"
                style={{
                  left: tooltipData.isLeft ? `${tooltipData.x - 145}px` : `${tooltipData.x + 15}px`,
                  top: `${tooltipData.y - 15}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider font-mono">
                  Time: {tooltipData.time.toFixed(3)}s
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00AAFF]" />
                  <span className="text-[10px] font-bold text-white/80">{topSignal}</span>
                  <span className="text-[11px] font-extrabold text-white font-mono">{tooltipData.value.toFixed(2)}°</span>
                </div>
              </div>
            )}
          </div>
          <div 
            className="flex-1 min-h-[90px] bg-surface-1/30 rounded-xl border border-white/5 relative overflow-hidden group"
            onMouseEnter={() => setHoveringChart('bottom')}
            onMouseLeave={() => { setHoveringChart(null); setTooltipData(null); }}
          >
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00FF88]">{bottomSignal}</Badge>
            </div>
            <UPlotChart options={bottomOptions} data={bottomData} className="w-full h-full" onReady={u => bottomChartRef.current = u} />
            {hoveringChart === 'bottom' && tooltipData && (
              <div 
                className="absolute z-30 pointer-events-none bg-surface-3/90 border border-white/10 backdrop-blur-md rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 transition-all duration-75"
                style={{
                  left: tooltipData.isLeft ? `${tooltipData.x - 145}px` : `${tooltipData.x + 15}px`,
                  top: `${tooltipData.y - 15}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider font-mono">
                  Time: {tooltipData.time.toFixed(3)}s
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]" />
                  <span className="text-[10px] font-bold text-white/80">{bottomSignal}</span>
                  <span className="text-[11px] font-extrabold text-white font-mono">{tooltipData.value.toFixed(2)}°</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-black rounded-3xl border border-white/5 overflow-hidden relative shadow-2xl group flex flex-col h-full min-h-0">
            <div className="flex-1 relative min-h-0">
                 {videoUrl ? (
                     <>
                         <video
                             ref={blurVideoRef}
                             src={videoUrl}
                             muted
                             loop
                             playsInline
                             className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[60px] scale-125 pointer-events-none transition-opacity duration-500"
                         />
                         <video 
                             ref={videoRef} 
                             src={videoUrl} 
                             className="w-full h-full object-contain relative z-10" 
                             onTimeUpdate={() => {
                                 if (videoRef.current) {
                                     const t = videoRef.current.currentTime;
                                     currentTimeRef.current = t;
                                     setCurrentTime(t);
                                     if (blurVideoRef.current && isPlaying && Math.abs(blurVideoRef.current.currentTime - t) > 0.15) {
                                         blurVideoRef.current.currentTime = t;
                                     }
                                     topChartRef.current?.redraw();
                                     bottomChartRef.current?.redraw();
                                 }
                             }}
                             onPlay={() => { setIsPlaying(true); blurVideoRef.current?.play(); }}
                             onPause={() => { setIsPlaying(false); blurVideoRef.current?.pause(); }}
                             onEnded={() => { setIsPlaying(false); blurVideoRef.current?.pause(); }}
                             onLoadStart={() => { setVideoLoading(true); setVideoError(null); }}
                             onWaiting={() => setVideoLoading(true)}
                             onCanPlay={() => setVideoLoading(false)}
                             onError={() => {
                                 setVideoLoading(false);
                                 setVideoError('Failed to decode video format');
                             }}
                         />
                        {videoLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Preparing Media...</span>
                            </div>
                        )}
                        {videoError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 z-20 text-red-500">
                                <Video className="w-12 h-12 opacity-60" />
                                <span className="text-xs font-bold uppercase tracking-widest">{videoError}</span>
                                <span className="text-[9px] opacity-40">Please verify AVI file exists or FFMPEG is installed</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-20"><Video className="w-12 h-12" /><span className="text-[10px] font-bold uppercase tracking-widest">Video Offline</span></div>
                )}
                <div className="absolute top-3 right-3 z-20">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 bg-black/80 hover:bg-black/95 text-white border-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md px-2.5">
                                <Camera className="w-3 h-3 text-primary animate-pulse" />
                                <span>Cam {analysisSelectedCamera}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32 bg-surface-2/95 border-white/5 text-white p-1 backdrop-blur-xl">
                            {(analysisAvailableCameras.length > 0 ? analysisAvailableCameras : [1, 2, 3]).map(cam => (
                                <DropdownMenuItem 
                                    key={cam} 
                                    className={cn(
                                        'text-[10px] font-bold cursor-pointer rounded-lg px-2 py-1.5 transition-colors flex items-center justify-between',
                                        analysisSelectedCamera === cam ? 'bg-primary text-black focus:bg-primary focus:text-black' : 'text-white/80 hover:text-white hover:bg-white/5 focus:bg-white/5 focus:text-white'
                                    )}
                                    onClick={() => setAnalysisSelectedCamera(Number(cam))}
                                >
                                    <span>Camera {cam}</span>
                                    {analysisSelectedCamera === cam && <span className="text-[10px] font-bold">✓</span>}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="h-24 bg-surface-2/50 border-t border-white/5 p-3 shrink-0 flex flex-col justify-between">
                <div className="flex items-center gap-3 w-full">
                    <span className="text-xs font-bold text-muted-foreground/60 font-mono">0.00s</span>
                    <div className="flex-1 relative py-2 flex items-center">
                        <Slider 
                            value={[currentTime]} 
                            onValueChange={([v]) => { 
                                currentTimeRef.current = v; 
                                setCurrentTime(v); 
                                if (videoRef.current) videoRef.current.currentTime = v; 
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = v; 
                            }} 
                            max={duration} 
                            step={0.001} 
                            className={cn(
                                'flex-1 cursor-pointer',
                                '[&>span:first-child]:!h-[3px] [&>span:first-child]:!bg-white/10',
                                '[&>span:first-child>span]:!bg-primary',
                                '[&>span:last-child]:!hidden'
                            )}
                        />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground/60 font-mono">{duration.toFixed(2)}s</span>
                </div>
                <div className="flex items-center justify-between w-full mt-1">
                    <div className="flex items-center gap-1">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-white/5 text-white flex items-center justify-center"
                            title="Restart from beginning"
                            onClick={() => {
                                currentTimeRef.current = 0;
                                setCurrentTime(0);
                                if (videoRef.current) videoRef.current.currentTime = 0;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = 0;
                                topChartRef.current?.redraw();
                                bottomChartRef.current?.redraw();
                            }}
                        >
                            <ArrowLeftToLine className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-white/5 text-white flex items-center justify-center"
                            title="Rewind 5 seconds"
                            onClick={() => {
                                const t = Math.max(0, currentTime - 5);
                                currentTimeRef.current = t;
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
                                topChartRef.current?.redraw();
                                bottomChartRef.current?.redraw();
                            }}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="outline" 
                            onClick={() => { 
                                if (videoRef.current) { 
                                    if (isPlaying) { 
                                        videoRef.current.pause(); 
                                        blurVideoRef.current?.pause(); 
                                    } else { 
                                        videoRef.current.play(); 
                                        blurVideoRef.current?.play(); 
                                    } 
                                    setIsPlaying(!isPlaying); 
                                } 
                            }} 
                            className={cn(
                                'h-7 w-7 rounded-lg border-white/10 bg-surface-3 transition-colors text-white hover:text-white', 
                                isPlaying ? 'bg-primary hover:bg-primary/90' : 'hover:bg-white/5'
                            )}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current text-white" /> : <Play className="w-3.5 h-3.5 fill-current text-white ml-0.5" />}
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-white/5 text-white flex items-center justify-center"
                            title="Forward 5 seconds"
                            onClick={() => {
                                const t = Math.min(duration, currentTime + 5);
                                currentTimeRef.current = t;
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
                                topChartRef.current?.redraw();
                                bottomChartRef.current?.redraw();
                            }}
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="outline" 
                            onClick={() => setIsSynced(!isSynced)} 
                            className={cn(
                                'h-7 w-7 rounded-lg border-white/10 transition-all text-white hover:text-white', 
                                isSynced ? 'bg-primary hover:bg-primary/90' : 'bg-surface-3 hover:bg-surface-2'
                            )} 
                            title={isSynced ? 'Disable Mouse Sync' : 'Enable Mouse Sync'}
                        >
                            {isSynced ? <Mouse className="w-3.5 h-3.5 text-white" /> : <MouseOff className="w-3.5 h-3.5 text-white" />}
                        </Button>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider truncate max-w-[200px]" title={videoFileName}>
                        {videoFileName}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-2/95 border border-white/10 backdrop-blur-xl rounded-xl p-1 shadow-2xl"
          style={{left: `${contextMenu.x}px`, top: `${contextMenu.y}px`}}
          onClick={() => setContextMenu(null)}
        >
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/5 rounded-lg w-full transition-colors"
            onMouseDown={(e) => { e.stopPropagation(); removeMarkerByIndex(contextMenu.markerIdx); setContextMenu(null); }}
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            Delete Marker
          </button>
        </div>
      )}
    </div>
  );
}
