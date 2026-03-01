
"use client";

import React from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  parseISO,
  isAfter,
  isBefore,
  isSameDay
} from "date-fns";
import { cn } from "@/lib/utils";
import { DayEvent } from "@/lib/types";
import { Plane, StickyNote, MoveHorizontal } from "lucide-react";

interface MonthGridProps {
  monthDate: Date;
  events: Record<string, DayEvent>;
  mini?: boolean;
  onDayClick: (date: Date) => void;
  onDayMouseDown?: (date: Date, type: string) => void;
  onDayMouseEnter?: (date: Date) => void;
  dragState?: {
    anchorDate: string | null;
    hoverDate: string | null;
    type: string | null;
  };
}

const TYPE_COLORS: Record<string, string> = {
  ROTATION: "bg-[#ffc000] text-[#2B1A0A]",
  TRAVEL_ENTRY: "bg-[#3CB371] text-white",
  TRAVEL_EXIT: "bg-[#ffff00] text-[#2B1A0A]",
  VACATION: "bg-[#c6d9f1] text-[#1e3a8a]",
  STANDBY: "bg-[#e2e8f0] text-slate-700",
  NORMAL: "bg-transparent",
};

export function MonthGrid({ 
  monthDate, 
  events, 
  mini = false, 
  onDayClick, 
  onDayMouseDown, 
  onDayMouseEnter,
  dragState 
}: MonthGridProps) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const weekdayLabels = mini ? ["L", "M", "X", "J", "V", "S", "D"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
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

          const dayType = event?.dayType === 'TRAVEL' ? 'TRAVEL_ENTRY' : event?.dayType;
          const isTravelDay = dayType === "TRAVEL_ENTRY" || dayType === "TRAVEL_EXIT";
          
          // Estilos de previsualización de arrastre
          const isDragTarget = dragState?.hoverDate === dateKey;
          const isAnchor = dragState?.anchorDate === dateKey;
          const isBeingDragged = dragState?.anchorDate && dragState?.type && isTravelDay && event?.dayType === dragState.type && dateKey === dragState.hoverDate;

          const colorClass = event && isCurrentMonth && dayType ? TYPE_COLORS[dayType] : "bg-background";

          return (
            <div
              key={dateKey}
              onClick={() => !dragState?.anchorDate && onDayClick(day)}
              onMouseDown={(e) => {
                if (isTravelDay && onDayMouseDown) {
                  e.preventDefault();
                  onDayMouseDown(day, dayType!);
                }
              }}
              onMouseEnter={() => onDayMouseEnter && onDayMouseEnter(day)}
              className={cn(
                "relative bg-background transition-all duration-75 flex flex-col items-center justify-center group",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground opacity-50",
                mini ? "aspect-square py-1" : "aspect-square sm:aspect-auto sm:min-h-[80px] p-1",
                colorClass,
                isTravelDay && !mini && "cursor-grab active:cursor-grabbing",
                isDragTarget && "ring-2 ring-primary ring-inset z-20",
                !dragState?.anchorDate && "hover:bg-accent/10 cursor-pointer"
              )}
            >
              <span className={cn(
                "text-xs sm:text-sm font-medium z-10",
                isTodayDay && "bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center"
              )}>
                {format(day, "d")}
              </span>
              
              {!mini && isCurrentMonth && isTravelDay && !dragState?.anchorDate && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoveHorizontal className="w-3 h-3 text-current" />
                </div>
              )}

              {!mini && isCurrentMonth && event && (
                <div className="absolute bottom-1 right-1 flex gap-0.5">
                   {event.flightTicketPurchased && <Plane className={cn("w-3 h-3", (event.dayType === "VACATION" || event.dayType === "ROTATION" || event.dayType === "TRAVEL_EXIT" || event.dayType === "STANDBY") ? "text-current fill-current" : "text-white fill-white")} />}
                   {event.notes && <StickyNote className={cn("w-3 h-3", (event.dayType === "VACATION" || event.dayType === "ROTATION" || event.dayType === "TRAVEL_EXIT" || event.dayType === "STANDBY") ? "text-current fill-current" : "text-white fill-white")} />}
                </div>
              )}

              {mini && isCurrentMonth && event && (
                <div className="absolute top-0 right-0 p-0.5">
                  {(event.flightTicketPurchased || event.notes) && <div className={cn("w-1 h-1 rounded-full", (event.dayType === "VACATION" || event.dayType === "ROTATION" || event.dayType === "TRAVEL_EXIT" || event.dayType === "STANDBY" || event.dayType === "TRAVEL_ENTRY") ? "bg-current" : "bg-white")} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
