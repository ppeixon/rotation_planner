
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DayEvent, DayType } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plane, Calendar as CalendarIcon, StickyNote, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface DayEditorProps {
  date: string | null;
  event?: DayEvent;
  onClose: () => void;
  onSave: (dateKey: string, data: Partial<DayEvent>) => void;
}

export function DayEditor({ date, event, onClose, onSave }: DayEditorProps) {
  const { isReadOnly } = useAuth();
  const [dayType, setDayType] = useState<DayType>("ROTATION");
  const [ticketPurchased, setTicketPurchased] = useState(false);
  const [ticketPending, setTicketPending] = useState(false);
  const [flightInfo, setFlightInfo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setDayType(event.dayType);
      setTicketPurchased(event.flightTicketPurchased || false);
      setTicketPending(event.flightTicketPending || false);
      setFlightInfo(event.flightInfo || "");
      setNotes(event.notes || "");
    } else {
      setDayType("ROTATION");
      setTicketPurchased(false);
      setTicketPending(false);
      setFlightInfo("");
      setNotes("");
    }
  }, [event, date]);

  if (!date) return null;

  const handleSave = () => {
    if (isReadOnly) return;
    onSave(date, {
      dayType,
      flightTicketPurchased: ticketPurchased,
      flightTicketPending: ticketPending,
      flightInfo,
      notes,
    });
    onClose();
  };

  const dayTypeOptions = [
    { value: "ROTATION", label: "Rotación", className: "day-rotation" },
    { value: "TRAVEL_EXIT", label: "Viaje Salida", className: "bg-[#ffff00] text-[#2B1A0A]" },
    { value: "TRAVEL_ENTRY", label: "Viaje Entrada", className: "bg-[#3CB371] text-white" },
    { value: "VACATION", label: "Vacaciones", className: "day-vacation" },
    { value: "STANDBY", label: "Standby", className: "day-standby" },
  ];

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span className="capitalize">{format(parseISO(date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {isReadOnly && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4" />
              Modo Solo Lectura: No puedes realizar cambios.
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base font-semibold">Tipo de día</Label>
            <RadioGroup
              disabled={isReadOnly}
              value={dayType}
              onValueChange={(val) => setDayType(val as DayType)}
              className="grid grid-cols-2 gap-2"
            >
              {dayTypeOptions.map((opt) => (
                <div key={opt.value} className="relative">
                  <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                  <Label
                    htmlFor={opt.value}
                    className={cn(
                      "flex items-center justify-center h-12 rounded-lg border-2 cursor-pointer text-xs font-bold transition-all px-2 text-center",
                      opt.className,
                      dayType === opt.value ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : "border-transparent opacity-80 hover:opacity-100",
                      isReadOnly && "cursor-default"
                    )}
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {(dayType === "TRAVEL_ENTRY" || dayType === "TRAVEL_EXIT" || dayType === "ROTATION" || dayType === "STANDBY") && (
            <div className="space-y-4 border-t pt-4">
               <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="ticket">Billete comprado</Label>
                </div>
                <Switch
                  id="ticket"
                  disabled={isReadOnly}
                  checked={ticketPurchased}
                  onCheckedChange={(val) => {
                    setTicketPurchased(val);
                    if (val) setTicketPending(false);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-destructive" />
                  <Label htmlFor="pending">TICKET PENDIENTE</Label>
                </div>
                <Switch
                  id="pending"
                  disabled={isReadOnly}
                  checked={ticketPending}
                  onCheckedChange={(val) => {
                    setTicketPending(val);
                    if (val) setTicketPurchased(false);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="flightInfo" className="text-sm">Travel Ticket Info</Label>
                <Input
                  id="flightInfo"
                  disabled={isReadOnly}
                  placeholder="Vuelo AH2004, 15:30h..."
                  value={flightInfo}
                  onChange={(e) => setFlightInfo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="notes">Notas</Label>
            </div>
            <Textarea
              id="notes"
              disabled={isReadOnly}
              placeholder="Añadir notas adicionales..."
              className="min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isReadOnly ? "Cerrar" : "Cancelar"}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave}>Guardar cambios</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
