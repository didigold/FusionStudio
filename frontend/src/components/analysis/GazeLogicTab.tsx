import { useState, useEffect, useRef } from "react";
import { motion, useScroll } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/analysis/SearchableSelect";
import { FolderBrowser } from "@/components/analysis/FolderBrowser";
import {
  Save,
  Download,
  Play,
  AlertCircle,
  Clock,
  HelpCircle,
  BugPlay,
  Activity,
  Menu,
  Filter,
  RefreshCw,
  X,
  Gauge,
  Plus,
  Trash2,
  FolderOpen,
  Lock,
  Settings,
  Box,
  Square,
  Drama,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { reportingApi } from "@/api/reportingApi";
import { toast } from "sonner";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const caseIdsMap: Record<string, string> = {
  "Long Distraction (NDT)": "Case IDs: D1-D9",
  "Long Distraction (DT)": "Case IDs: D10-D15",
  "Short Distraction (NDT)":
    "Case IDs: D16-D19, D28, D29-D42 (Includes Phone Use)",
  "Short Distraction (DT)": "Case IDs: D20-D27",
  Microsleep: "Case IDs: F1",
  Sleep: "Case IDs: F2",
  Drowsiness: "Case IDs: F3",
  "Unresponsive driver": "Case IDs: F4, F5",
  "High Speed": "Case IDs: ADDW High Speed",
  "Low Speed": "Case IDs: ADDW Low Speed",
};

interface SignalConfig {
  name: string;
  checked: boolean;
  operator: string;
  threshold: number | string;
  alias: string;
}

interface PassConfig {
  signal: string;
  value1: number;
  operator1: string;
  value2: number;
  operator2: string;
  mask: number;
}

interface GaugeConfig {
  min: number;
  max: number;
  ticks?: number[];
  ticks_count?: number;
}

const DEFAULT_GAUGE_RULES: Record<string, GaugeConfig> = {
  "Long Distraction (NDT)": { min: 0, max: 10 },
  "Long Distraction (DT)": { min: 0, max: 10 },
  "Short Distraction (NDT)": { min: 0, max: 10 },
  "Short Distraction (DT)": { min: 0, max: 10 },
  Microsleep: { min: 0, max: 10 },
  Sleep: { min: 0, max: 10 },
  Drowsiness: { min: 0, max: 10 },
  "Unresponsive driver": { min: 0, max: 10 },
  "High Speed": { min: 0, max: 10 },
  "Low Speed": { min: 0, max: 10 },
};

const fetchingValues = new Set<string>();

export function GazeLogicTab() {
  const {
    analysisSelectedFile,
    analysisCheckedFiles,
    analysisResults,
    analysisOem,
    analysisVehicle,
    analysisTrack,
    analysisEngineer,
    analysisAnalyst,
    analysisSourcePath,

    // Store states
    protocol,
    setProtocol,
    signalsConfig,
    setSignalsConfig,
    passCriteria,
    setPassCriteria,
    gaugeRules,
    setGaugeRules,
    loadedFiles,
    setLoadedFiles,
    importedConfigName,
    gaugeRulesPath,
    setGaugeRulesPath,
    knownGaugeRulesPaths,
    setKnownGaugeRulesPaths,
    audioMinFreq,
    audioMaxFreq,
    audioThreshold,
    analysisBatchRunning,
    setAnalysisBatchRunning,

    // Store actions
    autoLoadChannelsAndMerge,
    importConfigJSON,
    exportConfig,
    handleUnmountConfig,
    addLog,
  } = useAppStore();

  // Categories list based on active protocol
  const categoriesList =
    protocol === "Euro NCAP"
      ? [
          "Long Distraction (NDT)",
          "Long Distraction (DT)",
          "Short Distraction (NDT)",
          "Short Distraction (DT)",
          "Microsleep",
          "Sleep",
          "Drowsiness",
          "Unresponsive driver",
        ]
      : ["High Speed", "Low Speed"];

  const [activeCategory, setActiveCategory] = useState<string>(
    categoriesList[0],
  );

  // Sync active category on protocol changes
  useEffect(() => {
    setActiveCategory(
      protocol === "Euro NCAP" ? "Long Distraction (NDT)" : "High Speed",
    );
  }, [protocol]);

  // Filter signals state
  const [filterQuery, setFilterQuery] = useState("");

  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Batch generation progress states
  const wsRef = useRef<WebSocket | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: tableContainerRef });

  // Modals / Dropdowns
  const [gaugeRulesModalOpen, setGaugeRulesModalOpen] = useState(false);

  // Gauge Config Item definition for the list
  interface ConfigItem {
    id: string;
    name: string;
    path: string;
    rules: Record<string, any>;
    isDefault: boolean;
  }

  const [modalConfigs, setModalConfigs] = useState<ConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("default");
  const [editingRules, setEditingRules] = useState<Record<string, any>>({});
  const [isModified, setIsModified] = useState(false);
  const [showConfirmSwitch, setShowConfirmSwitch] = useState<string | null>(
    null,
  );

  const [newConfigName, setNewConfigName] = useState("");
  const [showNewConfigPrompt, setShowNewConfigPrompt] = useState(false);
  const [newConfigProjectBrowserOpen, setNewConfigProjectBrowserOpen] =
    useState(false);
  const [tempProjectPath, setTempProjectPath] = useState("");
  const [resetConfirmType, setResetConfirmType] = useState<
    "config" | "gauge" | "case" | null
  >(null);

  // Load configs in the modal
  const loadModalConfigs = async () => {
    // Load the actual default gauge_rules.json from disk
    let defaultRules: Record<string, GaugeConfig> = DEFAULT_GAUGE_RULES;
    try {
      const defaultRes = await fetch("/api/reporting/gauge_rules");
      if (defaultRes.ok) {
        const diskRules = await defaultRes.json();
        if (diskRules && typeof diskRules === "object" && Object.keys(diskRules).length > 0) {
          // Merge with DEFAULT_GAUGE_RULES keys so all categories are present
          const merged: Record<string, GaugeConfig> = { ...DEFAULT_GAUGE_RULES };
          for (const [key, rule] of Object.entries(diskRules)) {
            if (rule && typeof rule === "object") {
              merged[key] = {
                min: typeof (rule as any).min === "number" ? (rule as any).min : 0,
                max: typeof (rule as any).max === "number" ? (rule as any).max : 10,
                ticks: Array.isArray((rule as any).ticks) ? (rule as any).ticks.map(Number) : undefined,
                ticks_count: typeof (rule as any).ticks_count === "number" ? (rule as any).ticks_count : undefined,
              };
            }
          }
          defaultRules = merged;
        }
      }
    } catch (err) {
      console.error("Failed to load default gauge_rules.json from disk:", err);
    }

    const list: ConfigItem[] = [
      {
        id: "default",
        name: "Default",
        path: "config/gauge_rules.json",
        rules: defaultRules,
        isDefault: true,
      },
    ];

    for (const path of knownGaugeRulesPaths) {
      try {
        const res = await fetch("/api/reporting/gauge_rules/read_file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: path }),
        });
        const data = await res.json();
        if (data.rules) {
          list.push({
            id: path,
            name: path.split(/[/\\]/).pop() || path,
            path: path,
            rules: data.rules,
            isDefault: false,
          });
        }
      } catch (err) {
        console.error(`Failed to load config at ${path}:`, err);
      }
    }

    setModalConfigs(list);

    // Select the currently active one
    const activeId = gaugeRulesPath || "default";
    setSelectedConfigId(activeId);

    const activeConfig = list.find((c) => c.id === activeId);
    if (activeConfig) {
      const initializedRules = JSON.parse(JSON.stringify(activeConfig.rules));
      for (const [_cat, rule] of Object.entries(initializedRules)) {
        if (rule && typeof rule === "object") {
          const r = rule as any;
          if (r.ticks_count === undefined) {
            if (Array.isArray(r.ticks)) {
              r.ticks_count = Math.max(0, r.ticks.length - 2);
            } else {
              const minVal = parseFloat(r.min) || 0;
              const maxVal = parseFloat(r.max) || 10;
              const diff = maxVal - minVal;
              r.ticks_count = diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;
            }
          }
        }
      }
      setEditingRules(initializedRules);
    } else {
      const initializedDefaultRules = JSON.parse(
        JSON.stringify(DEFAULT_GAUGE_RULES),
      );
      for (const [_cat, rule] of Object.entries(initializedDefaultRules)) {
        const r = rule as any;
        const minVal = r.min ?? 0;
        const maxVal = r.max ?? 10;
        const diff = maxVal - minVal;
        r.ticks_count = diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;
      }
      setEditingRules(initializedDefaultRules);
    }
    setIsModified(false);
  };

  // Reload when modal opens or path states change
  useEffect(() => {
    if (gaugeRulesModalOpen) {
      loadModalConfigs();
    }
  }, [gaugeRulesModalOpen, knownGaugeRulesPaths, gaugeRulesPath]);

  const handleSelectConfig = (configId: string) => {
    if (configId === selectedConfigId) return;
    if (isModified) {
      setShowConfirmSwitch(configId);
    } else {
      performSwitch(configId);
    }
  };

  const performSwitch = (configId: string) => {
    setSelectedConfigId(configId);
    const config = modalConfigs.find((c) => c.id === configId);
    if (config) {
      const initializedRules = JSON.parse(JSON.stringify(config.rules));
      for (const [_cat, rule] of Object.entries(initializedRules)) {
        if (rule && typeof rule === "object") {
          const r = rule as any;
          if (r.ticks_count === undefined) {
            if (Array.isArray(r.ticks)) {
              r.ticks_count = Math.max(0, r.ticks.length - 2);
            } else {
              const minVal = parseFloat(r.min) || 0;
              const maxVal = parseFloat(r.max) || 10;
              const diff = maxVal - minVal;
              r.ticks_count = diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;
            }
          }
        }
      }
      setEditingRules(initializedRules);
    }
    setIsModified(false);
    setShowConfirmSwitch(null);
  };

  const handleFieldChange = (cat: string, field: string, val: any) => {
    const updated = { ...editingRules };
    if (!updated[cat]) {
      updated[cat] = { min: 0, max: 10 };
    }
    updated[cat] = { ...updated[cat], [field]: val };
    setEditingRules(updated);
    setIsModified(true);
  };

  const buildCleanRules = (rulesToClean: Record<string, any>) => {
    const cleanRules: Record<string, any> = {};
    for (const [cat, rule] of Object.entries(rulesToClean)) {
      const minVal = parseFloat(rule.min) || 0;
      const maxVal = parseFloat(rule.max) || 10;

      // Calculate Ticks Count
      let ticksCount = rule.ticks_count;
      if (ticksCount === undefined) {
        if (Array.isArray(rule.ticks)) {
          ticksCount = Math.max(0, rule.ticks.length - 2);
        } else {
          const diff = maxVal - minVal;
          ticksCount = diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;
        }
      }

      // Generate ticks array
      const generatedTicks = [minVal];
      const step = (maxVal - minVal) / (ticksCount + 1);
      for (let i = 1; i <= ticksCount; i++) {
        generatedTicks.push(parseFloat((minVal + step * i).toFixed(4)));
      }
      generatedTicks.push(maxVal);

      cleanRules[cat] = {
        min: minVal,
        max: maxVal,
        ticks_count: ticksCount,
        ticks: generatedTicks,
      };
    }
    return cleanRules;
  };

  const handleResetRowToDefault = (cat: string) => {
    const defaults = DEFAULT_GAUGE_RULES[cat] || {
      min: 0,
      max: 10,
    };
    const updated = { ...editingRules };

    const minVal = defaults.min;
    const maxVal = defaults.max;
    const diff = maxVal - minVal;
    const ticksCount = diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;

    updated[cat] = {
      min: minVal,
      max: maxVal,
      ticks_count: ticksCount,
    };
    setEditingRules(updated);
    setIsModified(true);
    toast.info(`Reset ${cat} values to template defaults.`);
  };

  const handleSaveActiveConfig = async () => {
    if (selectedConfigId === "default") return;

    const toastId = toast.loading("Saving configuration to file...");
    try {
      const cleanRules = buildCleanRules(editingRules);

      const res = await fetch("/api/reporting/gauge_rules/write_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: selectedConfigId,
          rules: cleanRules,
        }),
      });
      const data = await res.json();

      if (data.status === "success") {
        toast.dismiss(toastId);
        toast.success("Configuration saved successfully!");
        setIsModified(false);

        setModalConfigs((prev) =>
          prev.map((c) =>
            c.id === selectedConfigId ? { ...c, rules: cleanRules } : c,
          ),
        );
      } else {
        toast.dismiss(toastId);
        toast.error(`Error saving file: ${data.error}`);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to save configuration.");
      console.error(err);
    }
  };

  const handleRevertConfig = () => {
    setEditingRules(JSON.parse(JSON.stringify(DEFAULT_GAUGE_RULES)));
    setIsModified(true);
    toast.info("Reverted table values to default template. Save to persist.");
  };

  const handleExportGaugeConfig = async () => {
    const suggestedName =
      selectedConfigId === "default"
        ? `gauge_rules_default.json`
        : selectedConfigId.split(/[/\\]/).pop() || `gauge_rules.json`;

    const cleanRules = buildCleanRules(editingRules);

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "JSON Files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(cleanRules, null, 2));
        await writable.close();
        toast.success("Configuration exported successfully");
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(cleanRules, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", suggestedName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Configuration exported successfully");
  };

  const handleDeleteConfig = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPaths = knownGaugeRulesPaths.filter((p) => p !== path);
    setKnownGaugeRulesPaths(newPaths);

    if (selectedConfigId === path) {
      setSelectedConfigId("default");
      setEditingRules(JSON.parse(JSON.stringify(DEFAULT_GAUGE_RULES)));
      setIsModified(false);
    }
    setModalConfigs((prev) => prev.filter((c) => c.id !== path));
    toast.success("Configuration removed from list.");
  };

  const handleApplyLimits = () => {
    const selected = modalConfigs.find((c) => c.id === selectedConfigId);
    if (selected) {
      const activeRules = buildCleanRules(editingRules);

      setGaugeRules(activeRules);
      setGaugeRulesPath(
        selectedConfigId === "default" ? null : selectedConfigId,
      );
      setGaugeRulesModalOpen(false);
      toast.success(`Applied gauge limits: ${selected.name}`);
    }
  };

  const handleCloseModal = () => {
    if (isModified) {
      setShowConfirmSwitch("close_modal");
    } else {
      setGaugeRulesModalOpen(false);
    }
  };

  const handleImportGaugeConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== "object") {
          toast.error("Invalid gauge rules format.");
          return;
        }

        const projectDir = useAppStore.getState().analysisSourcePath;
        const destPath = projectDir
          ? `${projectDir}/${file.name}`
          : `config/${file.name}`;

        const writeRes = await fetch("/api/reporting/gauge_rules/write_file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: destPath, rules: parsed }),
        });
        const writeData = await writeRes.json();
        if (writeData.status === "success") {
          const currentPaths = [...knownGaugeRulesPaths];
          if (!currentPaths.includes(destPath)) {
            const newPaths = [...currentPaths, destPath];
            setKnownGaugeRulesPaths(newPaths);
            toast.success(`Imported and saved to: ${destPath}`);
          } else {
            toast.success(`Updated config at: ${destPath}`);
          }
          await loadModalConfigs();
          setSelectedConfigId(destPath);
          setEditingRules(parsed);
          setIsModified(false);
        } else {
          toast.error(`Failed to write file to disk: ${writeData.error}`);
        }
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleCreateNewConfig = async () => {
    if (!newConfigName.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    const state = useAppStore.getState();
    let targetDir = state.analysisSourcePath;

    if (!targetDir) {
      if (!tempProjectPath.trim()) {
        toast.error(
          "A project folder is required. Please select the project directory (e.g. the folder containing P01, P02, etc.).",
        );
        setNewConfigProjectBrowserOpen(true);
        return;
      }

      const success = await state.confirmPromptedPath(tempProjectPath);
      if (!success) {
        toast.error(
          "Failed to load the selected project folder. Make sure it is a valid project directory.",
        );
        return;
      }
      targetDir = tempProjectPath;
    }

    let filename = newConfigName.trim();
    if (!filename.toLowerCase().endsWith(".json")) {
      filename += ".json";
    }

    const destPath = `${targetDir}/${filename}`;

    try {
      const existRes = await fetch("/api/reporting/gauge_rules/exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: destPath }),
      });
      const existData = await existRes.json();
      if (existData.exists) {
        toast.error(
          "A configuration file with this name already exists in the destination folder.",
        );
        return;
      }

      const writeRes = await fetch("/api/reporting/gauge_rules/write_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: destPath,
          rules: DEFAULT_GAUGE_RULES,
        }),
      });
      const writeData = await writeRes.json();
      if (writeData.status === "success") {
        const currentPaths = [...knownGaugeRulesPaths];
        if (!currentPaths.includes(destPath)) {
          setKnownGaugeRulesPaths([...currentPaths, destPath]);
        }

        toast.success(`Created new configuration: ${destPath}`);
        setShowNewConfigPrompt(false);
        setNewConfigName("");
        setTempProjectPath("");

        await loadModalConfigs();
        setSelectedConfigId(destPath);
        setEditingRules(JSON.parse(JSON.stringify(DEFAULT_GAUGE_RULES)));
        setIsModified(false);
      } else {
        toast.error(`Failed to create config: ${writeData.error}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create configuration file.");
    }
  };

  // File selector states
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const [allParticipantMf4s, setAllParticipantMf4s] = useState<string[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  // Unique signal values cache keyed by "filePath::signalName"
  const [signalValuesCache, setSignalValuesCache] = useState<
    Record<string, (number | string)[]>
  >({});
  // Ref to read cache inside effects without adding it to the dep array
  const signalValuesCacheRef = useRef(signalValuesCache);
  signalValuesCacheRef.current = signalValuesCache;

  // Sync participant files whenever analysisResults changes
  useEffect(() => {
    if (!analysisResults || analysisResults.length === 0) {
      setAllParticipantMf4s([]);
      return;
    }
    const firstParticipant = analysisResults.find(
      (r: any) => r.type === "participant",
    );
    if (!firstParticipant) {
      setAllParticipantMf4s([]);
      return;
    }
    const getMf4Files = (node: any): string[] => {
      let files: string[] = [];
      if (
        node.type === "file" &&
        node.path.toLowerCase().endsWith(".mf4") &&
        !node.path.toLowerCase().includes("tracking")
      ) {
        files.push(node.path);
      }
      if (node.children) {
        for (const child of node.children) {
          files = files.concat(getMf4Files(child));
        }
      }
      return files;
    };
    setAllParticipantMf4s(getMf4Files(firstParticipant));
  }, [analysisResults]);

  // Load backend gauge rules on mount — only if no custom gaugeRulesPath is active
  useEffect(() => {
    // If the user already has a custom gauge file selected, don't overwrite it
    if (gaugeRulesPath) return;
    reportingApi
      .getGaugeRules()
      .then((res) => {
        if (res.data && Object.keys(res.data).length > 0) {
          const rules = { ...DEFAULT_GAUGE_RULES };
          Object.keys(res.data).forEach((key) => {
            if (res.data[key]) {
              rules[key] = {
                min: res.data[key].min ?? 0,
                max: res.data[key].max ?? 10,
                ticks: Array.isArray(res.data[key].ticks) ? res.data[key].ticks.map(Number) : undefined,
                ticks_count: typeof res.data[key].ticks_count === 'number' ? res.data[key].ticks_count : undefined,
              };
            }
          });
          setGaugeRules(rules);
        }
      })
      .catch((err) => console.error("Error loading gauge rules:", err));
  }, [setGaugeRules, gaugeRulesPath]);

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target?.result as string;
      await importConfigJSON(fileContent, file.name);
    };
    reader.readAsText(file);
  };

  const fetchSignalValues = async (filePath: string, signalName: string) => {
    const cacheKey = `${filePath}::${signalName}`;
    if (fetchingValues.has(cacheKey)) return;
    fetchingValues.add(cacheKey);
    try {
      const res = await fetch("/api/analysis/signal_unique_values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath, channel_name: signalName }),
      });
      const data = await res.json();
      if (data.values && Array.isArray(data.values) && data.values.length > 0) {
        setSignalValuesCache((prev) => ({ ...prev, [cacheKey]: data.values }));
      }
    } catch {
      // Error is caught, will clean up in finally
    } finally {
      fetchingValues.delete(cacheKey);
    }
  };

  // Fetch unique signal values when files are loaded or configuration changes
  useEffect(() => {
    const activeFile = loadedFiles[activeCategory];
    if (!activeFile) return;

    const categorySignals = signalsConfig[activeCategory] || [];
    categorySignals.forEach((sig) => {
      if (sig && sig.name !== "SoundPressure") {
        const cacheKey = `${activeFile}::${sig.name}`;
        if (!signalValuesCacheRef.current[cacheKey] && !fetchingValues.has(cacheKey)) {
          fetchSignalValues(activeFile, sig.name);
        }
      }
    });
  // signalValuesCache intentionally excluded — read via ref to break self-trigger loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, loadedFiles, signalsConfig]);

  const handleSelectFile = async (filePath: string) => {
    setFileSelectorOpen(false);
    const toastId = toast.loading(
      `Loading channels from ${filePath.split(/[/\\]/).pop()}...`,
    );
    try {
      const response = await fetch("/api/analysis/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await response.json();
      if (data.channels && Array.isArray(data.channels)) {
        const names = data.channels.map((ch: any) => ch.name).sort();
        const filteredNames = names.filter(
          (name: string) =>
            name.toLowerCase() !== "t" && name.toLowerCase() !== "time",
        );

        const existingCategoryConfig = signalsConfig[activeCategory] || [];
        const rebuiltList: SignalConfig[] = [
          existingCategoryConfig.find(
            (sig) => sig && sig.name === "SoundPressure",
          ) || {
            name: "SoundPressure",
            checked: true,
            operator: "None",
            threshold: 0.0,
            alias: "SoundPressure",
          },
        ];

        for (const name of filteredNames) {
          if (name === "SoundPressure") continue;
          const existingSig = existingCategoryConfig.find(
            (sig) => sig && sig.name === name,
          );
          if (existingSig) {
            rebuiltList.push(existingSig);
          } else {
            rebuiltList.push({
              name,
              checked: false,
              operator: "None",
              threshold: 0.0,
              alias: name,
            });
          }
        }

        for (const sig of existingCategoryConfig) {
          if (
            sig &&
            sig.name !== "SoundPressure" &&
            !filteredNames.includes(sig.name)
          ) {
            rebuiltList.push(sig);
          }
        }

        const seen = new Set<string>();
        const uniqueRebuiltList: SignalConfig[] = [];
        for (const sig of rebuiltList) {
          if (sig && sig.name && !seen.has(sig.name)) {
            seen.add(sig.name);
            uniqueRebuiltList.push(sig);
          }
        }

        setSignalsConfig({
          ...signalsConfig,
          [activeCategory]: uniqueRebuiltList,
        });
        setLoadedFiles((prev) => ({ ...prev, [activeCategory]: filePath }));
        toast.dismiss(toastId);
        toast.success(`Loaded channels for ${activeCategory}.`);
        // Background: fetch unique threshold values for all non-SoundPressure signals
        rebuiltList
          .filter((s) => s.name !== "SoundPressure")
          .forEach((s) => fetchSignalValues(filePath, s.name));
      } else {
        toast.dismiss(toastId);
        toast.error("Failed to read channels from selected file.");
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Failed to load file channels.");
      console.error(error);
    }
  };

  // Update logic configuration for category signals (using unique name lookup for safe filtering update)
  const updateSignalField = (
    category: string,
    name: string,
    field: keyof SignalConfig,
    value: any,
  ) => {
    const list = [...(signalsConfig[category] || [])];
    const index = list.findIndex((s) => s.name === name);
    if (index !== -1) {
      list[index] = { ...list[index], [field]: value };
    }
    setSignalsConfig({ ...signalsConfig, [category]: list });
  };

  // PASS Criteria Configuration Updates
  const updatePassCriteriaField = (
    category: string,
    field: keyof PassConfig,
    value: any,
  ) => {
    setPassCriteria({
      ...passCriteria,
      [category]: {
        ...(passCriteria[category] || {
          signal: "SoundPressure",
          value1: 3.0,
          operator1: "<",
          value2: 0.0,
          operator2: "None",
          mask: 6.0,
        }),
        [field]: value,
      },
    });
  };


  // Helper to map UI structures to the flat format the backend expects
  const getBackendCategoryConfigs = () => {
    const configs: Record<string, any> = {};
    categoriesList.forEach((cat) => {
      const signalsList = signalsConfig[cat] || [];
      const pass = passCriteria[cat] || {
        signal: "",
        value1: 3.0,
        operator1: "<",
        value2: 0.0,
        operator2: "None",
        mask: 6.0,
      };

      const signalsMap: Record<string, any> = {};
      signalsList.forEach((sig) => {
        if (sig && sig.name) {
          signalsMap[sig.name] = {
            checked: !!sig.checked,
            operator: sig.operator || "None",
            threshold:
              typeof sig.threshold === "number" ||
              typeof sig.threshold === "string"
                ? sig.threshold
                : 0.0,
            alias: sig.alias || sig.name,
          };
        }
      });

      configs[cat] = {
        signals: signalsMap,
        pass_signal_name: pass.signal,
        mask_start: pass.mask,
        operator1: pass.operator1,
        value1: pass.value1,
        operator2: pass.operator2,
        value2: pass.value2,
      };
    });
    return configs;
  };

  // Report Preview triggers
  const triggerPreview = async () => {
    if (!analysisSelectedFile) {
      toast.error("Please select an MF4 file from the sidebar first");
      return;
    }

    setIsPreviewLoading(true);

    // Open a blank window synchronously on user click to avoid browser popup blockers
    const newWindow = window.open("about:blank", "_blank");

    try {
      const backendConfigs = getBackendCategoryConfigs();
      const res = await reportingApi.gazePreview({
        file_path: analysisSelectedFile,
        protocol,
        metadata: {
          oem_name: analysisOem,
          vehicle: analysisVehicle,
          engineer: analysisEngineer,
          analyst: analysisAnalyst,
          track: analysisTrack,
        },
        category_configs: backendConfigs,
        gauge_rules: gaugeRules,
        micro: {
          min_freq: audioMinFreq,
          max_freq: audioMaxFreq,
          threshold: audioThreshold,
        },
      });

      if (res.data?.status === "success" && res.data?.preview_path) {
        toast.success("Preview report generated successfully!");
        const url = `/api/analysis/media?path=${encodeURIComponent(res.data.preview_path)}`;
        if (newWindow) {
          newWindow.location.href = url;
        }
      } else {
        toast.error(res.data?.message || "Failed to generate preview report");
        if (newWindow) {
          newWindow.close();
        }
      }
    } catch (err) {
      console.error(err);
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        error.response?.data?.message || "Error communicating with server",
      );
      if (newWindow) {
        newWindow.close();
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Batch Report Generation
  const triggerBatchGeneration = async () => {
    if (!analysisCheckedFiles || analysisCheckedFiles.length === 0) {
      toast.error("No files selected in sidebar tree checklist");
      return;
    }

    setAnalysisBatchRunning(true);
    addLog(`[Gaze Logic Batch] Starting report generation for ${analysisCheckedFiles.length} files...`);

    // Connect WebSocket to live logs
    const protocolWs = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocolWs}//${window.location.host}/api/reporting/ws`,
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          addLog(data.message);
        } else if (data.type === "progress_update") {
          addLog(data.message);
        } else if (data.type === "finished") {
          addLog(`[SUCCESS] ${data.message || "Batch generation complete"}`);
          toast.success(data.message || "All reports generated successfully!");
          setAnalysisBatchRunning(false);
          ws.close();
        } else if (data.type === "error") {
          addLog(`[ERROR] ${data.message}`);
          toast.error(`Batch Error: ${data.message}`);
          setAnalysisBatchRunning(false);
          ws.close();
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      setAnalysisBatchRunning(false);
    };

    try {
      const backendConfigs = getBackendCategoryConfigs();
      await reportingApi.gazeGenerate({
        files: analysisCheckedFiles,
        protocol,
        metadata: {
          oem_name: analysisOem,
          vehicle: analysisVehicle,
          engineer: analysisEngineer,
          analyst: analysisAnalyst,
          track: analysisTrack,
        },
        category_configs: backendConfigs,
        gauge_rules: gaugeRules,
        micro: {
          min_freq: audioMinFreq,
          max_freq: audioMaxFreq,
          threshold: audioThreshold,
        },
      });
    } catch (err) {
      console.error(err);
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        error.response?.data?.message || "Failed to start batch generation",
      );
      setAnalysisBatchRunning(false);
      ws.close();
    }
  };

  const stopBatchGeneration = async () => {
    try {
      await reportingApi.stop();
      toast.info("Stopping generation...");
      addLog("[Gaze Logic Batch] Stopping report generation...");
      if (wsRef.current) wsRef.current.close();
      setAnalysisBatchRunning(false);
    } catch {
      toast.error("Failed to request stop");
    }
  };

  const currentSignalsList = signalsConfig[activeCategory] || [];
  const checkedCount = currentSignalsList.filter((s) => s.checked).length;
  const currentPassCriteria = passCriteria[activeCategory] || {
    signal: "SoundPressure",
    value1: 3.0,
    operator1: "<",
    value2: 0.0,
    operator2: "None",
    mask: 6.0,
  };

  // Preview activation: sidebar file selected, active category has an MF4 file loaded, and at least one signal is active
  const isPreviewEnabled =
    !!analysisSelectedFile &&
    !!loadedFiles[activeCategory] &&
    currentSignalsList.some((s) => s.checked) &&
    !isPreviewLoading;

  // Batch run activation: at least one checkbox active in sidebar tree, active category has an MF4 file loaded, and at least one signal is active
  const isBatchEnabled =
    analysisCheckedFiles.length > 0 &&
    !!loadedFiles[activeCategory] &&
    currentSignalsList.some((s) => s.checked);

  // Filter signals list by query string
  const filteredSignals = currentSignalsList.filter((sig) => {
    if (!sig || typeof sig.name !== "string") return false;
    const nameLower = sig.name.toLowerCase();
    const aliasLower =
      typeof sig.alias === "string" ? sig.alias.toLowerCase() : nameLower;
    const queryLower = filterQuery.toLowerCase();
    return nameLower.includes(queryLower) || aliasLower.includes(queryLower);
  });

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-full w-full h-full min-h-0 overflow-hidden bg-surface-2/40">
      <style>{`
        @keyframes marquee-path {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-path {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-path 14s linear infinite;
          animation-play-state: paused;
        }
        .overflow-hidden:hover .animate-marquee-path,
        .animate-marquee-path:hover {
          animation-play-state: running;
        }
        .gaze-table-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
          mask-image: linear-gradient(to bottom, black 0px, black 43px, transparent 43px, black 59px, black calc(100% - 16px), transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 0px, black 43px, transparent 43px, black 59px, black calc(100% - 16px), transparent 100%);
        }
        .gaze-table-container::-webkit-scrollbar {
          display: none;
        }
        .gaze-table-container > div {
          overflow: visible !important;
        }
        .pill-text {
          transition: padding-right 0.2s ease, mask-image 0.2s ease, -webkit-mask-image 0.2s ease;
        }
        .group:hover .pill-text.has-clear {
          padding-right: 18px;
          mask-image: linear-gradient(to right, black calc(100% - 18px), transparent 100%);
          -webkit-mask-image: linear-gradient(to right, black calc(100% - 18px), transparent 100%);
        }
        .pill-clear-btn {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .group:hover .pill-clear-btn {
          opacity: 1;
          pointer-events: auto;
        }
        .group:has(.pill-clear-btn:hover) {
          background-color: rgba(239, 68, 68, 0.15) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
          color: #ef4444 !important;
        }
        .group:has(.pill-clear-btn:hover) svg {
          color: #ef4444 !important;
        }
        .group:has(.pill-clear-btn:hover) .pill-text {
          color: #ef4444 !important;
        }
        .group:has(.pill-clear-btn:hover) .pill-clear-btn {
          color: #ef4444 !important;
        }
      `}</style>

      {/* MAIN CONFIGURATION CARD */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
        {/* MERGED CARD HEADER: Title, Scenario, Filter Bar, & Settings Dropdown */}
        <div className="pb-4 border-b border-white/5 bg-surface-3/95 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 lg:px-6 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-left">
            <div className="flex items-center gap-3">
              {/* Setup Actions Dropdown using GazeTimeTab style trigger button & menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 bg-surface-2 text-foreground border-border rounded-lg hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 bg-popover border-border text-popover-foreground p-1 shadow-md"
                >
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-sm">
                      Protocols
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="bg-popover border-border text-popover-foreground p-1 shadow-md">
                        <DropdownMenuRadioGroup
                          value={protocol}
                          onValueChange={(val) =>
                            setProtocol(val as "Euro NCAP" | "GSR ADDW")
                          }
                        >
                          <DropdownMenuRadioItem
                            value="Euro NCAP"
                            className="text-sm"
                          >
                            Euro NCAP
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="GSR ADDW"
                            className="text-sm"
                          >
                            GSR ADDW
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-sm">
                      Configuration
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="bg-popover border-border text-popover-foreground p-1 shadow-md w-48">
                        <DropdownMenuItem
                          onClick={() =>
                            document
                              .getElementById("import-config-input")
                              ?.click()
                          }
                          className="text-sm gap-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Import JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={exportConfig}
                          className="text-sm gap-2 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" /> Save JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleUnmountConfig}
                          className="text-sm text-red-400 hover:text-red-300 focus:bg-red-500/20 focus:text-red-200 gap-2 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Unmount JSON
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator className="bg-border" />

                  <DropdownMenuItem
                    onClick={() => autoLoadChannelsAndMerge()}
                    className="text-sm gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Auto-Load data
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setGaugeRulesModalOpen(true)}
                    className="text-sm gap-2 cursor-pointer"
                  >
                    <Gauge className="w-3.5 h-3.5" /> Edit Gauge Limits
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-6 w-[1px] bg-border dark:bg-white/10" />
            </div>

            {/* Scenario selector Combobox with Radio buttons */}
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Scenario:
              </span>
              <div className="w-[260px] flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={activeCategory}
                    onChange={setActiveCategory}
                    placeholder="Select Scenario..."
                    items={categoriesList}
                    showRadio={true}
                  />
                </div>
                <HoverCard openDelay={10} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 rounded-full text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64 bg-[#1e1d1c] border border-white/5 text-white p-3 text-xs leading-relaxed text-left rounded-lg shadow-xl">
                    <div className="font-semibold text-primary mb-1">
                      {activeCategory}
                    </div>
                    <div>
                      {caseIdsMap[activeCategory] ||
                        "No cases mapped to this scenario."}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </div>

            {/* Active Configuration Name Badge */}
            <Badge
              variant="outline"
              className={cn(
                "h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-sm font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 justify-center border transition-colors group text-primary border-primary/20",
              )}
              onClick={() =>
                document.getElementById("import-config-input")?.click()
              }
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <div className="relative flex items-center justify-center min-w-0">
                <span
                  className={cn(
                    "pill-text transition-all duration-200 truncate",
                    importedConfigName && "has-clear",
                  )}
                >
                  {importedConfigName || "Default"}
                </span>
                {importedConfigName && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setResetConfirmType("config");
                    }}
                    className="pill-clear-btn flex items-center justify-center text-muted-foreground hover:text-white transition-opacity duration-200"
                    title="Unmount configuration and revert to default"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Badge>

            {/* Active Gauge Limits Badge */}
            <Badge
              variant="outline"
              className={cn(
                "h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-sm font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 justify-center border transition-colors group text-primary border-primary/20",
              )}
              onClick={() => setGaugeRulesModalOpen(true)}
              title={gaugeRulesPath || "Default Gauge Limits"}
            >
              <Gauge className="w-3.5 h-3.5 shrink-0" />
              <div className="relative flex items-center justify-center min-w-0">
                <span
                  className={cn(
                    "pill-text transition-all duration-200 truncate",
                    gaugeRulesPath && "has-clear",
                  )}
                >
                  {gaugeRulesPath
                    ? gaugeRulesPath.split(/[/\\]/).pop() || gaugeRulesPath
                    : "Default"}
                </span>
                {gaugeRulesPath && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setResetConfirmType("gauge");
                    }}
                    className="pill-clear-btn flex items-center justify-center text-muted-foreground hover:text-white transition-opacity duration-200"
                    title="Reset gauge limits to default"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Badge>

            {/* Loaded MF4 File Badge Indicator */}
            <div className="flex items-center">
              {loadedFiles[activeCategory] ? (
                <Badge
                  variant="outline"
                  className="h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-primary border-primary/20 text-sm font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 justify-center group"
                  onClick={() => setFileSelectorOpen(true)}
                  title={loadedFiles[activeCategory]}
                >
                  <Box className="w-3.5 h-3.5 shrink-0" />
                  <div className="relative flex items-center justify-center min-w-0">
                    <span
                      className={cn(
                        "pill-text truncate max-w-[140px] leading-none flex items-center justify-center h-full transition-all duration-200",
                        "has-clear",
                      )}
                    >
                      {loadedFiles[activeCategory].split(/[/\\]/).pop()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setResetConfirmType("case");
                      }}
                      className="pill-clear-btn flex items-center justify-center text-muted-foreground hover:text-white transition-opacity duration-200"
                      title="Unload case file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-primary border-primary/20 text-sm font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 justify-center"
                  onClick={() => setFileSelectorOpen(true)}
                >
                  <Box className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-none flex items-center justify-center h-full">
                    No MF4 Loaded
                  </span>
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 self-end lg:self-auto">
            {/* Filter entry with hover clear 'x' button */}
            <div className="relative flex items-center shrink-0 group">
              <Input
                placeholder="Filter signals..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-9 w-[160px] bg-surface-3 border-white/10 text-sm pl-8 pr-8 rounded-lg placeholder:text-muted-foreground/60"
              />
              <Filter className="w-4 h-4 text-muted-foreground/60 absolute left-2.5 pointer-events-none" />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery("")}
                  className="absolute right-2.5 text-muted-foreground hover:text-white transition-opacity duration-150 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Preview and Run Batch Button Group */}
            <div className="flex flex-row h-9 bg-surface-3 border border-white/10 rounded-lg shadow-xl backdrop-blur-md overflow-hidden">
              <div
                title={
                  !analysisSelectedFile
                    ? "Select a case to preview"
                    : "Preview Report"
                }
                className="h-full flex items-center"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isPreviewEnabled}
                  onClick={triggerPreview}
                  className="h-9 w-9 p-0 rounded-none text-white hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none border-none bg-transparent"
                >
                  {isPreviewLoading ? (
                    <Clock className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <BugPlay className="w-5 h-5 text-primary" />
                  )}
                </Button>
              </div>
              <div className="h-full w-[1px] bg-white/10" />
              {analysisBatchRunning ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 p-0 rounded-none bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse flex items-center justify-center transition-all duration-300"
                      title="Stop Batch"
                    >
                      <Square className="w-4 h-4 fill-white text-white" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-md bg-surface-2 border border-white/10 text-white rounded-2xl shadow-2xl p-6">
                    <AlertDialogHeader className="gap-2">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <AlertDialogTitle className="text-base font-bold text-white uppercase tracking-wider">
                        Stop Batch Generation?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm text-muted-foreground">
                        This will stop the batch generation process. Any
                        currently running report tasks will be aborted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row items-center justify-end gap-3 mt-4">
                      <AlertDialogCancel className="bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl py-2 px-4 text-xs font-bold"
                        onClick={stopBatchGeneration}
                      >
                        Stop
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isBatchEnabled}
                  onClick={triggerBatchGeneration}
                  className="h-9 w-9 p-0 rounded-none text-white hover:bg-white/10 hover:text-white disabled:opacity-30 border-none bg-transparent"
                  title={`Run Batch (${analysisCheckedFiles.length})`}
                >
                  <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Hidden Import Input */}
          <input
            type="file"
            id="import-config-input"
            className="hidden"
            accept=".json"
            onChange={handleImportConfig}
          />
        </div>

        <div className="p-0 flex-1 flex flex-col overflow-hidden">
          {/* Scrollable table with height adjusted to utilize bottom space */}
          <div
            className="flex-1 min-h-0 overflow-y-auto gaze-table-container relative"
            ref={tableContainerRef}
          >
            {/* Scroll Indicator Wrapper (Sticky at top-0, zero height to prevent pushing layout) */}
            <div className="sticky top-0 left-0 right-0 h-0 z-30 w-full overflow-visible">
              <motion.div
                id="scroll-indicator"
                style={{
                  scaleX: scrollYProgress,
                  transformOrigin: "left",
                }}
                className="absolute top-10 left-0 right-0 h-[3px] bg-primary w-full"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-16 text-sm uppercase font-bold text-center h-10 sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">
                    {checkedCount}/5
                  </TableHead>
                  <TableHead className="text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">
                    Signal
                  </TableHead>
                  <TableHead className="w-32 text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">
                    Operator
                  </TableHead>
                  <TableHead className="w-56 text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">
                    Threshold
                  </TableHead>
                  <TableHead className="text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">
                    Alias
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.map((sig) => (
                  <TableRow
                    key={sig.name}
                    className="border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <TableCell className="py-2.5 text-center">
                      <Checkbox
                        checked={sig.checked}
                        onCheckedChange={(checked) =>
                          updateSignalField(
                            activeCategory,
                            sig.name,
                            "checked",
                            !!checked,
                          )
                        }
                        disabled={!sig.checked && checkedCount >= 5}
                        className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-base font-semibold text-foreground/90">
                      {sig.name}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {sig.name === "SoundPressure" ? (
                        <span className="text-sm text-muted-foreground/60 px-2 font-medium">
                          Bandpass
                        </span>
                      ) : (
                        <Select
                          value={
                            ["None", ">", "<", ">=", "<=", "==", "!="].includes(
                              sig.operator,
                            )
                              ? sig.operator
                              : "None"
                          }
                          onValueChange={(val) =>
                            updateSignalField(
                              activeCategory,
                              sig.name,
                              "operator",
                              val,
                            )
                          }
                        >
                          <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2.5">
                            <SelectValue placeholder="Op" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                            <SelectItem value="None" className="text-sm">
                              None
                            </SelectItem>
                            <SelectItem value=">" className="text-sm">
                              &gt;
                            </SelectItem>
                            <SelectItem value="<" className="text-sm">
                              &lt;
                            </SelectItem>
                            <SelectItem value=">=" className="text-sm">
                              &gt;=
                            </SelectItem>
                            <SelectItem value="<=" className="text-sm">
                              &lt;=
                            </SelectItem>
                            <SelectItem value="==" className="text-sm">
                              ==
                            </SelectItem>
                            <SelectItem value="!=" className="text-sm">
                              !=
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {sig.name === "SoundPressure" ? (
                        <span className="text-sm text-muted-foreground/60 text-center block">
                          —
                        </span>
                      ) : (
                        (() => {
                          const cacheKey = `${loadedFiles[activeCategory] ?? ""}::${sig.name}`;
                          const cachedVals = signalValuesCache[cacheKey] || [];
                          if (cachedVals && cachedVals.length > 0) {
                            const cleanCached = cachedVals.filter(
                              (v) =>
                                v !== null &&
                                v !== undefined &&
                                String(v).trim() !== "",
                            );
                            const currentVal =
                              sig.threshold !== null &&
                              sig.threshold !== undefined &&
                              String(sig.threshold).trim() !== ""
                                ? sig.threshold
                                : 0.0;

                            // Deduplicate values based on their string representation to prevent duplicate select keys/values
                            const uniqueMap = new Map<
                              string,
                              number | string
                            >();
                            uniqueMap.set(String(currentVal), currentVal);
                            cleanCached.forEach((v) => {
                              uniqueMap.set(String(v), v);
                            });

                            const allVals = Array.from(uniqueMap.values());
                            allVals.sort((a, b) => {
                              const numA = Number(a);
                              const numB = Number(b);
                              if (!isNaN(numA) && !isNaN(numB)) {
                                return numA - numB;
                              }
                              return String(a).localeCompare(String(b));
                            });
                            return (
                              <Select
                                value={String(currentVal)}
                                onValueChange={(val) => {
                                  const parsed = parseFloat(val);
                                  const finalVal = isNaN(parsed) ? val : parsed;
                                  updateSignalField(
                                    activeCategory,
                                    sig.name,
                                    "threshold",
                                    finalVal,
                                  );
                                }}
                              >
                                <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2.5">
                                  <SelectValue placeholder="Value" />
                                </SelectTrigger>
                                <SelectContent className="bg-surface-2/90 border-white/5 text-white backdrop-blur-xl text-sm max-h-48 overflow-y-auto">
                                  {allVals.map((v) => (
                                    <SelectItem
                                      key={String(v)}
                                      value={String(v)}
                                      className="text-sm font-mono"
                                    >
                                      {String(v)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }
                          return (
                            <Input
                              type={
                                typeof sig.threshold === "number"
                                  ? "number"
                                  : "text"
                              }
                              value={
                                sig.threshold !== null &&
                                sig.threshold !== undefined
                                  ? String(sig.threshold)
                                  : ""
                              }
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                if (typeof sig.threshold === "number") {
                                  updateSignalField(
                                    activeCategory,
                                    sig.name,
                                    "threshold",
                                    parseFloat(rawVal) || 0.0,
                                  );
                                } else {
                                  updateSignalField(
                                    activeCategory,
                                    sig.name,
                                    "threshold",
                                    rawVal,
                                  );
                                }
                              }}
                              className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2.5"
                              step="0.1"
                            />
                          );
                        })()
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Input
                        value={sig.alias}
                        onChange={(e) =>
                          updateSignalField(
                            activeCategory,
                            sig.name,
                            "alias",
                            e.target.value,
                          )
                        }
                        className="h-8 bg-surface-3 border-white/5 text-sm rounded-lg px-2.5"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSignals.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-sm text-muted-foreground uppercase tracking-wider font-semibold"
                    >
                      {currentSignalsList.length === 0
                        ? "No signals configured for this category."
                        : "No signals matched the filter query."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* BOTTOM SECTION: PASS CRITERIA CONFIG (Pass Criteria title & text-sm fields) */}
          <div className="bg-surface-3/60 backdrop-blur-md border-t border-white/5 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase text-muted-foreground tracking-widest text-left">
                Pass Criteria
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3 text-sm text-foreground/80 font-medium text-left">
              <span className="text-muted-foreground whitespace-nowrap">
                The evaluation signal
              </span>
              <div className="w-[180px]">
                <Select
                  value={currentPassCriteria.signal}
                  onValueChange={(val) =>
                    updatePassCriteriaField(activeCategory, "signal", val)
                  }
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Signal" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    {(() => {
                      const seen = new Set<string>();
                      const items = currentSignalsList
                        .filter(
                          (s) =>
                            s &&
                            typeof s.name === "string" &&
                            s.name.trim() !== "",
                        )
                        .filter((s) => {
                          if (seen.has(s.name)) return false;
                          seen.add(s.name);
                          return true;
                        })
                        .map((s) => s.name);

                      if (
                        currentPassCriteria.signal &&
                        !seen.has(currentPassCriteria.signal)
                      ) {
                        items.push(currentPassCriteria.signal);
                      }

                      return items.map((name) => (
                        <SelectItem key={name} value={name} className="text-sm">
                          {name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">
                must be
              </span>

              <div className="w-[85px]">
                <Select
                  value={
                    ["None", ">", "<", ">=", "<=", "==", "!="].includes(
                      currentPassCriteria.operator1,
                    )
                      ? currentPassCriteria.operator1
                      : "None"
                  }
                  onValueChange={(val) =>
                    updatePassCriteriaField(activeCategory, "operator1", val)
                  }
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Op1" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    <SelectItem value="None" className="text-sm">
                      None
                    </SelectItem>
                    <SelectItem value=">" className="text-sm">
                      &gt;
                    </SelectItem>
                    <SelectItem value="<" className="text-sm">
                      &lt;
                    </SelectItem>
                    <SelectItem value=">=" className="text-sm">
                      &gt;=
                    </SelectItem>
                    <SelectItem value="<=" className="text-sm">
                      &lt;=
                    </SelectItem>
                    <SelectItem value="==" className="text-sm">
                      ==
                    </SelectItem>
                    <SelectItem value="!=" className="text-sm">
                      !=
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">
                than
              </span>

              <div className="w-[75px]">
                <Input
                  type="number"
                  value={currentPassCriteria.value1}
                  onChange={(e) =>
                    updatePassCriteriaField(
                      activeCategory,
                      "value1",
                      parseFloat(e.target.value) || 0.0,
                    )
                  }
                  className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2"
                  step="0.1"
                />
              </div>

              <span className="text-muted-foreground whitespace-nowrap">
                and
              </span>

              <div className="w-[85px]">
                <Select
                  value={
                    ["None", ">", "<", ">=", "<=", "==", "!="].includes(
                      currentPassCriteria.operator2,
                    )
                      ? currentPassCriteria.operator2
                      : "None"
                  }
                  onValueChange={(val) =>
                    updatePassCriteriaField(activeCategory, "operator2", val)
                  }
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Op2" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    <SelectItem value="None" className="text-sm">
                      None
                    </SelectItem>
                    <SelectItem value=">" className="text-sm">
                      &gt;
                    </SelectItem>
                    <SelectItem value="<" className="text-sm">
                      &lt;
                    </SelectItem>
                    <SelectItem value=">=" className="text-sm">
                      &gt;=
                    </SelectItem>
                    <SelectItem value="<=" className="text-sm">
                      &lt;=
                    </SelectItem>
                    <SelectItem value="==" className="text-sm">
                      ==
                    </SelectItem>
                    <SelectItem value="!=" className="text-sm">
                      !=
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">
                than
              </span>

              <div className="w-[75px]">
                <Input
                  type="number"
                  value={currentPassCriteria.value2}
                  onChange={(e) =>
                    updatePassCriteriaField(
                      activeCategory,
                      "value2",
                      parseFloat(e.target.value) || 0.0,
                    )
                  }
                  className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2"
                  step="0.1"
                />
              </div>

              <div className="h-5 w-[1px] bg-border dark:bg-white/10 mx-1 shrink-0" />

              <HoverCard openDelay={10} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="cursor-help flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 p-1 rounded-md hover:bg-white/5" title="Evaluation Mask Start">
                    <Drama className="w-4 h-4 text-primary" />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-64 bg-[#1e1d1c] border border-white/5 text-white p-3 text-xs leading-relaxed text-left rounded-lg shadow-xl z-50">
                  <div className="font-semibold text-primary mb-1">
                    Evaluation Mask Start
                  </div>
                  <div>
                    Specifies the start time of the evaluation mask in seconds. Data before this timestamp is ignored in calculations.
                  </div>
                </HoverCardContent>
              </HoverCard>

              <div className="w-16">
                <Input
                  type="number"
                  value={currentPassCriteria.mask}
                  onChange={(e) =>
                    updatePassCriteriaField(
                      activeCategory,
                      "mask",
                      parseFloat(e.target.value) || 0.0,
                    )
                  }
                  className="h-8 bg-surface-3 border-white/5 text-center text-sm rounded-lg px-2"
                  step="0.1"
                />
              </div>
              <span className="text-muted-foreground text-sm whitespace-nowrap">seconds</span>
            </div>
          </div>
        </div>
      </div>



      <Dialog
        open={gaugeRulesModalOpen}
        onOpenChange={(open) => {
          if (!open && isModified) {
            setShowConfirmSwitch("close_modal");
          } else {
            setGaugeRulesModalOpen(open);
          }
        }}
      >
        <DialogContent className="bg-surface-2 border-white/10 text-foreground w-[1100px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 border-b border-white/5 bg-surface-3/30 flex flex-row items-center gap-3">
            <DialogTitle className="text-lg font-bold uppercase text-foreground flex items-center gap-2 flex-1">
              <Gauge className="w-5 h-5 text-primary animate-pulse" /> Edit
              Gauge Rules (Matplotlib reports)
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCloseModal}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-white hover:bg-white/5 rounded-full transition-colors"
              title="Close Dialog"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {/* SPLIT PANE CONTAINER */}
          <div className="flex flex-row flex-1 min-h-0 w-full">
            {/* LEFT COLUMN: SIDEBAR CONFIG SELECTION */}
            <div className="w-[320px] border-r border-white/5 bg-surface-3/20 flex flex-col p-4 gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase text-muted-foreground/80 tracking-wider mr-auto">
                  Profiles
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewConfigPrompt(true)}
                  className="h-8 w-8 p-0 bg-black/30 border-white/5 rounded-md hover:bg-primary hover:text-black transition-colors"
                  title="New Configuration"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("import-gauge-input")?.click()
                  }
                  className="h-8 w-8 p-0 bg-black/30 border-white/5 rounded-md hover:bg-primary hover:text-black transition-colors"
                  title="Import JSON Rules File"
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="flex flex-col gap-1.5 px-1 py-0.5">
                  {modalConfigs.map((config) => {
                    const isSelected = selectedConfigId === config.id;
                    const isActive =
                      (gaugeRulesPath === null && config.id === "default") ||
                      gaugeRulesPath === config.id;
                    return (
                      <div
                        key={config.id}
                        onClick={() => handleSelectConfig(config.id)}
                        className={cn(
                          "w-full min-w-0 text-left p-3.5 rounded-xl border text-sm cursor-pointer transition-all flex flex-col gap-1 relative overflow-hidden group select-none",
                          isSelected
                            ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-lg"
                            : "bg-surface-3/15 border-white/5 hover:border-white/10 hover:bg-surface-3/30 text-foreground/80",
                        )}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="font-bold truncate max-w-[190px] text-base">
                            {config.name}
                          </span>
                          {isActive && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0.5 px-2 bg-primary/20 border-primary/30 text-primary font-black uppercase tracking-widest scale-90"
                            >
                              Active
                            </Badge>
                          )}
                          {config.isDefault && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0.5 px-2 bg-white/5 border-white/10 text-muted-foreground scale-90"
                            >
                              Default
                            </Badge>
                          )}

                          {/* DELETE BUTTON FOR CUSTOM CONFIGS */}
                          {!config.isDefault && (
                            <button
                              onClick={(e) => handleDeleteConfig(config.id, e)}
                              className="ml-auto opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity duration-150"
                              title="Delete config from list"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div
                          className="overflow-hidden w-full min-w-0 mt-0.5"
                          style={{
                            WebkitMaskImage:
                              "linear-gradient(to right, black 85%, transparent 100%)",
                            maskImage:
                              "linear-gradient(to right, black 85%, transparent 100%)",
                          }}
                        >
                          <span
                            className="animate-marquee-path text-xs font-mono text-muted-foreground/75"
                            title={config.path}
                            style={{
                              animationDuration: `${Math.max(4, config.path.length * 0.15)}s`,
                            }}
                          >
                            {config.path}&ensp;&ensp;&ensp;&ensp;{config.path}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RULES TABLE EDITOR */}
            <div className="flex-1 flex flex-col p-5 gap-4 min-h-0 overflow-hidden relative">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold uppercase text-foreground">
                    {selectedConfigId === "default"
                      ? "Viewing: Default"
                      : `Editing: ${modalConfigs.find((c) => c.id === selectedConfigId)?.name || ""}`}
                  </span>
                  {selectedConfigId === "default" && (
                    <Badge
                      variant="outline"
                      className="text-xs py-0.5 px-2 bg-red-500/10 border-red-500/20 text-red-400 gap-1 font-semibold uppercase tracking-wider flex items-center"
                    >
                      <Lock className="w-3 h-3" /> Read-Only
                    </Badge>
                  )}
                  {isModified && (
                    <Badge
                      variant="outline"
                      className="text-xs py-0.5 px-2 bg-orange-500/10 border-orange-500/20 text-orange-400 font-semibold uppercase tracking-wider"
                    >
                      Unsaved Changes
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="pb-6">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead
                          className="text-sm font-bold uppercase text-muted-foreground/80 tracking-wider w-[240px] text-left cursor-help"
                          title="Scenario names evaluated in the gaze logic."
                        >
                          Category
                        </TableHead>
                        <TableHead
                          className="text-sm font-bold uppercase text-center text-muted-foreground/80 tracking-wider w-20 cursor-help"
                          title="Minimum value of the gauge display."
                        >
                          Min (s)
                        </TableHead>
                        <TableHead
                          className="text-sm font-bold uppercase text-center text-muted-foreground/80 tracking-wider w-20 cursor-help"
                          title="Maximum value of the gauge display."
                        >
                          Max (s)
                        </TableHead>
                        <TableHead
                          className="text-sm font-bold uppercase text-center text-muted-foreground/80 tracking-wider w-20 cursor-help"
                          title="Number of intermediate ticks between the minimum and maximum values."
                        >
                          Ticks
                        </TableHead>
                        <TableHead
                          className="text-sm font-bold uppercase text-center text-muted-foreground/80 tracking-wider w-16 cursor-help"
                          title="Reset changes for this category back to the template defaults."
                        >
                          Reset
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoriesList.map((cat) => {
                        const rule = editingRules[cat] || {
                          min: 0,
                          max: 10,
                        };

                        // Calculate Ticks Count
                        let ticksCount = rule.ticks_count;
                        if (ticksCount === undefined) {
                          if (Array.isArray(rule.ticks)) {
                            ticksCount = Math.max(0, rule.ticks.length - 2);
                          } else {
                            const diff = (rule.max ?? 10) - (rule.min ?? 0);
                            ticksCount =
                              diff > 0 && diff <= 10 ? Math.round(diff) - 1 : 4;
                          }
                        }

                        const isDisabled = selectedConfigId === "default";

                        return (
                          <TableRow
                            key={cat}
                            className="border-white/5 hover:bg-white/[0.01]"
                          >
                            <TableCell
                              className="py-2.5 font-bold truncate text-left text-base text-foreground/90 max-w-[240px]"
                              title={cat}
                            >
                              {cat}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Input
                                type="number"
                                disabled={isDisabled}
                                value={rule.min !== undefined ? rule.min : ""}
                                onChange={(e) =>
                                  handleFieldChange(cat, "min", e.target.value)
                                }
                                className="h-9 bg-surface-3/60 border-white/5 text-base text-center rounded-md px-1.5 w-16 font-mono disabled:opacity-60 mx-auto"
                              />
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Input
                                type="number"
                                disabled={isDisabled}
                                value={rule.max !== undefined ? rule.max : ""}
                                onChange={(e) =>
                                  handleFieldChange(cat, "max", e.target.value)
                                }
                                className="h-9 bg-surface-3/60 border-white/5 text-base text-center rounded-md px-1.5 w-16 font-mono disabled:opacity-60 mx-auto"
                              />
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Input
                                type="number"
                                disabled={isDisabled}
                                min="0"
                                max="20"
                                placeholder="e.g. 4"
                                value={
                                  ticksCount !== undefined ? ticksCount : ""
                                }
                                onChange={(e) =>
                                  handleFieldChange(
                                    cat,
                                    "ticks_count",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="h-9 bg-surface-3/60 border-white/5 text-base text-center rounded-md px-1.5 w-16 font-mono disabled:opacity-60 mx-auto"
                              />
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isDisabled}
                                onClick={() => handleResetRowToDefault(cat)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-white/5 disabled:opacity-40 rounded-md transition-colors mx-auto"
                                title="Reset this category to default values"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>

              {/* EDITOR ACTION BUTTONS */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportGaugeConfig}
                    className="h-9 border-white/10 bg-black/20 hover:bg-white/5 text-sm font-bold px-3"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Export JSON
                  </Button>
                  {selectedConfigId !== "default" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRevertConfig}
                      className="h-9 border-white/10 bg-black/20 hover:bg-white/5 text-sm font-bold px-3"
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Undo Changes
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {selectedConfigId !== "default" && (
                    <Button
                      size="sm"
                      disabled={!isModified}
                      onClick={handleSaveActiveConfig}
                      className={cn(
                        "h-9 text-sm font-bold px-3",
                        isModified
                          ? "bg-primary text-black hover:bg-primary/90"
                          : "bg-white/5 border border-white/10 text-muted-foreground",
                      )}
                    >
                      <Save className="w-4 h-4 mr-1.5" /> Save File
                    </Button>
                  )}

                  <div className="h-9 w-[1px] bg-white/10 mx-1" />

                  <Button
                    onClick={handleApplyLimits}
                    className="h-9 bg-primary hover:bg-primary/95 text-black font-black uppercase text-xs tracking-wider rounded-lg px-5"
                  >
                    Apply Limits
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* HIDDEN INPUT FOR GAUGE RULES IMPORT */}
          <input
            type="file"
            id="import-gauge-input"
            className="hidden"
            accept=".json"
            onChange={handleImportGaugeConfig}
          />

          {/* NEW CONFIG DIALOG POPUP OVERLAY */}
          {showNewConfigPrompt && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <Card className="bg-surface-2 border border-white/10 text-white w-full max-w-md rounded-xl shadow-2xl p-6">
                <CardHeader className="p-0 pb-3 flex flex-col gap-1.5">
                  <CardTitle className="text-lg font-bold uppercase text-foreground flex items-center gap-2 text-left">
                    <Plus className="w-5 h-5 text-primary" /> Create New
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col gap-4">
                  {/* PROJECT FOLDER SELECTOR (SHOW IF NO ACTIVE PROJECT IN STORE) */}
                  {!analysisSourcePath && (
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-sm font-bold uppercase text-muted-foreground/80">
                        Project Folder (Required)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Select project folder..."
                          value={tempProjectPath}
                          readOnly
                          className="h-9 bg-surface-3 border-white/5 text-sm flex-1 truncate"
                        />
                        <Button
                          onClick={() => setNewConfigProjectBrowserOpen(true)}
                          className="h-9 bg-primary/20 border border-primary/30 text-primary hover:bg-primary hover:text-black font-bold text-xs px-3"
                        >
                          Browse
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground/90 leading-normal italic font-medium">
                        Tip: Choose the root folder containing the participant
                        folders (P01, P02, P03, etc.).
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-sm font-bold uppercase text-muted-foreground/80">
                      Configuration Name
                    </label>
                    <Input
                      placeholder="e.g. ncap_rules_2026"
                      value={newConfigName}
                      onChange={(e) => setNewConfigName(e.target.value)}
                      className="h-9 bg-surface-3 border-white/5 text-base"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateNewConfig();
                      }}
                    />
                    <span className="text-xs text-muted-foreground/90 leading-normal">
                      The file will always be saved in your project directory
                      (the folder with P01, P02, etc.) as a JSON file.
                    </span>
                  </div>

                  <div className="flex justify-end gap-2.5 mt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewConfigPrompt(false);
                        setNewConfigName("");
                        setTempProjectPath("");
                      }}
                      className="h-9 border-white/10 hover:bg-white/5 text-xs font-bold py-0.5 px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateNewConfig}
                      className="h-9 bg-primary hover:bg-primary/90 text-black text-xs font-black py-0.5 px-4 uppercase tracking-wider"
                    >
                      Create
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CONFIRM SWITCH DIALOG POPUP OVERLAY */}
          {showConfirmSwitch && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <Card className="bg-surface-2 border border-white/10 text-white w-full max-w-sm rounded-xl shadow-2xl p-6">
                <CardHeader className="p-0 pb-3 flex flex-col gap-1.5">
                  <CardTitle className="text-base font-extrabold uppercase text-foreground/90 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" /> Unsaved
                    Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col gap-4 text-left">
                  <span className="text-sm text-muted-foreground/95 leading-relaxed">
                    You have unsaved changes in the current configuration. Would
                    you like to save them before switching?
                  </span>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirmSwitch(null)}
                      className="h-9 border-white/10 hover:bg-white/5 text-xs font-bold py-0.5 px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (showConfirmSwitch === "close_modal") {
                          setIsModified(false);
                          setGaugeRulesModalOpen(false);
                        } else {
                          performSwitch(showConfirmSwitch);
                        }
                        setShowConfirmSwitch(null);
                      }}
                      className="h-9 hover:bg-white/5 text-xs font-bold py-0.5 px-4 text-red-400 hover:text-red-300"
                    >
                      Discard
                    </Button>
                    <Button
                      onClick={async () => {
                        await handleSaveActiveConfig();
                        if (showConfirmSwitch === "close_modal") {
                          setGaugeRulesModalOpen(false);
                        } else {
                          performSwitch(showConfirmSwitch);
                        }
                        setShowConfirmSwitch(null);
                      }}
                      className="h-9 bg-primary hover:bg-primary/90 text-black text-xs font-black py-0.5 px-4 uppercase tracking-wider"
                    >
                      Save & Switch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* FOLDER BROWSER FOR SELECTING PROJECT DIRECTORY */}
          <FolderBrowser
            open={newConfigProjectBrowserOpen}
            onOpenChange={setNewConfigProjectBrowserOpen}
            onSelect={(path) => setTempProjectPath(path)}
          />
        </DialogContent>
      </Dialog>

      {/* SELECT MF4 FILE DIALOG MODAL */}
      <Dialog open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
        <DialogContent className="bg-surface-2 border-white/10 text-foreground w-[480px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 border-b border-white/5 bg-surface-3/30 text-left">
            <DialogTitle className="text-sm font-bold uppercase text-foreground/90 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Select File for{" "}
              {activeCategory}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 border-b border-white/5 bg-surface-3/10">
            <div className="relative flex items-center group">
              <Input
                placeholder="Search project MF4 files..."
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                className="h-9 w-full bg-surface-3 border-white/10 text-sm pl-8 pr-8 rounded-lg placeholder:text-muted-foreground/60"
              />
              <Filter className="w-4 h-4 text-muted-foreground/60 absolute left-2.5 pointer-events-none" />
              {fileSearchQuery && (
                <button
                  onClick={() => setFileSearchQuery("")}
                  className="absolute right-2.5 text-muted-foreground hover:text-white transition-opacity duration-150 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto max-h-[45vh] scrollbar-thin">
            <div className="flex flex-col gap-1.5">
              {allParticipantMf4s.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  No MF4 files detected. Try scanning a source path first.
                </div>
              ) : (
                (() => {
                  const filtered = allParticipantMf4s.filter((f) =>
                    f.toLowerCase().includes(fileSearchQuery.toLowerCase()),
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        No matching files.
                      </div>
                    );
                  }
                  return filtered.map((filePath) => {
                    const isSelected = loadedFiles[activeCategory] === filePath;
                    const fileName = filePath.split(/[/\\]/).pop() || filePath;
                    return (
                      <button
                        key={filePath}
                        onClick={() => handleSelectFile(filePath)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1 overflow-hidden",
                          isSelected
                            ? "bg-primary/10 border-primary/40 text-primary font-bold"
                            : "bg-surface-3/15 border-white/5 hover:border-white/10 hover:bg-surface-3/30 text-foreground/80",
                        )}
                      >
                        <span className="truncate w-full font-medium">
                          {fileName}
                        </span>
                        <div
                          className="overflow-hidden w-full mt-0.5"
                          style={{
                            WebkitMaskImage:
                              "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                            maskImage:
                              "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                          }}
                        >
                          <span className="animate-marquee-path text-[10px] text-muted-foreground/70">
                            {filePath}&ensp;&ensp;&ensp;&ensp;{filePath}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()
              )}
            </div>
          </div>

          <div className="p-4 pt-2.5 border-t border-white/5 bg-surface-3/30 flex items-center justify-end">
            <Button
              variant="outline"
              onClick={() => setFileSelectorOpen(false)}
              className="h-8 border-white/10 hover:bg-white/5 text-foreground font-bold uppercase text-[10px] tracking-widest rounded-lg px-4"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RESET CONFIRMATION ALERT DIALOG */}
      <AlertDialog
        open={resetConfirmType !== null}
        onOpenChange={(open) => {
          if (!open) setResetConfirmType(null);
        }}
      >
        <AlertDialogContent className="max-w-[400px] border border-white/10 bg-surface-2/95 backdrop-blur-xl p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
            <AlertCircle className="w-6 h-6" />
          </div>
          <AlertDialogHeader className="items-center text-center gap-1.5">
            <AlertDialogTitle className="text-base font-bold text-white uppercase tracking-wider">
              {resetConfirmType === "config" && "Reset Configuration?"}
              {resetConfirmType === "gauge" && "Reset Gauge Limits?"}
              {resetConfirmType === "case" && "Unload Case File?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-white/70 max-w-[340px] leading-relaxed">
              {resetConfirmType === "config" &&
                "This will unmount the active configuration file. It affects multiple parts of the application, resetting all signals selection, pass criteria formulas, and custom gauge limits back to default system templates."}
              {resetConfirmType === "gauge" &&
                "This will revert the active matplotlib report gauge display limits back to default templates."}
              {resetConfirmType === "case" &&
                "This will unload the current case file and clear all of its loaded signals."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
            <AlertDialogCancel className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetConfirmType === "config") {
                  handleUnmountConfig();
                  toast.success(
                    "Configuration unmounted. Reverted to defaults.",
                  );
                } else if (resetConfirmType === "gauge") {
                  setGaugeRules(DEFAULT_GAUGE_RULES);
                  setGaugeRulesPath(null);
                  toast.success("Gauge rules reset to defaults.");
                } else if (resetConfirmType === "case") {
                  setLoadedFiles((prev) => {
                    const next = { ...prev };
                    delete next[activeCategory];
                    return next;
                  });
                  toast.success("Case file unloaded.");
                }
                setResetConfirmType(null);
              }}
              className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
