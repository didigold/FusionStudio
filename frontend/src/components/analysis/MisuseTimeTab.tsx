import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  MapPin,
  MousePointerClick,
  ArrowLeftRight
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
import CountUp from '@/components/ui/CountUp';
import ElasticSlider from '@/components/ui/ElasticSlider';
import { motion } from 'framer-motion';

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

  const [cameraLeft, setCameraLeft] = useState<string>('');
  const [cameraRight, setCameraRight] = useState<string>('');
  const [isSwapped, setIsSwapped] = useState(false);

  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [badgePos, setBadgePos] = useState({ x: 0, y: 0 });
  const targetPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    targetPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (isHoveringVideo) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      
      const updatePosition = () => {
        const dx = targetPosRef.current.x - currentPosRef.current.x;
        const dy = targetPosRef.current.y - currentPosRef.current.y;
        
        // Elastic/lerp update: step by 15% of the remaining distance
        currentPosRef.current.x += dx * 0.15;
        currentPosRef.current.y += dy * 0.15;
        
        setBadgePos({ x: currentPosRef.current.x, y: currentPosRef.current.y });
        rafRef.current = requestAnimationFrame(updatePosition);
      };
      
      rafRef.current = requestAnimationFrame(updatePosition);
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [isHoveringVideo, handleGlobalMouseMove]);


  // Auto-select first 2 cameras from available list
  useEffect(() => {
    if (analysisAvailableCameras.length > 0) {
      if (!cameraLeft || !analysisAvailableCameras.includes(cameraLeft)) {
        setCameraLeft(analysisAvailableCameras[0]);
      }
      if (!cameraRight || !analysisAvailableCameras.includes(cameraRight)) {
        if (analysisAvailableCameras.length > 1) {
          setCameraRight(analysisAvailableCameras[1]);
        } else {
          setCameraRight('');
        }
      }
    } else {
      setCameraLeft('');
      setCameraRight('');
    }
  }, [analysisAvailableCameras]);

  // Synchronize cameraLeft with store's selected camera if helpful
  useEffect(() => {
    if (cameraLeft) {
      setAnalysisSelectedCamera(cameraLeft);
    }
  }, [cameraLeft, setAnalysisSelectedCamera]);

  const [marks, setMarks] = useState<number[]>([]);
  const marksRef = useRef<number[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [targetFile, setTargetFile] = useState<string | null>(null);

  // Left Video States
  const [videoUrlLeft, setVideoUrlLeft] = useState<string | null>(null);
  const [videoLoadingLeft, setVideoLoadingLeft] = useState(false);
  const [videoErrorLeft, setVideoErrorLeft] = useState<string | null>(null);
  const objectUrlRefLeft = useRef<string | null>(null);

  // Right Video States
  const [videoUrlRight, setVideoUrlRight] = useState<string | null>(null);
  const [videoLoadingRight, setVideoLoadingRight] = useState(false);
  const [videoErrorRight, setVideoErrorRight] = useState<string | null>(null);
  const objectUrlRefRight = useRef<string | null>(null);

  const [bufferedLeft, setBufferedLeft] = useState(0);
  const [bufferedRight, setBufferedRight] = useState(0);

  const handleLeftProgress = useCallback(() => {
    if (videoRefLeft.current) {
      const buffered = videoRefLeft.current.buffered;
      const duration = videoRefLeft.current.duration;
      if (duration && buffered.length > 0) {
        let maxBufferedEnd = 0;
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.end(i) > maxBufferedEnd) {
            maxBufferedEnd = buffered.end(i);
          }
        }
        setBufferedLeft(Math.min(100, (maxBufferedEnd / duration) * 100));
      }
    }
  }, []);

  const handleRightProgress = useCallback(() => {
    if (videoRefRight.current) {
      const buffered = videoRefRight.current.buffered;
      const duration = videoRefRight.current.duration;
      if (duration && buffered.length > 0) {
        let maxBufferedEnd = 0;
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.end(i) > maxBufferedEnd) {
            maxBufferedEnd = buffered.end(i);
          }
        }
        setBufferedRight(Math.min(100, (maxBufferedEnd / duration) * 100));
      }
    }
  }, []);

  const videoFileNameLeft = useMemo(() => {
    if (!targetFile) return 'video.avi';
    const fileBase = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '').split(/[\\/]/).pop();
    return `${fileBase}_${cameraLeft || 'None'}.avi`;
  }, [targetFile, cameraLeft]);

  const videoFileNameRight = useMemo(() => {
    if (!targetFile) return 'video.avi';
    const fileBase = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '').split(/[\\/]/).pop();
    return `${fileBase}_${cameraRight || 'None'}.avi`;
  }, [targetFile, cameraRight]);

  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const [duration, setDuration] = useState(100);
  
  const videoRefLeft = useRef<HTMLVideoElement>(null);
  const blurVideoRefLeft = useRef<HTMLVideoElement>(null);
  const videoRefRight = useRef<HTMLVideoElement>(null);
  const blurVideoRefRight = useRef<HTMLVideoElement>(null);

  const [showBlur, setShowBlur] = useState(true);

  // Left Video Zoom & Pan logic
  const [videoZoomLeft, setVideoZoomLeft] = useState(1);
  const zoomInLeft = useCallback(() => setVideoZoomLeft(z => Math.min(3, parseFloat((z + 0.25).toFixed(2)))), []);
  const zoomOutLeft = useCallback(() => setVideoZoomLeft(z => Math.max(1, parseFloat((z - 0.25).toFixed(2)))), []);

  const videoContainerRefLeft = useRef<HTMLDivElement>(null);
  const videoPanRefLeft = useRef({ x: 0, y: 0 });
  const [videoPanLeft, setVideoPanLeft] = useState({ x: 0, y: 0 });
  const isDraggingVideoRefLeft = useRef(false);
  const dragStartRefLeft = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    videoPanRefLeft.current = videoPanLeft;
  }, [videoPanLeft]);

  useEffect(() => {
    if (videoZoomLeft <= 1) {
      setVideoPanLeft({ x: 0, y: 0 });
      if (videoRefLeft.current) {
        videoRefLeft.current.style.transform = `translate(0px, 0px) scale(1)`;
        videoRefLeft.current.style.cursor = 'default';
      }
    } else {
      if (videoRefLeft.current) {
        videoRefLeft.current.style.cursor = 'grab';
      }
    }
  }, [videoZoomLeft]);

  useEffect(() => {
    const container = videoContainerRefLeft.current;
    if (!container || !videoUrlLeft) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      setVideoZoomLeft(z => {
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
  }, [videoUrlLeft]);

  const handleVideoMouseDownLeft = (e: React.MouseEvent) => {
    if (e.button !== 0 || videoZoomLeft <= 1 || !videoUrlLeft) return;
    e.preventDefault();
    isDraggingVideoRefLeft.current = true;
    dragStartRefLeft.current = {
      x: e.clientX,
      y: e.clientY,
      panX: videoPanRefLeft.current.x,
      panY: videoPanRefLeft.current.y
    };
    if (videoRefLeft.current) {
      videoRefLeft.current.style.transition = 'none';
      videoRefLeft.current.style.cursor = 'grabbing';
    }
  };

  const handleVideoMouseMoveLeft = (e: React.MouseEvent) => {
    if (!isDraggingVideoRefLeft.current) return;
    const dx = e.clientX - dragStartRefLeft.current.x;
    const dy = e.clientY - dragStartRefLeft.current.y;
    const nextX = dragStartRefLeft.current.panX + dx;
    const nextY = dragStartRefLeft.current.panY + dy;
    
    videoPanRefLeft.current = { x: nextX, y: nextY };
    
    if (videoRefLeft.current) {
      videoRefLeft.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${videoZoomLeft})`;
    }
  };

  const handleVideoMouseUpLeft = (e?: React.MouseEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!isDraggingVideoRefLeft.current) {
        if (e && e.type === 'mouseup') {
            addMarkAtTime(currentTimeRef.current);
        }
        return;
    }
    isDraggingVideoRefLeft.current = false;
    if (videoRefLeft.current) {
      videoRefLeft.current.style.transition = 'transform 0.2s ease';
      videoRefLeft.current.style.cursor = videoZoomLeft > 1 ? 'grab' : 'default';
    }
    setVideoPanLeft(videoPanRefLeft.current);

    if (e && e.type === 'mouseup') {
      const dx = e.clientX - dragStartRefLeft.current.x;
      const dy = e.clientY - dragStartRefLeft.current.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        addMarkAtTime(currentTimeRef.current);
      }
    }
  };

  const [showZoomOverlayLeft, setShowZoomOverlayLeft] = useState(false);
  const isFirstRenderLeft = useRef(true);

  useEffect(() => {
    if (isFirstRenderLeft.current) {
      isFirstRenderLeft.current = false;
      return;
    }
    setShowZoomOverlayLeft(true);
    const timer = setTimeout(() => {
      setShowZoomOverlayLeft(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [videoZoomLeft]);

  // Right Video Zoom & Pan logic
  const [videoZoomRight, setVideoZoomRight] = useState(1);
  const zoomInRight = useCallback(() => setVideoZoomRight(z => Math.min(3, parseFloat((z + 0.25).toFixed(2)))), []);
  const zoomOutRight = useCallback(() => setVideoZoomRight(z => Math.max(1, parseFloat((z - 0.25).toFixed(2)))), []);

  const videoContainerRefRight = useRef<HTMLDivElement>(null);
  const videoPanRefRight = useRef({ x: 0, y: 0 });
  const [videoPanRight, setVideoPanRight] = useState({ x: 0, y: 0 });
  const isDraggingVideoRefRight = useRef(false);
  const dragStartRefRight = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    videoPanRefRight.current = videoPanRight;
  }, [videoPanRight]);

  useEffect(() => {
    if (videoZoomRight <= 1) {
      setVideoPanRight({ x: 0, y: 0 });
      if (videoRefRight.current) {
        videoRefRight.current.style.transform = `translate(0px, 0px) scale(1)`;
        videoRefRight.current.style.cursor = 'default';
      }
    } else {
      if (videoRefRight.current) {
        videoRefRight.current.style.cursor = 'grab';
      }
    }
  }, [videoZoomRight]);

  useEffect(() => {
    const container = videoContainerRefRight.current;
    if (!container || !videoUrlRight) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      setVideoZoomRight(z => {
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
  }, [videoUrlRight]);

  const handleVideoMouseDownRight = (e: React.MouseEvent) => {
    if (e.button !== 0 || videoZoomRight <= 1 || !videoUrlRight) return;
    e.preventDefault();
    isDraggingVideoRefRight.current = true;
    dragStartRefRight.current = {
      x: e.clientX,
      y: e.clientY,
      panX: videoPanRefRight.current.x,
      panY: videoPanRefRight.current.y
    };
    if (videoRefRight.current) {
      videoRefRight.current.style.transition = 'none';
      videoRefRight.current.style.cursor = 'grabbing';
    }
  };

  const handleVideoMouseMoveRight = (e: React.MouseEvent) => {
    if (!isDraggingVideoRefRight.current) return;
    const dx = e.clientX - dragStartRefRight.current.x;
    const dy = e.clientY - dragStartRefRight.current.y;
    const nextX = dragStartRefRight.current.panX + dx;
    const nextY = dragStartRefRight.current.panY + dy;
    
    videoPanRefRight.current = { x: nextX, y: nextY };
    
    if (videoRefRight.current) {
      videoRefRight.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${videoZoomRight})`;
    }
  };

  const handleVideoMouseUpRight = (e?: React.MouseEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!isDraggingVideoRefRight.current) {
        if (e && e.type === 'mouseup') {
            addMarkAtTime(currentTimeRef.current);
        }
        return;
    }
    isDraggingVideoRefRight.current = false;
    if (videoRefRight.current) {
      videoRefRight.current.style.transition = 'transform 0.2s ease';
      videoRefRight.current.style.cursor = videoZoomRight > 1 ? 'grab' : 'default';
    }
    setVideoPanRight(videoPanRefRight.current);

    if (e && e.type === 'mouseup') {
      const dx = e.clientX - dragStartRefRight.current.x;
      const dy = e.clientY - dragStartRefRight.current.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        addMarkAtTime(currentTimeRef.current);
      }
    }
  };

  const [showZoomOverlayRight, setShowZoomOverlayRight] = useState(false);
  const isFirstRenderRight = useRef(true);

  useEffect(() => {
    if (isFirstRenderRight.current) {
      isFirstRenderRight.current = false;
      return;
    }
    setShowZoomOverlayRight(true);
    const timer = setTimeout(() => {
      setShowZoomOverlayRight(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [videoZoomRight]);

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

  // Load marks effect
  useEffect(() => {
    if (targetFile) {
      analysisApi.loadMarks(targetFile, analysisSourcePath).then(res => {
        if (res.data.status === 'success' && Array.isArray(res.data.marks)) {
          setMarks(res.data.marks);
        } else {
          setMarks([]);
        }
      }).catch(err => {
        console.error("Failed to load marks:", err);
        setMarks([]);
      });
    } else {
      setMarks([]);
      setIsPlaying(false);
      setDuration(100);
    }
  }, [targetFile, analysisSourcePath]);

  // Load Left Video
  useEffect(() => {
    if (targetFile && cameraLeft) {
      const baseName = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '');
      const url = `/api/analysis/media?path=${encodeURIComponent(`${baseName}_${cameraLeft}.avi`)}`;
      
      setVideoUrlLeft(null);
      setVideoLoadingLeft(true);
      setVideoErrorLeft(null);

      const abortController = new AbortController();
      fetch(url, { signal: abortController.signal })
        .then(res => {
          if (!res.ok) throw new Error('Video not found');
          return res.blob();
        })
        .then(blob => {
          if (objectUrlRefLeft.current) URL.revokeObjectURL(objectUrlRefLeft.current);
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRefLeft.current = blobUrl;
          setVideoUrlLeft(blobUrl);
          setVideoLoadingLeft(false);
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          console.error('Failed to preload left video:', err);
          setVideoUrlLeft(url);
          setVideoLoadingLeft(false);
        });

      return () => {
        abortController.abort();
      };
    } else {
      setVideoUrlLeft(null);
      if (objectUrlRefLeft.current) {
        URL.revokeObjectURL(objectUrlRefLeft.current);
        objectUrlRefLeft.current = null;
      }
      setVideoZoomLeft(1);
    }
  }, [targetFile, cameraLeft]);

  // Load Right Video
  useEffect(() => {
    if (targetFile && cameraRight) {
      const baseName = targetFile.replace(/_tracking\.mf4$/i, '').replace(/\.mf4$/i, '');
      const url = `/api/analysis/media?path=${encodeURIComponent(`${baseName}_${cameraRight}.avi`)}`;
      
      setVideoUrlRight(null);
      setVideoLoadingRight(true);
      setVideoErrorRight(null);

      const abortController = new AbortController();
      fetch(url, { signal: abortController.signal })
        .then(res => {
          if (!res.ok) throw new Error('Video not found');
          return res.blob();
        })
        .then(blob => {
          if (objectUrlRefRight.current) URL.revokeObjectURL(objectUrlRefRight.current);
          const blobUrl = URL.createObjectURL(blob);
          objectUrlRefRight.current = blobUrl;
          setVideoUrlRight(blobUrl);
          setVideoLoadingRight(false);
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          console.error('Failed to preload right video:', err);
          setVideoUrlRight(url);
          setVideoLoadingRight(false);
        });

      return () => {
        abortController.abort();
      };
    } else {
      setVideoUrlRight(null);
      if (objectUrlRefRight.current) {
        URL.revokeObjectURL(objectUrlRefRight.current);
        objectUrlRefRight.current = null;
      }
      setVideoZoomRight(1);
    }
  }, [targetFile, cameraRight]);

  // Cleanup effect for object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRefLeft.current) URL.revokeObjectURL(objectUrlRefLeft.current);
      if (objectUrlRefRight.current) URL.revokeObjectURL(objectUrlRefRight.current);
    };
  }, []);

  // Declarative play/pause synchronization effect
  useEffect(() => {
    if (isPlaying) {
      if (videoRefLeft.current && videoUrlLeft && videoRefLeft.current.paused) {
        videoRefLeft.current.play().catch(e => console.log("Left play error", e));
      }
      if (blurVideoRefLeft.current && videoUrlLeft && blurVideoRefLeft.current.paused) {
        blurVideoRefLeft.current.play().catch(e => {});
      }
      if (videoRefRight.current && videoUrlRight && videoRefRight.current.paused) {
        videoRefRight.current.play().catch(e => console.log("Right play error", e));
      }
      if (blurVideoRefRight.current && videoUrlRight && blurVideoRefRight.current.paused) {
        blurVideoRefRight.current.play().catch(e => {});
      }
    } else {
      if (videoRefLeft.current && !videoRefLeft.current.paused) {
        videoRefLeft.current.pause();
      }
      if (blurVideoRefLeft.current && !blurVideoRefLeft.current.paused) {
        blurVideoRefLeft.current.pause();
      }
      if (videoRefRight.current && !videoRefRight.current.paused) {
        videoRefRight.current.pause();
      }
      if (blurVideoRefRight.current && !blurVideoRefRight.current.paused) {
        blurVideoRefRight.current.pause();
      }
    }
  }, [isPlaying, videoUrlLeft, videoUrlRight]);

  // Seek helper function
  const seekTo = useCallback((t: number) => {
    currentTimeRef.current = t;
    setCurrentTime(t);
    if (videoRefLeft.current) videoRefLeft.current.currentTime = t;
    if (blurVideoRefLeft.current) blurVideoRefLeft.current.currentTime = t;
    if (videoRefRight.current) videoRefRight.current.currentTime = t;
    if (blurVideoRefRight.current) blurVideoRefRight.current.currentTime = t;
  }, []);

  const handleLeftTimeUpdate = () => {
    if (videoRefLeft.current) {
      const t = videoRefLeft.current.currentTime;
      currentTimeRef.current = t;
      // Throttle React state updates to ~10fps to reduce render thrashing
      const now = performance.now();
      if (now - lastStateUpdateRef.current >= 100) {
          lastStateUpdateRef.current = now;
          setCurrentTime(t);
      }
      if (blurVideoRefLeft.current && isPlaying && Math.abs(blurVideoRefLeft.current.currentTime - t) > 0.15) {
          blurVideoRefLeft.current.currentTime = t;
      }
      // Sync right video
      if (videoRefRight.current && isPlaying && Math.abs(videoRefRight.current.currentTime - t) > 0.15) {
          videoRefRight.current.currentTime = t;
      }
      if (blurVideoRefRight.current && isPlaying && Math.abs(blurVideoRefRight.current.currentTime - t) > 0.15) {
          blurVideoRefRight.current.currentTime = t;
      }
    }
  };

  const handleLeftLoadedMetadata = () => {
    if (videoRefLeft.current) {
      setDuration(videoRefLeft.current.duration || 100);
    }
  };

  const handleRightTimeUpdate = () => {
    if (videoRefRight.current && !videoUrlLeft) {
      const t = videoRefRight.current.currentTime;
      currentTimeRef.current = t;
      const now = performance.now();
      if (now - lastStateUpdateRef.current >= 100) {
          lastStateUpdateRef.current = now;
          setCurrentTime(t);
      }
      if (blurVideoRefRight.current && isPlaying && Math.abs(blurVideoRefRight.current.currentTime - t) > 0.15) {
          blurVideoRefRight.current.currentTime = t;
      }
    }
  };

  const handleRightLoadedMetadata = () => {
    if (videoRefRight.current && !videoUrlLeft) {
      setDuration(videoRefRight.current.duration || 100);
    }
  };

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
                className="flex-1 min-h-0 flex flex-col md:flex-row bg-neutral-950 gap-px relative"
                onMouseEnter={(e) => {
                    setIsHoveringVideo(true);
                    targetPosRef.current = { x: e.clientX, y: e.clientY };
                    currentPosRef.current = { x: e.clientX, y: e.clientY };
                    setBadgePos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setIsHoveringVideo(false)}
            >
                {/* Global Top-Left Dropdown */}
                <div 
                    className="absolute top-3 left-3 z-30 flex flex-col items-start gap-2 pointer-events-auto"
                    onMouseEnter={() => setIsHoveringVideo(false)}
                    onMouseLeave={() => setIsHoveringVideo(true)}
                >
                    <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={!targetFile}>
                                <Button variant="outline" size="sm" className={cn("h-8 w-8 p-0 bg-black/50 hover:!bg-black/70 !text-white hover:!text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md", !targetFile && "opacity-50 pointer-events-none")}>
                                    <Menu className="w-4 h-4 !text-white" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52 bg-popover border-border text-popover-foreground p-1 shadow-md">
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
                </div>

                {/* Left Panel */}
                <motion.div 
                    layout
                    ref={videoContainerRefLeft}
                    className={`flex-1 relative min-h-0 overflow-hidden bg-black ${isSwapped ? 'order-2' : 'order-1'}`}
                    onMouseDown={handleVideoMouseDownLeft}
                    onMouseMove={handleVideoMouseMoveLeft}
                    onMouseUp={handleVideoMouseUpLeft}
                    onMouseLeave={() => handleVideoMouseUpLeft()}
                >
                     {videoErrorLeft ? (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6">
                             <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-red-500/10 p-6 max-w-md shadow-2xl flex flex-col items-center text-center">
                                 <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                                     <Video className="w-6 h-6" />
                                 </div>
                                 <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                                     {videoErrorLeft === 'Video file not found' ? 'Video File Not Found' : 'Transcoding Error'}
                                 </h3>
                                 {videoErrorLeft === 'Video file not found' ? (
                                     <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                         The requested AVI video file for left camera could not be located in the current project source directory. Please verify that the file exists.
                                     </p>
                                 ) : (
                                     <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                         Failed to decode the video format. FusionStudio packages FFMPEG automatically via <code>imageio-ffmpeg</code>, so no manual installation is required. This failure may be due to an unsupported codec or a backend transcoding issue.
                                     </p>
                                 )}
                             </div>
                         </div>
                     ) : videoLoadingLeft && !videoUrlLeft ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                              <Loader2 className="w-8 h-8 text-white animate-spin" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Left Media...</span>
                          </div>
                      ) : videoUrlLeft ? (
                          <>
                              {showBlur && (
                              <video
                                  ref={blurVideoRefLeft}
                                  src={videoUrlLeft}
                                  muted
                                  loop
                                  playsInline
                                  className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[60px] scale-125 pointer-events-none transition-opacity duration-500"
                              />
                              )}
                              <video 
                                  ref={videoRefLeft} 
                                  src={videoUrlLeft} 
                                  className="w-full h-full object-contain relative z-10 transition-transform duration-200"
                                  style={{ 
                                      transform: `translate(${videoPanLeft.x}px, ${videoPanLeft.y}px) scale(${videoZoomLeft})`, 
                                      transformOrigin: 'center center' 
                                  }}
                                  onTimeUpdate={handleLeftTimeUpdate}
                                  onLoadedMetadata={handleLeftLoadedMetadata}
                                  onPlay={() => { setIsPlaying(true); blurVideoRefLeft.current?.play().catch(() => {}); }}
                                  onPause={() => { setIsPlaying(false); blurVideoRefLeft.current?.pause(); }}
                                  onEnded={() => { setIsPlaying(false); blurVideoRefLeft.current?.pause(); }}
                                  onLoadStart={() => { setVideoLoadingLeft(true); setVideoErrorLeft(null); setBufferedLeft(0); }}
                                  onWaiting={() => setVideoLoadingLeft(true)}
                                  onCanPlay={() => setVideoLoadingLeft(false)}
                                  onProgress={handleLeftProgress}
                                  onError={async () => {
                                      setVideoLoadingLeft(false);
                                      if (videoUrlLeft && !videoUrlLeft.startsWith('blob:')) {
                                          try {
                                             const res = await fetch(videoUrlLeft, { method: 'HEAD' });
                                             if (res.status === 404) {
                                                 setVideoErrorLeft('Video file not found');
                                                 return;
                                             }
                                          } catch (err) {
                                              console.error('Error fetching left video URL details:', err);
                                          }
                                      }
                                      setVideoErrorLeft('Failed to decode video format');
                                  }}
                             />
                             {/* Zoom Level Indicator Overlay */}
                             <div className={cn(
                                 "absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-500",
                                 showZoomOverlayLeft ? "opacity-100 scale-100" : "opacity-0 scale-95"
                             )}>
                                 <div 
                                     className="text-white/80 text-7xl font-extrabold font-sans tracking-widest select-none"
                                     style={{ textShadow: '0 0 16px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.5)' }}
                                 >
                                     {Math.round(videoZoomLeft * 100)}%
                                 </div>
                             </div>
                             {videoLoadingLeft && (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 z-20 transition-all duration-300">
                                     <div 
                                         className="absolute left-0 top-0 bottom-0 bg-red-500/25 pointer-events-none transition-all duration-300 ease-out -z-10"
                                         style={{ width: `${bufferedLeft}%` }}
                                     />
                                     <Loader2 className="w-8 h-8 text-white animate-spin" />
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Left Media ({Math.round(bufferedLeft)}%)...</span>
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
                            
                            <Video className="w-14 h-14 stroke-[1.0] text-muted-foreground/60" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-mono text-muted-foreground/60">Left Video Offline</span>
                        </div>
                    )}
                    <div 
                        className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-auto"
                        onMouseEnter={() => setIsHoveringVideo(false)}
                        onMouseLeave={() => setIsHoveringVideo(true)}
                    >
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
                                                cameraLeft === cam ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                                            )}
                                            onClick={() => setCameraLeft(cam)}
                                        >
                                            <span>{cam}</span>
                                            {cameraLeft === cam && <span className="text-sm font-bold">✓</span>}
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
                                disabled={!targetFile || videoZoomLeft >= 3}
                                onClick={zoomInLeft}
                                className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                                title="Zoom In"
                            >
                                <Plus className="w-3.5 h-3.5 !text-white" />
                            </Button>
                            <div className="w-full h-[1px] bg-white/10" />
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!targetFile || videoZoomLeft <= 1}
                                onClick={zoomOutLeft}
                                className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                                title="Zoom Out"
                            >
                                <Minus className="w-3.5 h-3.5 !text-white" />
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Swap Button */}
                {targetFile && cameraLeft && cameraRight && (
                    <motion.div 
                        layout
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onMouseEnter={() => setIsHoveringVideo(false)}
                        onMouseLeave={() => setIsHoveringVideo(true)}
                    >
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setIsSwapped(!isSwapped)}
                            className="w-12 h-12 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        >
                            <ArrowLeftRight className="w-5 h-5" />
                        </motion.button>
                    </motion.div>
                )}

                {/* Right Panel */}
                <motion.div 
                    layout
                    ref={videoContainerRefRight}
                    className={`flex-1 relative min-h-0 overflow-hidden bg-black ${isSwapped ? 'order-1' : 'order-2'}`}
                    onMouseDown={handleVideoMouseDownRight}
                    onMouseMove={handleVideoMouseMoveRight}
                    onMouseUp={handleVideoMouseUpRight}
                    onMouseLeave={() => handleVideoMouseUpRight()}
                >
                     {videoErrorRight ? (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6">
                             <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-red-500/10 p-6 max-w-md shadow-2xl flex flex-col items-center text-center">
                                 <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                                     <Video className="w-6 h-6" />
                                 </div>
                                 <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                                     {videoErrorRight === 'Video file not found' ? 'Video File Not Found' : 'Transcoding Error'}
                                 </h3>
                                 {videoErrorRight === 'Video file not found' ? (
                                     <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                         The requested AVI video file for right camera could not be located in the current project source directory. Please verify that the file exists.
                                     </p>
                                 ) : (
                                     <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                         Failed to decode the video format. FusionStudio packages FFMPEG automatically via <code>imageio-ffmpeg</code>, so no manual installation is required. This failure may be due to an unsupported codec or a backend transcoding issue.
                                     </p>
                                 )}
                             </div>
                         </div>
                     ) : videoLoadingRight && !videoUrlRight ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                              <Loader2 className="w-8 h-8 text-white animate-spin" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Right Media...</span>
                          </div>
                      ) : videoUrlRight ? (
                          <>
                              {showBlur && (
                              <video
                                  ref={blurVideoRefRight}
                                  src={videoUrlRight}
                                  muted
                                  loop
                                  playsInline
                                  className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[60px] scale-125 pointer-events-none transition-opacity duration-500"
                              />
                              )}
                              <video 
                                  ref={videoRefRight} 
                                  src={videoUrlRight} 
                                  className="w-full h-full object-contain relative z-10 transition-transform duration-200"
                                  style={{ 
                                      transform: `translate(${videoPanRight.x}px, ${videoPanRight.y}px) scale(${videoZoomRight})`, 
                                      transformOrigin: 'center center' 
                                  }}
                                  onTimeUpdate={handleRightTimeUpdate}
                                  onLoadedMetadata={handleRightLoadedMetadata}
                                  onPlay={() => { setIsPlaying(true); blurVideoRefRight.current?.play().catch(() => {}); }}
                                  onPause={() => { setIsPlaying(false); blurVideoRefRight.current?.pause(); }}
                                  onEnded={() => { setIsPlaying(false); blurVideoRefRight.current?.pause(); }}
                                  onLoadStart={() => { setVideoLoadingRight(true); setVideoErrorRight(null); setBufferedRight(0); }}
                                  onWaiting={() => setVideoLoadingRight(true)}
                                  onCanPlay={() => setVideoLoadingRight(false)}
                                  onProgress={handleRightProgress}
                                  onError={async () => {
                                      setVideoLoadingRight(false);
                                      if (videoUrlRight && !videoUrlRight.startsWith('blob:')) {
                                          try {
                                             const res = await fetch(videoUrlRight, { method: 'HEAD' });
                                             if (res.status === 404) {
                                                 setVideoErrorRight('Video file not found');
                                                 return;
                                             }
                                          } catch (err) {
                                              console.error('Error fetching right video URL details:', err);
                                          }
                                      }
                                      setVideoErrorRight('Failed to decode video format');
                                  }}
                             />
                             {/* Zoom Level Indicator Overlay */}
                             <div className={cn(
                                 "absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-500",
                                 showZoomOverlayRight ? "opacity-100 scale-100" : "opacity-0 scale-95"
                             )}>
                                 <div 
                                     className="text-white/80 text-7xl font-extrabold font-sans tracking-widest select-none"
                                     style={{ textShadow: '0 0 16px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.5)' }}
                                 >
                                     {Math.round(videoZoomRight * 100)}%
                                 </div>
                             </div>
                             {videoLoadingRight && (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 z-20 transition-all duration-300">
                                     <div 
                                         className="absolute left-0 top-0 bottom-0 bg-red-500/25 pointer-events-none transition-all duration-300 ease-out -z-10"
                                         style={{ width: `${bufferedRight}%` }}
                                     />
                                     <Loader2 className="w-8 h-8 text-white animate-spin" />
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preparing Right Media ({Math.round(bufferedRight)}%)...</span>
                                 </div>
                             )}
                             {/* Visual Misuse Mark indicator on the video */}
                             {marks.length > 0 && targetFile && (
                               <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg">
                                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                 <span className="text-xs font-bold text-white uppercase tracking-wider">Misuse Triggered At: <span className="text-red-400 font-mono ml-1">{marks[0].toFixed(2)}s</span></span>
                               </div>
                             )}
                         </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-pulse-sync select-none">
                            {/* Ambient glow circle */}
                            <div className="absolute w-[220px] h-[220px] rounded-full bg-white/[0.03] blur-[50px] pointer-events-none" />
                            
                            <Video className="w-14 h-14 stroke-[1.0] text-muted-foreground/60" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-mono text-muted-foreground/60">Right Video Offline</span>
                        </div>
                    )}
                    <div 
                        className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-auto"
                        onMouseEnter={() => setIsHoveringVideo(false)}
                        onMouseLeave={() => setIsHoveringVideo(true)}
                    >
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
                                                cameraRight === cam ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
                                            )}
                                            onClick={() => setCameraRight(cam)}
                                        >
                                            <span>{cam}</span>
                                            {cameraRight === cam && <span className="text-sm font-bold">✓</span>}
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
                                disabled={!targetFile || videoZoomRight >= 3}
                                onClick={zoomInRight}
                                className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                                title="Zoom In"
                            >
                                <Plus className="w-3.5 h-3.5 !text-white" />
                            </Button>
                            <div className="w-full h-[1px] bg-white/10" />
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!targetFile || videoZoomRight <= 1}
                                onClick={zoomOutRight}
                                className="h-7 w-7 p-0 rounded-none !text-white hover:!bg-white/10 hover:!text-white disabled:opacity-30 border-none bg-transparent"
                                title="Zoom Out"
                            >
                                <Minus className="w-3.5 h-3.5 !text-white" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
            
            <div className="h-24 border-t border-border pt-4 pb-2 px-3 shrink-0 flex flex-col justify-between bg-white dark:bg-surface-ink relative z-30 shadow-2xl">
                <div className="flex items-center gap-3 w-full px-[5%]">
                    <div className="flex-1 min-w-0 relative flex items-center group">
                        <ElasticSlider 
                            value={currentTime} 
                            disabled={!targetFile}
                            onChange={(v) => { 
                                seekTo(v);
                            }} 
                            maxValue={targetFile ? duration : 100} 
                            stepSize={0.001} 
                            leftIcon={
                                <motion.span 
                                    className="text-xs font-bold text-muted-foreground dark:text-white font-mono tabular-nums shrink-0"
                                >
                                    {targetFile ? `${currentTime.toFixed(2)}s` : "0.00s"}
                                </motion.span>
                            }
                            rightIcon={
                                <motion.span 
                                    className={cn("font-bold text-muted-foreground dark:text-white", targetFile ? "text-xs font-mono tabular-nums" : "text-xl font-sans relative -top-[1.5px]")}
                                >
                                    {targetFile ? (
                                        <CountUp
                                            from={0}
                                            to={Number(duration.toFixed(2))}
                                            duration={0.5}
                                            className="tabular-nums"
                                        />
                                    ) : "∞"}
                                    {targetFile && "s"}
                                </motion.span>
                            }
                            trackOverlay={
                                <>
                                    {/* Render Mark on the timeline */}
                                    {marks.length > 0 && targetFile && duration > 0 && (
                                      <div 
                                        className="absolute top-1/2 -translate-y-1/2 w-[3px] h-3 bg-red-500 z-10 pointer-events-none rounded-full"
                                        style={{ left: `${marks[0] / duration * 100}%` }}
                                      />
                                    )}
                                    {/* Hover vertical line */}
                                    {duration > 0 && targetFile && (
                                        <div 
                                            className={cn(
                                                "absolute bottom-1/2 w-[1px] bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)] transition duration-300 ease-out",
                                                isHoveringVideo ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                                            )}
                                            style={{ 
                                                left: `${currentTime / duration * 100}%`,
                                                height: '2000px',
                                                transformOrigin: 'bottom center'
                                            }}
                                        />
                                    )}
                                </>
                            }
                            className={cn(
                                'flex-1 cursor-pointer',
                                !targetFile && "opacity-30 pointer-events-none"
                            )}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between w-full">
                    {/* Left space to balance center controls */}
                    <div className="flex-1"></div>
                    
                    <div className="flex items-center justify-center gap-3 flex-1">
                        <motion.button 
                            disabled={!targetFile}
                            onClick={() => {
                                seekTo(0);
                            }}
                            whileTap="tap"
                            className="h-10 w-10 rounded-xl hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30 overflow-hidden outline-none select-none transition-colors"
                            title="Restart from beginning"
                        >
                            <motion.div
                                variants={{
                                    tap: { x: -8 }
                                }}
                                transition={{ type: "spring", stiffness: 450, damping: 12 }}
                            >
                                <ArrowLeftToLine className="w-5 h-5" />
                            </motion.div>
                        </motion.button>
                        <motion.button 
                            disabled={!targetFile}
                            onClick={() => {
                                const t = Math.max(0, currentTime - 5);
                                seekTo(t);
                            }}
                            whileTap="tap"
                            className="h-10 w-10 rounded-xl hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30 overflow-hidden outline-none select-none transition-colors"
                            title="Rewind 5 seconds"
                        >
                            <motion.div
                                variants={{
                                    tap: { rotate: -35 }
                                }}
                                transition={{ type: "spring", stiffness: 450, damping: 12 }}
                            >
                                <RotateCcw className="w-5 h-5" />
                            </motion.div>
                        </motion.button>
                        <motion.button 
                            disabled={!targetFile}
                            onClick={() => { 
                                setIsPlaying(!isPlaying); 
                            }} 
                            whileTap="tap"
                            className={cn(
                                'h-10 w-10 rounded-xl border border-border bg-surface-3 transition-colors disabled:opacity-30 flex items-center justify-center overflow-hidden outline-none select-none',
                                isPlaying ? 'bg-primary hover:bg-primary/90 !text-primary-foreground' : 'hover:bg-accent text-foreground'
                            )}
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            <motion.div
                                variants={{
                                    tap: { scale: 0.82 }
                                }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                className="flex items-center justify-center"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                            </motion.div>
                        </motion.button>
                        <motion.button 
                            disabled={!targetFile}
                            onClick={() => {
                                const t = Math.min(duration, currentTime + 5);
                                seekTo(t);
                            }}
                            whileTap="tap"
                            className="h-10 w-10 rounded-xl hover:bg-accent text-foreground flex items-center justify-center disabled:opacity-30 overflow-hidden outline-none select-none transition-colors"
                            title="Forward 5 seconds"
                        >
                            <motion.div
                                variants={{
                                    tap: { rotate: 35 }
                                }}
                                transition={{ type: "spring", stiffness: 450, damping: 12 }}
                            >
                                <RotateCw className="w-5 h-5" />
                            </motion.div>
                        </motion.button>
                    </div>
                    
                    <div className="flex-1 flex justify-end">
                        <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider truncate max-w-[300px]" title={targetFile ? `${videoFileNameLeft} | ${videoFileNameRight}` : "No project loaded"}>
                            {targetFile ? `${cameraLeft || 'None'} + ${cameraRight || 'None'}` : "NO PROJECT LOADED"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
      {targetFile && (
        <div 
          className={cn(
            "fixed z-50 pointer-events-none bg-red-500 text-white font-extrabold text-2xl px-3 py-1 rounded-md shadow-lg whitespace-nowrap transform -translate-x-1/2 -translate-y-12 tracking-wider transition duration-300 ease-out border border-red-400 flex items-center gap-1.5",
            isHoveringVideo ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}
          style={{ left: badgePos.x, top: badgePos.y }}
        >
          <MousePointerClick className="w-5 h-5 text-white mr-0.5" />
          <span className="tabular-nums">{currentTime.toFixed(2)}</span>s
        </div>
      )}
    </div>
  );
}
