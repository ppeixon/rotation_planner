
"use client";

import React, { useState } from "react";
import { useRotation } from "@/hooks/useRotation";
import { MonthGrid } from "./Calendar/MonthGrid";
import { DayEditor } from "./Calendar/DayEditor";
import { BlockEditor } from "./Calendar/BlockEditor";
import { RotationGenerator } from "./RotationGenerator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  getDaysInMonth
} from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  LogOut,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DayType } from "@/lib/types";

export function Dashboard() {
  const { user, logout } = useAuth();
  const { events, loading, updateDay, generateRotations, resyncChain } = useRotation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [view, setView] = useState<"annual" | "monthly">("annual");

  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [blockData, setBlockData] = useState<{
    startDate: string;
    duration: number;
    type: DayType;
  } | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Sincronizando con la nube...</p>
      </div>
    );
  }

  const handleDayClick = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const event = events[dateKey];

    if (view === "annual") {
      let targetType = event?.dayType;
      let targetDate = date;

      // Si pulsamos en un viaje, intentamos asociarlo al bloque anterior para editar la cadena
      if (targetType === "TRAVEL_EXIT") {
        targetType = "ROTATION";
        targetDate = subDays(date, 1);
      } else if (targetType === "TRAVEL_ENTRY") {
        targetType = "VACATION";
        targetDate = subDays(date, 1);
      }

      if (targetType === "ROTATION" || targetType === "VACATION") {
        const typeToFind = targetType as DayType;
        let start = targetDate;
        
        // Buscar inicio del bloque contiguo del mismo tipo
        let checkDate = subDays(targetDate, 1);
        while (true) {
          const prevKey = format(checkDate, "yyyy-MM-dd");
          const prevEvent = events[prevKey];
          if (!prevEvent || prevEvent.dayType !== typeToFind) break;
          start = checkDate;
          checkDate = subDays(checkDate, 1);
        }

        // Calcular duración del bloque base (sin contar el viaje)
        let baseDuration = 0;
        let scanDate = start;
        while (true) {
          const currentKey = format(scanDate, "yyyy-MM-dd");
          const currentEvent = events[currentKey];
          if (!currentEvent || currentEvent.dayType !== typeToFind) break;
          baseDuration++;
          scanDate = addDays(scanDate, 1);
        }

        setBlockData({
          startDate: format(start, "yyyy-MM-dd"),
          duration: baseDuration,
          type: typeToFind
        });
        setBlockEditorOpen(true);
      } else {
        // Otros casos (standby, normal, o viajes aislados) saltan a mensual
        setCurrentDate(date);
        setView("monthly");
      }
    } else {
      setEditingDate(dateKey);
    }
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

  const periodPrefix = view === "annual" ? format(currentDate, "yyyy") : format(currentDate, "yyyy-MM");
  
  const rawStats = Object.entries(events).reduce((acc, [dateKey, event]) => {
    if (dateKey.startsWith(periodPrefix)) {
      acc[event.dayType] = (acc[event.dayType] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  let totalInPeriod = 0;
  if (view === "monthly") {
    totalInPeriod = getDaysInMonth(currentDate);
  } else {
    const year = currentDate.getFullYear();
    const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
    totalInPeriod = isLeap ? 366 : 365;
  }

  const occupiedDays = (rawStats.ROTATION || 0) + 
                      (rawStats.TRAVEL_ENTRY || 0) + 
                      (rawStats.TRAVEL_EXIT || 0) + 
                      (rawStats.VACATION || 0);

  const stats = {
    VACATION: rawStats.VACATION || 0,
    TRAVEL_ENTRY: rawStats.TRAVEL_ENTRY || 0,
    ROTATION: rawStats.ROTATION || 0,
    TRAVEL_EXIT: rawStats.TRAVEL_EXIT || 0,
    STANDBY: Math.max(0, totalInPeriod - occupiedDays)
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body">
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-primary p-2 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-headline font-bold text-lg hidden sm:block">Algeria Rotation Planner</h1>
            <h1 className="font-headline font-bold text-lg sm:hidden">ARP</h1>
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
            
            <Card className="shadow-sm border-muted">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Estadísticas {view === "annual" ? format(currentDate, "yyyy") : format(currentDate, "MMM yyyy")}
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
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <span className="text-xs font-medium uppercase tracking-tight">Standby</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{stats.STANDBY} d</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 p-4 bg-muted/20 rounded-2xl border text-[11px] text-muted-foreground leading-tight">
              <p className="font-bold mb-1 uppercase tracking-wider">Leyenda</p>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#c6d9f1]" />
                   <span>Azul: Vacaciones (26 días)</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#3CB371]" />
                   <span>Verde: Viaje Entrada (1 día)</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#ffc000]" />
                   <span>Naranja: Rotación (28 días)</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#ffff00]" />
                   <span>Amarillo: Viaje Salida (1 día)</span>
                </div>
              </div>
            </div>
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
                  {view === "monthly" ? format(currentDate, "MMMM yyyy") : format(currentDate, "yyyy")}
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 sm:p-6 shadow-sm min-h-[500px]">
              {view === "monthly" ? (
                <MonthGrid 
                  monthDate={startOfMonth(currentDate)} 
                  events={events} 
                  onDayClick={handleDayClick} 
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {yearMonths.map((m) => (
                    <div key={m.getTime()} className="space-y-3">
                      <h3 className="text-sm font-bold text-primary pl-1 uppercase tracking-wider">{format(m, "MMMM")}</h3>
                      <MonthGrid 
                        monthDate={m} 
                        events={events} 
                        mini 
                        onDayClick={handleDayClick} 
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
      
      <footer className="py-6 border-t bg-muted/20 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">RotationVista &copy; {new Date().getFullYear()} - Gestión de Rotaciones Argelia</p>
        </div>
      </footer>
    </div>
  );
}
