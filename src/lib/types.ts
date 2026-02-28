export type DayType = "ROTATION" | "TRAVEL" | "VACATION" | "NORMAL";

export interface DayEvent {
  dateKey: string; // YYYY-MM-DD
  dayType: DayType;
  flightTicketPurchased: boolean;
  flightInfo?: string;
  notes?: string;
  source: "MANUAL" | "GENERATED";
  updatedAt: number;
  updatedBy: string;
}

export interface UserSettings {
  startRotationDate: number | null;
  generateMonthsAhead: number;
  timezone: string;
  updatedAt: number;
}