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
import {
  GA_MARK_SEQUENCE,
  GA_MARK_META,
  normalizeGaPeriods,
  toGaStoragePayload,
  flattenGaMarkers,
  countGaMarks,
  nextGaMarkSlot,
  emptyGaPeriod,
} from '@/lib/gaMarks';
import type { GaPeriod, GaMarkKey, GaMarkerRef } from '@/lib/gaMarks';
import { useAppStore } from '@/store/useAppStore';
import { analysisApi } from '@/api/analysisApi';
import { UPlotChart } from './UPlotChart';
import uPlot from 'uplot';
import Waves from './Waves';
import { useTheme } from '@/hooks/useTheme';

const playSound = (src: string) => {
  try {
    const audio = new Audio(src);
    audio.play().catch(e => console.error("Audio play error", e));
  } catch (e) {
    console.error("Audio creation error", e);
  }
};


// --- CHART SKELETON COMPONENT ---
const ChartSkeleton = ({ title, colorClass }: { title: string; colorClass: string }) => {
  const strokeColor = colorClass.includes('#00AAFF') ? 'rgba(0, 170, 255, 0.3)' : 'rgba(0, 255, 136, 0.3)';
  return (
    <div className="flex-1 min-h-[90px] bg-white dark:bg-surface-1 rounded-none border-b border-border dark:border-white/5 last:border-b-0 relative overflow-hidden flex flex-col justify-between p-4 select-none">
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

  const [periods, setPeriods] = useState<GaPeriod[]>([]);
  const periodsRef = useRef<GaPeriod[]>([]);
  useEffect(() => { periodsRef.current = periods; }, [periods]);

  const totalMarks = useMemo(() => countGaMarks(periods), [periods]);
  const nextSlot = useMemo(() => nextGaMarkSlot(periods), [periods]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetFile, setTargetFile] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const savePeriods = useCallback((next: GaPeriod[]) => {
    if (targetFile) analysisApi.saveMarks(targetFile, toGaStoragePayload(next), analysisSourcePath, 'GA').catch(() => {});
  }, [targetFile, analysisSourcePath]);

  const videoFileName = useMemo(() => {
    if (!targetFile) return 'video.avi';
    const base = targetFile.replace('_tracking.mf4', '').replace('.mf4', '').split(/[\\/]/).pop();
    const camId = analysisSelectedCamera;
    const camSuffix = typeof camId === 'number' ? `cam${camId}` : String(camId);
    return `${base}_${camSuffix}.avi`;
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

  // Panning and Wheel Zoom logic
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoPanRef = useRef({ x: 0, y: 0 });
  const [videoPan, setVideoPan] = useState({ x: 0, y: 0 });
  const isDraggingVideoRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    videoPanRef.current = videoPan;
  }, [videoPan]);

  useEffect(() => {
    if (videoZoom <= 1) {
      setVideoPan({ x: 0, y: 0 });
      if (videoRef.current) {
        videoRef.current.style.transform = `translate(0px, 0px) scale(1)`;
        videoRef.current.style.cursor = 'default';
      }
    } else {
      if (videoRef.current) {
        videoRef.current.style.cursor = 'grab';
      }
    }
  }, [videoZoom]);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container || !videoUrl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      setVideoZoom(z => {
        if (e.deltaY < 0) {
          return Math.min(3, parseFloat((z + zoomFactor).toFixed(2)));
        } else {
          return Math.max(1, parseFloat((z - zoomFactor).toFixed(2)));
        }
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [videoUrl]);

  const handleVideoMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || videoZoom <= 1 || !videoUrl) return;
    e.preventDefault();
    isDraggingVideoRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: videoPanRef.current.x,
      panY: videoPanRef.current.y
    };
    if (videoRef.current) {
      videoRef.current.style.transition = 'none';
      videoRef.current.style.cursor = 'grabbing';
    }
  };

  const handleVideoMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingVideoRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nextX = dragStartRef.current.panX + dx;
    const nextY = dragStartRef.current.panY + dy;
    
    videoPanRef.current = { x: nextX, y: nextY };
    
    if (videoRef.current) {
      videoRef.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${videoZoom})`;
    }
  };

  const handleVideoMouseUp = () => {
    if (!isDraggingVideoRef.current) return;
    isDraggingVideoRef.current = false;
    if (videoRef.current) {
      videoRef.current.style.transition = 'transform 0.2s ease';
      videoRef.current.style.cursor = videoZoom > 1 ? 'grab' : 'default';
    }
    setVideoPan(videoPanRef.current);
  };

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
      if (subjs.length > 0 && (!selectedSubject || !subjs.includes(selectedSubject))) {
        setSelectedSubject(subjs[0]);
      }
    }
  }, [analysisCheckedFiles, selectedSubject]);

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

    if (fileToLoad) {
      const match = subjects.find(s => fileToLoad.replace(/\\/g, '/').includes(s));
      if (match && match !== selectedSubject) {
        setSelectedSubject(match);
      }
    }
  }, [analysisSelectedFile, analysisCheckedFiles, subjects, selectedSubject]);

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

  // Phase 2: Undo stack (snapshots of periods taken before each mutation)
  const undoStackRef = useRef<GaPeriod[][]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const pushUndoSnapshot = useCallback(() => {
    undoStackRef.current.push(periodsRef.current.map(p => ({ ...p })));
    setUndoCount(undoStackRef.current.length);
  }, []);

  const undoLastAction = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    setUndoCount(stack.length);
    setPeriods(prev);
    savePeriods(prev);
  }, [savePeriods]);

  // Pan state
  const panRef = useRef<{startClientX: number; startMin: number; startMax: number} | null>(null);

  // Drag state for markers
  const draggingRef = useRef<{marker: GaMarkerRef; startVal: number} | null>(null);
  // Live value during drag (avoids stale index after sort)
  const dragLiveValRef = useRef<number | null>(null);
  // Marker that passed the hover threshold (enables marker drag on mousedown)
  const markerDragReadyRef = useRef<GaMarkerRef | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; marker: GaMarkerRef} | null>(null);
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
      analysisApi.loadMarks(targetFile, analysisSourcePath, 'GA').then(res => {
        if (res.data.status === 'success') {
          // Backend returns canonical v2 periods; fall back to normalizing raw entry
          const loaded = Array.isArray(res.data.periods)
            ? normalizeGaPeriods(res.data.periods)
            : normalizeGaPeriods(res.data.marks);
          setPeriods(loaded);
        } else setPeriods([]);
      });
      undoStackRef.current = [];
      setUndoCount(0);
      const baseName = targetFile.replace('_tracking.mf4', '').replace('.mf4', '');
      const camId = analysisSelectedCamera;
      const camSuffix = typeof camId === 'number' ? `cam${camId}` : String(camId);
      const url = `/api/analysis/media?path=${encodeURIComponent(`${baseName}_${camSuffix}.avi`)}`;
      
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
      setPeriods([]);
      undoStackRef.current = [];
      setUndoCount(0);
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
    pushUndoSnapshot();
    setPeriods([]);
    savePeriods([]);
  }, [pushUndoSnapshot, savePeriods]);

  const clearLastMark = useCallback(() => {
    const current = periodsRef.current;
    if (countGaMarks(current) === 0) return;
    pushUndoSnapshot();
    const next = current.map(p => ({ ...p }));
    // Remove the last filled slot of the last non-empty period
    for (let pi = next.length - 1; pi >= 0; pi--) {
      const filled = GA_MARK_SEQUENCE.filter(k => next[pi][k] != null);
      if (filled.length === 0) continue;
      next[pi][filled[filled.length - 1]] = null;
      break;
    }
    const cleaned = next.filter(p => GA_MARK_SEQUENCE.some(k => p[k] != null));
    setPeriods(cleaned);
    savePeriods(cleaned);
  }, [pushUndoSnapshot, savePeriods]);

  const removeMarker = useCallback((ref: GaMarkerRef) => {
    pushUndoSnapshot();
    const next = periodsRef.current.map(p => ({ ...p }));
    if (next[ref.periodIdx]) next[ref.periodIdx][ref.key] = null;
    const cleaned = next.filter(p => GA_MARK_SEQUENCE.some(k => p[k] != null));
    setPeriods(cleaned);
    savePeriods(cleaned);
  }, [pushUndoSnapshot, savePeriods]);

  const changeMarkerType = useCallback((ref: GaMarkerRef, newKey: GaMarkKey) => {
    if (ref.key === newKey) return;
    pushUndoSnapshot();
    const next = periodsRef.current.map(p => ({ ...p }));
    const p = next[ref.periodIdx];
    if (!p) return;
    // Swap values between the old slot and the requested slot
    const t = p[ref.key];
    p[ref.key] = p[newKey];
    p[newKey] = t;
    setPeriods(next);
    savePeriods(next);
  }, [pushUndoSnapshot, savePeriods]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!targetFile) return;
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); clearAllMarks(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); clearLastMark(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLastAction(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); resetZoom(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); setShowBlur(v => !v); }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) { e.preventDefault(); goToPrevCase(); }
        else { e.preventDefault(); goToNextCase(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetFile, clearAllMarks, clearLastMark, undoLastAction, goToNextCase, goToPrevCase, resetZoom, setShowBlur]);

  const addMarkAtTime = useCallback((t: number) => {
    const slot = nextGaMarkSlot(periodsRef.current);
    pushUndoSnapshot();
    playSound('/sounds/tap_01.wav');
    const next = periodsRef.current.map(p => ({ ...p }));
    while (next.length <= slot.periodIdx) next.push(emptyGaPeriod());
    next[slot.periodIdx][slot.key] = t;
    setPeriods(next);
    savePeriods(next);
  }, [pushUndoSnapshot, savePeriods]);

  // Find a marker by x pixel pos (plotting-area coords)
  const findMarkerAtPos = useCallback((u: uPlot, px: number): GaMarkerRef | null => {
    const markers = flattenGaMarkers(periodsRef.current);
    const tol = 15;
    for (const m of markers) {
      const mPx = u.valToPos(m.t, 'x');
      if (Math.abs(mPx - px) <= tol) return m;
    }
    return null;
  }, []);

  const sameMarker = useCallback((a: GaMarkerRef | null, b: GaMarkerRef | null) =>
    a === b || (!!a && !!b && a.periodIdx === b.periodIdx && a.key === b.key), []);

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

        let lastNear: GaMarkerRef | null = null;
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
          const near = findMarkerAtPos(u, px);
          if (near != null) {
            if (!sameMarker(lastNear, near)) {
              clearHoverTimeout();
              markerDragReadyRef.current = null;
              lastNear = near;

              // Start a 0.25s hover delay timer to activate the drag cursor
              markerHoverTimeout = setTimeout(() => {
                u.over.style.setProperty('cursor', 'ew-resize', 'important');
                markerDragReadyRef.current = near;
              }, 250);
            }
          } else {
            clearHoverTimeout();
            if (lastNear != null) { markerDragReadyRef.current = null; lastNear = null; }
            u.over.style.removeProperty('cursor');
          }
        });

        u.over.addEventListener('mouseleave', () => {
          clearHoverTimeout();
          markerDragReadyRef.current = null;
          lastNear = null;
          u.over.style.removeProperty('cursor');
        });

        u.over.addEventListener('mousedown', (e: MouseEvent) => {
          clearHoverTimeout();
          if (e.button !== 0) return;
          const rect = u.over.getBoundingClientRect();
          const px = e.clientX - rect.left;
          // Only start marker drag if the hover threshold was met
          if (markerDragReadyRef.current != null) {
            const near = findMarkerAtPos(u, px);
            if (near != null && sameMarker(near, markerDragReadyRef.current)) {
              draggingRef.current = { marker: near, startVal: near.t };
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
            const { marker, startVal } = draggingRef.current;
            const newVal = dragLiveValRef.current;
            dragLiveValRef.current = null;
            if (newVal != null && Math.abs(newVal - startVal) > 0.001) {
              pushUndoSnapshot();
              const next = periodsRef.current.map(p => ({ ...p }));
              if (next[marker.periodIdx]) {
                next[marker.periodIdx][marker.key] = newVal;
                setPeriods(next);
                savePeriods(next);
              }
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
          const near = findMarkerAtPos(u, px);
          if (near != null) {
            setContextMenu({x: e.clientX, y: e.clientY, marker: near});
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
        const currentPeriods = periodsRef.current;

        // Period shading: transition away (amber), VATS (orange), transition back (green)
        for (const p of currentPeriods) {
          const spans: Array<[number | null, number | null, string]> = [
            [p.move_start, p.gaze_on, 'rgba(255, 193, 7, 0.10)'],
            [p.gaze_on, p.move_end, 'rgba(255, 152, 0, 0.15)'],
            [p.move_end, p.road_on, 'rgba(76, 175, 80, 0.10)'],
          ];
          for (const [a, b, color] of spans) {
            if (a == null || b == null || b <= a) continue;
            const x1 = u.valToPos(a, 'x', true);
            const x2 = u.valToPos(b, 'x', true);
            ctx.fillStyle = color;
            ctx.fillRect(x1, bbox.top, x2 - x1, bbox.height);
          }
        }

        const dragVal = dragLiveValRef.current;
        const dragMarker = draggingRef.current?.marker;
        for (const m of flattenGaMarkers(currentPeriods)) {
          const isDragging = !!dragMarker && dragMarker.periodIdx === m.periodIdx && dragMarker.key === m.key && dragVal != null;
          const val = isDragging ? dragVal! : m.t;
          const x = u.valToPos(val, 'x', true);
          if (x >= 0 && x <= bbox.width + bbox.left) {
            const meta = GA_MARK_META[m.key];
            ctx.beginPath();
            ctx.strokeStyle = isDragging ? '#ffb74d' : meta.color;
            ctx.lineWidth = isDragging ? 2.5 : 1.75;
            if (meta.dash) ctx.setLineDash(meta.dash);
            ctx.moveTo(x, bbox.top);
            ctx.lineTo(x, bbox.top + bbox.height);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        ctx.restore();
      }]
    }
  }), [addMarkAtTime, sync.key, findMarkerAtPos, sameMarker, pushUndoSnapshot, savePeriods, targetFile, isDark]);

  const topOptions = useMemo(() => createOptions(topSignal, '#00AAFF'), [topSignal, createOptions]);
  const bottomOptions = useMemo(() => createOptions(bottomSignal, '#00FF88'), [bottomSignal, createOptions]);

  useEffect(() => {
    topChartRef.current?.redraw();
    bottomChartRef.current?.redraw();
  }, [periods]);

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
    <div className="flex flex-col animate-in fade-in duration-500 h-full overflow-hidden">
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
          className="flex-[2] flex flex-col gap-0 p-0 overflow-hidden h-full min-h-0 justify-center border-r border-border bg-white dark:bg-surface-ink"
        >
          {targetFile ? (
            <>
              <div 
                className="flex-1 min-h-[90px] rounded-none border-b border-border relative overflow-hidden group bg-white dark:bg-surface-1"
                onMouseEnter={() => setHoveringChart('top')}
                onMouseLeave={() => { setHoveringChart(null); if (topTooltipRef.current) topTooltipRef.current.style.display = 'none'; }}
              >
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold text-[#00AAFF]">{topSignal}</Badge>
                </div>
                <div className="absolute top-2 right-2 z-10 pointer-events-none">
                  <Badge
                    variant="outline"
                    className="bg-black/60 backdrop-blur-md border-white/5 text-[9px] font-bold"
                    style={{ color: GA_MARK_META[nextSlot.key].color }}
                  >
                    Next: {GA_MARK_META[nextSlot.key].label} · P{nextSlot.periodIdx + 1}
                  </Badge>
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
                className="flex-1 min-h-[90px] rounded-none relative overflow-hidden group bg-white dark:bg-surface-1"
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
            <div 
                ref={videoContainerRef}
                className="flex-1 relative min-h-0 overflow-hidden"
                onMouseDown={handleVideoMouseDown}
                onMouseMove={handleVideoMouseMove}
                onMouseUp={handleVideoMouseUp}
                onMouseLeave={handleVideoMouseUp}
            >
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
                              style={{ 
                                  transform: `translate(${videoPan.x}px, ${videoPan.y}px) scale(${videoZoom})`, 
                                  transformOrigin: 'center center' 
                              }}
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
                            <DropdownMenuItem className="text-sm" onClick={clearLastMark} disabled={totalMarks === 0}>
                                <Eraser className="w-3 h-3 text-muted-foreground" /> Clear Last
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+D</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
                                <DropdownMenuItem className="text-sm" variant="destructive" disabled={totalMarks === 0} onSelect={(e) => { e.preventDefault(); setConfirmClearAll(true); }}>
                                    <Trash2 className="w-3 h-3" /> Clear All
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
                                            This will permanently delete all <span className="text-red-400 font-extrabold">{totalMarks}</span> markers. This action cannot be undone.
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
                            <DropdownMenuItem className="text-sm" onClick={() => setShowBlur(v => !v)}>
                                <Sparkles className="w-3.5 h-3.5" /> Ambient light
                                {showBlur && <span className="text-xs font-bold ml-2">✓</span>}
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+B</DropdownMenuShortcut>
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
            <div className="h-24 border-t border-border p-3 shrink-0 flex flex-col justify-between bg-white dark:bg-surface-ink">
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
                            variant="ghost" 
                            onClick={toggleSync} 
                            className="h-7 w-7 rounded-lg hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30"
                            title={isSynced ? 'Disable Mouse Sync' : 'Enable Mouse Sync'}
                        >
                            {isSynced ? <Mouse className="w-3.5 h-3.5" /> : <MouseOff className="w-3.5 h-3.5" />}
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
          className="fixed z-50 bg-surface-2/95 border border-white/10 backdrop-blur-xl rounded-xl p-1 shadow-2xl min-w-[160px]"
          style={{left: `${contextMenu.x}px`, top: `${contextMenu.y}px`}}
          onClick={() => setContextMenu(null)}
        >
          <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
            {GA_MARK_META[contextMenu.marker.key].label} · P{contextMenu.marker.periodIdx + 1} · {contextMenu.marker.t.toFixed(2)}s
          </div>
          {GA_MARK_SEQUENCE.filter(k => k !== contextMenu.marker.key).map(k => (
            <button
              key={k}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/5 rounded-lg w-full transition-colors"
              onMouseDown={(e) => { e.stopPropagation(); changeMarkerType(contextMenu.marker, k); setContextMenu(null); }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GA_MARK_META[k].color }} />
              Set as {GA_MARK_META[k].label}
            </button>
          ))}
          <div className="h-px bg-white/10 my-1" />
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/5 rounded-lg w-full transition-colors"
            onMouseDown={(e) => { e.stopPropagation(); removeMarker(contextMenu.marker); setContextMenu(null); }}
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            Delete Marker
          </button>
        </div>
      )}
    </div>
  );
}
