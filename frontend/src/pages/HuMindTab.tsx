import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { useBrainTrainingWS } from "../hooks/useBrainTrainingWS";
import {
  Brain,
  Settings,
  Play,
  Square,
  History,
  FolderOpen,
  Database,
  Layers,
  TrendingDown,
  RefreshCw,
  Zap,
  Trash2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Info,
  CheckCircle2,
  Circle,
  Loader2,
  Cpu,
  Sparkles,
  Shield,
  BookOpen,
  AlertTriangle,
  BarChart3,
  Target,
  Check,
  GripVertical,
  RotateCcw,
  GitCompare,
  Activity,
  Clock,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Standardized Defaults ───
const RECOMMENDED_DEFAULTS = {
  epochs: 150,
  lr: 0.001,
  patience: 20,
  batchSize: 32,
  weightDecay: 0.0001,
  videoFps: 5,
};

// ─── Training Phases ───
const PHASES = ["extracting", "building", "training", "done"] as const;
const PHASE_LABELS: Record<string, string> = {
  extracting: "Extracting",
  building: "Building Dataset",
  training: "Training",
  done: "Complete",
};

// ─── Tooltip Descriptions ───
const PARAM_TOOLTIPS: Record<string, string> = {
  epochs:
    "Maximum number of full passes through the training data. Training may stop earlier via early stopping if the model stops improving.",
  lr: "Controls how much the model weights are updated each step. Lower values learn slower but more precisely; higher values learn faster but may overshoot. The scheduler halves it automatically on plateaus.",
  patience:
    "Number of epochs to wait without validation improvement before stopping training early. Higher values allow more time for the learning rate scheduler to find better minima.",
  batchSize:
    "Number of training samples processed together in one step. Larger batches are faster but use more GPU memory. 32 is a good default for most setups.",
  weightDecay:
    "L2 regularization penalty applied to model weights to prevent overfitting. Higher values constrain the model more aggressively.",
  videoFps:
    "Frames per second sampled from driver video for visual feature extraction. Higher values capture more detail but increase extraction time and memory usage.",
};

// ─── Best Practices Data ───
const BEST_PRACTICES = [
  {
    icon: BarChart3,
    title: "Data Balance",
    text: 'Ensure roughly equal distribution of distraction vs. normal segments. Heavy imbalance (e.g., 90% normal, 10% distraction) biases the model toward always predicting "normal". Aim for at least 30% distraction samples.',
  },
  {
    icon: Shield,
    title: "Overfitting Prevention",
    text: "Watch the gap between training accuracy and validation accuracy. If train acc reaches 99% but val acc is stuck at 75%, the model is memorizing rather than learning. Remedies: add more projects, or increase patience for early stopping.",
  },
  {
    icon: Database,
    title: "Data Diversity",
    text: "Include recordings from different vehicles, drivers, lighting conditions, and distraction types (phone, eating, talking). Models trained on a single scenario will fail to generalize.",
  },
  {
    icon: TrendingDown,
    title: "Epoch Count",
    text: "More epochs ≠ better model. After the loss plateaus, additional epochs only increase overfitting risk. The patience parameter automatically stops training when improvement stalls.",
  },
  {
    icon: Sparkles,
    title: "Learning Rate",
    text: "Start with 0.001 (recommended default). If loss oscillates wildly, reduce to 0.0001. If training is too slow and loss barely moves, try 0.01 for initial exploration.",
  },
  {
    icon: AlertTriangle,
    title: "Video + MF4 Alignment",
    text: "Ensure your JSON mark files have accurate start/end timestamps aligned with both the MF4 signal data and video frames. Misaligned marks will teach the model wrong patterns.",
  },
  {
    icon: Target,
    title: "Minimum Data",
    text: "For reliable multimodal training, aim for at least 500 labeled segments (distraction windows) across all projects combined. Below 200, the model will likely not generalize.",
  },
];

// ─── Contextual Tips ───
const TIPS_IDLE = [
  "Use at least 3 diverse projects for robust generalization. Mixing highway and urban scenarios improves model accuracy.",
  "Before training, verify your JSON mark files have correct distraction start/end timestamps.",
  "The multimodal architecture combines MF4 signal data with video features for the best results.",
];
const TIPS_TRAINING = [
  "If validation loss hasn't improved for several epochs, early stopping (patience) will save the best checkpoint automatically.",
  "A slowly decreasing loss is healthy. Sudden spikes may indicate learning rate is too high.",
  "Training on GPU is significantly faster. Ensure CUDA is available for large datasets.",
];
const TIPS_DONE = [
  "Compare train accuracy vs. validation accuracy. A gap >15% may indicate overfitting — try adding more training data.",
  "Re-train with additional projects from different scenarios to improve generalization.",
  "The saved model includes full provenance data showing which projects contributed to its training.",
];

function getContextualTip(phase: string, epochData: any[]): string {
  if (phase === "done" || (phase === "" && epochData.length > 0)) {
    return TIPS_DONE[Math.floor(Date.now() / 12000) % TIPS_DONE.length];
  }
  if (phase && phase !== "done" && phase !== "error") {
    return TIPS_TRAINING[Math.floor(Date.now() / 10000) % TIPS_TRAINING.length];
  }
  return TIPS_IDLE[Math.floor(Date.now() / 15000) % TIPS_IDLE.length];
}

// ─── Tooltip Wrapper ───
function ParamTooltip({
  label,
  tooltipKey,
  children,
}: {
  label: string;
  tooltipKey: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
          {label}
        </label>
        <div className="relative">
          <button
            type="button"
            className="text-muted-foreground/40 hover:text-primary transition-colors"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
          >
            <Info className="w-3 h-3" />
          </button>
          {show && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-64 px-3 py-2 text-xs text-foreground/90 bg-surface-2 border border-white/10 rounded-lg shadow-xl leading-relaxed pointer-events-none">
              {PARAM_TOOLTIPS[tooltipKey]}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Phase Stepper Component ───
function PhaseStepper({ currentPhase }: { currentPhase: string }) {
  const currentIdx = PHASES.indexOf(currentPhase as any);

  return (
    <div className="flex items-center gap-2 w-full">
      {PHASES.map((phase, i) => {
        const isComplete = currentIdx > i || currentPhase === "done";
        const isCurrent = currentPhase === phase && currentPhase !== "done";
        const isDone = phase === "done" && currentPhase === "done";

        return (
          <div key={phase} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex-1 justify-center",
                isComplete || isDone
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : isCurrent
                    ? "bg-primary/10 text-primary border border-primary/20 animate-pulse"
                    : "bg-surface-3/50 text-muted-foreground/40 border border-white/5",
              )}
            >
              {isComplete || isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isCurrent ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              <span>{PHASE_LABELS[phase]}</span>
            </div>
            {i < PHASES.length - 1 && (
              <ChevronRight
                className={cn(
                  "w-4 h-4 shrink-0",
                  isComplete
                    ? "text-emerald-400/50"
                    : "text-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mini Sparkline ───
function MiniSparkline({
  data,
  color = "currentColor",
  height = 24,
  width = 80,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Participant {
  path: string;
  name: string;
  mf4s: number;
  avis: number;
}

interface ProjectGroup {
  path: string;
  name: string;
  participants: Participant[];
  isExpanded: boolean;
}

// Get training project paths from model metadata
const getModelTrainingPaths = (model: any): string[] => {
  if (model?.metadata?.training_projects) {
    return model.metadata.training_projects.map((p: any) => p.path || p);
  }
  if (model?.metadata?.projects) {
    return model.metadata.projects;
  }
  return [];
};

// ─── Main Component ───
export default function HuMindTab() {
  const {
    brainModels,
    setBrainModels,
    brainHistory,
    setBrainHistory,
    brainArchitecture,
    brainEpochs,
    setBrainEpochs,
    brainLR,
    setBrainLR,
    brainPatience,
    setBrainPatience,
    brainBatchSize,
    setBrainBatchSize,
    brainWeightDecay,
    setBrainWeightDecay,
    brainVideoFps,
    setBrainVideoFps,
    brainTraining,
    setBrainTraining,
    brainPhase,
    brainPhaseProgress,
    brainEpochData,
    clearBrainEpochData,
    brainDatasetStats,
    setBrainDatasetStats,
    addLog,
  } = useAppStore();

  useBrainTrainingWS();

  // Selected active model path (for inference selection)
  const [activeModelPath, setActiveModelPath] = useState<string | null>(() => {
    return localStorage.getItem("humind_active_model_path");
  });

  const [scanning, setScanning] = useState(false);
  const [projectInput, setProjectInput] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteModelPath, setDeleteModelPath] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [tipText, setTipText] = useState("");
  const epochScrollRef = useRef<HTMLDivElement>(null);
  const [mainView, setMainView] = useState<"monitor" | "compare">("monitor");
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

  const [trainingMode, setTrainingMode] = useState<"fresh" | "finetune">("fresh");

  // Sync trainingMode to 'fresh' when activeModelPath is cleared
  useEffect(() => {
    if (!activeModelPath) {
      setTrainingMode("fresh");
    }
  }, [activeModelPath]);

  // Derive projects that are already part of the active model's database
  const activeModelTrainedPaths = useMemo(() => {
    const paths = new Set<string>();
    if (activeModelPath && Array.isArray(brainModels)) {
      const activeModel = brainModels.find((m: any) => m.path === activeModelPath);
      if (activeModel) {
        const trained = getModelTrainingPaths(activeModel);
        if (Array.isArray(trained)) {
          trained.forEach((p) => {
            if (p) paths.add(p);
          });
        }
      }
    }
    return paths;
  }, [activeModelPath, brainModels]);

  const activeModelTrainedBasenames = useMemo(() => {
    const basenames = new Set<string>();
    activeModelTrainedPaths.forEach((p) => {
      const base = p.split(/[/\\]/).filter(Boolean).pop() || "";
      if (base) basenames.add(base.toLowerCase());
    });
    return basenames;
  }, [activeModelTrainedPaths]);

  // Group models by variant/name and sort by timestamp
  const groupedModels = useMemo(() => {
    const groups: Record<string, any[]> = {};
    if (Array.isArray(brainModels)) {
      brainModels.forEach((m: any) => {
        if (m) {
          let name = m.metadata?.name || m.variant || "Unspecified Model";
          if (name === "No model loaded" || name === "no_model_loaded" || name === "distraction_detector") {
            if (m.variant === "multimodal") {
              name = "Multimodal";
            } else if (m.variant === "mlp") {
              name = "Distraction Detector";
            }
          }
          // Normalize names that start with distraction_detector_
          if (name.startsWith("distraction_detector_")) {
            name = "Distraction Detector";
          }
          if (!groups[name]) groups[name] = [];
          groups[name].push(m);
        }
      });
    }
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const timeA = String(a.metadata?.training_config?.timestamp || "");
        const timeB = String(b.metadata?.training_config?.timestamp || "");
        return timeB.localeCompare(timeA);
      });
    });
    return groups;
  }, [brainModels]);

  // Flat sorted models for comparison view
  const allModelsSorted = useMemo(() => {
    if (!Array.isArray(brainModels)) return [];
    return [...brainModels].sort((a, b) => {
      const timeA = String(a.metadata?.training_config?.timestamp || "");
      const timeB = String(b.metadata?.training_config?.timestamp || "");
      return timeB.localeCompare(timeA);
    });
  }, [brainModels]);

  // Persistent Project Groups state
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>(() => {
    try {
      const saved = localStorage.getItem("humind_project_groups");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((g: any) => ({
            path: g.path || "",
            name: g.name || "",
            participants: Array.isArray(g.participants) ? g.participants : [],
            isExpanded: !!g.isExpanded,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Selected participant paths
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("humind_selected_projects");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Sync projects to localStorage
  useEffect(() => {
    localStorage.setItem("humind_project_groups", JSON.stringify(projectGroups));
  }, [projectGroups]);

  useEffect(() => {
    localStorage.setItem("humind_selected_projects", JSON.stringify(selectedProjects));
  }, [selectedProjects]);

  // Load models and history on mount and when training finishes
  useEffect(() => {
    fetch("/api/brain/models")
      .then((r) => r.json())
      .then((d) => {
        const models = d.models || [];
        setBrainModels(models);

        if (models.length > 0) {
          const sorted = [...models].sort((a, b) => {
            const timeA = String(a.metadata?.training_config?.timestamp || "");
            const timeB = String(b.metadata?.training_config?.timestamp || "");
            return timeB.localeCompare(timeA);
          });

          const stored = localStorage.getItem("humind_active_model_path");
          if (!stored || !models.some((m: any) => m.path === stored) || brainPhase === "done") {
            const latestPath = sorted[0].path;
            setActiveModelPath(latestPath);
            localStorage.setItem("humind_active_model_path", latestPath);
          }
        }
      });
    fetch("/api/brain/history")
      .then((r) => r.json())
      .then((d) => setBrainHistory(d));
  }, [brainPhase, setBrainModels, setBrainHistory]);

  // Rotate contextual tips
  useEffect(() => {
    const update = () =>
      setTipText(getContextualTip(brainPhase, brainEpochData));
    update();
    const interval = setInterval(update, 8000);
    return () => clearInterval(interval);
  }, [brainPhase, brainEpochData]);

  // Auto-scroll epoch table
  useEffect(() => {
    if (epochScrollRef.current) {
      epochScrollRef.current.scrollTop = epochScrollRef.current.scrollHeight;
    }
  }, [brainEpochData]);

  // Find best epoch
  const bestEpoch = useMemo(() => {
    if (brainEpochData.length === 0) return -1;
    let bestIdx = 0;
    let bestAcc = -1;
    brainEpochData.forEach((d: any, i: number) => {
      const acc = d.val_acc != null ? d.val_acc : d.acc;
      if (acc > bestAcc) {
        bestAcc = acc;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [brainEpochData]);

  // Reset to recommended defaults
  const handleResetDefaults = () => {
    setBrainEpochs(RECOMMENDED_DEFAULTS.epochs);
    setBrainLR(RECOMMENDED_DEFAULTS.lr);
    setBrainPatience(RECOMMENDED_DEFAULTS.patience);
    setBrainBatchSize(RECOMMENDED_DEFAULTS.batchSize);
    setBrainWeightDecay(RECOMMENDED_DEFAULTS.weightDecay);
    setBrainVideoFps(RECOMMENDED_DEFAULTS.videoFps);
    addLog("Reset all training parameters to recommended defaults.");
  };

  // Check if current config matches defaults
  const isDefaultConfig =
    brainEpochs === RECOMMENDED_DEFAULTS.epochs &&
    brainLR === RECOMMENDED_DEFAULTS.lr &&
    brainPatience === RECOMMENDED_DEFAULTS.patience &&
    brainBatchSize === RECOMMENDED_DEFAULTS.batchSize &&
    brainWeightDecay === RECOMMENDED_DEFAULTS.weightDecay &&
    brainVideoFps === RECOMMENDED_DEFAULTS.videoFps;

  // Add a project path to the list
  const handleAddProject = async () => {
    const path = projectInput.trim();
    if (!path) return;
    if (projectGroups.some((g) => g.path === path)) {
      addLog(`Project folder already added: ${path}`);
      return;
    }

    setScanning(true);
    try {
      const res = await fetch(
        `/api/brain/projects?root=${encodeURIComponent(path)}`,
      );
      const data = await res.json();
      const projects = data.projects || [];
      const name = path.split(/[/\\]/).filter(Boolean).pop() || path;

      if (projects.length > 0) {
        const group: ProjectGroup = {
          path,
          name,
          participants: projects.map((p: any) => ({
            path: p.path,
            name: p.name,
            mf4s: p.mf4s || 0,
            avis: p.avis || 0,
          })),
          isExpanded: true,
        };
        setProjectGroups((prev) => [...prev, group]);
        setSelectedProjects((prev) => [
          ...prev,
          ...projects.map((p: any) => p.path),
        ]);
        addLog(
          `Added project folder: ${name} with ${projects.length} participant(s)`,
        );
      } else {
        const group: ProjectGroup = {
          path,
          name,
          participants: [{ path, name, mf4s: 0, avis: 0 }],
          isExpanded: false,
        };
        setProjectGroups((prev) => [...prev, group]);
        setSelectedProjects((prev) => [...prev, path]);
        addLog(`Added project folder: ${name}`);
      }
    } catch (err) {
      const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
      const group: ProjectGroup = {
        path,
        name,
        participants: [{ path, name, mf4s: 0, avis: 0 }],
        isExpanded: false,
      };
      setProjectGroups((prev) => [...prev, group]);
      setSelectedProjects((prev) => [...prev, path]);
      addLog(`Added project folder (unverified): ${name}`);
    } finally {
      setScanning(false);
      setProjectInput("");
    }
  };

  const handleRemoveProject = (groupPath: string) => {
    const group = projectGroups.find((g) => g.path === groupPath);
    if (!group) return;
    const pPaths = group.participants.map((p) => p.path);
    setProjectGroups((prev) => prev.filter((g) => g.path !== groupPath));
    setSelectedProjects((prev) => prev.filter((p) => !pPaths.includes(p)));
    addLog(`Removed project folder: ${group.name}`);
  };

  const toggleGroupExpanded = (groupPath: string) => {
    setProjectGroups((prev) =>
      prev.map((g) =>
        g.path === groupPath ? { ...g, isExpanded: !g.isExpanded } : g,
      ),
    );
  };

  const toggleParticipantSelection = (pPath: string) => {
    setSelectedProjects((prev) =>
      prev.includes(pPath) ? prev.filter((p) => p !== pPath) : [...prev, pPath],
    );
  };

  const handleGroupRadioChange = (groupPath: string, value: string) => {
    const group = projectGroups.find((g) => g.path === groupPath);
    if (!group) return;
    const pPaths = group.participants.map((p) => p.path);

    if (value === "all") {
      setSelectedProjects((prev) => {
        const filtered = prev.filter((p) => !pPaths.includes(p));
        return [...filtered, ...pPaths];
      });
    } else if (value === "none") {
      setSelectedProjects((prev) => prev.filter((p) => !pPaths.includes(p)));
    }
  };

  const handleStartTraining = async () => {
    if (selectedProjects.length === 0) {
      addLog("Select at least one project.");
      return;
    }
    setBrainTraining(true);
    clearBrainEpochData();
    setBrainDatasetStats(null);
    const modeDesc = trainingMode === "finetune" && activeModelPath ? "fine-tuning active model" : "starting fresh training";
    addLog(
      `Starting ${brainArchitecture} training (${modeDesc}) on ${selectedProjects.length} project(s)`,
    );

    try {
      const endpoint =
        brainArchitecture === "legacy"
          ? "/api/brain/train/legacy"
          : "/api/brain/train/multimodal";
      const body: any = {
        root_folders: selectedProjects,
        epochs: brainEpochs,
        lr: brainLR,
        patience: brainPatience,
        batch_size: brainBatchSize,
        weight_decay: brainWeightDecay,
        video_fps: brainVideoFps,
      };
      if (trainingMode === "finetune" && activeModelPath) {
        body.base_model_path = activeModelPath;
      }

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      setBrainTraining(false);
      addLog(`Error starting training: ${err}`);
    }
  };

  const handleStop = () => {
    setStopConfirmOpen(true);
  };

  const confirmStop = async () => {
    setStopConfirmOpen(false);
    await fetch("/api/brain/stop", { method: "POST" });
    addLog("Stop requested. Waiting for the current epoch to finish...");
  };

  const handleDeleteModel = async () => {
    if (!deleteModelPath) return;
    try {
      await fetch("/api/brain/models", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleteModelPath }),
      });
      addLog(`Model deleted: ${deleteModelPath}`);
      if (activeModelPath === deleteModelPath) {
        setActiveModelPath(null);
        localStorage.removeItem("humind_active_model_path");
      }
      const res = await fetch("/api/brain/models");
      const data = await res.json();
      setBrainModels(data.models || []);
    } catch (err) {
      addLog(`Delete failed: ${err}`);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteModelPath(null);
    }
  };

  const handleSetActiveModel = (path: string) => {
    setActiveModelPath(path);
    localStorage.setItem("humind_active_model_path", path);
    addLog(`Active inference model updated to: ${path}`);
  };

  const handleLoadModelConfig = (model: any) => {
    if (model.metadata) {
      const meta = model.metadata;
      const tc = meta.training_config || {};
      if (tc.epochs_requested) setBrainEpochs(tc.epochs_requested);
      if (tc.learning_rate) setBrainLR(tc.learning_rate);
      if (tc.early_stop_patience) setBrainPatience(tc.early_stop_patience);
      if (tc.batch_size) setBrainBatchSize(tc.batch_size);
      if (tc.weight_decay) setBrainWeightDecay(tc.weight_decay);
      addLog(
        `Loaded configuration from saved model: ${model.variant || model.architecture}`,
      );
    } else {
      addLog(`No config metadata available in this model file.`);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 relative">
      {/* ─── HEADER BAR ─── */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-2/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">HuMind</h3>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Distraction Prediction Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Contextual tip */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg max-w-md">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300/90 leading-tight truncate">
              {tipText}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-white/5 bg-surface-3 hover:bg-surface-3/80 shrink-0"
            title="Training Best Practices"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex min-h-0 w-full relative">
        {/* ─── LEFT PANEL (Accordion structure) ─── */}
        <div
          style={{ width: 380 }}
          className="shrink-0 flex flex-col min-h-0 bg-surface-1/40 h-full border-r border-white/5 relative"
        >
          {/* Main View Switcher placed at the very top of the sidebar to save main canvas height */}
          <div className="p-3 border-b border-white/5 bg-surface-2/30 shrink-0">
            <div className="flex bg-surface-3/60 rounded-xl p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setMainView("monitor")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                  mainView === "monitor"
                    ? "bg-primary text-background shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                Training Monitor
              </button>
              <button
                type="button"
                onClick={() => setMainView("compare")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                  mainView === "compare"
                    ? "bg-primary text-background shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Model Comparison
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <Accordion
              type="single"
              collapsible
              defaultValue="config"
              className="w-full"
            >
              {/* Section 1: Model Configuration */}
              <AccordionItem value="config" className="border-b border-white/5">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.02] text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground/60" />
                    <span>Training Configuration</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1 space-y-4">
                  {/* Architecture */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Architecture
                    </label>
                    <div className="flex bg-surface-3/30 rounded-lg p-3 border border-white/5 items-center justify-between">
                      <span className="text-xs font-bold text-foreground">MULTIMODAL (CNN + LSTM)</span>
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/20 text-[10px] font-bold border-0">ACTIVE</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 leading-tight">
                      Fuses 1D vehicle signal telemetry (MF4) with driver visual behavior features (AVI).
                    </p>
                  </div>

                  {/* Training Mode */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Training Mode
                    </label>
                    <div className="flex bg-surface-3 rounded-lg p-1 border border-border/30">
                      <button
                        type="button"
                        onClick={() => setTrainingMode("fresh")}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                          trainingMode === "fresh"
                            ? "bg-primary text-background shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        START FRESH
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainingMode("finetune")}
                        disabled={!activeModelPath}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-md transition-all disabled:opacity-40 disabled:pointer-events-none",
                          trainingMode === "finetune"
                            ? "bg-primary text-background shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        FINE-TUNE ACTIVE
                      </button>
                    </div>
                    {!activeModelPath ? (
                      <p className="text-[10px] text-amber-500/80 leading-tight">
                        Select a model in the database to enable Fine-tuning.
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/60 leading-tight">
                        {trainingMode === "finetune"
                          ? "Resuming training using the weights of the selected active model."
                          : "Starting training a brand new model from scratch."}
                      </p>
                    )}
                  </div>

                  {/* Reset to Recommended */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Hyperparameters
                    </span>
                    <button
                      onClick={handleResetDefaults}
                      disabled={isDefaultConfig}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-all",
                        isDefaultConfig
                          ? "text-muted-foreground/30 cursor-default"
                          : "text-primary hover:bg-primary/10 cursor-pointer",
                      )}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Recommended
                    </button>
                  </div>

                  {/* Hyperparameters Form fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <ParamTooltip label="Epochs" tooltipKey="epochs">
                      <input
                        type="number"
                        value={brainEpochs}
                        onChange={(e) =>
                          setBrainEpochs(parseInt(e.target.value) || 150)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                    <ParamTooltip label="Learning Rate" tooltipKey="lr">
                      <input
                        type="text"
                        value={brainLR}
                        onChange={(e) =>
                          setBrainLR(parseFloat(e.target.value) || 0.001)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                    <ParamTooltip label="Early Stop Patience" tooltipKey="patience">
                      <input
                        type="number"
                        value={brainPatience}
                        onChange={(e) =>
                          setBrainPatience(parseInt(e.target.value) || 20)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                    <ParamTooltip label="Batch Size" tooltipKey="batchSize">
                      <input
                        type="number"
                        value={brainBatchSize}
                        onChange={(e) =>
                          setBrainBatchSize(parseInt(e.target.value) || 32)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                    <ParamTooltip label="Weight Decay" tooltipKey="weightDecay">
                      <input
                        type="text"
                        value={brainWeightDecay}
                        onChange={(e) =>
                          setBrainWeightDecay(parseFloat(e.target.value) || 0.0001)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                    <ParamTooltip label="Video FPS" tooltipKey="videoFps">
                      <input
                        type="number"
                        value={brainVideoFps}
                        onChange={(e) =>
                          setBrainVideoFps(parseInt(e.target.value) || 5)
                        }
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </ParamTooltip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section 2: Projects manager */}
              <AccordionItem value="projects" className="border-b border-white/5">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.02] text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground/60" />
                    <span>Training Projects</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
                  {/* Add Folder input */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={projectInput}
                      onChange={(e) => setProjectInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
                      placeholder="Add project directory..."
                      className="flex-1 bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleAddProject}
                      disabled={scanning || !projectInput.trim()}
                      className="h-8.5 w-8.5 rounded-lg border-white/10 bg-surface-3 shrink-0"
                      title="Add Project"
                    >
                      {scanning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Hierarchical project groups tree */}
                  {projectGroups.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {projectGroups.map((group) => {
                        const totalParticipants = group.participants?.length || 0;
                        const selectedInGroup = group.participants
                          ? group.participants.filter((p) =>
                              selectedProjects.includes(p.path),
                            ).length
                          : 0;
                        const allSelected = selectedInGroup === totalParticipants;
                        const noneSelected = selectedInGroup === 0;
                        const radioValue = allSelected
                          ? "all"
                          : noneSelected
                            ? "none"
                            : "mixed";

                        return (
                          <div
                            key={group.path}
                            className="border border-white/5 bg-surface-3/15 rounded-xl overflow-hidden"
                          >
                            {/* Folder header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-surface-3/30 border-b border-white/5">
                              <div
                                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                onClick={() => toggleGroupExpanded(group.path)}
                              >
                                {group.isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                )}
                                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span
                                  className="text-xs font-bold text-foreground truncate"
                                  title={group.path}
                                >
                                  {group.name}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRemoveProject(group.path)}
                                className="text-muted-foreground/45 hover:text-red-400 p-1"
                                title="Remove folder"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Options and list */}
                            <div className="p-2.5 space-y-2">
                              {/* All/None Radio selector */}
                              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.03]">
                                <span className="text-xs text-muted-foreground/70 font-semibold">
                                  Include:
                                </span>
                                <RadioGroup
                                  value={radioValue}
                                  onValueChange={(val) =>
                                    handleGroupRadioChange(group.path, val)
                                  }
                                  className="flex items-center gap-3"
                                >
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem
                                      value="all"
                                      id={`all-${group.path}`}
                                      className="h-3.5 w-3.5 border-white/20"
                                    />
                                    <Label
                                      htmlFor={`all-${group.path}`}
                                      className="text-xs font-semibold cursor-pointer text-foreground/80"
                                    >
                                      All
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem
                                      value="none"
                                      id={`none-${group.path}`}
                                      className="h-3.5 w-3.5 border-white/20"
                                    />
                                    <Label
                                      htmlFor={`none-${group.path}`}
                                      className="text-xs font-semibold cursor-pointer text-foreground/80"
                                    >
                                      None
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </div>

                              {/* Participant Sub-items */}
                              {group.isExpanded && (
                                <div className="space-y-1 pl-1">
                                  {(group.participants || []).map((p) => {
                                    const isSelected = selectedProjects.includes(p.path);
                                    return (
                                      <div
                                        key={p.path}
                                        className={cn(
                                          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
                                          isSelected
                                            ? "bg-primary/5 hover:bg-primary/10"
                                            : "hover:bg-surface-3/40",
                                        )}
                                        onClick={() => toggleParticipantSelection(p.path)}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleParticipantSelection(p.path)}
                                          className="w-3.5 h-3.5 accent-primary rounded shrink-0 cursor-pointer"
                                        />
                                        <span className="flex-1 truncate text-foreground/80 font-medium">
                                          {p.name}
                                        </span>
                                        {(p.mf4s > 0 || p.avis > 0) && (
                                          <span className="text-[10px] font-bold text-muted-foreground/40 font-mono shrink-0">
                                            {p.mf4s > 0 ? `${p.mf4s}M` : ""} {p.avis > 0 ? `${p.avis}V` : ""}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/40 italic bg-surface-3/10 rounded-xl border border-dashed border-white/5">
                      <FolderOpen className="w-4 h-4 mr-2 opacity-50" />
                      No projects added yet
                    </div>
                  )}

                  {selectedProjects.length > 0 && (
                    <div className="flex items-center justify-between text-xs font-semibold px-1 pt-1">
                      <span className="text-primary">
                        {selectedProjects.length} participant(s) selected
                      </span>
                      <span className="text-muted-foreground/50">
                        {projectGroups.reduce(
                          (acc, g) => acc + g.participants.length,
                          0,
                        )}{" "}
                        total
                      </span>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Section 3: Saved Models */}
              <AccordionItem value="models" className="border-b border-white/5">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.02] text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground/60" />
                    <span>Saved Models Database</span>
                    <span className="text-xs text-muted-foreground/40 ml-auto font-mono bg-white/5 px-2 py-0.5 rounded-full">
                      {brainModels.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1 space-y-2">
                  {Object.keys(groupedModels).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(groupedModels).map(([groupName, models]) => (
                        <div key={groupName} className="space-y-2">
                          <div className="flex items-center gap-1.5 px-1 pt-1">
                            <Brain className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                            <span className="text-xs font-bold text-foreground/90 truncate">{groupName}</span>
                            <Badge className="bg-white/5 text-muted-foreground/60 text-[9px] font-bold py-0.5 px-1.5 border-0 rounded-full ml-auto font-mono shrink-0">
                              {models.length} ver
                            </Badge>
                          </div>

                          <div className="pl-3.5 border-l border-white/5 space-y-2 ml-2">
                            {models.map((m: any) => {
                              const isExpanded = expandedModel === m.path;
                              const isModelActive = activeModelPath === m.path;
                              const trainedProjects = getModelTrainingPaths(m);

                              const bestAcc =
                                m.metadata?.best_val_acc ??
                                m.metadata?.history?.acc?.slice(-1)[0] ??
                                null;
                              const epochsTrained =
                                m.metadata?.epochs_completed ??
                                m.metadata?.training_config?.epochs_completed ??
                                m.metadata?.history?.acc?.length ??
                                null;

                              const timestampStr = m.metadata?.training_config?.timestamp
                                ? new Date(m.metadata.training_config.timestamp).toLocaleDateString() + " " + new Date(m.metadata.training_config.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : "Original Build";

                              return (
                                <div
                                  key={m.path}
                                  className={cn(
                                    "border rounded-xl overflow-hidden transition-all relative",
                                    isModelActive
                                      ? "bg-primary/[0.03] border-primary/30 shadow-sm"
                                      : "bg-surface-3/10 border-white/5 hover:border-white/10",
                                  )}
                                >
                                  <div className="p-2.5 space-y-2 relative group/card">
                                    <div className="flex items-start gap-2">
                                      <button
                                        onClick={() => handleSetActiveModel(m.path)}
                                        className={cn(
                                          "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                                          isModelActive
                                            ? "bg-primary border-primary text-background"
                                            : "border-white/20 hover:border-primary/50",
                                        )}
                                        title={
                                          isModelActive
                                            ? "Active inference model"
                                            : "Set as active inference model"
                                        }
                                      >
                                        {isModelActive && (
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        )}
                                      </button>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] uppercase font-bold bg-white/5 border-0 px-1 py-0.5 rounded"
                                          >
                                            {m.architecture}
                                          </Badge>
                                          {isModelActive && (
                                            <Badge className="text-[9px] font-bold bg-emerald-500 text-background px-1.5 py-0.5 rounded">
                                              ACTIVE
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground/60 font-semibold truncate mt-1">
                                          {timestampStr}
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="text-[10px] font-semibold text-muted-foreground/60 block font-mono">
                                          {m.size_mb} MB
                                        </span>
                                      </div>
                                    </div>

                                    {(bestAcc !== null || epochsTrained !== null) && (
                                      <div className="flex items-center gap-3 text-[10px] bg-surface-3/30 px-2 py-1 rounded-md">
                                        {bestAcc !== null && (
                                          <span>
                                            Val Acc:{" "}
                                            <span className="font-bold text-amber-400">
                                              {(bestAcc * 100).toFixed(1)}%
                                            </span>
                                          </span>
                                        )}
                                        {epochsTrained !== null && (
                                          <span className="text-muted-foreground/60 font-medium">
                                            Epochs:{" "}
                                            <span className="font-semibold text-foreground/80">
                                              {epochsTrained}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.03]">
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleLoadModelConfig(m)}
                                          className="h-6 px-1.5 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md flex items-center gap-1"
                                          title="Load configuration parameters to sidebar"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          <span>Load Config</span>
                                        </Button>
                                        {trainedProjects.length > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              setExpandedModel(
                                                isExpanded ? null : m.path,
                                              )
                                            }
                                            className="h-6 px-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-md flex items-center gap-0.5"
                                          >
                                            <span>Provenance</span>
                                            <ChevronRight
                                              className={cn(
                                                "w-3 h-3 transition-transform",
                                                isExpanded && "rotate-90",
                                              )}
                                            />
                                          </Button>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setDeleteModelPath(m.path);
                                          setDeleteConfirmOpen(true);
                                        }}
                                        className="opacity-0 group-hover/card:opacity-100 text-muted-foreground/50 hover:text-red-400 transition-opacity p-1"
                                        title="Delete model file"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded && trainedProjects.length > 0 && (
                                    <div className="px-2 pb-2 border-t border-white/5 pt-1.5 bg-black/10 space-y-1 min-w-0 w-full overflow-hidden">
                                      <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wider block">
                                        Training Datasets
                                      </span>
                                      <div className="space-y-0.5 max-h-20 overflow-y-auto custom-scrollbar min-w-0 w-full">
                                        {trainedProjects.map((p, pi) => (
                                          <div
                                            key={pi}
                                            className="relative w-full min-w-0 overflow-hidden pr-6 group/path"
                                            title={p}
                                          >
                                            <div className="text-[10px] text-muted-foreground/75 font-mono truncate py-0.5 hover:text-foreground select-all">
                                              {p}
                                            </div>
                                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#131313] via-[#131313]/90 to-transparent pointer-events-none group-hover/path:from-surface-3/50 transition-colors" />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/40 italic bg-surface-3/10 rounded-xl border border-dashed border-white/5">
                      No saved models database
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ScrollArea>

          {/* Persistent Action Panel at Bottom */}
          <div className="p-4 border-t border-white/5 bg-surface-2/30 shrink-0">
            {!brainTraining ? (
              <button
                onClick={handleStartTraining}
                disabled={selectedProjects.length === 0}
                className="w-full bg-primary text-background rounded-xl py-3.5 font-bold flex items-center justify-center gap-2.5 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:scale-100 text-xs uppercase tracking-wider cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Start Training
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl py-3.5 font-bold flex items-center justify-center gap-2.5 shadow-lg hover:bg-red-500/20 transition-all text-xs uppercase tracking-wider cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" /> Stop Training
              </button>
            )}
          </div>
        </div>

        {/* ─── MAIN PANEL ─── */}
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">

          {mainView === "monitor" ? (
            <>
              {/* Phase Stepper */}
              {(brainTraining || brainPhase === "done") && (
                <div className="p-3 border-b border-white/5 bg-surface-2/30 shrink-0">
                  <PhaseStepper currentPhase={brainPhase} />
                </div>
              )}

              {/* Dataset Stats Card */}
              {brainDatasetStats && (
                <div className="p-3 border-b border-white/5 bg-surface-2/20 shrink-0">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-primary/60" />
                      <span className="font-bold text-muted-foreground uppercase text-[10px]">Dataset:</span>
                    </div>
                    <span className="font-bold text-foreground">{brainDatasetStats.total_windows} windows</span>
                    <div className="h-3 w-px bg-white/10" />
                    <span className="text-muted-foreground/70">Train: <span className="text-foreground font-semibold">{brainDatasetStats.train_windows}</span></span>
                    <span className="text-muted-foreground/70">Val: <span className="text-foreground font-semibold">{brainDatasetStats.val_windows}</span></span>
                    <div className="h-3 w-px bg-white/10" />
                    <span className="text-muted-foreground/70">
                      Balance: <span className={cn("font-bold", brainDatasetStats.class_balance_ratio > 0.2 && brainDatasetStats.class_balance_ratio < 0.8 ? "text-emerald-400" : "text-amber-400")}>
                        {(brainDatasetStats.class_balance_ratio * 100).toFixed(0)}% positive
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Stats Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-2/30 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Phase:
                  </span>
                  <span className="text-xs text-primary font-bold uppercase">
                    {brainPhase || "Idle"}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">
                      Accuracy
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {brainEpochData.length > 0
                        ? (brainEpochData[brainEpochData.length - 1].acc * 100).toFixed(1) + "%"
                        : "--"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/5" />
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">
                      Loss
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {brainEpochData.length > 0
                        ? brainEpochData[brainEpochData.length - 1].loss?.toFixed(4)
                        : "--"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/5" />
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">
                      Best Val Acc
                    </span>
                    <span className="text-base font-extrabold text-amber-400 tabular-nums">
                      {bestEpoch >= 0 && brainEpochData[bestEpoch]
                        ? (
                            (brainEpochData[bestEpoch].val_acc ??
                              brainEpochData[bestEpoch].acc) * 100
                          ).toFixed(1) + "%"
                        : "--"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/5" />
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">
                      F1
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {brainEpochData.length > 0 && brainEpochData[brainEpochData.length - 1].val_f1 != null
                        ? (brainEpochData[brainEpochData.length - 1].val_f1 * 100).toFixed(1) + "%"
                        : "--"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/5" />
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">
                      Epoch
                    </span>
                    <span className="text-base font-extrabold text-foreground tabular-nums">
                      {brainEpochData.length > 0
                        ? `${brainEpochData.length}/${brainEpochs}`
                        : "--"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Epoch Table and Chart */}
              <div className="flex-1 flex flex-col min-h-0 bg-surface-2/10 backdrop-blur-md border-t border-white/5">
                {/* Graph View (Top Half) */}
                {brainEpochData.length > 0 && (
                  <div className="h-64 shrink-0 border-b border-white/5 p-4 pl-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={brainEpochData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorValLoss" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorValAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="epoch" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "#1a1a1a", borderColor: "#333", fontSize: "12px", borderRadius: "8px" }}
                          itemStyle={{ color: "#fff" }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", color: "#aaa" }} />
                        <Area type="monotone" name="Train Loss" dataKey="loss" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorLoss)" dot={false} isAnimationActive={false} />
                        <Area type="monotone" name="Val Loss" dataKey="val_loss" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorValLoss)" dot={false} isAnimationActive={false} />
                        <Area type="monotone" name="Val Acc" dataKey="val_acc" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValAcc)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Table View (Bottom Half) */}
                <div
                  ref={epochScrollRef}
                  className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar"
                >
                  {brainEpochData.length > 0 ? (
                    <table className="w-full text-xs font-mono">
                      <thead className="sticky top-0 bg-surface-2/95 backdrop-blur z-10 border-b border-border/30">
                        <tr className="text-xs text-muted-foreground uppercase border-b border-border/20">
                          <th className="text-left py-3 pl-4 pr-4 font-bold">Epoch</th>
                          <th className="text-right py-3 pr-4 font-bold">Loss</th>
                          <th className="text-right py-3 pr-4 font-bold">Acc</th>
                          <th className="text-right py-3 pr-4 font-bold">Val Loss</th>
                          <th className="text-right py-3 pr-4 font-bold">Val Acc</th>
                          <th className="text-right py-3 pr-4 font-bold">F1</th>
                          <th className="text-right py-3 pr-4 font-bold">LR</th>
                          <th className="text-right py-3 pr-4 font-bold">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brainEpochData.map((d: any, i: number) => {
                          const isBest = i === bestEpoch;
                          return (
                            <tr
                              key={i}
                              className={cn(
                                "border-b border-white/[0.03] transition-colors",
                                isBest
                                  ? "bg-amber-500/[0.06] border-l-2 border-l-amber-400"
                                  : "hover:bg-white/[0.02]",
                              )}
                            >
                              <td
                                className={cn(
                                  "py-2.5 pl-4 pr-4 font-bold",
                                  isBest ? "text-amber-400" : "text-primary",
                                )}
                              >
                                {d.epoch}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-muted-foreground/80 tabular-nums">
                                {d.loss?.toFixed(4)}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">
                                {d.acc != null ? (d.acc * 100).toFixed(1) + "%" : "-"}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-muted-foreground/80 tabular-nums">
                                {d.val_loss?.toFixed(4) || "-"}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 pr-4 text-right tabular-nums font-bold",
                                  isBest ? "text-amber-400" : "text-foreground",
                                )}
                              >
                                {d.val_acc != null ? (d.val_acc * 100).toFixed(1) + "%" : "-"}
                                {isBest && (
                                  <span className="ml-2 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                    ★ BEST
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-foreground/70 tabular-nums">
                                {d.val_f1 != null ? (d.val_f1 * 100).toFixed(1) + "%" : "-"}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-muted-foreground/60 tabular-nums text-[10px]">
                                {d.lr != null ? d.lr.toExponential(1) : "-"}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-muted-foreground/60 tabular-nums text-[10px]">
                                {d.epoch_time != null ? `${d.epoch_time}s` : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : brainTraining ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 select-none p-8 text-center animate-in fade-in duration-500">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                          {brainPhase === "extracting" ? "Extracting Video Features" : brainPhase === "building" ? "Building Multimodal Dataset" : "Initializing Neural Network"}
                        </p>
                        <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed">
                          {brainPhase === "extracting" ? "Parsing vehicle MF4 logs and decoding camera frames..." : brainPhase === "building" ? "Aligning temporal sequence windows and windowing..." : "Loading weights and preparing model optimizer..."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 select-none max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
                      {/* Top Welcome Title */}
                      <div className="text-center space-y-3">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                          <Brain className="w-7 h-7 animate-pulse" />
                        </div>
                        <h4 className="text-xl font-extrabold text-foreground uppercase tracking-widest">
                          Multimodal Distraction Engine
                        </h4>
                        <p className="text-sm text-muted-foreground/85 max-w-lg mx-auto leading-relaxed">
                          Fuses synchronized driver telemetry and video streams using a CNN+LSTM network to detect distraction, fatigue, and eyes-off-road events.
                        </p>
                      </div>

                      {/* Three Cards (Input Streams & Target) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                        {/* Card 1: Telemetry */}
                        <div className="bg-surface-2/40 border border-white/5 p-5 rounded-2xl space-y-4 flex flex-col justify-between hover:bg-surface-2/60 transition-all duration-300">
                          <div className="space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <Activity className="w-5 h-5" />
                            </div>
                            <h5 className="text-sm font-bold text-foreground uppercase tracking-wider">
                              Telemetry Stream
                            </h5>
                            <p className="text-xs text-muted-foreground/85 leading-relaxed">
                              Synchronized 1D vehicle logs including velocity, steering angle, accelerator input, and ADAS alarms parsed from MF4 files.
                            </p>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest font-mono text-emerald-500/60 font-semibold bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 w-fit">
                            1D Signals
                          </div>
                        </div>

                        {/* Card 2: Driver Video */}
                        <div className="bg-surface-2/40 border border-white/5 p-5 rounded-2xl space-y-4 flex flex-col justify-between hover:bg-surface-2/60 transition-all duration-300">
                          <div className="space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                              <Film className="w-5 h-5" />
                            </div>
                            <h5 className="text-sm font-bold text-foreground uppercase tracking-wider">
                              Behavioral Video
                            </h5>
                            <p className="text-xs text-muted-foreground/85 leading-relaxed">
                              2D frontal driver facial landmarks, eye closure status, gaze coordinates, and yaw/pitch/roll pose computed from video streams.
                            </p>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest font-mono text-blue-500/60 font-semibold bg-blue-500/5 px-2.5 py-1 rounded border border-blue-500/10 w-fit">
                            2D AVI frames
                          </div>
                        </div>

                        {/* Card 3: Marks annotation */}
                        <div className="bg-surface-2/40 border border-white/5 p-5 rounded-2xl space-y-4 flex flex-col justify-between hover:bg-surface-2/60 transition-all duration-300">
                          <div className="space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                              <Target className="w-5 h-5" />
                            </div>
                            <h5 className="text-sm font-bold text-foreground uppercase tracking-wider">
                              Ground Truth Labels
                            </h5>
                            <p className="text-xs text-muted-foreground/85 leading-relaxed">
                              User annotations defined inside the project's marks.json mapping instants of drowsiness, looking away, or distraction.
                            </p>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest font-mono text-amber-500/60 font-semibold bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/10 w-fit">
                            marks.json
                          </div>
                        </div>
                      </div>

                      {/* Instructions / CTA Banner */}
                      <div className="w-full flex items-center gap-4 bg-primary/5 border border-primary/10 p-5 rounded-2xl">
                        <Sparkles className="w-6 h-6 text-primary shrink-0 animate-pulse" />
                        <div className="text-left space-y-1">
                          <h6 className="text-sm font-extrabold text-primary uppercase tracking-wider">Ready to Train?</h6>
                          <p className="text-xs text-muted-foreground/85">
                            Select the target participant folders in the configuration panel on the left, then click <strong className="text-primary font-bold">Start Training</strong> to begin modeling.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress bar overlay */}
                {brainTraining && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.min(brainPhaseProgress * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ─── MODEL COMPARISON VIEW ─── */
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-2/10 backdrop-blur-md">
              {allModelsSorted.length > 0 ? (
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-surface-2/95 backdrop-blur z-10 border-b border-white/5">
                    <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                      <th className="text-left py-3 pl-4 pr-3 font-bold w-8"></th>
                      <th className="text-left py-3 pr-4 font-bold">Date</th>
                      <th className="text-left py-3 pr-4 font-bold">Arch</th>
                      <th className="text-right py-3 pr-4 font-bold">Val Acc</th>
                      <th className="text-right py-3 pr-4 font-bold">Val Loss</th>
                      <th className="text-right py-3 pr-4 font-bold">F1</th>
                      <th className="text-right py-3 pr-4 font-bold">Epochs</th>
                      <th className="text-right py-3 pr-4 font-bold">Projects</th>
                      <th className="text-right py-3 pr-4 font-bold">Size</th>
                      <th className="text-center py-3 pr-4 font-bold">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allModelsSorted.map((m: any, idx: number) => {
                      const isModelActive = activeModelPath === m.path;
                      const bestAcc =
                        m.metadata?.best_val_acc ??
                        m.metadata?.dataset_stats?.class_balance_ratio ??
                        m.metadata?.history?.val_acc?.slice(-1)[0] ??
                        null;
                      const bestValLoss = m.metadata?.best_val_loss ?? null;
                      const bestF1 = m.metadata?.history?.val_f1?.slice(-1)[0] ?? null;
                      const epochsTrained =
                        m.metadata?.training_config?.epochs_completed ??
                        m.metadata?.history?.acc?.length ??
                        null;
                      const trainedProjects = getModelTrainingPaths(m);
                      const accHistory = m.metadata?.history?.val_acc || [];

                      const timestampStr = m.metadata?.training_config?.timestamp
                        ? new Date(m.metadata.training_config.timestamp).toLocaleDateString() + " " + new Date(m.metadata.training_config.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "—";

                      return (
                        <tr
                          key={m.path}
                          className={cn(
                            "border-b border-white/[0.03] transition-colors cursor-pointer",
                            isModelActive
                              ? "bg-primary/[0.04] border-l-2 border-l-primary"
                              : "hover:bg-white/[0.02]",
                            idx === 0 && "bg-emerald-500/[0.03]",
                          )}
                          onClick={() => handleSetActiveModel(m.path)}
                        >
                          <td className="py-2.5 pl-4 pr-3">
                            <div className="flex items-center gap-1">
                              {isModelActive && (
                                <Badge className="text-[8px] font-bold bg-emerald-500 text-background px-1 py-0 rounded">
                                  ●
                                </Badge>
                              )}
                              {idx === 0 && (
                                <Badge className="text-[8px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20 px-1 py-0 rounded">
                                  NEW
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-foreground/80 font-medium text-[11px]">
                            {timestampStr}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase font-bold bg-white/5 border-0 px-1 py-0.5 rounded"
                            >
                              {m.architecture}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-bold text-amber-400 tabular-nums">
                            {bestAcc != null ? (bestAcc * 100).toFixed(1) + "%" : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground/80 tabular-nums">
                            {bestValLoss != null ? bestValLoss.toFixed(4) : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-foreground/70 tabular-nums">
                            {bestF1 != null ? (bestF1 * 100).toFixed(1) + "%" : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-foreground/80 tabular-nums">
                            {epochsTrained ?? "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground/70 tabular-nums">
                            {trainedProjects.length}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground/60 tabular-nums">
                            {m.size_mb} MB
                          </td>
                          <td className="py-2.5 pr-4 flex items-center justify-center">
                            {accHistory.length > 1 ? (
                              <MiniSparkline
                                data={accHistory}
                                color="hsl(var(--primary))"
                                width={60}
                                height={20}
                              />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 select-none">
                  <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center">
                    <GitCompare className="w-6 h-6 stroke-[1.2] text-foreground/20" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-sm tracking-[0.2em] font-extrabold uppercase text-foreground/20">
                      No Models
                    </p>
                    <p className="text-xs uppercase tracking-wider opacity-40 font-mono text-muted-foreground">
                      Train your first model to compare results
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer bar */}
          <div className="p-3 bg-surface-2 border-t border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    brainTraining ? "bg-primary animate-pulse" : "bg-[#2da44e]",
                  )}
                />
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  {brainTraining ? "Training in progress" : "Ready"}
                </span>
              </div>
              {selectedProjects.length > 0 && (
                <>
                  <div className="h-4 w-px bg-white/5" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    {selectedProjects.length} participant
                    {selectedProjects.length !== 1 ? "s" : ""} selected
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs font-bold uppercase bg-white/5 border-0 rounded"
              >
                {brainArchitecture}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs font-bold uppercase bg-white/5 border-0 rounded"
              >
                LR {brainLR}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BEST PRACTICES RIGHT DRAWER ─── */}
      <Drawer open={guideOpen} onOpenChange={setGuideOpen} direction="right">
        <DrawerContent className="h-full w-full max-w-md border-l border-white/10 bg-surface-2/95 backdrop-blur-xl">
          <DrawerHeader className="border-b border-white/5 pb-4">
            <DrawerTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
              Training Best Practices
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground mt-1">
              Refine your distraction prediction ML models using these core
              dataset and training principles.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Architecture Info Card */}
            <div className="bg-surface-3/30 border border-white/5 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Multimodal Architecture
                </span>
              </div>
              <div className="text-xs text-muted-foreground/80 leading-relaxed space-y-2">
                <p>
                  <strong>MULTIMODAL (CNN + LSTM)</strong> fuses 1D vehicle
                  signals with deep visual features extracted from driver video
                  frames (AVI). By combining signal variance with eye gaze and
                  posture features, it is much more accurate and robust.
                </p>
              </div>
            </div>

            {BEST_PRACTICES.map((bp, i) => (
              <div
                key={i}
                className="bg-surface-3/20 border border-white/5 rounded-xl p-4 hover:bg-surface-3/45 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <bp.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    {bp.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  {bp.text}
                </p>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Model Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent className="bg-surface-2 border border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete the
              model files and its training history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-3 hover:bg-surface-3/80 text-foreground border-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              className="bg-red-500 hover:bg-red-600 text-white border-0"
            >
              Delete Model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Training Confirmation Dialog */}
      <AlertDialog
        open={stopConfirmOpen}
        onOpenChange={setStopConfirmOpen}
      >
        <AlertDialogContent className="bg-surface-2 border border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Training?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to abort the current training session? The model will save its progress up to the last completed epoch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-3 border-white/10 hover:bg-surface-3/80 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-red-500/80 hover:bg-red-500 text-white border-0">
              Stop Training
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
