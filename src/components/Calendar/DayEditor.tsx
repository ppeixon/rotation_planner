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
import { Plane, Calendar as CalendarIcon, Briefcase, Sun, StickyNote, HelpCircle } from "lucide-react";

interface DayEditorProps {
  date: string | null;
  event?: DayEvent;
  onClose: () => void;
  onSave: (dateKey: string, data: Partial<DayEvent>) => void;
}

export function DayEditor({ date, event, onClose, onSave }: DayEditorProps) {
  const [dayType, setDayType] = useState<DayType>("NORMAL");
  const [ticketPurchased, setTicketPurchased] = useState(false);
  const [flightInfo, setFlightInfo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setDayType(event.dayType);
      setTicketPurchased(event.flightTicketPurchased || false);
      setFlightInfo(event.flightInfo || "");
      setNotes(event.notes || "");
    } else {
      setDayType("NORMAL");
      setTicketPurchased(false);
      setFlightInfo("");
      setNotes("");
    }
  }, [event, date]);

  if (!date) return null;

  const handleSave = () => {
    onSave(date, {
      dayType,
      flightTicketPurchased: ticketPurchased,
      flightInfo,
      notes,
    });
    onClose();
  };

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            {format(parseISO(date), "PPP")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Tipo de día</Label>
            <RadioGroup
              value={dayType}
              onValueChange={(val) => setDayType(val as DayType)}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/5 transition-colors cursor-pointer">
                <RadioGroupItem value="ROTATION" id="rotation" />
                <Label htmlFor="rotation" className="flex items-center gap-2 cursor-pointer">
                   <div className="w-3 h-3 rounded-full bg-[#ffc000]" />
                   Rotación
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/5 transition-colors cursor-pointer">
                <RadioGroupItem value="TRAVEL" id="travel" />
                <Label htmlFor="travel" className="flex items-center gap-2 cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-[#3CB371]" />
                  Viaje
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/5 transition-colors cursor-pointer">
                <RadioGroupItem value="VACATION" id="vacation" />
                <Label htmlFor="vacation" className="flex items-center gap-2 cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-[#c6d9f1]" />
                  Vacaciones
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/5 transition-colors cursor-pointer">
                <RadioGroupItem value="STANDBY" id="standby" />
                <Label htmlFor="standby" className="flex items-center gap-2 cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  Standby
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/5 transition-colors cursor-pointer">
                <RadioGroupItem value="NORMAL" id="normal" />
                <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  Normal
                </Label>
              </div>
            </RadioGroup>
          </div>

          {(dayType === "TRAVEL" || dayType === "ROTATION" || dayType === "STANDBY") && (
            <div className="space-y-4 border-t pt-4">
               <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="ticket">Billete comprado</Label>
                </div>
                <Switch
                  id="ticket"
                  checked={ticketPurchased}
                  onCheckedChange={setTicketPurchased}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flightInfo" className="text-sm">Info de vuelo / PNR</Label>
                <Input
                  id="flightInfo"
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
              placeholder="Añadir notas adicionales..."
              className="min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
