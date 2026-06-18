
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DayEvent, DayType, TicketStatus } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Train, Plane, Calendar as CalendarIcon, StickyNote, AlertCircle, Check, X, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface DayEditorProps {
  date: string | null;
  event?: DayEvent;
  onClose: () => void;
  onSave: (dateKey: string, data: Partial<DayEvent>) => void;
}

type TicketStatusOption = {
  value: TicketStatus;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
};

const TRAIN_OPTIONS: TicketStatusOption[] = [
  {
    value: "PENDING",
    label: "Falta",
    icon: <X className="w-4 h-4" />,
    activeClass: "bg-red-500 text-white border-red-600 shadow-md shadow-red-200",
    inactiveClass: "border-red-200 text-red-400 hover:bg-red-50",
  },
  {
    value: "PURCHASED",
    label: "Comprado",
    icon: <Check className="w-4 h-4" />,
    activeClass: "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-200",
    inactiveClass: "border-emerald-200 text-emerald-400 hover:bg-emerald-50",
  },
  {
    value: "NOT_NEEDED",
    label: "No necesario",
    icon: <MinusCircle className="w-4 h-4" />,
    activeClass: "bg-zinc-400 text-white border-zinc-500 shadow-md",
    inactiveClass: "border-zinc-200 text-zinc-400 hover:bg-zinc-50",
  },
];

const FLIGHT_OPTIONS: TicketStatusOption[] = [
  {
    value: "PENDING",
    label: "Falta",
    icon: <X className="w-4 h-4" />,
    activeClass: "bg-red-500 text-white border-red-600 shadow-md shadow-red-200",
    inactiveClass: "border-red-200 text-red-400 hover:bg-red-50",
  },
  {
    value: "PURCHASED",
    label: "Comprado",
    icon: <Check className="w-4 h-4" />,
    activeClass: "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-200",
    inactiveClass: "border-emerald-200 text-emerald-400 hover:bg-emerald-50",
  },
  {
    value: "NOT_NEEDED",
    label: "No necesario",
    icon: <MinusCircle className="w-4 h-4" />,
    activeClass: "bg-zinc-400 text-white border-zinc-500 shadow-md",
    inactiveClass: "border-zinc-200 text-zinc-400 hover:bg-zinc-50",
  },
];

function TicketStatusSelector({
  label,
  icon,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  value: TicketStatus | undefined;
  options: TicketStatusOption[];
  onChange: (val: TicketStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <Label className="text-sm font-semibold">{label}</Label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 px-2 text-[11px] font-bold transition-all duration-200 select-none",
                isActive ? opt.activeClass : opt.inactiveClass,
                !isActive && "opacity-70",
                disabled && "cursor-default opacity-50",
                !disabled && "cursor-pointer active:scale-95"
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DayEditor({ date, event, onClose, onSave }: DayEditorProps) {
  const { isReadOnly } = useAuth();
  const [dayType, setDayType] = useState<DayType>("ROTATION");
  const [trainStatus, setTrainStatus] = useState<TicketStatus | undefined>(undefined);
  const [flightStatus, setFlightStatus] = useState<TicketStatus | undefined>(undefined);
  const [flightInfo, setFlightInfo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setDayType(event.dayType);
      setTrainStatus(event.trainStatus ?? undefined);
      setFlightStatus(event.flightStatus ?? undefined);
      setFlightInfo(event.flightInfo || "");
      setNotes(event.notes || "");
    } else {
      setDayType("ROTATION");
      setTrainStatus(undefined);
      setFlightStatus(undefined);
      setFlightInfo("");
      setNotes("");
    }
  }, [event, date]);

  if (!date) return null;

  const isTravelDay = dayType === "TRAVEL_ENTRY" || dayType === "TRAVEL_EXIT";

  const handleSave = () => {
    if (isReadOnly) return;

    // Derive legacy fields from new status for backward compatibility
    const flightTicketPurchased = flightStatus === "PURCHASED";
    const flightTicketPending = flightStatus === "PENDING";

    onSave(date, {
      dayType,
      // Legacy
      flightTicketPurchased,
      flightTicketPending,
      flightInfo,
      // New
      trainStatus: isTravelDay ? trainStatus : undefined,
      flightStatus: isTravelDay ? flightStatus : undefined,
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
      <DialogContent className="sm:max-w-[440px]">
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

          {/* Day type selector */}
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

          {/* Travel ticket section — only for travel days */}
          {isTravelDay && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Billetes de transporte
              </p>

              <TicketStatusSelector
                label="Tren"
                icon={<Train className="w-4 h-4" />}
                value={trainStatus}
                options={TRAIN_OPTIONS}
                onChange={setTrainStatus}
                disabled={isReadOnly}
              />

              <TicketStatusSelector
                label="Avión"
                icon={<Plane className="w-4 h-4" />}
                value={flightStatus}
                options={FLIGHT_OPTIONS}
                onChange={setFlightStatus}
                disabled={isReadOnly}
              />

              <div className="space-y-2">
                <Label htmlFor="flightInfo" className="text-sm">
                  Info del viaje
                </Label>
                <Input
                  id="flightInfo"
                  disabled={isReadOnly}
                  placeholder="Vuelo AH2004, Tren AVE 15:30h..."
                  value={flightInfo}
                  onChange={(e) => setFlightInfo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="notes">Notas</Label>
            </div>
            <Textarea
              id="notes"
              disabled={isReadOnly}
              placeholder="Añadir notas adicionales..."
              className="min-h-[80px]"
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
