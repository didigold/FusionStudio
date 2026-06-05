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
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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

// ─── Hyperparameter Presets ───
const PRESETS = [
  {
    id: "fast",
    label: "Fast Prototype",
    icon: Zap,
    epochs: 20,
    lr: 0.01,
    patience: 5,
    desc: "Quick sanity check on small data",
  },
  {
    id: "balanced",
    label: "Balanced",
    icon: Target,
    epochs: 100,
    lr: 0.001,
    patience: 15,
    desc: "Standard production training",
  },
  {
    id: "deep",
    label: "Deep Training",
    icon: Sparkles,
    epochs: 300,
    lr: 0.0001,
    patience: 30,
    desc: "Maximum accuracy, large datasets",
  },
] as const;

// ─── Training Phases ───
const PHASES = ["extracting", "building", "training", "done"] as const;
const PHASE_LABELS: Record<string, string> = {
  extracting: "Extracting",
  building: "Building Dataset",
  training: "Training",
  done: "Complete",
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
    text: "Watch the gap between training accuracy and validation accuracy. If train acc reaches 99% but val acc is stuck at 75%, the model is memorizing rather than learning. Remedies: add more projects, use the Balanced preset, or increase patience for early stopping.",
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
    text: "Start with 0.001 (Balanced preset). If loss oscillates wildly, reduce to 0.0001. If training is too slow and loss barely moves, try 0.01 for initial exploration.",
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

// ─── Main Component ───
export default function HuMindTab() {
  const {
    brainModels,
    setBrainModels,
    brainHistory,
    setBrainHistory,
    brainArchitecture,
    setBrainArchitecture,
    brainModelName,
    setBrainModelName,
    brainEpochs,
    setBrainEpochs,
    brainLR,
    setBrainLR,
    brainPatience,
    setBrainPatience,
    brainTraining,
    setBrainTraining,
    brainPhase,
    brainPhaseProgress,
    brainEpochData,
    clearBrainEpochData,
    addLog,
  } = useAppStore();

  useBrainTrainingWS();

  const [scanning, setScanning] = useState(false);
  const [projectInput, setProjectInput] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>("balanced");
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteModelPath, setDeleteModelPath] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [tipText, setTipText] = useState("");
  const epochScrollRef = useRef<HTMLDivElement>(null);

  // Drag Resizing State and Logic
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Constrain sidebar width between 280px and 600px
      const newWidth = Math.max(280, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
  };

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

  // Selected active model path (for inference selection)
  const [activeModelPath, setActiveModelPath] = useState<string | null>(() => {
    return localStorage.getItem("humind_active_model_path");
  });

  // Sync projects to localStorage
  useEffect(() => {
    localStorage.setItem(
      "humind_project_groups",
      JSON.stringify(projectGroups),
    );
  }, [projectGroups]);

  useEffect(() => {
    localStorage.setItem(
      "humind_selected_projects",
      JSON.stringify(selectedProjects),
    );
  }, [selectedProjects]);

  // Load models and history on mount
  useEffect(() => {
    fetch("/api/brain/models")
      .then((r) => r.json())
      .then((d) => setBrainModels(d.models || []));
    fetch("/api/brain/history")
      .then((r) => r.json())
      .then((d) => setBrainHistory(d));
  }, []);

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
        // Root directory containing sub-projects
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
        // Automatically check all participants of the newly added project
        setSelectedProjects((prev) => [
          ...prev,
          ...projects.map((p: any) => p.path),
        ]);
        addLog(
          `Added project folder: ${name} with ${projects.length} participant(s)`,
        );
      } else {
        // Single project folder itself
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

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setBrainEpochs(preset.epochs);
    setBrainLR(preset.lr);
    setBrainPatience(preset.patience);
    setActivePreset(preset.id);
  };

  const handleStartTraining = async () => {
    if (selectedProjects.length === 0) {
      addLog("Select at least one project.");
      return;
    }
    setBrainTraining(true);
    clearBrainEpochData();
    addLog(
      `Starting ${brainArchitecture} training: ${brainModelName} on ${selectedProjects.length} project(s)`,
    );

    try {
      const endpoint =
        brainArchitecture === "legacy"
          ? "/api/brain/train/legacy"
          : "/api/brain/train/multimodal";
      const body: any = {
        root_folders: selectedProjects,
        model_name: brainModelName,
        epochs: brainEpochs,
        lr: brainLR,
      };
      if (brainArchitecture === "multimodal") body.patience = brainPatience;

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

  const handleStop = async () => {
    await fetch("/api/brain/stop", { method: "POST" });
    addLog("Stop requested.");
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
      // Refresh models list
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

  // Set the chosen model as active for predictions
  const handleSetActiveModel = (path: string) => {
    setActiveModelPath(path);
    localStorage.setItem("humind_active_model_path", path);
    addLog(`Active inference model updated to: ${path}`);
  };

  // Pre-fill sidebar controls with model parameters from metadata
  const handleLoadModelConfig = (model: any) => {
    if (model.metadata) {
      const meta = model.metadata;
      if (meta.name) setBrainModelName(meta.name);
      if (meta.epochs) setBrainEpochs(meta.epochs);
      if (meta.lr) setBrainLR(meta.lr);
      if (meta.patience) setBrainPatience(meta.patience);
      if (model.architecture) setBrainArchitecture(model.architecture as any);
      setActivePreset(null);
      addLog(
        `Loaded configuration parameters from saved model variant: ${model.variant || model.architecture}`,
      );
    } else {
      addLog(`No config metadata available in this model file.`);
    }
  };

  // Determine project statuses relative to model training data
  const modelTrainedPaths = useMemo(() => {
    const paths = new Set<string>();
    brainModels.forEach((m: any) => {
      getModelTrainingPaths(m).forEach((p) => paths.add(p));
    });
    // Also from history
    if (brainHistory?.mlp?.projects)
      brainHistory.mlp.projects.forEach((p: string) => paths.add(p));
    if (brainHistory?.multimodal?.projects)
      brainHistory.multimodal.projects.forEach((p: string) => paths.add(p));
    return paths;
  }, [brainModels, brainHistory]);

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
          {/* Drawer trigger button */}
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
          style={{ width: sidebarWidth }}
          className="shrink-0 flex flex-col min-h-0 bg-surface-1/40 h-full border-r border-white/5 relative"
        >
          <ScrollArea className="flex-1">
            <Accordion
              type="multiple"
              defaultValue={["config", "projects"]}
              className="w-full"
            >
              {/* Section 1: Model Configuration */}
              <AccordionItem value="config" className="border-b border-white/5">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.02] text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground/60" />
                    <span>Model Configuration</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1 space-y-4">
                  {/* Architecture */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Architecture
                    </label>
                    <div className="flex bg-surface-3 rounded-lg p-1 border border-border/30">
                      <button
                        onClick={() => setBrainArchitecture("multimodal")}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                          brainArchitecture === "multimodal"
                            ? "bg-primary text-background shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        MULTIMODAL
                      </button>
                      <button
                        onClick={() => setBrainArchitecture("legacy")}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
                          brainArchitecture === "legacy"
                            ? "bg-primary text-background shadow-md"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        LEGACY (MLP)
                      </button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Training Presets
                    </label>
                    <div className="flex gap-1.5">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          title={preset.desc}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border",
                            activePreset === preset.id
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-surface-3/50 text-muted-foreground/60 border-white/5 hover:text-foreground hover:border-white/10",
                          )}
                        >
                          <preset.icon className="w-3.5 h-3.5" />
                          {preset.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hyperparameters Form fields */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={brainModelName}
                        onChange={(e) => setBrainModelName(e.target.value)}
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                        Epochs
                      </label>
                      <input
                        type="number"
                        value={brainEpochs}
                        onChange={(e) => {
                          setBrainEpochs(parseInt(e.target.value) || 100);
                          setActivePreset(null);
                        }}
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                        Learning Rate
                      </label>
                      <input
                        type="text"
                        value={brainLR}
                        onChange={(e) => {
                          setBrainLR(parseFloat(e.target.value) || 0.001);
                          setActivePreset(null);
                        }}
                        className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                      />
                    </div>
                    {brainArchitecture === "multimodal" && (
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">
                          Early Stopping Patience
                        </label>
                        <input
                          type="number"
                          value={brainPatience}
                          onChange={(e) => {
                            setBrainPatience(parseInt(e.target.value) || 15);
                            setActivePreset(null);
                          }}
                          className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/30 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section 2: Projects manager */}
              <AccordionItem
                value="projects"
                className="border-b border-white/5"
              >
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
                        const totalParticipants =
                          group.participants?.length || 0;
                        const selectedInGroup = group.participants
                          ? group.participants.filter((p) =>
                              selectedProjects.includes(p.path),
                            ).length
                          : 0;
                        const allSelected =
                          selectedInGroup === totalParticipants;
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
                                  {group.participants.map((p) => {
                                    const isSelected =
                                      selectedProjects.includes(p.path);
                                    const isTrained = modelTrainedPaths.has(
                                      p.path,
                                    );
                                    return (
                                      <div
                                        key={p.path}
                                        className={cn(
                                          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
                                          isSelected
                                            ? "bg-primary/5 hover:bg-primary/10"
                                            : "hover:bg-surface-3/40",
                                        )}
                                        onClick={() =>
                                          toggleParticipantSelection(p.path)
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() =>
                                            toggleParticipantSelection(p.path)
                                          }
                                          className="w-3.5 h-3.5 accent-primary rounded shrink-0 cursor-pointer"
                                        />
                                        {/* Status bullet */}
                                        <div
                                          className={cn(
                                            "w-2 h-2 rounded-full shrink-0",
                                            isTrained
                                              ? "bg-emerald-500"
                                              : "bg-amber-500",
                                          )}
                                          title={
                                            isTrained
                                              ? "Included in trained models"
                                              : "Pending (not trained)"
                                          }
                                        />
                                        <span className="flex-1 truncate text-foreground/80 font-medium">
                                          {p.name}
                                        </span>
                                        {(p.mf4s > 0 || p.avis > 0) && (
                                          <span className="text-[10px] font-bold text-muted-foreground/40 font-mono shrink-0">
                                            {p.mf4s > 0 ? `${p.mf4s}M` : ""}{" "}
                                            {p.avis > 0 ? `${p.avis}V` : ""}
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
                  {brainModels.length > 0 ? (
                    <div className="space-y-2">
                      {brainModels.map((m: any, i: number) => {
                        const isExpanded = expandedModel === m.path;
                        const isModelActive = activeModelPath === m.path;
                        const trainedProjects = getModelTrainingPaths(m);

                        // Try to pull metrics from metadata
                        const bestAcc =
                          m.metadata?.best_val_acc ??
                          m.metadata?.history?.acc?.slice(-1)[0] ??
                          null;
                        const epochsTrained =
                          m.metadata?.epochs_completed ??
                          m.metadata?.history?.acc?.length ??
                          null;

                        return (
                          <div
                            key={i}
                            className={cn(
                              "border rounded-xl overflow-hidden transition-all",
                              isModelActive
                                ? "bg-primary/[0.03] border-primary/30 shadow-sm"
                                : "bg-surface-3/20 border-white/5 hover:border-white/10",
                            )}
                          >
                            {/* Card Content */}
                            <div className="p-3 space-y-2 relative group/card">
                              {/* Header info */}
                              <div className="flex items-start gap-2.5">
                                {/* Active Select Toggle */}
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
                                      className="text-[10px] uppercase font-bold bg-white/5 border-0 px-1.5 py-0.5 rounded"
                                    >
                                      {m.architecture}
                                    </Badge>
                                    {isModelActive && (
                                      <Badge className="text-[10px] font-bold bg-emerald-500 text-background px-1.5 py-0.5 rounded">
                                        ACTIVE
                                      </Badge>
                                    )}
                                  </div>
                                  <h4
                                    className="text-xs font-bold text-foreground/90 truncate mt-1"
                                    title={m.variant || m.architecture}
                                  >
                                    {m.variant || m.architecture}
                                  </h4>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-xs font-semibold text-muted-foreground/60 block font-mono">
                                    {m.size_mb} MB
                                  </span>
                                </div>
                              </div>

                              {/* Summary performance metrics if present */}
                              {(bestAcc !== null || epochsTrained !== null) && (
                                <div className="flex items-center gap-4 text-xs bg-surface-3/30 px-2 py-1 rounded-md">
                                  {bestAcc !== null && (
                                    <span>
                                      Acc:{" "}
                                      <span className="font-bold text-amber-400">
                                        {(bestAcc * 100).toFixed(1)}%
                                      </span>
                                    </span>
                                  )}
                                  {epochsTrained !== null && (
                                    <span className="text-muted-foreground/60">
                                      Epochs:{" "}
                                      <span className="font-semibold text-foreground/80">
                                        {epochsTrained}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Card Action buttons (hover visible) */}
                              <div className="flex items-center justify-between pt-1 border-t border-white/[0.03]">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleLoadModelConfig(m)}
                                    className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-md flex items-center gap-1"
                                    title="Load configuration parameters to sidebar"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
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
                                      className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md flex items-center gap-0.5"
                                    >
                                      <span>Provenance</span>
                                      <ChevronRight
                                        className={cn(
                                          "w-3.5 h-3.5 transition-transform",
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
                                  className="opacity-0 group-hover/card:opacity-100 text-muted-foreground/50 hover:text-red-400 transition-opacity p-1.5"
                                  title="Delete model file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Provenance training projects details */}
                            {isExpanded && trainedProjects.length > 0 && (
                              <div className="px-3 pb-3 border-t border-white/5 pt-2 bg-black/10 space-y-1.5 min-w-0 w-full overflow-hidden">
                                <span className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider block">
                                  Training Datasets
                                </span>
                                <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar min-w-0 w-full">
                                  {trainedProjects.map((p, pi) => (
                                    <div
                                      key={pi}
                                      className="relative w-full min-w-0 overflow-hidden pr-6 group/path"
                                      title={p}
                                    >
                                      <div className="text-xs text-muted-foreground/75 font-mono truncate py-0.5 hover:text-foreground select-all">
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
                  ) : (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/40 italic bg-surface-3/10 rounded-xl border border-dashed border-white/5">
                      No saved models database
                    </div>
                  )}

                  {/* History summary */}
                  {brainHistory &&
                    (brainHistory.mlp || brainHistory.multimodal) && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                        {brainHistory.mlp && (
                          <div className="flex items-center gap-2 text-xs">
                            <Cpu className="w-4 h-4 text-primary/50" />
                            <span className="text-muted-foreground">
                              MLP:{" "}
                              <span className="text-foreground font-bold">
                                {brainHistory.mlp.name}
                              </span>{" "}
                              ({brainHistory.mlp.projects?.length || 0}{" "}
                              projects)
                            </span>
                          </div>
                        )}
                        {brainHistory.multimodal && (
                          <div className="flex items-center gap-2 text-xs">
                            <Zap className="w-4 h-4 text-primary/50" />
                            <span className="text-muted-foreground">
                              Multi:{" "}
                              <span className="text-foreground font-bold">
                                {brainHistory.multimodal.epochs} epochs
                              </span>
                              , best accuracy:{" "}
                              <span className="text-foreground font-bold">
                                {brainHistory.multimodal.best_acc != null
                                  ? (
                                      brainHistory.multimodal.best_acc * 100
                                    ).toFixed(1) + "%"
                                  : "-"}
                              </span>
                            </span>
                          </div>
                        )}
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
                disabled
                className="w-full bg-surface-3 text-muted-foreground rounded-xl py-3.5 font-bold flex items-center justify-center gap-2.5 shadow-lg text-xs uppercase tracking-wider opacity-50 cursor-not-allowed"
              >
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />{" "}
                Training...
              </button>
            )}
          </div>
        </div>

        {/* Drag handle divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 bg-white/5 hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center shrink-0 group select-none relative z-25 h-full"
        >
          <div className="flex h-4 w-3 items-center justify-center rounded-sm border border-white/10 bg-surface-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        </div>

        {/* ─── MAIN PANEL (Live Monitor) ─── */}
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
          {/* Phase Stepper */}
          {(brainTraining || brainPhase === "done") && (
            <div className="p-3 border-b border-white/5 bg-surface-2/30 shrink-0">
              <PhaseStepper currentPhase={brainPhase} />
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
                    ? (
                        brainEpochData[brainEpochData.length - 1].acc * 100
                      ).toFixed(1) + "%"
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

          {/* Epoch Table */}
          <div className="flex-1 relative min-h-0 bg-[#0a0a0a]">
            <div
              ref={epochScrollRef}
              className="w-full h-full overflow-y-auto custom-scrollbar"
            >
              {brainEpochData.length > 0 ? (
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
                    <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                      <th className="text-left py-3 pl-4 pr-4 font-bold">
                        Epoch
                      </th>
                      <th className="text-right py-3 pr-4 font-bold">Loss</th>
                      <th className="text-right py-3 pr-4 font-bold">Acc</th>
                      <th className="text-right py-3 pr-4 font-bold">
                        Val Loss
                      </th>
                      <th className="text-right py-3 pr-4 font-bold">
                        Val Acc
                      </th>
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
                            {d.acc != null
                              ? (d.acc * 100).toFixed(1) + "%"
                              : "-"}
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
                            {d.val_acc != null
                              ? (d.val_acc * 100).toFixed(1) + "%"
                              : "-"}
                            {isBest && (
                              <span className="ml-2 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                ★ BEST
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 select-none">
                  <div className="absolute w-[180px] h-[180px] rounded-full bg-white/[0.02] blur-[40px] pointer-events-none" />
                  <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center animate-pulse-sync animate-pulse">
                    <TrendingDown className="w-6 h-6 stroke-[1.2] text-foreground/20" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-sm tracking-[0.2em] font-extrabold uppercase text-foreground/20">
                      Training Monitor
                    </p>
                    <p className="text-xs uppercase tracking-wider opacity-40 font-mono text-muted-foreground">
                      Start training to see epoch data
                    </p>
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

          {/* Practices content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* MLP vs Multimodal Architecture Info Card */}
            <div className="bg-surface-3/30 border border-white/5 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  MLP vs Multimodal Architectures
                </span>
              </div>
              <div className="text-xs text-muted-foreground/80 leading-relaxed space-y-2">
                <p>
                  <strong>LEGACY (MLP Classifier)</strong> trains strictly on 1D
                  driver telemetry (head angles, movement speed, variance)
                  parsed from vehicle signals (MF4). It is very fast and
                  lightweight but lacks camera visual behavior tracking.
                </p>
                <p>
                  <strong>MULTIMODAL (CNN + LSTM)</strong> fuses 1D vehicle
                  signals with deep visual features extracted from driver video
                  frames (AVI). By combining signal variance with eye gaze and
                  posture features, it is much more accurate and robust but
                  takes longer to train.
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

      {/* ─── DELETE MODEL DIALOG ─── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[340px] border border-white/10 bg-surface-2/80 backdrop-blur-xl p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
            <Trash2 className="w-5 h-5" />
          </div>
          <AlertDialogHeader className="items-center text-center gap-1.5">
            <AlertDialogTitle className="text-base font-bold text-white uppercase tracking-wider">
              Delete Model?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-white/70 max-w-[280px]">
              This will permanently delete the saved model file. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
            <AlertDialogCancel className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5 cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
