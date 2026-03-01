
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
  isToday
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
  STANDBY: "bg-[#e2e8f0] text-slate-700",
  NORMAL: "bg-transparent",
};

export const MonthGrid = React.memo(function MonthGrid({ 
  monthDate, 
  events, 
  mini = false, 
  showTravelDays = true,
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

            let dayType = event?.dayType;
            if (!showTravelDays && dayType === "TRAVEL_ENTRY") dayType = "VACATION";
            if (!showTravelDays && dayType === "TRAVEL_EXIT") dayType = "ROTATION";
            
            const isTravelDay = event?.dayType === "TRAVEL_ENTRY" || event?.dayType === "TRAVEL_EXIT";
            const isDragTarget = isDragging && dragHoverDate === dateKey;

            const colorClass = event && isCurrentMonth && dayType ? TYPE_COLORS[dayType] : "bg-background text-background";

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
                  !isCurrentMonth ? "bg-background text-background pointer-events-none" : cn("bg-background", colorClass),
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
                     {event.flightTicketPurchased && <Plane className={cn("w-3 h-3", (dayType === "VACATION" || dayType === "ROTATION" || dayType === "TRAVEL_EXIT" || dayType === "STANDBY") ? "text-current fill-current" : "text-white fill-white")} />}
                     {event.notes && <StickyNote className={cn("w-3 h-3", (dayType === "VACATION" || dayType === "ROTATION" || dayType === "TRAVEL_EXIT" || dayType === "STANDBY") ? "text-current fill-current" : "text-white fill-white")} />}
                  </div>
                )}

                {isCurrentMonth && mini && event && (
                  <div className="absolute top-0 right-0 p-0.5">
                    {(event.flightTicketPurchased || event.notes) && <div className={cn("w-1 h-1 rounded-full", (dayType === "VACATION" || dayType === "ROTATION" || dayType === "TRAVEL_EXIT" || dayType === "STANDBY" || dayType === "TRAVEL_ENTRY") ? "bg-current" : "bg-white")} />}
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
