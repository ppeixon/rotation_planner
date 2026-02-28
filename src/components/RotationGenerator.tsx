"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefreshCw, Play } from "lucide-react";
import { format } from "date-fns";

interface RotationGeneratorProps {
  onGenerate: (startDate: Date) => void;
  isGenerating?: boolean;
}

export function RotationGenerator({ onGenerate, isGenerating }: RotationGeneratorProps) {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          Generador de Rotación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Define la fecha de inicio de tu próxima rotación. Se generarán bloques de 28 días automáticamente para los próximos 18 meses.
        </p>
        <div className="space-y-2">
          <Label htmlFor="startDate">Fecha de Inicio de Rotación</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/30 pt-6">
         <span className="text-xs text-muted-foreground italic">Prioriza tus viajes y vacaciones manuales.</span>
        <Button 
          onClick={() => onGenerate(new Date(startDate))}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Generar Ahora
        </Button>
      </CardFooter>
    </Card>
  );
}