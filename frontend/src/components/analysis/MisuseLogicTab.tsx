import { useState, useEffect, useRef, useMemo } from "react";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Cog,
  SlidersHorizontal,
  Box,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { reportingApi } from "@/api/reportingApi";
import { omApi } from "@/api/omApi";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getOmScenarioCategory } from "@/lib/utils";
import { MisuseTimelineEditor } from "./MisuseTimelineEditor";

const caseIdsMap: Record<string, string> = {
  "OoP \u2014 Initial Phase": "Folders: Initial Phase Face on Facia / Feet on Dashboard",
  "OoP \u2014 Change of Status": "Folders: Change of Status Face on Facia / Feet on Dashboard",
  "OoP \u2014 15 min Warning": "Folders: 15 minutes Warning Repetition Face on Facia / Feet on Dashboard",
  "CSR \u2014 Initial Phase": "Folders: Initial Phase Buckle Only / Completely Behind Back / Lap Belt Only",
  "CSR \u2014 Change of Status": "Folders: Change of Status Buckle Only / Completely Behind Back / Lap Belt Only",
};

interface SignalConfig {
  name: string;
  checked: boolean;
  operator: string;
  threshold: number | string;
  alias: string;
}

interface GaugeConfig {
  min: number;
  max: number;
  ticks?: number[];
  ticks_count?: number;
}

const DEFAULT_GAUGE_RULES: Record<string, GaugeConfig> = {
  "OoP \u2014 Initial Phase": { min: 0, max: 10 },
  "OoP \u2014 Change of Status": { min: 0, max: 10 },
  "OoP \u2014 15 min Warning": { min: 0, max: 10 },
  "CSR \u2014 Initial Phase": { min: 0, max: 10 },
  "CSR \u2014 Change of Status": { min: 0, max: 10 },
};

const fetchingValues = new Set<string>();

export function MisuseLogicTab() {
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
    analysisAvailableCameras,

    // Store states
    protocol,
    signalsConfig,
    setSignalsConfig,
    passCriteria,
    misuseCriteria,
    setMisuseCriteria,
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

  // Categories list for Misuse / Occupant Monitoring
  const categoriesList = [
    "OoP \u2014 Initial Phase",
    "OoP \u2014 Change of Status",
    "OoP \u2014 15 min Warning",
    "CSR \u2014 Initial Phase",
    "CSR \u2014 Change of Status",
  ];

  const [activeCategory, setActiveCategory] = useState<string>(
    categoriesList[0],
  );

  useEffect(() => {
    if (analysisSelectedFile) {
      const detectedCategory = getOmScenarioCategory(analysisSelectedFile);
      if (detectedCategory && categoriesList.includes(detectedCategory)) {
        setActiveCategory(detectedCategory);
      }
    }
  }, [analysisSelectedFile]);


  // Filter signals state
  const [filterQuery, setFilterQuery] = useState("");

  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Report Settings Camera state
  const [reportCameraLeft, setReportCameraLeft] = useState<string>('');
  const [reportCameraRight, setReportCameraRight] = useState<string>('');

  useEffect(() => {
    if (analysisAvailableCameras.length > 0) {
      if (!reportCameraLeft || !analysisAvailableCameras.includes(reportCameraLeft)) {
        setReportCameraLeft(analysisAvailableCameras[0] as string);
      }
      if (!reportCameraRight || !analysisAvailableCameras.includes(reportCameraRight)) {
        if (analysisAvailableCameras.length > 1) {
          setReportCameraRight(analysisAvailableCameras[1] as string);
        } else {
          setReportCameraRight('');
        }
      }
    } else {
      setReportCameraLeft('');
      setReportCameraRight('');
    }
  }, [analysisAvailableCameras]);

  // Batch generation progress states
  const wsRef = useRef<WebSocket | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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
    if (signalValuesCacheRef.current[cacheKey]) return;
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

  // Fetch unique signal values lazily — only for CHECKED signals (max 6),
  // sequentially with concurrency limit to avoid overwhelming the backend
  // with parallel MDF reads on large OM files.
  useEffect(() => {
    const activeFile = loadedFiles[activeCategory];
    if (!activeFile) return;

    const categorySignals = signalsConfig[activeCategory] || [];
    // Only fetch values for checked signals (max 6) — the rest don't need dropdowns
    const checkedSignals = categorySignals.filter(
      (sig) => sig && sig.checked && sig.name !== "SoundPressure"
    );
    const signalsToFetch = checkedSignals.filter((sig) => {
      const cacheKey = `${activeFile}::${sig.name}`;
      return !signalValuesCacheRef.current[cacheKey] && !fetchingValues.has(cacheKey);
    });

    if (signalsToFetch.length === 0) return;

    let cancelled = false;
    const MAX_CONCURRENT = 2;

    const fetchSequentially = async () => {
      for (let i = 0; i < signalsToFetch.length; i += MAX_CONCURRENT) {
        if (cancelled) return;
        const batch = signalsToFetch.slice(i, i + MAX_CONCURRENT);
        await Promise.all(
          batch.map((sig) => {
            if (cancelled) return Promise.resolve();
            return fetchSignalValues(activeFile, sig.name);
          })
        );
      }
    };

    fetchSequentially();

    return () => {
      cancelled = true;
    };
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
        // Signal values are fetched lazily by the useEffect for checked signals only
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

      const isUnresponsive = cat.toLowerCase().includes("unresponsive");

      const signalsMap: Record<string, any> = {};
      signalsList.forEach((sig) => {
        if (sig && sig.name) {
          signalsMap[sig.name] = {
            checked: !!sig.checked,
            operator: isUnresponsive ? "None" : (sig.operator || "None"),
            threshold: isUnresponsive
              ? 0.0
              : typeof sig.threshold === "number" ||
                typeof sig.threshold === "string"
              ? sig.threshold
              : 0.0,
            alias: sig.alias || sig.name,
          };
        }
      });

      configs[cat] = {
        signals: signalsMap,
        pass_signal_name: isUnresponsive ? "" : pass.signal,
        mask_start: pass.mask,
        operator1: isUnresponsive ? "None" : pass.operator1,
        value1: isUnresponsive ? 0.0 : pass.value1,
        operator2: isUnresponsive ? "None" : pass.operator2,
        value2: isUnresponsive ? 0.0 : pass.value2,
        unresponsive_phases: misuseCriteria[cat] || [],
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

    try {
      const backendConfigs = getBackendCategoryConfigs();
      const res = await omApi.omPreview({
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
        source_dir: analysisSourcePath,
        report_camera_settings: {
          left: reportCameraLeft,
          right: reportCameraRight
        }
      });

      if (res.data?.status === "success" && res.data?.preview_path) {
        toast.success("Preview report generated successfully!");
        
        // Directly open the generated preview image in the Windows default viewer
        try {
          const openRes = await reportingApi.openFile(res.data.preview_path);
          if (openRes.data?.status === "success") {
            toast.success("Opening report image in OS viewer...");
          } else {
            toast.error(openRes.data?.message || "Failed to open image externally");
          }
        } catch (err) {
          toast.error("Error launching photo viewer.");
        }
      } else {
        toast.error(res.data?.message || "Failed to generate preview report");
      }
    } catch (err) {
      console.error(err);
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(
        error.response?.data?.message || "Error communicating with server",
      );
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
      await omApi.omGenerate({
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
        source_dir: analysisSourcePath,
        report_camera_settings: {
          left: reportCameraLeft,
          right: reportCameraRight
        }
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


  // Preview activation: sidebar file selected, not currently loading
  const isPreviewEnabled = !!analysisSelectedFile && !isPreviewLoading;

  // Batch run activation: at least one checkbox active in sidebar tree
  const isBatchEnabled = analysisCheckedFiles.length > 0;

  // Filter signals list by query string
  const filteredSignals = useMemo(() => {
    const queryLower = filterQuery.toLowerCase();
    return currentSignalsList.filter((sig) => {
      if (!sig || typeof sig.name !== "string") return false;
      const nameLower = sig.name.toLowerCase();
      const aliasLower =
        typeof sig.alias === "string" ? sig.alias.toLowerCase() : nameLower;
      return nameLower.includes(queryLower) || aliasLower.includes(queryLower);
    });
  }, [currentSignalsList, filterQuery]);

  const sortedFilteredSignals = useMemo(() => {
    const checked = filteredSignals.filter((sig) => sig.checked);
    const unchecked = filteredSignals.filter((sig) => !sig.checked);
    return [...checked, ...unchecked];
  }, [filteredSignals]);

  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);

  const columns: GridColDef[] = useMemo(() => [
    {
      field: "checked",
      headerName: `${checkedCount}/6`,
      width: 64,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <div className="flex justify-center items-center h-full w-full">
          <Checkbox
            checked={params.value}
            onCheckedChange={(checked) =>
              updateSignalField(activeCategory, params.row.name, "checked", !!checked)
            }
            disabled={!params.value && checkedCount >= 6}
            className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      ),
    },
    {
      field: "name",
      headerName: "Signal",
      flex: 1.5,
      renderCell: (params) => (
        <div className="text-base font-semibold text-foreground/90 truncate w-full flex items-center h-full" title={params.value}>
          {params.value}
        </div>
      ),
    },
    {
      field: "operator",
      headerName: "Operator",
      width: 120,
      renderCell: (params) => {
        if (params.row.name === "SoundPressure") {
          return (
            <div className="flex items-center h-full w-full pr-2 text-sm text-muted-foreground/60 font-medium">
              Bandpass
            </div>
          );
        }
        return (
          <div className="flex items-center h-full w-full pr-2">
            <Select
              disabled={activeCategory.toLowerCase().includes("unresponsive")}
              value={
                activeCategory.toLowerCase().includes("unresponsive")
                  ? "None"
                  : ["None", ">", "<", ">=", "<=", "==", "!="].includes(params.value)
                  ? params.value
                  : "None"
              }
              onValueChange={(val) =>
                updateSignalField(activeCategory, params.row.name, "operator", val)
              }
            >
              <SelectTrigger className="h-8 bg-surface-2/50 border border-border text-sm text-foreground rounded-lg px-2.5 hover:bg-surface-2/70 w-full">
                <SelectValue placeholder="Op" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-sm">
                {["None", ">", "<", ">=", "<=", "==", "!="].map(op => (
                  <SelectItem key={op} value={op} className="text-sm">
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
    },
    {
      field: "threshold",
      headerName: "Threshold",
      width: 200,
      renderCell: (params) => {
        if (params.row.name === "SoundPressure" || activeCategory.toLowerCase().includes("unresponsive")) {
          return <span className="text-sm text-muted-foreground/60 text-center w-full block">—</span>;
        }

        const cacheKey = `${loadedFiles[activeCategory] ?? ""}::${params.row.name}`;
        const cachedVals = signalValuesCache[cacheKey] || [];
        if (cachedVals && cachedVals.length > 0) {
          const cleanCached = cachedVals.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
          const currentVal = params.value !== null && params.value !== undefined && String(params.value).trim() !== "" ? params.value : 0.0;
          const uniqueMap = new Map<string, number | string>();
          uniqueMap.set(String(currentVal), currentVal);
          cleanCached.forEach((v) => uniqueMap.set(String(v), v));
          const allVals = Array.from(uniqueMap.values());
          allVals.sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a).localeCompare(String(b));
          });
          return (
            <div className="flex items-center h-full w-full pr-2">
              <Select
                value={String(currentVal)}
                onValueChange={(val) => {
                  const parsed = parseFloat(val);
                  const finalVal = isNaN(parsed) ? val : parsed;
                  updateSignalField(activeCategory, params.row.name, "threshold", finalVal);
                }}
              >
                <SelectTrigger className="h-8 bg-surface-2/50 border border-border text-sm text-foreground rounded-lg px-2.5 hover:bg-surface-2/70 w-full">
                  <SelectValue placeholder="Value" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-sm max-h-48 overflow-y-auto">
                  {allVals.map((v) => (
                    <SelectItem key={String(v)} value={String(v)} className="text-sm font-mono">
                      {String(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div className="flex items-center h-full w-full pr-2">
            <Input
              type={typeof params.value === "number" ? "number" : "text"}
              value={params.value !== null && params.value !== undefined ? String(params.value) : ""}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (typeof params.value === "number") {
                  updateSignalField(activeCategory, params.row.name, "threshold", parseFloat(rawVal) || 0.0);
                } else {
                  updateSignalField(activeCategory, params.row.name, "threshold", rawVal);
                }
              }}
              className="h-8 bg-surface-2/50 border border-border text-sm text-center rounded-lg px-2.5 hover:bg-surface-2/70 focus:bg-background text-foreground w-full"
              step="0.1"
            />
          </div>
        );
      },
    },
    {
      field: "alias",
      headerName: "Alias",
      flex: 1,
      renderCell: (params) => (
        <div className="flex items-center h-full w-full pr-2">
          <Input
            value={params.value || ""}
            onChange={(e) => updateSignalField(activeCategory, params.row.name, "alias", e.target.value)}
            className="h-8 bg-surface-2/50 border border-border text-sm rounded-lg px-2.5 hover:bg-surface-2/70 focus:bg-background text-foreground w-full"
          />
        </div>
      ),
    },
  ], [checkedCount, activeCategory, loadedFiles, signalValuesCache, updateSignalField]);

  const rows = useMemo(() => {
    return sortedFilteredSignals.map(sig => ({
      id: sig.name,
      name: sig.name,
      checked: sig.checked,
      operator: sig.operator,
      threshold: sig.threshold,
      alias: sig.alias,
    }));
  }, [sortedFilteredSignals]);

  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    if (!isCollapsibleOpen) {
      setIsMounting(true);
      const timer = setTimeout(() => setIsMounting(false), 50);
      return () => clearTimeout(timer);
    } else {
      setIsMounting(false);
    }
  }, [isCollapsibleOpen]);

  const availableSignalsList = useMemo(() => currentSignalsList.map(s => s.name), [currentSignalsList]);

  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (!tableContainerRef.current) return;
    const scroller = tableContainerRef.current.querySelector('.MuiDataGrid-virtualScroller');
    if (!scroller) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      if (scrollHeight > clientHeight) {
        setScrollProgress(scrollTop / (scrollHeight - clientHeight));
      } else {
        setScrollProgress(0);
      }
    };

    scroller.addEventListener('scroll', handleScroll);
    handleScroll();
    
    const observer = new ResizeObserver(() => handleScroll());
    observer.observe(scroller);

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [rows, isMounting]);

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
        .group:hover .animate-marquee-path,
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
        .pill-marquee-container {
          overflow: hidden;
          white-space: nowrap;
          width: 140px;
          position: relative;
          transition: padding-right 0.2s ease, mask-image 0.2s ease, -webkit-mask-image 0.2s ease;
          mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent);
          display: flex;
          align-items: center;
        }
        .group:hover .pill-marquee-container.has-clear {
          padding-right: 18px;
          mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 18px), transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 18px), transparent);
        }
        .pill-normal-container {
          overflow: hidden;
          white-space: nowrap;
          width: auto;
          max-width: 140px;
          position: relative;
          transition: padding-right 0.2s ease;
          display: flex;
          align-items: center;
          color: inherit;
        }
        .group:hover .pill-normal-container.has-clear {
          padding-right: 18px;
        }
        .pill-marquee-text {
          display: inline-block;
          white-space: nowrap;
          transition: transform 0.2s ease;
          color: inherit;
        }
        .group:hover .pill-marquee-text.animate {
          animation: marquee-path 12s linear infinite;
          animation-play-state: running;
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
        .group:has(.pill-clear-btn:hover) .pill-text,
        .group:has(.pill-clear-btn:hover) .pill-marquee-text,
        .group:has(.pill-clear-btn:hover) .pill-normal-container span {
          color: #ef4444 !important;
        }
        .group:has(.pill-clear-btn:hover) .pill-clear-btn {
          color: #ef4444 !important;
        }
        .group:has(.pill-add-btn):hover {
          background-color: rgba(59, 130, 246, 0.15) !important;
          border-color: rgba(59, 130, 246, 0.4) !important;
          color: #3b82f6 !important;
        }
        .group:has(.pill-add-btn):hover svg {
          color: #3b82f6 !important;
        }
        .group:has(.pill-add-btn):hover .pill-text,
        .group:has(.pill-add-btn):hover .pill-marquee-text,
        .group:has(.pill-add-btn):hover .pill-normal-container span {
          color: #3b82f6 !important;
        }
        .group:has(.pill-add-btn):hover .pill-add-btn {
          color: #3b82f6 !important;
        }
      `}</style>

      {/* MAIN CONFIGURATION CARD */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
        {/* MERGED CARD HEADER: Title, Scenario, Filter Bar, & Settings Dropdown */}
        <div className="pb-4 border-b border-border/50 bg-surface-2/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 lg:px-6 shrink-0">
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
                    onClick={() => autoLoadChannelsAndMerge(undefined, undefined, undefined, true)}
                    className="text-sm gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Auto-Load data
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
                  <HoverCardContent className="w-64 bg-popover border border-border text-popover-foreground p-3 text-xs leading-relaxed text-left rounded-lg shadow-xl z-50">
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




            {/* Loaded MF4 File Badge Indicator */}
            <div className="flex items-center">
              <Badge
                variant="outline"
                className="h-9 px-3 bg-surface-2/50 hover:bg-surface-2/70 text-primary border-primary/20 text-sm font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 justify-center group"
                onClick={() => setFileSelectorOpen(true)}
                title={loadedFiles[activeCategory] || "No MF4 Loaded"}
              >
                <Box className="w-3.5 h-3.5 shrink-0" />
                <div className="relative flex items-center justify-center min-w-0">
                  {(() => {
                    const fileName = loadedFiles[activeCategory]
                      ? loadedFiles[activeCategory].split(/[/\\]/).pop() || ""
                      : "No MF4 Loaded";
                    const isLong = fileName.length > 15;
                    return (
                      <div className={cn(isLong ? "pill-marquee-container" : "pill-normal-container", "has-clear")}>
                        <span
                          className={cn(
                            isLong ? "pill-marquee-text text-primary leading-none animate" : "text-primary leading-none"
                          )}
                          style={isLong ? { animationDuration: `${Math.max(6, fileName.length * 0.25)}s` } : undefined}
                        >
                          {isLong ? (
                            <>{fileName}&ensp;&ensp;&ensp;&ensp;{fileName}</>
                          ) : (
                            fileName
                          )}
                        </span>
                      </div>
                    );
                  })()}
                  {loadedFiles[activeCategory] ? (
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
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileSelectorOpen(true);
                      }}
                      className="pill-clear-btn pill-add-btn flex items-center justify-center text-muted-foreground hover:text-white transition-opacity duration-200"
                      title="Load case file"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3.5 self-end lg:self-auto">
            {/* Filter entry with hover clear 'x' button */}
            <div className="relative flex items-center shrink-0 group">
              <Input
                placeholder="Filter signals..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-9 w-[160px] bg-surface-2/50 border border-border hover:bg-surface-2/70 focus:bg-background text-sm pl-8 pr-8 rounded-lg placeholder:text-muted-foreground/60 transition-colors text-foreground"
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
            <div className="flex flex-row h-9 bg-surface-2/50 border border-border rounded-lg shadow-xl backdrop-blur-md overflow-hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 p-0 rounded-none text-muted-foreground hover:text-foreground hover:bg-surface-2/70 border-none bg-transparent"
                    title="Report Settings"
                  >
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-popover border border-border shadow-2xl rounded-xl p-4 mr-4 mt-2">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">Report Settings</h4>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Camera Frame: Initial Trigger</p>
                      <Select
                        value={reportCameraLeft}
                        onValueChange={setReportCameraLeft}
                      >
                        <SelectTrigger className="bg-background border border-border text-foreground">
                          <SelectValue placeholder="Select camera" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          {analysisAvailableCameras.map((cam, idx) => (
                            <SelectItem
                              key={idx}
                              value={cam.toString()}
                              className="text-foreground hover:bg-secondary focus:bg-secondary"
                            >
                              Camera: {cam}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Camera Frame: Detection</p>
                      <Select
                        value={reportCameraRight}
                        onValueChange={setReportCameraRight}
                      >
                        <SelectTrigger className="bg-background border border-border text-foreground">
                          <SelectValue placeholder="Select camera" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          {analysisAvailableCameras.map((cam, idx) => (
                            <SelectItem
                              key={idx}
                              value={cam.toString()}
                              className="text-foreground hover:bg-secondary focus:bg-secondary"
                            >
                              Camera: {cam}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="h-full w-[1px] bg-border" />
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
                  className="h-9 w-9 p-0 rounded-none text-muted-foreground hover:text-foreground hover:bg-surface-2/70 disabled:opacity-30 disabled:pointer-events-none border-none bg-transparent"
                >
                  {isPreviewLoading ? (
                    <Clock className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <BugPlay className="w-5 h-5 text-primary" />
                  )}
                </Button>
              </div>
              <div className="h-full w-[1px] bg-border" />
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
                  <AlertDialogContent className="sm:max-w-md bg-popover border border-border text-foreground rounded-2xl shadow-2xl p-6">
                    <AlertDialogHeader className="gap-2">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <AlertDialogTitle className="text-base font-bold text-foreground uppercase tracking-wider">
                        Stop Batch Generation?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm text-muted-foreground">
                        This will stop the batch generation process. Any
                        currently running report tasks will be aborted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row items-center justify-end gap-3 mt-4">
                      <AlertDialogCancel className="bg-secondary border border-border hover:bg-secondary/80 text-secondary-foreground rounded-xl py-2 px-4 text-xs font-bold transition-all">
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
                  className="h-9 w-9 p-0 rounded-none text-muted-foreground hover:text-foreground hover:bg-surface-2/70 disabled:opacity-30 border-none bg-transparent"
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
          {!isCollapsibleOpen && (
            <div
              className="flex-1 min-h-0 relative w-full overflow-hidden max-w-full gaze-table-container"
              ref={tableContainerRef}
            >
              {isMounting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1 z-50">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <div className="text-sm text-muted-foreground font-medium animate-pulse">
                    {loadedFiles[activeCategory]
                      ? `Loading signals from ${loadedFiles[activeCategory].split(/[/\\]/).pop()}`
                      : "Loading table..."}
                  </div>
                </div>
              ) : null}
              {/* Custom Horizontal Scroll Indicator */}
              {!isMounting && (
                <div className="absolute top-[40px] left-0 right-0 h-0 z-30 w-full overflow-visible pointer-events-none">
                  <div
                    style={{
                      transform: `scaleX(${scrollProgress})`,
                      transformOrigin: "left",
                    }}
                    className="absolute top-0 left-0 right-0 h-[2px] bg-primary w-full transition-transform duration-75 ease-out"
                  />
                </div>
              )}
              {!isCollapsibleOpen && !isMounting && (
                <DataGrid
                  rows={rows}
                  columns={columns}
                  rowHeight={52}
                  disableRowSelectionOnClick
                  pagination
                  initialState={{
                    pagination: {
                      paginationModel: { pageSize: 100, page: 0 },
                    },
                  }}
                  pageSizeOptions={[25, 50, 100, 200, 500]}
                  disableColumnMenu
                  slots={{
                    noRowsOverlay: () => (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                        {currentSignalsList.length === 0
                          ? "No signals configured for this category."
                          : "No signals matched the filter query."}
                      </div>
                    )
                  }}
                  sx={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    '& .MuiDataGrid-cell': {
                      borderBottom: '1px solid var(--border) !important',
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiDataGrid-columnHeaders': {
                      borderBottom: '1px solid var(--border) !important',
                      backgroundColor: 'var(--surface-2) !important',
                      minHeight: '40px !important',
                      maxHeight: '40px !important',
                      lineHeight: '40px !important',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      letterSpacing: '0.05em',
                      color: 'inherit',
                    },
                    '& .MuiDataGrid-columnHeader': {
                      backgroundColor: 'var(--surface-2) !important',
                    },
                    '& .MuiDataGrid-columnSeparator': {
                      color: 'var(--border) !important',
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                      fontWeight: 'bold',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: 'rgba(255,255,255,0.02)',
                    },
                    '& .MuiDataGrid-virtualScroller::-webkit-scrollbar': {
                      display: 'none',
                    },
                    '& .MuiDataGrid-virtualScroller': {
                      overflowY: 'auto',
                      msOverflowStyle: 'none',
                      scrollbarWidth: 'none',
                    },
                    '& .MuiDataGrid-footerContainer': {
                      borderTop: '1px solid var(--border) !important',
                      backgroundColor: 'var(--surface-2) !important',
                      color: 'inherit',
                    },
                    '& .MuiDataGrid-withBorderColor': {
                      borderColor: 'var(--border) !important',
                    },
                    '& .MuiTablePagination-root': {
                      color: 'inherit',
                      fontFamily: 'inherit !important',
                    },
                    '& .MuiTablePagination-actions button': {
                      color: 'inherit',
                    },
                    '& .MuiTablePagination-select': {
                      color: 'inherit',
                      fontFamily: 'inherit !important',
                    },
                    '& .MuiTablePagination-displayedRows': {
                      fontFamily: 'inherit !important',
                    },
                    '& .MuiTablePagination-selectLabel': {
                      fontFamily: 'inherit !important',
                    },
                    color: 'inherit',
                    fontFamily: 'inherit',
                  }}
                />
              )}
            </div>
          )}

          {/* BOTTOM SECTION: MISUSE TIMELINE */}
          <motion.div
            initial={false}
            animate={{ height: isCollapsibleOpen ? '100%' : '0px' }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="bg-surface-2/50 backdrop-blur-md border-t border-border/50 flex flex-col relative shrink-0"
          >
            <div className={`absolute left-1/2 -translate-x-1/2 z-10 ${
              isCollapsibleOpen ? 'top-0' : '-top-7'
            }`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCollapsibleOpen(!isCollapsibleOpen)}
                className={`h-7 w-12 bg-surface-2/80 hover:bg-surface-2 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.1)] ${
                  isCollapsibleOpen 
                    ? 'rounded-b-lg rounded-t-none border-t-0' 
                    : 'rounded-t-lg rounded-b-none border-b-0'
                }`}
              >
                {isCollapsibleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
            
            {isCollapsibleOpen && (
              <div className="flex-1 flex flex-col min-h-0 w-full p-0 overflow-hidden animate-in fade-in duration-300">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCategory}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="flex-1 flex flex-col min-h-0 justify-center"
                  >
                    <MisuseTimelineEditor
                      activeCategory={activeCategory}
                      misuseCriteria={misuseCriteria}
                      setMisuseCriteria={setMisuseCriteria}
                      availableSignals={availableSignalsList}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
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
                              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
                            maskImage:
                              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
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
        <AlertDialogContent className="max-w-[400px] border border-border bg-popover/95 backdrop-blur-xl p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
            <AlertCircle className="w-6 h-6" />
          </div>
          <AlertDialogHeader className="items-center text-center gap-1.5">
            <AlertDialogTitle className="text-base font-bold text-foreground uppercase tracking-wider">
              {resetConfirmType === "config" && "Reset Configuration?"}
              {resetConfirmType === "gauge" && "Reset Gauge Limits?"}
              {resetConfirmType === "case" && "Unload Case File?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground max-w-[340px] leading-relaxed">
              {resetConfirmType === "config" &&
                "This will unmount the active configuration file. It affects multiple parts of the application, resetting all signals selection, pass criteria formulas, and custom gauge limits back to default system templates."}
              {resetConfirmType === "gauge" &&
                "This will revert the active matplotlib report gauge display limits back to default templates."}
              {resetConfirmType === "case" &&
                "This will unload the current case file and clear all of its loaded signals."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
            <AlertDialogCancel className="flex-1 bg-secondary border border-border hover:bg-secondary/80 text-secondary-foreground rounded-xl py-2 px-4 text-xs font-bold transition-all">
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
