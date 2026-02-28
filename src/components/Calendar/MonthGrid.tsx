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
  isSameDay
} from "date-fns";
import { cn } from "@/lib/utils";
import { DayEvent } from "@/lib/types";
import { Plane, StickyNote } from "lucide-react";

interface MonthGridProps {
  monthDate: Date;
  events: Record<string, DayEvent>;
  mini?: boolean;
  onDayClick: (date: Date) => void;
}

const TYPE_COLORS: Record<string, string> = {
  ROTATION: "bg-[#FF8C00] text-white",
  TRAVEL: "bg-[#3CB371] text-white",
  VACATION: "bg-[#1E90FF] text-white",
  NORMAL: "bg-transparent",
};

export function MonthGrid({ monthDate, events, mini = false, onDayClick }: MonthGridProps) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const weekdayLabels = mini ? ["L", "M", "X", "J", "V", "S", "D"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-[10px] uppercase font-bold text-muted-foreground py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border border rounded-md overflow-hidden">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const event = events[dateKey];
          const isCurrentMonth = isSameMonth(day, monthDate);
          const isTodayDay = isToday(day);

          return (
            <div
              key={dateKey}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative bg-background hover:bg-accent/10 transition-colors cursor-pointer flex flex-col items-center justify-center",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground opacity-50",
                mini ? "aspect-square py-1" : "aspect-square sm:aspect-auto sm:min-h-[80px] p-1",
                event && isCurrentMonth ? TYPE_COLORS[event.dayType] : "bg-background"
              )}
            >
              <span className={cn(
                "text-xs sm:text-sm font-medium",
                isTodayDay && "bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center"
              )}>
                {format(day, "d")}
              </span>
              
              {!mini && isCurrentMonth && event && (
                <div className="absolute bottom-1 right-1 flex gap-0.5">
                   {event.flightTicketPurchased && <Plane className="w-3 h-3 text-white fill-white" />}
                   {event.notes && <StickyNote className="w-3 h-3 text-white fill-white" />}
                </div>
              )}

              {mini && isCurrentMonth && event && (
                <div className="absolute top-0 right-0 p-0.5">
                  {(event.flightTicketPurchased || event.notes) && <div className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}