"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRotation } from "@/hooks/useRotation";
import { MonthGrid } from "./Calendar/MonthGrid";
import { DayEditor } from "./Calendar/DayEditor";
import { BlockEditor } from "./Calendar/BlockEditor";
import { RotationGenerator } from "./RotationGenerator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig 
} from "@/components/ui/chart";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis,
  Cell,
  ReferenceLine,
  Legend
} from "recharts";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfYear, 
  eachMonthOfInterval, 
  endOfYear,
  addYears,
  subYears,
  startOfMonth,
  subDays,
  addDays,
  getDaysInMonth,
  parseISO,
  differenceInDays
} from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  LogOut,
  BarChart3,
  ListTodo,
  MousePointer2,
  History,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DayType } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHART_COLORS: Record<string, string> = {
  VACATION: "#c6d9f1",
  TRAVEL_ENTRY: "#3CB371",
  ROTATION: "#ffc000",
  TRAVEL_EXIT: "#ffff00",
  STANDBY: "#fee2e2",
  NORMAL: "#f4f4f5",
};

const chartConfig = {
  days: {
    label: "Días",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function Dashboard() {
  const { user, logout } = useAuth();
  const { events, loading, updateDay, generateRotations, resyncChain, clearYear } = useRotation();
  
  // States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [view, setView] = useState<"annual" | "monthly">("annual");
  const [showTravelDays, setShowTravelDays] = useState(true);
  const [showClassicTravelDays, setShowClassicTravelDays] = useState(true);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [yearlyStatsDialogOpen, setYearlyStatsDialogOpen] = useState(false);
  const [currentYearStatsDialogOpen, setCurrentYearStatsDialogOpen] = useState(false);
  const [blockData, setBlockData] = useState<{
    startDate: string;
    duration: number;
    type: DayType;
  } | null>(null);

  // Drag & Drop States
  const [dragState, setDragState] = useState<{
    anchorDate: string;
    type: DayType;
    initialTravelDate: string;
  } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Timer for single/double click distinction
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastChartClickRef = useRef<{ time: number; index: number | null }>({ time: 0, index: null });

  // Stats for current view (Monthly or Annual)
  const stats = useMemo(() => {
    const periodPrefix = view === "monthly" ? format(currentDate, "yyyy-MM") : format(currentDate, "yyyy");
    
    const raw = Object.entries(events).reduce((acc, [dateKey, event]) => {
      if (dateKey.startsWith(periodPrefix)) {
        acc[event.dayType] = (acc[event.dayType] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    let totalDays = 0;
    if (view === "monthly") {
      totalDays = getDaysInMonth(currentDate);
    } else {
      const year = currentDate.getFullYear();
      const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
      totalDays = isLeap ? 366 : 365;
    }

    const occupied = (raw.ROTATION || 0) + 
                    (raw.TRAVEL_ENTRY || 0) + 
                    (raw.TRAVEL_EXIT || 0) + 
                    (raw.VACATION || 0) +
                    (raw.STANDBY || 0);

    return {
      VACATION: raw.VACATION || 0,
      TRAVEL_ENTRY: raw.TRAVEL_ENTRY || 0,
      ROTATION: raw.ROTATION || 0,
      TRAVEL_EXIT: raw.TRAVEL_EXIT || 0,
      STANDBY: raw.STANDBY || 0,
      NORMAL: Math.max(0, totalDays - occupied)
    };
  }, [events, currentDate, view]);

  // Monthly breakdown for the current year (for the currentYearStatsDialog)
  const monthlyStatsForCurrentYear = useMemo(() => {
    const year = currentDate.getFullYear();
    const months = eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate),
    });

    return months.map((month) => {
      const monthKey = format(month, "yyyy-MM");
      const raw = Object.entries(events).reduce((acc, [dateKey, event]) => {
        if (dateKey.startsWith(monthKey)) {
          acc[event.dayType] = (acc[event.dayType] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        month: format(month, "MMM", { locale: es }),
        VACATION: raw.VACATION || 0,
        TRAVEL_ENTRY: raw.TRAVEL_ENTRY || 0,
        ROTATION: raw.ROTATION || 0,
        TRAVEL_EXIT: raw.TRAVEL_EXIT || 0,
        STANDBY: raw.STANDBY || 0,
      };
    });
  }, [events, currentDate]);

  // Global Stats Year by Year for Historico
  const yearlyStatsBreakdown = useMemo(() => {
    const years: Record<number, Record<string, number>> = {};
    const currentYear = new Date().getFullYear();
    
    // Find the first year with any data
    const eventYears = Object.keys(events)
      .map(k => parseInt(k.substring(0, 4)))
      .filter(y => !isNaN(y));
    
    const startYear = eventYears.length > 0 ? Math.min(...eventYears) : currentYear;
    
    for (let y = startYear; y <= currentYear + 1; y++) {
      years[y] = { VACATION: 0, TRAVEL_ENTRY: 0, ROTATION: 0, TRAVEL_EXIT: 0, STANDBY: 0 };
    }

    Object.entries(events).forEach(([dateKey, event]) => {
      const year = parseInt(dateKey.substring(0, 4));
      if (year >= startYear && years[year]) {
        years[year][event.dayType] = (years[year][event.dayType] || 0) + 1;
      }
    });

    return Object.entries(years).map(([year, data]) => ({
      year,
      ...data
    })).sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [events]);

  const blocksInPeriod = useMemo(() => {
    const periodPrefix = view === "monthly" ? format(currentDate, "yyyy-MM") : format(currentDate, "yyyy");
    const periodEvents = Object.entries(events)
      .filter(([dateKey]) => dateKey.startsWith(periodPrefix))
      .sort(([a], [b]) => a.localeCompare(b));

    const blocks: { type: DayType; start: string; duration: number }[] = [];
    if (periodEvents.length === 0) return blocks;

    let currentBlock: { type: DayType; start: string; duration: number } | null = null;

    periodEvents.forEach(([dateKey, event]) => {
      const type = event.dayType;
      
      if (type === "VACATION" || type === "ROTATION" || type === "STANDBY") {
        if (currentBlock && currentBlock.type === type) {
          currentBlock.duration++;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = { type, start: dateKey, duration: 1 };
        }
      } else if (type === "TRAVEL_ENTRY") {
        if (currentBlock && currentBlock.type === "VACATION") {
          currentBlock.duration++;
          blocks.push(currentBlock);
          currentBlock = null;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = null;
        }
      } else if (type === "TRAVEL_EXIT") {
        if (currentBlock && currentBlock.type === "ROTATION") {
          currentBlock.duration++;
          blocks.push(currentBlock);
          currentBlock = null;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = null;
        }
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = null;
      }
    });
    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  }, [events, currentDate, view]);

  // Handlers
  const handleDayMouseDown = useCallback((date: Date, type: string) => {
    const dateKey = format(date, "yyyy-MM-dd");
    let baseType: DayType;
    
    if (type === "TRAVEL_EXIT") baseType = "ROTATION";
    else if (type === "TRAVEL_ENTRY") baseType = "VACATION";
    else return;

    let start = date;
    let checkDate = subDays(date, 1);
    while (true) {
      const prevKey = format(checkDate, "yyyy-MM-dd");
      const prevEvent = events[prevKey];
      if (!prevEvent || prevEvent.dayType !== baseType) break;
      start = checkDate;
      checkDate = subDays(checkDate, 1);
    }

    setDragState({
      anchorDate: format(start, "yyyy-MM-dd"),
      type: baseType,
      initialTravelDate: dateKey
    });
    setHoverDate(dateKey);
  }, [events]);

  const handleDayMouseEnter = useCallback((date: Date) => {
    setHoverDate(format(date, "yyyy-MM-dd"));
  }, []);

  const handleDayClickAction = useCallback((date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const event = events[dateKey];

    if (view === "annual") {
      let targetType = event?.dayType;
      let targetDate = date;

      if (targetType === "TRAVEL_EXIT") {
        targetType = "ROTATION";
        targetDate = subDays(date, 1);
      } else if (targetType === "TRAVEL_ENTRY") {
        targetType = "VACATION";
        targetDate = subDays(date, 1);
      }

      if (targetType === "ROTATION" || targetType === "VACATION" || targetType === "STANDBY") {
        const typeToFind = targetType as DayType;
        let start = targetDate;
        
        let checkDate = subDays(targetDate, 1);
        while (true) {
          const prevKey = format(checkDate, "yyyy-MM-dd");
          const prevEvent = events[prevKey];
          if (!prevEvent || prevEvent.dayType !== typeToFind) break;
          start = checkDate;
          checkDate = subDays(checkDate, 1);
        }

        let baseDuration = 0;
        let scanDate = start;
        while (true) {
          const currentKey = format(scanDate, "yyyy-MM-dd");
          const currentEvent = events[currentKey];
          if (!currentEvent || currentEvent.dayType !== typeToFind) break;
          baseDuration++;
          scanDate = addDays(scanDate, 1);
        }

        const effectiveDuration = (typeToFind === "ROTATION" || typeToFind === "VACATION") ? baseDuration - 1 : baseDuration;

        setBlockData({
          startDate: format(start, "yyyy-MM-dd"),
          duration: effectiveDuration,
          type: typeToFind
        });
        setBlockEditorOpen(true);
      }
    } else {
      setEditingDate(dateKey);
    }
  }, [events, view]);

  const handleDayDoubleClickAction = useCallback((date: Date) => {
    if (view === "annual") {
      setCurrentDate(date);
      setView("monthly");
    } else if (view === "monthly") {
      setView("annual");
    }
  }, [view]);

  const onDayClickWrapper = useCallback((date: Date) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDayDoubleClickAction(date);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        handleDayClickAction(date);
        clickTimeoutRef.current = null;
      }, 250);
    }
  }, [handleDayClickAction, handleDayDoubleClickAction]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragState && hoverDate) {
        const anchor = parseISO(dragState.anchorDate);
        const target = parseISO(hoverDate);
        const newDuration = Math.max(1, differenceInDays(target, anchor));
        
        if (newDuration !== differenceInDays(parseISO(dragState.initialTravelDate), anchor)) {
          resyncChain(dragState.anchorDate, newDuration, dragState.type);
        }
      }
      setDragState(null);
      setHoverDate(null);
    };

    if (dragState) {
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [dragState, hoverDate, resyncChain]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Sincronizando con la nube...</p>
      </div>
    );
  }

  const handleBlockDoubleClick = (block: { type: DayType; start: string; duration: number }) => {
    const effectiveDuration = (block.type === "ROTATION" || block.type === "VACATION") ? block.duration - 1 : block.duration;
    setBlockData({
      startDate: block.start,
      duration: effectiveDuration,
      type: block.type
    });
    setBlockEditorOpen(true);
  };

  const next = () => {
    if (view === "monthly") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addYears(currentDate, 1));
  };

  const prev = () => {
    if (view === "monthly") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subYears(currentDate, 1));
  };

  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload) return;
    
    const now = Date.now();
    const activeIndex = data.activeTooltipIndex;
    
    if (now - lastChartClickRef.current.time < 300 && lastChartClickRef.current.index === activeIndex) {
      // Double click detected on a bar
      const year = data.activePayload[0].payload.year;
      const newDate = new Date(parseInt(year), 0, 1);
      setCurrentDate(newDate);
      setView("annual");
      setYearlyStatsDialogOpen(false);
    }
    
    lastChartClickRef.current = { time: now, index: activeIndex };
  };

  const yearMonths = eachMonthOfInterval({
    start: startOfYear(currentDate),
    end: endOfYear(currentDate),
  });

  const periodLabel = view === "monthly" ? format(currentDate, "MMMM yyyy", { locale: es }) : format(currentDate, "yyyy");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-primary p-2 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-headline font-bold text-lg hidden lg:block tracking-tight">Algeria Rotation Planner</h1>
            <h1 className="font-headline font-bold text-lg lg:hidden">ARP</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 border-r h-9">
              <Checkbox 
                id="toggle-travel" 
                checked={showTravelDays} 
                onCheckedChange={(checked) => {
                  const val = !!checked;
                  setShowTravelDays(val);
                  if (!val) {
                    setShowClassicTravelDays(false);
                  }
                }}
              />
              <Label htmlFor="toggle-travel" className="text-[10px] font-bold uppercase tracking-tight cursor-pointer">
                TRAVEL DAYS
              </Label>
            </div>

            {showTravelDays && (
              <div className="flex items-center gap-2 px-3 border-r h-9 animate-in fade-in slide-in-from-left-2 duration-300">
                <Checkbox 
                  id="toggle-classic" 
                  checked={showClassicTravelDays} 
                  onCheckedChange={(checked) => setShowClassicTravelDays(!!checked)}
                />
                <Label htmlFor="toggle-classic" className="text-[10px] font-bold uppercase tracking-tight cursor-pointer">
                  CLASSIC VIEW TRAVEL DAYS
                </Label>
              </div>
            )}

            <Tabs value={view} onValueChange={(v) => setView(v as "annual" | "monthly")} className="hidden md:flex w-auto">
              <TabsList className="grid grid-cols-2 h-9 w-[200px]">
                <TabsTrigger value="monthly" className="gap-2">
                  <CalendarIcon className="w-4 h-4" /> Mes
                </TabsTrigger>
                <TabsTrigger value="annual" className="gap-2">
                  <LayoutGrid className="w-4 h-4" /> Año
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => logout()}>
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:flex-row gap-8">
          
          <aside className="w-full md:w-80 space-y-6 shrink-0">
            {view === "annual" && (
              <RotationGenerator 
                onGenerate={generateRotations} 
                onClearYear={clearYear}
                defaultDate={format(startOfYear(currentDate), "yyyy-01-01")}
              />
            )}
            
            <Card 
              className="shadow-sm border-muted transition-all select-none cursor-pointer hover:bg-muted/5 group"
              onClick={() => setCurrentYearStatsDialogOpen(true)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Estadísticas {periodLabel}
                  </div>
                  <TrendingUp className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#c6d9f1]/20 border border-[#c6d9f1]/40">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#c6d9f1]" />
                    <span className="text-xs font-medium uppercase tracking-tight">Vacaciones</span>
                  </div>
                  <span className="text-sm font-bold text-[#1e3a8a]">{stats.VACATION} d</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#3CB371]/5 border border-[#3CB371]/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3CB371]" />
                    <span className="text-xs font-medium uppercase tracking-tight">V. Entrada</span>
                  </div>
                  <span className="text-sm font-bold text-[#3CB371]">{stats.TRAVEL_ENTRY} d</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#ffc000]/10 border border-[#ffc000]/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ffc000]" />
                    <span className="text-xs font-medium uppercase tracking-tight">Rotación</span>
                  </div>
                  <span className="text-sm font-bold text-[#2B1A0A]">{stats.ROTATION} d</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#ffff00]/10 border border-[#ffff00]/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ffff00]" />
                    <span className="text-xs font-medium uppercase tracking-tight">V. Salida</span>
                  </div>
                  <span className="text-sm font-bold text-[#b8860b]">{stats.TRAVEL_EXIT} d</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#fee2e2]/20 border border-red-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#fee2e2]" />
                    <span className="text-xs font-medium uppercase tracking-tight">Standby</span>
                  </div>
                  <span className="text-sm font-bold text-red-700">{stats.STANDBY} d</span>
                </div>
                <p className="text-[9px] text-center text-muted-foreground italic pt-1">
                  Haz clic para ver gráfica detallada
                </p>
              </CardContent>
            </Card>

            <Card className={cn(
              "shadow-sm border-muted flex flex-col transition-all",
              view === "annual" ? "max-h-[calc(100vh-28rem)] h-fit" : "h-auto"
            )}>
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-primary" />
                    Bloques de {periodLabel}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MousePointer2 className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-[10px]">Doble clic para editar bloque</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto px-4 pb-4 flex-1 custom-scrollbar">
                <div className="space-y-2">
                  {blocksInPeriod.map((block, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between text-[11px] py-2 border-b last:border-0 border-muted/50 cursor-pointer hover:bg-muted/10 transition-colors group rounded-lg px-2"
                      onDoubleClick={() => handleBlockDoubleClick(block)}
                      title="Doble clic para editar este bloque"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0", 
                          block.type === "ROTATION" ? "bg-[#ffc000]" : 
                          block.type === "VACATION" ? "bg-[#c6d9f1]" : "bg-[#fee2e2]"
                        )} />
                        <div>
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {block.type === "ROTATION" ? "Rotación + V. Salida" : 
                             block.type === "VACATION" ? "Vacaciones + V. Entrada" : "Standby"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(block.start), "d MMM", { locale: es })} - {format(addDays(parseISO(block.start), block.duration - 1), "d MMM", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/30 px-2 py-1 rounded-md group-hover:bg-primary/20 transition-colors">
                        <span className="text-sm font-bold text-primary">{block.duration} d</span>
                      </div>
                    </div>
                  ))}
                  {blocksInPeriod.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-6 italic">
                      No hay bloques registrados para este periodo
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Tabs value={view} onValueChange={(v) => setView(v as "annual" | "monthly")} className="md:hidden w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="monthly">Mes</TabsTrigger>
                  <TabsTrigger value="annual">Año</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1 flex justify-start md:justify-start">
                <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-full border shadow-sm">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <h2 className="font-headline font-bold text-base min-w-[140px] text-center uppercase tracking-wide">
                    {periodLabel}
                  </h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {view === "annual" && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setYearlyStatsDialogOpen(true)}
                    className="gap-2 rounded-full border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-xs font-bold uppercase tracking-widest h-10 px-6 transition-all"
                  >
                    <History className="w-4 h-4 text-primary" />
                    Histórico Anual
                  </Button>
                </div>
              )}
            </div>

            <div className={cn(
              "bg-card border rounded-2xl p-4 sm:p-6 shadow-sm min-h-[500px] transition-all",
              dragState && "ring-2 ring-primary ring-offset-2 ring-inset"
            )}>
              {view === "monthly" ? (
                <MonthGrid 
                  monthDate={startOfMonth(currentDate)} 
                  events={events} 
                  onDayClick={onDayClickWrapper}
                  onDayMouseDown={handleDayMouseDown}
                  onDayMouseEnter={handleDayMouseEnter}
                  dragAnchorDate={dragState?.anchorDate}
                  dragHoverDate={hoverDate}
                  isDragging={!!dragState}
                  showTravelDays={showTravelDays}
                  showClassicTravelDays={showClassicTravelDays}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {yearMonths.map((m) => (
                    <div key={m.getTime()} className="space-y-3">
                      <h3 className="text-sm font-bold text-primary pl-1 uppercase tracking-wider">{format(m, "MMMM", { locale: es })}</h3>
                      <MonthGrid 
                        monthDate={m} 
                        events={events} 
                        mini 
                        onDayClick={onDayClickWrapper}
                        onDayMouseDown={handleDayMouseDown}
                        onDayMouseEnter={handleDayMouseEnter}
                        dragAnchorDate={dragState?.anchorDate}
                        dragHoverDate={hoverDate}
                        isDragging={!!dragState}
                        showTravelDays={showTravelDays}
                        showClassicTravelDays={showClassicTravelDays}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <DayEditor 
        date={editingDate} 
        event={editingDate ? events[editingDate] : undefined}
        onClose={() => setEditingDate(null)}
        onSave={updateDay}
      />

      <BlockEditor
        isOpen={blockEditorOpen}
        onClose={() => setBlockEditorOpen(false)}
        startDate={blockData?.startDate || null}
        currentDuration={blockData?.duration || 0}
        type={blockData?.type || "ROTATION"}
        onSave={resyncChain}
      />

      {/* Current Year Detailed Stats Dialog */}
      <Dialog open={currentYearStatsDialogOpen} onOpenChange={setCurrentYearStatsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-4xl h-auto rounded-3xl border-none shadow-2xl flex flex-col p-6 sm:p-10">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="w-6 h-6 text-primary" />
              Desglose Mensual {currentDate.getFullYear()}
            </DialogTitle>
            <DialogDescription>
              Resumen visual de los días trabajados y de descanso mes a mes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 w-full mt-6 h-[400px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <BarChart data={monthlyStatsForCurrentYear} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="TRAVEL_ENTRY" name="V. Entrada" stackId="a" fill={CHART_COLORS.TRAVEL_ENTRY} />
                <Bar dataKey="ROTATION" name="Rotación" stackId="a" fill={CHART_COLORS.ROTATION} />
                <Bar dataKey="TRAVEL_EXIT" name="V. Salida" stackId="a" fill={CHART_COLORS.TRAVEL_EXIT} />
                <Bar dataKey="VACATION" name="Vacaciones" stackId="a" fill={CHART_COLORS.VACATION} />
                <Bar dataKey="STANDBY" name="Standby" stackId="a" fill={CHART_COLORS.STANDBY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Yearly Breakdown Dialog (History) */}
      <Dialog open={yearlyStatsDialogOpen} onOpenChange={setYearlyStatsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[90vw] h-[90vh] rounded-3xl border-none shadow-2xl flex flex-col p-6 sm:p-10">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-3xl font-bold">
              <History className="w-8 h-8 text-primary" />
              Histórico Anual
            </DialogTitle>
            <DialogDescription className="text-lg">
              Evolución detallada de rotaciones, viajes y vacaciones año tras año.
              <span className="block text-xs text-muted-foreground mt-1 italic">
                (Haz doble clic en una barra para navegar a ese año)
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 w-full mt-8 min-h-0 overflow-x-auto">
            <div className="min-w-[1000px] h-full">
              <ChartContainer config={chartConfig} className="w-full h-full">
                <BarChart 
                  data={yearlyStatsBreakdown} 
                  margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  onClick={handleChartClick}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="year" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 700 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine 
                    y={180} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="3 3" 
                    label={{ position: 'right', value: '180d', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <Bar dataKey="TRAVEL_ENTRY" name="V. Entrada" stackId="a" fill={CHART_COLORS.TRAVEL_ENTRY} />
                  <Bar dataKey="ROTATION" name="Rotación" stackId="a" fill={CHART_COLORS.ROTATION} />
                  <Bar dataKey="TRAVEL_EXIT" name="V. Salida" stackId="a" fill={CHART_COLORS.TRAVEL_EXIT} />
                  <Bar dataKey="VACATION" name="Vacaciones" stackId="a" fill={CHART_COLORS.VACATION} />
                  <Bar dataKey="STANDBY" name="Standby" stackId="a" fill={CHART_COLORS.STANDBY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <footer className="py-6 border-t bg-muted/20 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">RotationVista &copy; {new Date().getFullYear()} - Gestión de Rotaciones Argelia</p>
        </div>
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted));
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}
