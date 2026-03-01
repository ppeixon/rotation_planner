export type DayType = "ROTATION" | "TRAVEL_ENTRY" | "TRAVEL_EXIT" | "VACATION" | "STANDBY" | "NORMAL";

export interface DayEvent {
  id: string; // YYYY-MM-DD
  dateKey: string; // YYYY-MM-DD
  dayType: DayType;
  flightTicketPurchased: boolean;
  flightTicketPending?: boolean;
  flightInfo?: string;
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
