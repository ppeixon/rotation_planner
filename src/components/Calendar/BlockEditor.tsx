
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format, parseISO, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Settings2, Info, Plane, Plus, Minus, CalendarDays, Clock } from "lucide-react";
import { DayType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BlockEditorProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string | null;
  currentDuration: number;
  type: DayType;
  onSave: (startDate: string, newDuration: number, type: DayType) => void;
}

export function BlockEditor({ isOpen, onClose, startDate, currentDuration, type, onSave }: BlockEditorProps) {
  const [duration, setDuration] = useState(currentDuration);

  const start = useMemo(() => (startDate ? startOfDay(parseISO(startDate)) : null), [startDate]);
  const travelDate = useMemo(() => (start ? addDays(start, duration) : null), [start, duration]);

  useEffect(() => {
    if (isOpen) {
      setDuration(currentDuration);
    }
  }, [isOpen, currentDuration]);

  if (!start) return null;

  const handleSave = () => {
    onSave(startDate!, duration, type);
    onClose();
  };

  const isRotation = type === "ROTATION";
  const isVacation = type === "VACATION";
  const isStandby = type === "STANDBY";

  const typeLabel = isRotation ? "Rotación" : isVacation ? "Vacaciones" : "Standby";
  const typeColor = isRotation ? "text-primary" : isVacation ? "text-[#1e3a8a]" : "text-[#991b1b]";
  const travelIconColor = isRotation ? "text-[#ffff00]" : "text-[#3CB371]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Settings2 className="w-6 h-6 text-primary" />
            Configurar {typeLabel}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Ajusta la duración del bloque de {typeLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 py-6">
          {/* Resumen de Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 p-4 bg-muted/40 rounded-2xl border border-muted">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Inicio</span>
              </div>
              <p className="text-sm font-bold">{format(start, "d MMM yyyy", { locale: es })}</p>
            </div>
            
            {!isStandby ? (
              <div className="flex flex-col gap-1 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Plane className={cn("w-4 h-4", travelIconColor)} />
                  <span className="text-[10px] uppercase font-bold tracking-wider">{isRotation ? "V. Salida" : "V. Entrada"}</span>
                </div>
                <p className="text-sm font-bold">{travelDate ? format(travelDate, "d MMM yyyy", { locale: es }) : "---"}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-4 bg-muted/40 rounded-2xl border border-muted">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Fin</span>
                </div>
                <p className="text-sm font-bold">{travelDate ? format(addDays(start, duration - 1), "d MMM yyyy", { locale: es }) : "---"}</p>
              </div>
            )}
          </div>

          {/* Ajuste de Duración */}
          <div className="space-y-4">
            <Label className="text-center block text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Duración del Bloque
            </Label>
            
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDuration(Math.max(1, duration - 1))}
                className="h-16 w-16 rounded-2xl border-2 hover:bg-primary/10 hover:border-primary transition-all active:scale-90"
              >
                <Minus className="w-8 h-8 text-primary" />
              </Button>

              <div className="flex flex-col items-center">
                <span className={cn("text-6xl font-black tracking-tighter transition-all", typeColor)}>
                  {duration}
                </span>
                <span className="text-xs font-bold text-muted-foreground uppercase">Días</span>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setDuration(duration + 1)}
                className="h-16 w-16 rounded-2xl border-2 hover:bg-primary/10 hover:border-primary transition-all active:scale-90"
              >
                <Plus className="w-8 h-8 text-primary" />
              </Button>
            </div>
          </div>

          {/* Info adicional */}
          <div className="flex gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isStandby 
                ? `Al guardar, se establecerán ${duration} días de standby. El resto de las rotaciones y cadenas de días posteriores no se verán afectadas.`
                : `Al guardar, se establecerá el día de viaje justo después de los ${duration} días de ${typeLabel.toLowerCase()} y se recalculará el resto del año siguiendo tu ciclo de 56 días.`
              }
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-12 font-semibold">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="rounded-xl h-12 px-10 font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
            Guardar y Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
