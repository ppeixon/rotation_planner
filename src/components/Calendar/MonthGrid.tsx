"use client";

import React, { useMemo } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  subDays
} from "date-fns";
import { cn } from "@/lib/utils";
import { DayEvent } from "@/lib/types";
import { Plane, StickyNote, MoveHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MonthGridProps {
  monthDate: Date;
  events: Record<string, DayEvent>;
  mini?: boolean;
  showTravelDays?: boolean;
  showClassicTravelDays?: boolean;
  onDayClick: (date: Date) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayMouseDown?: (date: Date, type: string) => void;
  onDayMouseEnter?: (date: Date) => void;
  dragAnchorDate?: string | null;
  dragHoverDate?: string | null;
  isDragging?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  ROTATION: "bg-[#ffc000] text-[#2B1A0A]",
  TRAVEL_ENTRY: "day-travel-entry-split",
  TRAVEL_EXIT: "day-travel-exit-split",
  VACATION: "bg-[#c6d9f1] text-[#1e3a8a]",
  STANDBY: "bg-[#fee2e2] text-[#991b1b]",
  NORMAL: "bg-transparent",
};

export const MonthGrid = React.memo(function MonthGrid({ 
  monthDate, 
  events, 
  mini = false, 
  showTravelDays = true,
  showClassicTravelDays = false,
  onDayClick, 
  onDayDoubleClick,
  onDayMouseDown, 
  onDayMouseEnter,
  dragAnchorDate,
  dragHoverDate,
  isDragging
}: MonthGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const weekdayLabels = mini ? ["L", "M", "X", "J", "V", "S", "D"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full select-none">
        <div className="grid grid-cols-7 mb-1">
          {weekdayLabels.map((label) => (
            <div key={label} className="text-center text-[10px] uppercase font-bold text-muted-foreground py-1">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-zinc-300 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const event = events[dateKey];
            const isCurrentMonth = isSameMonth(day, monthDate);
            const isTodayDay = isToday(day);

            const isTravelDay = event?.dayType === "TRAVEL_ENTRY" || event?.dayType === "TRAVEL_EXIT";
            const isDragTarget = isDragging && dragHoverDate === dateKey;

            let colorClass = "bg-background text-background";
            
            if (event && isCurrentMonth) {
              const dayType = event.dayType;

              if (dayType === "TRAVEL_EXIT") {
                // Viaje de Salida (Amarillo en clásico, Split Naranja/Azul en moderno)
                if (showClassicTravelDays) {
                  colorClass = "bg-[#ffff00] text-[#2B1A0A]";
                } else {
                  colorClass = "day-travel-exit-split";
                }
              } else if (dayType === "TRAVEL_ENTRY") {
                // Viaje de Entrada
                if (!showTravelDays) {
                  colorClass = "bg-[#c6d9f1] text-[#1e3a8a]"; // Azul sólido si viajes ocultos
                } else if (showClassicTravelDays) {
                  colorClass = "bg-[#3CB371] text-white"; // Verde sólido en clásico
                } else {
                  colorClass = "day-travel-entry-split"; // Split Azul/Verde en moderno
                }
              } else if (dayType === "ROTATION") {
                const prevDateKey = format(subDays(day, 1), "yyyy-MM-dd");
                const isRotationStart = events[prevDateKey]?.dayType === "TRAVEL_ENTRY";
                
                if (isRotationStart) {
                  if (!showTravelDays) {
                    // Transición directa Azul -> Naranja si viajes ocultos
                    colorClass = "day-rotation-start-hidden-split";
                  } else if (showClassicTravelDays) {
                    // Naranja sólido en clásico
                    colorClass = "bg-[#ffc000] text-[#2B1A0A]";
                  } else {
                    // Verde -> Naranja en moderno
                    colorClass = "day-rotation-start-split";
                  }
                } else {
                  colorClass = TYPE_COLORS.ROTATION;
                }
              } else if (dayType === "VACATION") {
                colorClass = TYPE_COLORS.VACATION;
              } else if (dayType === "STANDBY") {
                colorClass = TYPE_COLORS.STANDBY;
              } else {
                colorClass = "bg-transparent";
              }
            }

            const dayContent = (
              <div
                onClick={() => isCurrentMonth && !isDragging && onDayClick(day)}
                onDoubleClick={() => isCurrentMonth && !isDragging && onDayDoubleClick?.(day)}
                onMouseDown={(e) => {
                  if (isCurrentMonth && isTravelDay && onDayMouseDown) {
                    e.preventDefault();
                    onDayMouseDown(day, event!.dayType);
                  }
                }}
                onMouseEnter={() => isCurrentMonth && isDragging && onDayMouseEnter && onDayMouseEnter(day)}
                className={cn(
                  "relative transition-colors duration-75 flex flex-col items-center justify-center group",
                  !isCurrentMonth ? "bg-background text-background pointer-events-none" : colorClass,
                  mini ? "aspect-square py-1" : "aspect-square sm:aspect-auto sm:min-h-[80px] p-1",
                  isCurrentMonth && isTravelDay && !mini && "cursor-grab active:cursor-grabbing",
                  isCurrentMonth && isDragTarget && "ring-2 ring-primary ring-inset z-20",
                  isCurrentMonth && !isDragging && "hover:bg-accent/10 cursor-pointer"
                )}
              >
                <span className={cn(
                  "text-xs sm:text-sm font-medium z-10",
                  isCurrentMonth && isTodayDay && "bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center",
                  !isCurrentMonth && "hidden"
                )}>
                  {format(day, "d")}
                </span>
                
                {isCurrentMonth && !mini && isTravelDay && !isDragging && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoveHorizontal className="w-3 h-3 text-current" />
                  </div>
                )}

                {isCurrentMonth && !mini && event && (
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                     {event.flightTicketPurchased && <Plane className={cn("w-3 h-3", "fill-current")} />}
                     {event.notes && <StickyNote className={cn("w-3 h-3", "fill-current")} />}
                  </div>
                )}

                {isCurrentMonth && mini && event && (
                  <div className="absolute top-0 right-0 p-0.5">
                    {(event.flightTicketPurchased || event.notes) && <div className={cn("w-1 h-1 rounded-full bg-current")} />}
                  </div>
                )}
              </div>
            );

            if (isCurrentMonth && event?.notes) {
              return (
                <Tooltip key={dateKey}>
                  <TooltipTrigger asChild>
                    {dayContent}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] break-words p-3 rounded-xl shadow-xl border-primary/20 bg-card">
                    <p className="text-xs font-medium leading-relaxed">{event.notes}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <React.Fragment key={dateKey}>{dayContent}</React.Fragment>;
          })}
        </div>
      </div>
    </TooltipProvider>
  );
});
