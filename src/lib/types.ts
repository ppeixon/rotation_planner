export type DayType = "ROTATION" | "TRAVEL_ENTRY" | "TRAVEL_EXIT" | "VACATION" | "STANDBY" | "NORMAL";

export type TicketStatus = "NOT_NEEDED" | "PENDING" | "PURCHASED";

export interface DayEvent {
  id: string; // YYYY-MM-DD
  dateKey: string; // YYYY-MM-DD
  dayType: DayType;
  // Legacy fields (kept for backward compatibility)
  flightTicketPurchased: boolean;
  flightTicketPending?: boolean;
  flightInfo?: string;
  // New independent train/flight ticket status
  trainStatus?: TicketStatus;
  flightStatus?: TicketStatus;
  notes?: string;
  source: "MANUAL" | "GENERATED";
  updatedAt: number;
  updatedBy: string;
  userId: string;
}

export interface UserSettings {
  id: string; // "profile"
  userId: string;
  startRotationDate: number | null;
  generateMonthsAhead: number;
  timezone: string;
  updatedAt: number;
}
