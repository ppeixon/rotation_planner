
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
import { RefreshCw, Play, CalendarRange } from "lucide-react";
import { format } from "date-fns";

interface RotationGeneratorProps {
  onGenerate: (startDateKey: string) => void;
  isGenerating?: boolean;
  defaultDate?: string;
}

export function RotationGenerator({ onGenerate, isGenerating, defaultDate }: RotationGeneratorProps) {
  const [startDate, setStartDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);

  // Sincronizar la fecha por defecto cuando se abre el diálogo o cambia el año en el Dashboard
  useEffect(() => {
    if (open && defaultDate) {
      setStartDate(defaultDate);
    }
  }, [open, defaultDate]);

  const handleGenerate = () => {
    // Pasar directamente el string de la fecha para evitar desfases de zona horaria con el objeto Date
    onGenerate(startDate);
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
            Generador de Rotación
          </DialogTitle>
          <DialogDescription className="text-sm">
            Define la fecha de inicio de tu próxima rotación. Se generarán bloques de 28 días automáticamente **solo para el año en curso** de la fecha seleccionada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="startDate" className="text-sm font-semibold">Fecha de Inicio de Rotación</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 rounded-xl border-primary/20 focus:ring-primary"
            />
          </div>
          <div className="bg-muted/50 p-4 rounded-2xl border border-muted-foreground/10">
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              <strong>Nota:</strong> Este proceso solo afectará a los días del mismo año que la fecha elegida. Los años anteriores y posteriores no se verán modificados.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2 rounded-xl px-6"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generar Calendario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
