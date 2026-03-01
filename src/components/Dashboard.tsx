
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
  ResponsiveContainer,
  Cell
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
  MousePointer2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DayType } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHART_COLORS: Record<string, string> = {
  VACATION: "#c6d9f1",
  TRAVEL_ENTRY: "#3CB371",
  ROTATION: "#ffc000",
  TRAVEL_EXIT: "#ffff00",
  STANDBY: "#e2e8f0",
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
  const { events, loading, updateDay, generateRotations, resyncChain } = useRotation();
  
  // States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [view, setView] = useState<"annual" | "monthly">("annual");
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
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

  // 1. Hooks first - all data calculations
  const stats = useMemo(() => {
    const periodPrefix = view === "annual" ? format(currentDate, "yyyy") : format(currentDate, "yyyy-MM");
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

  const chartData = useMemo(() => [
    { name: "Vacaciones", value: stats.VACATION, type: "VACATION" },
    { name: "V. Entrada", value: stats.TRAVEL_ENTRY, type: "TRAVEL_ENTRY" },
    { name: "Rotación", value: stats.ROTATION, type: "ROTATION" },
    { name: "V. Salida", value: stats.TRAVEL_EXIT, type: "TRAVEL_EXIT" },
    { name: "Standby", value: stats.STANDBY, type: "STANDBY" },
  ], [stats]);

  const blocksInYear = useMemo(() => {
    const yearStr = format(currentDate, "yyyy");
    const yearEvents = Object.entries(events)
      .filter(([dateKey]) => dateKey.startsWith(yearStr))
      .sort(([a], [b]) => a.localeCompare(b));

    const blocks: { type: DayType; start: string; duration: number }[] = [];
    if (yearEvents.length === 0) return blocks;

    let currentBlock: { type: DayType; start: string; duration: number } | null = null;

    yearEvents.forEach(([dateKey, event]) => {
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
  }, [events, currentDate]);

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

  // Unified click handler to solve single/double click conflict
  const onDayClickWrapper = useCallback((date: Date) => {
    if (clickTimeoutRef.current) {
      // Second click detected: it's a double click
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDayDoubleClickAction(date);
    } else {
      // First click: wait to see if a second click arrives
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

  const yearMonths = eachMonthOfInterval({
    start: startOfYear(currentDate),
    end: endOfYear(currentDate),
  });

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

          <div className="hidden xl:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-x px-4 h-full">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#c6d9f1]" /> Vacaciones
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3CB371]" /> V. Entrada
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffc000]" /> Rotación
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffff00]" /> V. Salida
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#e2e8f0]" /> Standby
            </div>
          </div>

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
            <RotationGenerator 
              onGenerate={generateRotations} 
              defaultDate={format(startOfYear(currentDate), "yyyy-01-01")}
            />
            
            <Card 
              className="shadow-sm border-muted cursor-pointer hover:bg-muted/5 transition-colors select-none"
              onClick={() => setStatsDialogOpen(true)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Estadísticas {view === "annual" ? format(currentDate, "yyyy") : format(currentDate, "MMM yyyy")}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MousePointer2 className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-[10px]">Clic para ver gráfica</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#e2e8f0]/20 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#e2e8f0]" />
                    <span className="text-xs font-medium uppercase tracking-tight">Standby</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{stats.STANDBY} d</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-muted flex flex-col h-[calc(100vh-28rem)] min-h-[400px]">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-primary" />
                    Bloques del {format(currentDate, "yyyy")}
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
                  {blocksInYear.map((block, idx) => (
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
                          block.type === "VACATION" ? "bg-[#c6d9f1]" : "bg-[#e2e8f0]"
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
                  {blocksInYear.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-6 italic">
                      No hay bloques generados para este año
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex-1 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Tabs value={view} onValueChange={(v) => setView(v as "annual" | "monthly")} className="md:hidden w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="monthly">Mes</TabsTrigger>
                  <TabsTrigger value="annual">Año</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-full border shadow-sm mx-auto md:mx-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="font-headline font-bold text-base min-w-[140px] text-center uppercase tracking-wide">
                  {view === "monthly" ? format(currentDate, "MMMM yyyy", { locale: es }) : format(currentDate, "yyyy")}
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
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

      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[80vw] h-[85vh] rounded-3xl border-none shadow-2xl flex flex-col p-6 sm:p-10">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-3xl font-bold">
              <BarChart3 className="w-8 h-8 text-primary" />
              Distribución de Días
            </DialogTitle>
            <DialogDescription className="text-lg">
              Resumen visual para {view === "annual" ? format(currentDate, "yyyy") : format(currentDate, "MMMM yyyy", { locale: es })}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 w-full mt-8 min-h-0">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 14, fontWeight: 700 }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 14, fontWeight: 700 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="value" 
                  radius={[12, 12, 0, 0]} 
                  barSize={120}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.type]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-8 shrink-0">
            {chartData.map((item) => (
              <div key={item.type} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/30 border border-muted/50">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: CHART_COLORS[item.type] }} />
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{item.name}</span>
                <span className="text-2xl font-black text-foreground">{item.value} d</span>
              </div>
            ))}
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
