import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Folder, File, CheckSquare, LayoutGrid, Locate, LocateOff, FileChartColumnIncreasing, FolderRoot, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FolderNavigatorProps {
  results: any[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  checkedFilesSet: Set<string>;
  onToggleCheck: (path: string) => void;
  onToggleFolder: (node: any) => void;
  selectionType: string;
  onSelectionChange: (val: string) => void;
  totalMF4Count: number;
}

const getAllFilesUnderNode = (node: any): string[] => {
  let files: string[] = []
  if (node.type === 'file') {
    files.push(node.path)
  }
  if (node.children) {
    for (const child of node.children) {
      files = files.concat(getAllFilesUnderNode(child))
    }
  }
  return files
}

const findPathToNode = (nodes: any[], targetPath: string, currentPath: string[] = []): string[] | null => {
  const normTarget = normalizePath(targetPath);
  for (const node of nodes) {
    if (node.type === 'file' && normalizePath(node.path) === normTarget) {
      return currentPath;
    }
    if (node.children) {
      const found = findPathToNode(node.children, targetPath, [...currentPath, node.name]);
      if (found) return found;
    }
  }
  return null;
}

const normalizePath = (p: string): string => {
  return p.replace(/\\/g, '/').toLowerCase().replace(/_tracking\.mf4$/i, '.mf4');
}

export function FolderNavigator({
  results,
  selectedPath,
  onSelect,
  checkedFilesSet,
  onToggleCheck,
  onToggleFolder,
  selectionType,
  onSelectionChange,
  totalMF4Count,
}: FolderNavigatorProps) {
  // We track the path of folder names to navigate down the tree
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const lastNavigatedPath = useRef<string | null>(null);

  useEffect(() => {
    if (selectedPath && results.length > 0) {
      const normSelected = normalizePath(selectedPath);
      if (normSelected !== (lastNavigatedPath.current ? normalizePath(lastNavigatedPath.current) : null)) {
        const foundPath = findPathToNode(results, selectedPath);
        if (foundPath) {
          setCurrentPath(foundPath);
          lastNavigatedPath.current = selectedPath;
        }
      }
    }
  }, [selectedPath, results]);

  // Find the current node by traversing the results tree
  const currentNodeContent = useMemo(() => {
    let currentNodes = results;
    for (const folderName of currentPath) {
      const found = currentNodes.find(n => n.name === folderName && n.type !== 'file');
      if (found && found.children) {
        currentNodes = found.children;
      } else {
        // Fallback if path becomes invalid
        currentNodes = [];
        break;
      }
    }
    return currentNodes;
  }, [results, currentPath]);

  const navigateTo = (folderName: string) => {
    setCurrentPath(prev => [...prev, folderName]);
  };

  const navigateUpTo = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(prev => prev.slice(0, index + 1));
    }
  };

  const goBack = () => {
    if (currentPath.length > 0) {
      setCurrentPath(prev => prev.slice(0, -1));
    }
  };

  const renderBreadcrumbs = () => {
    if (currentPath.length === 0) {
      return (
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbPage className="cursor-default flex items-center text-muted-foreground" title="Root">
                <FolderRoot className="w-4 h-4 text-primary" />
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );
    }

    if (currentPath.length <= 2) {
      return (
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink 
                className="cursor-pointer flex items-center hover:text-foreground" 
                onClick={(e) => { e.preventDefault(); navigateUpTo(-1); }}
                title="Root"
              >
                <FolderRoot className="w-4 h-4 text-primary" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            {currentPath.map((folder, idx) => {
              const isLast = idx === currentPath.length - 1;
              return (
                <React.Fragment key={idx}>
                  <BreadcrumbSeparator className="shrink-0" />
                  <BreadcrumbItem className="shrink-0 min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="cursor-default max-w-[90px] truncate font-medium text-foreground" title={folder}>
                        {folder}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        className="cursor-pointer max-w-[90px] truncate hover:text-foreground" 
                        title={folder}
                        onClick={(e) => { e.preventDefault(); navigateUpTo(idx); }}
                      >
                        {folder}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      );
    }

    // Path is very long (> 2 levels), collapse intermediate items to keep everything on one row
    const firstFolder = currentPath[0];
    const lastFolder = currentPath[currentPath.length - 1];
    const middleFolders = currentPath
      .map((folder, idx) => ({ folder, idx }))
      .slice(1, -1);

    return (
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap overflow-hidden">
          {/* Root Link */}
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbLink 
              className="cursor-pointer flex items-center hover:text-foreground" 
              onClick={(e) => { e.preventDefault(); navigateUpTo(-1); }}
              title="Root"
            >
              <FolderRoot className="w-4 h-4 text-primary" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="shrink-0" />

          {/* First Folder */}
          <BreadcrumbItem className="shrink-0 min-w-0">
            <BreadcrumbLink 
              className="cursor-pointer max-w-[90px] truncate hover:text-foreground" 
              title={firstFolder}
              onClick={(e) => { e.preventDefault(); navigateUpTo(0); }}
            >
              {firstFolder}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="shrink-0" />

          {/* Collapsible middle folders */}
          <BreadcrumbItem className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-muted/50 rounded flex items-center justify-center">
                  <BreadcrumbEllipsis />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  {middleFolders.map(({ folder, idx }) => (
                    <DropdownMenuItem 
                      key={idx} 
                      onClick={() => navigateUpTo(idx)}
                      className="cursor-pointer"
                    >
                      {folder}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="shrink-0" />

          {/* Last Folder */}
          <BreadcrumbItem className="shrink-0 min-w-0">
            <BreadcrumbPage className="cursor-default max-w-[90px] truncate font-medium text-foreground" title={lastFolder}>
              {lastFolder}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  const getFolderCheckboxState = (node: any) => {
    const nestedFiles = getAllFilesUnderNode(node);
    if (nestedFiles.length === 0) return false;
    const checkedNestedCount = nestedFiles.filter(f => checkedFilesSet.has(f)).length;
    const isAllChecked = checkedNestedCount === nestedFiles.length;
    const isIndeterminate = checkedNestedCount > 0 && checkedNestedCount < nestedFiles.length;
    return isAllChecked ? true : (isIndeterminate ? "indeterminate" : false);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      <div className="p-4 border-b border-white/5 bg-surface-2/30 flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold tracking-tight text-foreground">
                {currentPath.length > 0 ? `Recordings / ${currentPath[currentPath.length - 1]}` : "Recordings"}
              </span>
           </div>
        </div>

        {/* Radio Selection Group */}
        <RadioGroup 
          value={selectionType} 
          onValueChange={onSelectionChange}
          className="flex gap-x-3 gap-y-2"
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'none', label: 'None' },
          ].map((item) => (
            <div key={item.id} className="flex items-center space-x-1.5">
              <RadioGroupItem value={item.id} id={`r-${item.id}`} className="w-3 h-3 border-white/20" />
              <Label htmlFor={`r-${item.id}`} className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                {item.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <ScrollArea className="flex-1 bg-background/30 scroll-fade-mask relative">
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <AnimatePresence mode="popLayout">
              {currentNodeContent.map((node: any, idx: number) => {
                if (node.type === 'file') {
                  const isChecked = checkedFilesSet.has(node.path);
                  const isSelected = selectedPath && normalizePath(selectedPath) === normalizePath(node.path);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={node.path || idx}
                      onClick={() => onSelect(node.path)}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all hover:bg-surface-3 group",
                        isSelected ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-sm" : "bg-card border-border/50 text-foreground/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <File className={cn("w-5 h-5 shrink-0", isSelected ? "text-primary" : "text-primary/60 group-hover:text-primary")} />
                        <div onClick={(e) => { e.stopPropagation(); onToggleCheck(node.path); }}>
                          <Checkbox 
                            checked={isChecked} 
                            className="w-4 h-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                          />
                        </div>
                        <div className="flex gap-1 items-center">
                          <Badge 
                            key={`marks-${node.has_marks}`}
                            variant={node.has_marks ? "success" : "destructive"} 
                            className={cn("p-0 w-5 h-5 border-0 flex items-center justify-center rounded-md transition-all duration-300", node.has_marks && "animate-badge-pop")}
                            title={node.has_marks ? "Marks Completed" : "Marks Pending"}
                          >
                            {node.has_marks ? <Locate className="w-3.5 h-3.5" /> : <LocateOff className="w-3.5 h-3.5" />}
                          </Badge>
                          <Badge 
                            key={`report-${node.has_report}`}
                            variant={node.has_report ? "success" : "destructive"} 
                            className={cn("p-0 w-5 h-5 border-0 flex items-center justify-center rounded-md transition-all duration-300", node.has_report && "animate-badge-pop")}
                            title={node.has_report ? "Report Completed" : "Report Pending"}
                          >
                            {node.has_report ? <FileChartColumnIncreasing className="w-3.5 h-3.5" /> : <File className="w-3.5 h-3.5" />}
                          </Badge>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs font-bold leading-tight line-clamp-2 mt-auto", 
                        isSelected ? "text-primary" : "text-foreground"
                      )} title={node.name}>
                        {node.name}
                      </span>
                    </motion.div>
                  );
                } else {
                  // Folder Node
                  const folderCheckState = getFolderCheckboxState(node);
                  const totalFiles = getAllFilesUnderNode(node).length;
                  const normalizedSelected = selectedPath ? normalizePath(selectedPath) : null;
                  const containsSelected = normalizedSelected && getAllFilesUnderNode(node)
                    .map(f => normalizePath(f))
                    .includes(normalizedSelected);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={node.name || idx}
                      onClick={() => navigateTo(node.name)}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer group",
                        containsSelected 
                          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-sm" 
                          : "border-border/50 bg-card hover:bg-surface-3"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Folder className="w-5 h-5 text-amber-500/80 group-hover:text-amber-500 shrink-0" />
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-extrabold text-muted-foreground/80 bg-surface-3/50 border border-white/5 rounded px-1.5 min-w-[20px] h-4 flex items-center justify-center shrink-0" title={`${totalFiles} files`}>
                            {totalFiles}
                          </span>
                          <div onClick={() => onToggleFolder(node)} className="flex items-center justify-center h-4">
                            <Checkbox 
                              checked={folderCheckState} 
                              className="w-4 h-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-2 text-foreground mt-auto" title={node.name}>
                        {node.name}
                      </span>
                    </motion.div>
                  );
                }
              })}
            </AnimatePresence>
            {currentNodeContent.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Folder className="w-8 h-8 opacity-20 mb-2" />
                <span className="text-sm font-medium">Empty folder</span>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Floating Back Button */}
      <AnimatePresence>
        {currentPath.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-[54px] left-1/2 -translate-x-1/2 z-20"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              className="bg-popover/90 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-foreground font-bold text-xs py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 border-t border-white/5 bg-surface-2/30 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold text-primary tracking-tight">
              {checkedFilesSet.size} selected
            </span>
         </div>
         <span className="text-xs font-medium text-muted-foreground tracking-tight opacity-50">
            Total: {totalMF4Count} MF4
         </span>
      </div>
    </div>
  );
}
