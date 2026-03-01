
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { RefreshCw, Play, CalendarRange, Trash2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface RotationGeneratorProps {
  onGenerate: (startDateKey: string, initialType: string, initialDuration: number) => void;
  onClearYear: (year: number) => void;
  isGenerating?: boolean;
  defaultDate?: string;
}

export function RotationGenerator({ onGenerate, onClearYear, isGenerating, defaultDate }: RotationGeneratorProps) {
  const { isReadOnly } = useAuth();
  const [startDate, setStartDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [initialType, setInitialType] = useState<string>("ROTATION");
  const [initialDuration, setInitialDuration] = useState<number>(28);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && defaultDate) {
      setStartDate(defaultDate);
    }
  }, [open, defaultDate]);

  const handleGenerate = () => {
    if (isReadOnly) return;
    onGenerate(startDate, initialType, initialDuration);
    setOpen(false);
  };

  const handleClear = () => {
    if (isReadOnly) return;
    const year = parseISO(startDate).getFullYear();
    onClearYear(year);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full h-12 gap-2 text-base font-bold shadow-md hover:scale-[1.01] transition-transform rounded-xl">
          <CalendarRange className="w-5 h-5" />
          Configurar Rotación
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="w-5 h-5 text-primary" />
            Configurar Inicio de Año
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isReadOnly 
              ? "Vista de generación automática (Solo lectura)." 
              : "Define cómo comienza tu calendario y el sistema generará el ciclo automático de 56 días."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {isReadOnly && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4" />
              Modo Solo Lectura: No puedes generar o borrar datos.
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="startDate" className="text-sm font-semibold">Fecha de Inicio</Label>
            <Input
              id="startDate"
              type="date"
              disabled={isReadOnly}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 rounded-xl border-primary/20"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">¿Cómo comienza el periodo?</Label>
            <Select disabled={isReadOnly} value={initialType} onValueChange={setInitialType}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Selecciona estado inicial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VACATION">Vacaciones (26 días)</SelectItem>
                <SelectItem value="TRAVEL_ENTRY">Viaje de Entrada (Verde)</SelectItem>
                <SelectItem value="ROTATION">Rotación (28 días)</SelectItem>
                <SelectItem value="TRAVEL_EXIT">Viaje de Salida (Amarillo)</SelectItem>
                <SelectItem value="STANDBY">Standby</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="duration" className="text-sm font-semibold">Duración de este primer bloque (días)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              disabled={isReadOnly}
              value={initialDuration}
              onChange={(e) => setInitialDuration(parseInt(e.target.value) || 1)}
              className="h-12 rounded-xl border-primary/20"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!isReadOnly && (
            <>
              <div className="flex-1 flex justify-start">
                <Button 
                  variant="destructive" 
                  onClick={handleClear}
                  className="gap-2 rounded-xl w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Borrar Año
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-2 rounded-xl px-6 bg-[#C1E1C1] hover:bg-[#B1D1B1] text-[#2B4B2B] border-none shadow-sm font-bold"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Generar
                </Button>
              </div>
            </>
          )}
          {isReadOnly && (
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full rounded-xl">Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
