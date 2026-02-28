
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Settings2, Info } from "lucide-react";
import { DayType } from "@/lib/types";

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

  useEffect(() => {
    setDuration(currentDuration);
  }, [currentDuration, isOpen]);

  if (!startDate) return null;

  const handleSave = () => {
    onSave(startDate, duration, type);
    onClose();
  };

  const typeLabel = type === "ROTATION" ? "Rotación" : "Vacaciones";
  const typeColor = type === "ROTATION" ? "text-[#ffc000]" : "text-[#1e3a8a]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="w-5 h-5 text-primary" />
            Editar Bloque de {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Ajusta la duración de este bloque específico. El calendario posterior se recalculará automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-muted">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Inicio del bloque</p>
              <p className="text-sm font-semibold">{format(parseISO(startDate), "d 'de' MMMM, yyyy", { locale: es })}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="duration" className="text-sm font-semibold flex justify-between">
              Duración del bloque (días)
              <span className={typeColor}>{duration} días</span>
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              className="h-12 rounded-xl border-primary/20 focus:ring-primary text-lg font-bold"
            />
          </div>

          <div className="flex gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Al guardar, se mantendrá fija la fecha de inicio y se ajustará el final de este bloque. Todos los ciclos posteriores se desplazarán consecuentemente.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} className="rounded-xl px-8 font-bold">
            Actualizar Cadena
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
