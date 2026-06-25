import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  Video,
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
  MapPin
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
import { getOmScenarioName } from '@/lib/utils';

export function MisuseTimeTab() {
  const {
    analysisCheckedFiles,
    analysisSelectedFile,
    setAnalysisSelectedFile,
    analysisSelectedCamera,
    setAnalysisSelectedCamera,
    analysisAvailableCameras,
    analysisSourcePath,
  } = useAppStore();

  // Auto-select first available camera if the current selection doesn't exist in the list
  useEffect(() => {
    if (analysisAvailableCameras.length > 0 && !analysisAvailableCameras.includes(analysisSelectedCamera)) {
      setAnalysisSelectedCamera(analysisAvailableCameras[0]);
    }
  }, [analysisAvailableCameras, analysisSelectedCamera, setAnalysisSelectedCamera]);

  const [marks, setMarks] = useState<number[]>([]);
  const marksRef = useRef<number[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetFile, setTargetFile] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const videoFileName = useMemo(() => {
    if (!targetFile) return 'video.avi';
    const fileBase = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '').split(/[\\/]/).pop();
    return `${fileBase}_${analysisSelectedCamera}.avi`;
  }, [targetFile, analysisSelectedCamera]);

  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const [duration, setDuration] = useState(100);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);

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
      fileToLoad = fileToLoad.replace(/\.mf4$/i, '_tracking.mf4');
    }
    setTargetFile(fileToLoad);

    if (fileToLoad) {
      const match = subjects.find(s => fileToLoad.replace(/\\/g, '/').includes(s));
      if (match && match !== selectedSubject) {
        setSelectedSubject(match);
      }
    }
  }, [analysisSelectedFile, analysisCheckedFiles, subjects, selectedSubject]);

  const findCaseIndex = useCallback((file: string | null) => {
    if (!file) return -1;
    const norm = file.replace(/_tracking\.mf4$/i, '.mf4').replace(/\\/g, '/');
    return subjectCases.findIndex(c => c.replace(/\\/g, '/') === norm);
  }, [subjectCases]);

  const goToPrevCase = useCallback(() => {
    const idx = findCaseIndex(targetFile);
    if (idx > 0) {
      setAnalysisSelectedFile(subjectCases[idx - 1].replace(/_tracking\.mf4$/i, '.mf4'));
    }
  }, [findCaseIndex, targetFile, subjectCases, setAnalysisSelectedFile]);

  const goToNextCase = useCallback(() => {
    const idx = findCaseIndex(targetFile);
    if (idx < subjectCases.length - 1) {
      setAnalysisSelectedFile(subjectCases[idx + 1].replace(/_tracking\.mf4$/i, '.mf4'));
    }
  }, [findCaseIndex, targetFile, subjectCases, setAnalysisSelectedFile]);

  const currentCaseIdx = findCaseIndex(targetFile);
  const prevCaseName = currentCaseIdx > 0
    ? getOmScenarioName(subjectCases[currentCaseIdx - 1])
    : null;
  const nextCaseName = currentCaseIdx < subjectCases.length - 1
    ? getOmScenarioName(subjectCases[currentCaseIdx + 1])
    : null;

  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    if (targetFile) {
      // Skip video loading if the selected camera is not in the available list
      // (the auto-select effect will correct it on the next render)
      if (analysisAvailableCameras.length > 0 && !analysisAvailableCameras.includes(analysisSelectedCamera)) {
        return;
      }
      analysisApi.loadMarks(targetFile, analysisSourcePath).then(res => {
        if (res.data.status === 'success' && Array.isArray(res.data.marks)) setMarks(res.data.marks);
        else setMarks([]);
      });
      const baseName = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '');
      const url = `/api/analysis/media?path=${encodeURIComponent(`${baseName}_${analysisSelectedCamera}.avi`)}`;
      
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
  }, [targetFile, analysisSelectedCamera, analysisSourcePath, analysisAvailableCameras]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const clearAllMarks = useCallback(() => {
    setMarks([]);
    if (targetFile) analysisApi.saveMarks(targetFile, [], analysisSourcePath).catch(() => {});
  }, [targetFile, analysisSourcePath]);

  const addMarkAtTime = useCallback((t: number) => {
    const next = [t];
    setMarks(next);
    if (targetFile) analysisApi.saveMarks(targetFile, next, analysisSourcePath).catch(() => {});
  }, [targetFile, analysisSourcePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!targetFile) return;
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); addMarkAtTime(currentTimeRef.current); }
      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); setShowBlur(v => !v); }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) { e.preventDefault(); goToPrevCase(); }
        else { e.preventDefault(); goToNextCase(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetFile, addMarkAtTime, goToNextCase, goToPrevCase, setShowBlur]);

  const lastStateUpdateRef = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const curT = currentTimeRef.current;
      if (curT !== currentTime) {
        setCurrentTime(curT);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [currentTime]);

  return (
    <div className="flex flex-col animate-in fade-in duration-500 h-full overflow-hidden bg-white dark:bg-background">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
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
                              onLoadedMetadata={() => {
                                  if (videoRef.current) {
                                      setDuration(videoRef.current.duration || 100);
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
                         {/* Visual Misuse Mark indicator on the video */}
                         {marks.length > 0 && targetFile && (
                           <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg">
                             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                             <span className="text-xs font-bold text-white uppercase tracking-wider">Misuse Triggered At: <span className="text-red-400 font-mono ml-1">{marks[0].toFixed(2)}s</span></span>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-5 w-5 ml-2 hover:bg-red-500/20 rounded-full" 
                               onClick={(e) => { e.stopPropagation(); clearAllMarks(); }}
                             >
                               <Trash2 className="w-3 h-3 text-red-400" />
                             </Button>
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
                <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!targetFile}>
                            <Button variant="outline" size="sm" className={cn("h-7 w-7 p-0 bg-black/50 hover:!bg-black/70 !text-white hover:!text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md", !targetFile && "opacity-50 pointer-events-none")}>
                                <Camera className={cn("w-3.5 h-3.5 !text-white", targetFile && "animate-pulse")} />
                            </Button>
                        </DropdownMenuTrigger>
                        {targetFile && (
                            <DropdownMenuContent align="end" className="w-40 bg-popover border-border text-popover-foreground p-1 shadow-md">
                                {(analysisAvailableCameras.length > 0 ? analysisAvailableCameras : []).map(cam => (
                                    <DropdownMenuItem 
                                        key={cam} 
                                        className={cn(
                                            'text-sm font-bold cursor-pointer rounded-lg px-2 py-1.5 transition-colors flex items-center justify-between',
                                            analysisSelectedCamera === cam ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                                        )}
                                        onClick={() => setAnalysisSelectedCamera(cam)}
                                    >
                                        <span>{cam}</span>
                                        {analysisSelectedCamera === cam && <span className="text-sm font-bold">✓</span>}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        )}
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!targetFile}>
                            <Button variant="outline" size="sm" className={cn("h-7 w-7 p-0 bg-black/50 hover:!bg-black/70 !text-white hover:!text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md", !targetFile && "opacity-50 pointer-events-none")}>
                                <Menu className="w-3.5 h-3.5 !text-white" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-popover border-border text-popover-foreground p-1 shadow-md">
                            {/* --- Subject / Case --- */}
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
                                    {targetFile ? getOmScenarioName(targetFile) : 'Select...'}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="max-h-[260px] overflow-y-auto bg-popover border-border text-popover-foreground">
                                        <DropdownMenuRadioGroup value={targetFile?.replace(/_tracking\.mf4$/i, '.mf4') || ''} onValueChange={setAnalysisSelectedFile}>
                                            {subjectCases.map(c => (
                                                <DropdownMenuRadioItem key={c} value={c} className="text-sm">
                                                    {getOmScenarioName(c)}
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
                            <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
                                <DropdownMenuItem className="text-sm" variant="destructive" disabled={marks.length === 0} onSelect={(e) => { e.preventDefault(); setConfirmClearAll(true); }}>
                                    <Trash2 className="w-3 h-3" /> Clear Marker
                                </DropdownMenuItem>
                                <AlertDialogContent className="max-w-[340px] border border-border bg-surface-2 p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <AlertDialogHeader className="items-center text-center gap-1.5">
                                        <AlertDialogTitle className="text-base font-bold text-foreground uppercase tracking-wider">
                                            Clear Misuse Marker?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm text-muted-foreground max-w-[280px]">
                                            This will permanently delete the misuse time marker. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
                                        <AlertDialogCancel className="flex-1 bg-accent border border-border hover:bg-accent/80 text-foreground rounded-xl py-2 px-4 text-xs font-bold transition-all">
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction onClick={clearAllMarks} className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5">
                                            Clear Marker
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* --- View --- */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm" onClick={() => setShowBlur(v => !v)}>
                                <Sparkles className="w-3.5 h-3.5" /> Ambient light
                                {showBlur && <span className="text-xs font-bold ml-2">✓</span>}
                                <DropdownMenuShortcut className="text-[10px] text-muted-foreground/60">Ctrl+B</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
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
            
            <div className="h-24 border-t border-border p-3 shrink-0 flex flex-col justify-between bg-white dark:bg-surface-ink relative z-30 shadow-2xl">
                <div className="flex items-center gap-3 w-full">
                    <span className="text-xs font-bold text-muted-foreground dark:text-white font-mono">{currentTime.toFixed(2)}s</span>
                    <div className="flex-1 relative py-2 flex items-center group">
                        <Slider 
                            value={[currentTime]} 
                            disabled={!targetFile}
                            onValueChange={([v]) => { 
                                currentTimeRef.current = v; 
                                setCurrentTime(v); 
                                if (videoRef.current) videoRef.current.currentTime = v; 
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = v; 
                            }} 
                            max={targetFile ? duration : 100} 
                            step={0.001} 
                            className={cn(
                                'flex-1 cursor-pointer',
                                '[&>span:first-child]:!h-[3px] [&>span:first-child]:!bg-white/10 group-hover:[&>span:first-child]:!h-[5px] transition-all',
                                '[&>span:first-child>span]:!bg-primary',
                                '[&>span:last-child]:!hidden',
                                !targetFile && "opacity-30 pointer-events-none"
                            )}
                        />
                        {/* Render Mark on the timeline */}
                        {marks.length > 0 && targetFile && duration > 0 && (
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 w-[3px] h-3 bg-red-500 z-10 pointer-events-none rounded-full"
                            style={{ left: `calc(${marks[0] / duration * 100}%)` }}
                          />
                        )}
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
                                const t = Math.min(0, currentTime - 5);
                                currentTimeRef.current = t;
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                                if (blurVideoRef.current) blurVideoRef.current.currentTime = t;
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
                            }}
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    
                    {/* The prominent Add Misuse Mark button */}
                    {targetFile && (
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white font-bold h-8 px-4 rounded-xl shadow-lg shadow-red-500/20"
                        onClick={() => addMarkAtTime(currentTimeRef.current)}
                      >
                        <MapPin className="w-4 h-4 mr-1.5" />
                        Set Misuse Time
                      </Button>
                    )}

                    <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider truncate max-w-[200px]" title={targetFile ? videoFileName : "No project loaded"}>
                        {targetFile ? videoFileName : "NO PROJECT LOADED"}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
