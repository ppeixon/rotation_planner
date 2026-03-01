
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, addDays, differenceInDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Settings2, Info, Calendar as CalendarIcon, Plane } from "lucide-react";
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
  const [travelDate, setTravelDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (startDate && isOpen) {
      setDuration(currentDuration);
      setTravelDate(addDays(parseISO(startDate), currentDuration));
    }
  }, [currentDuration, startDate, isOpen]);

  if (!startDate) return null;

  const start = startOfDay(parseISO(startDate));

  const handleDurationChange = (val: number) => {
    const newDur = Math.max(1, val);
    setDuration(newDur);
    setTravelDate(addDays(start, newDur));
  };

  const handleDateChange = (date: Date | undefined) => {
    // El usuario selecciona el día de viaje, que es el día inmediatamente posterior al bloque
    if (date && date > start) {
      setTravelDate(date);
      const newDur = differenceInDays(startOfDay(date), start);
      setDuration(newDur);
    }
  };

  const handleSave = () => {
    onSave(startDate, duration, type);
    onClose();
  };

  const isRotation = type === "ROTATION";
  const typeLabel = isRotation ? "Rotación" : "Vacaciones";
  const travelLabel = isRotation ? "Viaje de Salida (Amarillo)" : "Viaje de Entrada (Verde)";
  const typeColor = isRotation ? "text-[#ffc000]" : "text-[#1e3a8a]";
  const travelColor = isRotation ? "text-[#ffff00]" : "text-[#3CB371]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="w-5 h-5 text-primary" />
            Ajustar Cadena de {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Modifica cuándo termina este periodo seleccionando el día de viaje correspondiente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border border-muted">
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Inicio</p>
                <p className="text-xs font-semibold">{format(start, "d MMM yyyy", { locale: es })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10">
              <Plane className={cn("w-5 h-5", isRotation ? "text-[#b8860b]" : "text-[#3CB371]")} />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{isRotation ? "V. Salida" : "V. Entrada"}</p>
                <p className="text-xs font-semibold">{travelDate ? format(travelDate, "d MMM yyyy", { locale: es }) : "---"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-semibold flex justify-between">
                Días de {typeLabel}
                <span className={cn("font-bold", typeColor)}>{duration} días</span>
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
                className="h-12 rounded-xl border-primary/20 focus:ring-primary text-lg font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Selecciona el Día de Viaje</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal rounded-xl border-primary/20",
                      !travelDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {travelDate ? format(travelDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={travelDate}
                    onSelect={handleDateChange}
                    disabled={(date) => date <= start}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <p className={cn("text-[10px] font-bold uppercase text-center mt-1", travelColor)}>
                Este será tu día de {travelLabel}
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Al guardar, se recalculará automáticamente el resto del año siguiendo el ciclo de 56 días a partir del día siguiente al viaje.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20">
            Actualizar Cadena
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
