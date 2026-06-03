import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  Menu,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { analysisApi } from '@/api/analysisApi';
import { UPlotChart } from './UPlotChart';
import uPlot from 'uplot';
import Waves from './Waves';
import { useTheme } from '@/hooks/useTheme';


// --- CHART SKELETON COMPONENT ---
const ChartSkeleton = ({ title, colorClass }: { title: string; colorClass: string }) => {
  const strokeColor = colorClass.includes('#00AAFF') ? 'rgba(0, 170, 255, 0.3)' : 'rgba(0, 255, 136, 0.3)';
  return (
    <div className="flex-1 min-h-[90px] bg-white dark:bg-surface-1 rounded-xl border border-border dark:border-white/5 relative overflow-hidden flex flex-col justify-between p-4 select-none">
      <div className="absolute top-2 left-2 z-10">
        <div className="h-5 px-2 bg-black/40 backdrop-blur-md rounded-md border border-white/5 flex items-center justify-center">
          <span className={cn("text-[9px] font-bold uppercase tracking-wider", colorClass)}>{title}</span>
        </div>
      </div>
      
      {/* Wave container */}
      <div className="flex-1 w-full relative mt-4 overflow-hidden rounded-lg">
        <Waves
          lineColor={strokeColor}
          backgroundColor="transparent"
          waveSpeedX={0.02}
          waveSpeedY={0.01}
          waveAmpX={30}
          waveAmpY={15}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={36}
          className="opacity-70"
        />
        {/* Soft grid background overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="400" y2="20" stroke="currentColor" className="text-black/[0.04] dark:text-white/[0.03]" strokeWidth="1" strokeDasharray="4" />
          <line x1="0" y1="50" x2="400" y2="50" stroke="currentColor" className="text-black/[0.04] dark:text-white/[0.03]" strokeWidth="1" strokeDasharray="4" />
          <line x1="0" y1="80" x2="400" y2="80" stroke="currentColor" className="text-black/[0.04] dark:text-white/[0.03]" strokeWidth="1" strokeDasharray="4" />
        </svg>
      </div>

      <div className="flex justify-between items-center w-full text-[9px] text-muted-foreground/30 font-mono mt-1 pt-1 border-t border-border dark:border-white/5">
        <span>0.00s</span>
        <span>25.00s</span>
        <span>50.00s</span>
        <span>75.00s</span>
        <span className="text-sm font-sans relative -top-[1.2px]">∞</span>
      </div>
    </div>
  );
};

export function GazeTimeTab() {
  const { isDark } = useTheme();
  const {
    analysisCheckedFiles,
    analysisSelectedFile,
    setAnalysisSelectedFile,
    analysisSelectedCamera,
    setAnalysisSelectedCamera,
    analysisAvailableCameras,
    analysisSourcePath,
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
  const topTooltipRef = useRef<HTMLDivElement>(null);
  const bottomTooltipRef = useRef<HTMLDivElement>(null);
  const hoveringChartRef = useRef(hoveringChart);
  useEffect(() => {
    hoveringChartRef.current = hoveringChart;
  }, [hoveringChart]);

  const [marks, setMarks] = useState<number[]>([]);
  const marksRef = useRef<number[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetFile, setTargetFile] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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
  const toggleSync = useCallback(() => {
    setIsSynced(v => { const n = !v; isSyncedRef.current = n; return n; });
  }, []);

  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const hoverTimeRef = useRef<number | null>(null);

  const [duration, setDuration] = useState(100);
  const durationRef = useRef(100);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // rAF video seek loop (avoids jank from setCursor seeking on every pixel)
  const seekRAF = useRef(0);
  useEffect(() => {
    let last = 0;
    const loop = () => {
      seekRAF.current = requestAnimationFrame(loop);
      if (!isSyncedRef.current || isPlayingRef.current || panRef.current || !videoRef.current || videoRef.current.readyState < 1) return;
      const h = hoverTimeRef.current;
      if (h == null) return;
      const now = performance.now();
      if (now - last < 16) return;
      if (!videoRef.current.seeking) {
        const cur = videoRef.current.currentTime;
        if (Math.abs(cur - h) > 0.015) {
          videoRef.current.currentTime = h;
        }
      }
      if (blurVideoRef.current && !blurVideoRef.current.seeking) {
        const blurCur = blurVideoRef.current.currentTime;
        if (Math.abs(blurCur - h) > 0.015) {
          blurVideoRef.current.currentTime = h;
        }
      }
      last = now;
    };
    seekRAF.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(seekRAF.current);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);
  const topChartRef = useRef<uPlot | null>(null);
  const bottomChartRef = useRef<uPlot | null>(null);

  // Video zoom state
  const [videoZoom, setVideoZoom] = useState(1);
  const zoomIn = useCallback(() => setVideoZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2)))), []);
  const zoomOut = useCallback(() => setVideoZoom(z => Math.max(1, parseFloat((z - 0.25).toFixed(2)))), []);
  const [showBlur, setShowBlur] = useState(true);

  // Zoom overlay timer logic
  const [showZoomOverlay, setShowZoomOverlay] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setShowZoomOverlay(true);
    const timer = setTimeout(() => {
      setShowZoomOverlay(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [videoZoom]);

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
        if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
        return next;
      });
    } else if (action.type === 'remove') {
      const t = action.data.time;
      setMarks(prev => {
        const next = [...prev, t].sort((a, b) => a - b);
        if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
        return next;
      });
    } else if (action.type === 'move') {
      const { oldTime } = action.data;
      setMarks(prev => {
        const next = [...prev];
        const idx = next.indexOf(action.data.newTime);
        if (idx >= 0) {
          next[idx] = oldTime;
          next.sort((a, b) => a - b);
          if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
        }
        return next;
      });
    }
  }, [targetFile, analysisSourcePath]);

  // Pan state
  const panRef = useRef<{startClientX: number; startMin: number; startMax: number} | null>(null);

  // Drag state for markers
  const draggingRef = useRef<{index: number; startVal: number} | null>(null);
  // Live value during drag (avoids stale index after sort)
  const dragLiveValRef = useRef<number | null>(null);
  // Marker index that passed the 1s hover threshold (enables marker drag on mousedown)
  const markerDragReadyRef = useRef<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; markerIdx: number} | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Dismiss context menu on any click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    hoverTimeRef.current = null;
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
      analysisApi.loadMarks(targetFile, analysisSourcePath).then(res => {
        if (res.data.status === 'success' && Array.isArray(res.data.marks)) setMarks(res.data.marks);
        else setMarks([]);
      });
      const baseName = targetFile.replace('_tracking.mf4', '').replace('.mf4', '');
      const url = `/api/analysis/media?path=${encodeURIComponent(`${baseName}_cam${analysisSelectedCamera}.avi`)}`;
      
      setVideoUrl(null);
      setVideoLoading(true);
      setVideoError(null);

      const abortController = new AbortController();
      fetch(url, { signal: abortController.signal })
        .then(res => {
          if (!res.ok) throw new Error('Video not found');
          return res.blob();
        })
        .then(blob => {
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRef.current = blobUrl;
          setVideoUrl(blobUrl);
          setVideoLoading(false);
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          console.error('Failed to preload video:', err);
          setVideoUrl(url);
          setVideoLoading(false);
        });

      return () => {
        abortController.abort();
      };
    } else {
      setChannels([]);
      setTopSignal('');
      setBottomSignal('');
      setTopData([[], []]);
      setBottomData([[], []]);
      setMarks([]);
      setVideoUrl(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setIsPlaying(false);
      setDuration(100);
      setVideoZoom(1);
    }
  }, [targetFile, analysisSelectedCamera, analysisSourcePath]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

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
    if (targetFile) analysisApi.saveMarks(targetFile, [], analysisSourcePath).catch(() => {});
  }, [targetFile, analysisSourcePath]);

  const clearLastMark = useCallback(() => {
    const current = marksRef.current;
    if (current.length > 0) {
      const removed = current[current.length - 1];
      addToUndoStack({type: 'remove', data: {time: removed}});
      const newMarks = current.slice(0, -1);
      setMarks(newMarks);
      if (targetFile) analysisApi.saveMarks(targetFile, newMarks, analysisSourcePath).catch(() => {});
    }
  }, [targetFile, addToUndoStack, analysisSourcePath]);

  const removeMarkerByIndex = useCallback((index: number) => {
    const removed = marksRef.current[index];
    if (removed == null) return;
    addToUndoStack({type: 'remove', data: {time: removed, index}});
    setMarks(prev => {
      const next = [...prev];
      const idx = next.indexOf(removed);
      if (idx === -1) return prev;
      next.splice(idx, 1);
      if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
      return next;
    });
  }, [targetFile, addToUndoStack, analysisSourcePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!targetFile) return;
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); clearAllMarks(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); clearLastMark(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLastAction(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); resetZoom(); }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) { e.preventDefault(); goToPrevCase(); }
        else { e.preventDefault(); goToNextCase(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetFile, clearAllMarks, clearLastMark, undoLastAction, goToNextCase, goToPrevCase, resetZoom]);

  const addMarkAtTime = useCallback((t: number) => {
    if (marksRef.current.includes(t)) return;
    addToUndoStack({type: 'add', data: {time: t}});
    setMarks(prev => {
        const next = [...prev, t].sort((a, b) => a - b);
        if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
        return next;
    });
  }, [targetFile, addToUndoStack, analysisSourcePath]);

  // Find a marker by x pixel pos (plotting-area coords)
  const findMarkerIndexAtPos = useCallback((u: uPlot, px: number): number | null => {
    const currentMarks = marksRef.current;
    const tol = 15;
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
      { stroke: isDark ? '#666' : '#888888', grid: { stroke: isDark ? '#333' : '#E5E5E5', width: 0.5 } },
      { stroke: 'transparent', grid: { stroke: isDark ? '#333' : '#E5E5E5', width: 0.5 }, values: [] }
    ],
    hooks: {
      setCursor: [
        (u) => {
          const left = u.cursor.left;
          if (left == null || left < 0) {
            hoverTimeRef.current = null;
            return;
          }
          const t = u.posToVal(left, 'x');
          hoverTimeRef.current = t;

          // Tooltip via direct DOM (no React state)
          const activeChart = hoveringChartRef.current;
          const chartLabel = label;
          const isCurrentChart = (activeChart === 'top' && chartLabel === topSignalRef.current) ||
                                 (activeChart === 'bottom' && chartLabel === bottomSignalRef.current);

          const tipRef = activeChart === 'top' ? topTooltipRef : bottomTooltipRef;
          if (isCurrentChart && tipRef.current) {
            const idx = u.cursor.idx;
            if (idx != null && idx >= 0 && u.data[1]) {
              const yVal = u.data[1][idx];
              const xVal = u.data[0][idx];
              if (yVal == null || xVal == null) return;

              const tooltipX = u.bbox.left + left;
              const tooltipY = u.bbox.top + (u.cursor.top ?? 0);
              const isLeft = left > u.bbox.width - 130;
              const el = tipRef.current;
              el.style.display = 'block';
              el.style.left = isLeft ? `${tooltipX - 145}px` : `${tooltipX + 15}px`;
              el.style.top = `${tooltipY - 15}px`;
              el.querySelector('[data-tip-time]')!.textContent = `Time: ${xVal.toFixed(3)}s`;
              el.querySelector('[data-tip-value]')!.textContent = `${yVal.toFixed(2)}°`;
            }
          } else if (tipRef.current) {
            tipRef.current.style.display = 'none';
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

        let lastNearIdx: number | null = null;
        let markerHoverTimeout: any = null;

        const clearHoverTimeout = () => {
          if (markerHoverTimeout) {
            clearTimeout(markerHoverTimeout);
            markerHoverTimeout = null;
          }
        };

        u.over.addEventListener('mousemove', (e: MouseEvent) => {
          if (panRef.current || draggingRef.current) return;
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const nearIdx = findMarkerIndexAtPos(u, px);
          if (nearIdx != null) {
            if (lastNearIdx !== nearIdx) {
              clearHoverTimeout();
              markerDragReadyRef.current = null;
              lastNearIdx = nearIdx;
              
              // Start a 0.25s hover delay timer to activate the drag cursor
              markerHoverTimeout = setTimeout(() => {
                u.over.style.setProperty('cursor', 'ew-resize', 'important');
                markerDragReadyRef.current = nearIdx;
              }, 250);
            }
          } else {
            clearHoverTimeout();
            if (lastNearIdx != null) { markerDragReadyRef.current = null; lastNearIdx = null; }
            u.over.style.removeProperty('cursor');
          }
        });

        u.over.addEventListener('mouseleave', () => {
          clearHoverTimeout();
          markerDragReadyRef.current = null;
          lastNearIdx = null;
          u.over.style.removeProperty('cursor');
        });

        u.over.addEventListener('mousedown', (e: MouseEvent) => {
          clearHoverTimeout();
          if (e.button !== 0) return;
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          // Only start marker drag if the 1s hover threshold was met
          if (markerDragReadyRef.current != null) {
            const nearIdx = findMarkerIndexAtPos(u, px);
            if (nearIdx != null && nearIdx === markerDragReadyRef.current) {
              draggingRef.current = {index: nearIdx, startVal: marksRef.current[nearIdx]};
              markerDragReadyRef.current = null;
              // Keep cursor as ew-resize during drag
              u.over.style.setProperty('cursor', 'ew-resize', 'important');
              return;
            }
          }
          markerDragReadyRef.current = null;
          // Always start pan otherwise
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
                if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
                return next;
              });
            }
            draggingRef.current = null;
            u.over.style.removeProperty('cursor');
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
  }), [addMarkAtTime, sync.key, findMarkerIndexAtPos, addToUndoStack, targetFile, isDark]);

  const topOptions = useMemo(() => createOptions(topSignal, '#00AAFF'), [topSignal, createOptions]);
  const bottomOptions = useMemo(() => createOptions(bottomSignal, '#00FF88'), [bottomSignal, createOptions]);

  useEffect(() => {
    topChartRef.current?.redraw();
    bottomChartRef.current?.redraw();
  }, [marks]);

  // Ref to throttle expensive React state updates from onTimeUpdate
  const lastStateUpdateRef = useRef<number>(0);

  const updatePlayheadCursors = useCallback((time: number) => {
    if (hoveringChartRef.current != null) return;
    [topChartRef.current, bottomChartRef.current].forEach(u => {
      if (u) {
        const left = u.valToPos(time, 'x');
        u.setCursor({ left, top: 0 });
      }
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const curT = currentTimeRef.current;
      if (curT !== currentTime) {
        setCurrentTime(curT);
      }
      if (isPlayingRef.current) {
        updatePlayheadCursors(curT);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [currentTime, updatePlayheadCursors]);

  return (
    <div className="flex flex-col animate-in fade-in duration-500 h-full overflow-hidden" style={{ backgroundColor: isDark ? 'var(--background)' : '#ffffff' }}>
      <style>{`
        .uplot .u-over { cursor: crosshair !important; }
        .uplot .u-select { background: rgba(0, 170, 255, 0.2) !important; }
        .uplot .u-cursor-x { border-left: 1px dashed rgba(255, 255, 255, 0.4) !important; }
        
        @keyframes waveMove1 {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-200px, 0, 0); }
        }
        @keyframes waveMove2 {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-150px, 0, 0); }
        }
        @keyframes pulseSmoothSync {
          0%, 100% {
            opacity: 0.25;
            filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0));
            color: rgba(255, 255, 255, 0.35);
          }
          50% {
            opacity: 0.95;
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.25));
            color: rgba(255, 255, 255, 0.95);
          }
        }
        .animate-wave-1 {
          animation: waveMove1 6s linear infinite;
        }
        .animate-wave-2 {
          animation: waveMove2 4s linear infinite;
        }
        .animate-pulse-sync {
          animation: pulseSmoothSync 3s ease-in-out infinite;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        <div 
          className="flex-[2] flex flex-col gap-2 p-4 overflow-hidden h-full min-h-0 justify-center border-r border-border"
          style={{ backgroundColor: isDark ? 'var(--surface-ink)' : '#ffffff' }}
        >
          {targetFile ? (
            <>
              <div 
                className="flex-1 min-h-[90px] rounded-xl border border-border relative overflow-hidden group"
                style={{ backgroundColor: isDark ? 'var(--surface-1)' : '#ffffff' }}
                onMouseEnter={() => setHoveringChart('top')}
                onMouseLeave={() => { setHoveringChart(null); if (topTooltipRef.current) topTooltipRef.current.style.display = 'none'; }}
              >
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00AAFF]">{topSignal}</Badge>
                </div>
                <UPlotChart options={topOptions} data={topData} className="w-full h-full" onReady={u => topChartRef.current = u} />
                <div ref={topTooltipRef} style={{display: 'none', transform: 'translateY(-50%)'}}
                  className="absolute z-30 pointer-events-none bg-popover/90 dark:bg-surface-3/45 border border-border dark:border-white/10 backdrop-blur-xl rounded-xl p-2.5 shadow-md flex flex-col gap-1"
                >
                  <div className="text-[10px] text-muted-foreground/80 dark:text-white/50 font-bold uppercase tracking-wider font-mono" data-tip-time>Time: 0.000s</div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00AAFF]" />
                    <span className="text-[10px] font-bold text-foreground/80 dark:text-white/80">{topSignal}</span>
                    <span className="text-[11px] font-extrabold text-foreground dark:text-white font-mono" data-tip-value>0.00°</span>
                  </div>
                </div>
              </div>
              <div 
                className="flex-1 min-h-[90px] rounded-xl border border-border relative overflow-hidden group"
                style={{ backgroundColor: isDark ? 'var(--surface-1)' : '#ffffff' }}
                onMouseEnter={() => setHoveringChart('bottom')}
                onMouseLeave={() => { setHoveringChart(null); if (bottomTooltipRef.current) bottomTooltipRef.current.style.display = 'none'; }}
              >
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00FF88]">{bottomSignal}</Badge>
                </div>
                <UPlotChart options={bottomOptions} data={bottomData} className="w-full h-full" onReady={u => bottomChartRef.current = u} />
                <div ref={bottomTooltipRef} style={{display: 'none', transform: 'translateY(-50%)'}}
                  className="absolute z-30 pointer-events-none bg-popover/90 dark:bg-surface-3/45 border border-border dark:border-white/10 backdrop-blur-xl rounded-xl p-2.5 shadow-md flex flex-col gap-1"
                >
                  <div className="text-[10px] text-muted-foreground/80 dark:text-white/50 font-bold uppercase tracking-wider font-mono" data-tip-time>Time: 0.000s</div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]" />
                    <span className="text-[10px] font-bold text-foreground/80 dark:text-white/80">{bottomSignal}</span>
                    <span className="text-[11px] font-extrabold text-foreground dark:text-white font-mono" data-tip-value>0.00°</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <ChartSkeleton title="Gaze Horizontal Angle" colorClass="text-[#00AAFF]" />
              <ChartSkeleton title="Gaze Vertical Angle" colorClass="text-[#00FF88]" />
            </>
          )}
        </div>

        <div className="flex-1 bg-black overflow-hidden relative group flex flex-col h-full min-h-0">
            <div className="flex-1 relative min-h-0">
                 {videoError ? (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6">
                         <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-red-500/10 p-6 max-w-md shadow-2xl flex flex-col items-center text-center">
                             <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                                 <Video className="w-6 h-6" />
                             </div>
                             <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                                 {videoError === 'Video file not found' ? 'Video File Not Found' : 'Transcoding Error'}
                             </h3>
                             {videoError === 'Video file not found' ? (
                                 <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                     The requested AVI video file could not be located in the current project source directory. Please verify that the file exists.
                                 </p>
                             ) : (
                                 <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                     Failed to decode the video format. FusionStudio packages FFMPEG automatically via <code>imageio-ffmpeg</code>, so no manual installation is required. This failure may be due to an unsupported codec or a backend transcoding issue.
                                 </p>
                             )}
                         </div>
                     </div>
                 ) : videoLoading && !videoUrl ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Media...</span>
                      </div>
                  ) : videoUrl ? (
                      <>
                          {showBlur && (
                          <video
                              ref={blurVideoRef}
                              src={videoUrl}
                              muted
                              loop
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[60px] scale-125 pointer-events-none transition-opacity duration-500"
                          />
                          )}
                          <video 
                              ref={videoRef} 
                              src={videoUrl} 
                              className="w-full h-full object-contain relative z-10 transition-transform duration-200"
                              style={{ transform: `scale(${videoZoom})`, transformOrigin: 'center center' }}
                              onTimeUpdate={() => {
                                  if (videoRef.current) {
                                      const t = videoRef.current.currentTime;
                                      currentTimeRef.current = t;
                                      // Throttle React state updates to ~10fps to reduce render thrashing
                                      const now = performance.now();
                                      if (now - lastStateUpdateRef.current >= 100) {
                                          lastStateUpdateRef.current = now;
                                          setCurrentTime(t);
                                      }
                                      if (blurVideoRef.current && isPlaying && Math.abs(blurVideoRef.current.currentTime - t) > 0.15) {
                                          blurVideoRef.current.currentTime = t;
                                      }
                                  }
                              }}
                              onPlay={() => { setIsPlaying(true); blurVideoRef.current?.play(); }}
                              onPause={() => { setIsPlaying(false); blurVideoRef.current?.pause(); }}
                              onEnded={() => { setIsPlaying(false); blurVideoRef.current?.pause(); }}
                              onLoadStart={() => { setVideoLoading(true); setVideoError(null); }}
                              onWaiting={() => setVideoLoading(true)}
                              onCanPlay={() => setVideoLoading(false)}
                              onError={async () => {
                                  setVideoLoading(false);
                                  if (videoUrl && !videoUrl.startsWith('blob:')) {
                                      try {
                                         const res = await fetch(videoUrl, { method: 'HEAD' });
                                         if (res.status === 404) {
                                             setVideoError('Video file not found');
                                             return;
                                         }
                                      } catch (err) {
                                          console.error('Error fetching video URL details:', err);
                                      }
                                  }
                                  setVideoError('Failed to decode video format');
                              }}
                         />
                         {/* Zoom Level Indicator Overlay */}
                         <div className={cn(
                             "absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-500",
                             showZoomOverlay ? "opacity-100 scale-100" : "opacity-0 scale-95"
                         )}>
                             <div 
                                 className="text-white/80 text-7xl font-extrabold font-sans tracking-widest select-none"
                                 style={{ textShadow: '0 0 16px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.5)' }}
                             >
                                 {Math.round(videoZoom * 100)}%
                             </div>
                         </div>
                         {videoLoading && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                                 <Loader2 className="w-8 h-8 text-white animate-spin" />
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Media...</span>
                             </div>
                         )}
                     </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-pulse-sync select-none">
                        {/* Ambient glow circle */}
                        <div className="absolute w-[220px] h-[220px] rounded-full bg-white/[0.03] blur-[50px] pointer-events-none" />
                        
                        <Video className="w-14 h-14 stroke-[1.0]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-mono">Video Offline</span>
                    </div>
                )}
                <div className="absolute top-3 left-3 z-20">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!targetFile}>
                            <Button variant="outline" size="sm" className={cn("h-7 w-7 p-0 bg-black/50 hover:!bg-black/70 !text-white hover:!text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md", !targetFile && "opacity-50 pointer-events-none")}>
                                <Menu className="w-3.5 h-3.5 !text-white" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52 bg-popover border-border text-popover-foreground p-1 shadow-md">
                            {/* --- Signals --- */}
                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Top Signal</DropdownMenuLabel>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-sm">{topSignal || 'Select...'}</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="max-h-[220px] overflow-y-auto bg-popover border-border text-popover-foreground">
                                        <DropdownMenuRadioGroup value={topSignal} onValueChange={setTopSignal}>
                                            {channels.map((ch: any) => (
                                                <DropdownMenuRadioItem key={ch.name} value={ch.name} className="text-sm">
                                                    {ch.name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuLabel className="pt-1 text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Bottom Signal</DropdownMenuLabel>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-sm">{bottomSignal || 'Select...'}</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="max-h-[220px] overflow-y-auto bg-popover border-border text-popover-foreground">
                                        <DropdownMenuRadioGroup value={bottomSignal} onValueChange={setBottomSignal}>
                                            {channels.map((ch: any) => (
                                                <DropdownMenuRadioItem key={ch.name} value={ch.name} className="text-sm">
                                                    {ch.name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>

                            {/* --- Subject / Case --- */}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Subject</DropdownMenuLabel>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-sm">{selectedSubject || 'Select...'}</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="bg-popover border-border text-popover-foreground">
                                        <DropdownMenuRadioGroup value={selectedSubject} onValueChange={setSelectedSubject}>
                                            {subjects.map(s => (
                                                <DropdownMenuRadioItem key={s} value={s} className="text-sm">{s}</DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuLabel className="pt-1 text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Case</DropdownMenuLabel>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-sm">
                                    {targetFile?.split(/[\\/]/).pop()?.replace('.mf4', '').replace('_tracking', '') || 'Select...'}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="max-h-[260px] overflow-y-auto bg-popover border-border text-popover-foreground">
                                        <DropdownMenuRadioGroup value={targetFile?.replace('_tracking.mf4', '.mf4') || ''} onValueChange={setAnalysisSelectedFile}>
                                            {subjectCases.map(c => (
                                                <DropdownMenuRadioItem key={c} value={c} className="text-sm">
                                                    {c.split(/[\\/]/).pop()?.replace('.mf4', '').replace('_tracking', '') || c}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>

                            {/* --- Case Navigation --- */}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Navigate</DropdownMenuLabel>
                            <DropdownMenuItem className="text-sm" disabled={currentCaseIdx <= 0} onClick={goToPrevCase} title={prevCaseName ?? ''}>
                                <ArrowLeft className="w-3 h-3 text-muted-foreground" /> Previous
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">⇧+Tab</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-sm" disabled={currentCaseIdx >= subjectCases.length - 1} onClick={goToNextCase} title={nextCaseName ?? ''}>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" /> Next
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Tab</DropdownMenuShortcut>
                            </DropdownMenuItem>

                            {/* --- Marker Actions --- */}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Markers</DropdownMenuLabel>
                            <DropdownMenuItem className="text-sm" disabled={undoCount === 0} onClick={undoLastAction}>
                                <Undo2 className="w-3 h-3 text-muted-foreground" /> Undo
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+Z</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-sm" onClick={clearLastMark} disabled={marks.length === 0}>
                                <Eraser className="w-3 h-3 text-muted-foreground" /> Clear Last
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+D</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
                                <DropdownMenuItem className="text-sm" variant="destructive" disabled={marks.length === 0} onSelect={(e) => { e.preventDefault(); setConfirmClearAll(true); }}>
                                    <Trash2 className="w-3 h-3 text-red-500" /> Clear All
                                    <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+Space</DropdownMenuShortcut>
                                </DropdownMenuItem>
                                <AlertDialogContent className="max-w-[340px] border border-border bg-surface-2 p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <AlertDialogHeader className="items-center text-center gap-1.5">
                                        <AlertDialogTitle className="text-base font-bold text-foreground uppercase tracking-wider">
                                            Clear All Markers?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm text-muted-foreground max-w-[280px]">
                                            This will permanently delete all <span className="text-red-400 font-extrabold">{marks.length}</span> markers. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
                                        <AlertDialogCancel className="flex-1 bg-accent border border-border hover:bg-accent/80 text-foreground rounded-xl py-2 px-4 text-xs font-bold transition-all">
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction onClick={clearAllMarks} className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5">
                                            Clear All
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* --- View --- */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm" onClick={resetZoom}>
                                <Maximize className="w-3.5 h-3.5" /> Autorange
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+A</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!targetFile}>
                            <Button variant="outline" size="sm" className={cn("h-7 w-7 p-0 bg-black/50 hover:!bg-black/70 !text-white hover:!text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md", !targetFile && "opacity-50 pointer-events-none")}>
                                <Camera className={cn("w-3.5 h-3.5 !text-white", targetFile && "animate-pulse")} />
                            </Button>
                        </DropdownMenuTrigger>
                        {targetFile && (
                            <DropdownMenuContent align="end" className="w-32 bg-popover border-border text-popover-foreground p-1 shadow-md">
                                {(analysisAvailableCameras.length > 0 ? analysisAvailableCameras : [1, 2, 3]).map(cam => (
                                    <DropdownMenuItem 
                                        key={cam} 
                                        className={cn(
                                            'text-sm font-bold cursor-pointer rounded-lg px-2 py-1.5 transition-colors flex items-center justify-between',
                                            analysisSelectedCamera === cam ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                                        )}
                                        onClick={() => setAnalysisSelectedCamera(Number(cam))}
                                    >
                                        <span>Camera {cam}</span>
                                        {analysisSelectedCamera === cam && <span className="text-sm font-bold">✓</span>}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        )}
                    </DropdownMenu>
                    <div className={cn(
                        "flex flex-col w-7 bg-black/50 border border-white/10 rounded-lg shadow-xl backdrop-blur-md overflow-hidden",
                        !targetFile && "opacity-50 pointer-events-none"
                    )}>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!targetFile || videoZoom >= 3}
                            onClick={zoomIn}
                            className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                            title="Zoom In"
                        >
                            <Plus className="w-3.5 h-3.5 !text-white" />
                        </Button>
                        <div className="w-full h-[1px] bg-white/10" />
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!targetFile || videoZoom <= 1}
                            onClick={zoomOut}
                            className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                            title="Zoom Out"
                        >
                            <Minus className="w-3.5 h-3.5 !text-white" />
                        </Button>
                    </div>
                </div>
            </div>
            <div className="h-24 border-t border-border p-3 shrink-0 flex flex-col justify-between" style={{ backgroundColor: isDark ? 'var(--surface-ink)' : '#ffffff' }}>
                <div className="flex items-center gap-3 w-full">
                    <span className="text-xs font-bold text-muted-foreground dark:text-white font-mono">{currentTime.toFixed(2)}s</span>
                    <div className="flex-1 relative py-2 flex items-center">
                        <Slider 
                            value={[currentTime]} 
                            disabled={!targetFile}
                            onValueChange={([v]) => { 
                                currentTimeRef.current = v; 
                                setCurrentTime(v); 
                                if (videoRef.current) videoRef.current.currentTime = v; 
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = v; 
                                updatePlayheadCursors(v);
                            }} 
                            max={targetFile ? duration : 100} 
                            step={0.001} 
                            className={cn(
                                'flex-1 cursor-pointer',
                                '[&>span:first-child]:!h-[3px] [&>span:first-child]:!bg-white/10',
                                '[&>span:first-child>span]:!bg-primary',
                                '[&>span:last-child]:!hidden',
                                !targetFile && "opacity-30 pointer-events-none"
                            )}
                        />
                    </div>
                    <span className={cn("font-bold text-muted-foreground dark:text-white", targetFile ? "text-xs font-mono" : "text-xl font-sans relative -top-[1.5px]")}>
                        {targetFile ? `${duration.toFixed(2)}s` : "∞"}
                    </span>
                </div>
                <div className="flex items-center justify-between w-full mt-1">
                    <div className="flex items-center gap-1">
                        <Button 
                            disabled={!targetFile}
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30"
                            title="Restart from beginning"
                            onClick={() => {
                                currentTimeRef.current = 0;
                                setCurrentTime(0);
                                if (videoRef.current) videoRef.current.currentTime = 0;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = 0;
                                updatePlayheadCursors(0);
                            }}
                        >
                            <ArrowLeftToLine className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            disabled={!targetFile}
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30"
                            title="Rewind 5 seconds"
                            onClick={() => {
                                const t = Math.max(0, currentTime - 5);
                                currentTimeRef.current = t;
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
                                updatePlayheadCursors(t);
                            }}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            disabled={!targetFile}
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
                                'h-7 w-7 rounded-lg border-border bg-surface-3 transition-colors disabled:opacity-30',
                                isPlaying ? 'bg-primary hover:bg-primary/90 !text-primary-foreground' : 'hover:bg-accent text-foreground'
                            )}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </Button>
                        <Button 
                            disabled={!targetFile}
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-lg hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30"
                            title="Forward 5 seconds"
                            onClick={() => {
                                const t = Math.min(duration, currentTime + 5);
                                currentTimeRef.current = t;
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
                                updatePlayheadCursors(t);
                            }}
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                            disabled={!targetFile}
                            size="icon" 
                            variant="outline" 
                            onClick={toggleSync} 
                            className={cn(
                                'h-7 w-7 rounded-lg border-border transition-all disabled:opacity-30',
                                isSynced ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-surface-3 hover:bg-surface-2 text-foreground'
                            )} 
                            title={isSynced ? 'Disable Mouse Sync' : 'Enable Mouse Sync'}
                        >
                            {isSynced ? <Mouse className="w-3.5 h-3.5" /> : <MouseOff className="w-3.5 h-3.5" />}
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => setShowBlur(v => !v)} 
                            className={cn(
                                'h-7 w-7 rounded-lg transition-all disabled:opacity-30 border',
                                showBlur 
                                  ? 'bg-primary/10 border-primary/30 text-foreground' 
                                  : 'bg-surface-3 hover:bg-surface-2 text-foreground border-border'
                            )} 
                            title={showBlur ? 'Disable ambient blur' : 'Enable ambient blur'}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider truncate max-w-[200px]" title={targetFile ? videoFileName : "No project loaded"}>
                        {targetFile ? videoFileName : "NO PROJECT LOADED"}
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
