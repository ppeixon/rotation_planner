
"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, collection, writeBatch, Timestamp } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings, DayType } from "@/lib/types";
import { 
  format, 
  addDays, 
  isBefore, 
  startOfDay, 
  parseISO, 
  endOfYear
} from "date-fns";

export function useRotation() {
  const { user } = useAuth();
  const db = useFirestore();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [events, setEvents] = useState<Record<string, DayEvent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setSettings(null);
      setEvents({});
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, "users", user.uid, "settings", "profile");
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as UserSettings);
      } else {
        const defaultSettings: UserSettings = {
          id: "profile",
          userId: user.uid,
          startRotationDate: null,
          generateMonthsAhead: 18,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          updatedAt: Date.now(),
        };
        setDocumentNonBlocking(settingsRef, defaultSettings, { merge: true });
      }
    });

    const eventsRef = collection(db, "users", user.uid, "dayEvents");
    const unsubEvents = onSnapshot(eventsRef, (querySnap) => {
      const newEvents: Record<string, DayEvent> = {};
      querySnap.forEach((doc) => {
        newEvents[doc.id] = doc.data() as DayEvent;
      });
      setEvents(newEvents);
      setLoading(false);
    });

    return () => {
      unsubSettings();
      unsubEvents();
    };
  }, [user, db]);

  const updateDay = useCallback((dateKey: string, partial: Partial<DayEvent>) => {
    if (!user || !db) return;
    const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
    const existing = events[dateKey];
    
    const newEvent: Partial<DayEvent> = {
      ...existing,
      id: dateKey,
      dateKey,
      dayType: partial.dayType ?? existing?.dayType ?? "NORMAL",
      flightTicketPurchased: partial.flightTicketPurchased ?? existing?.flightTicketPurchased ?? false,
      flightInfo: partial.flightInfo ?? existing?.flightInfo ?? "",
      notes: partial.notes ?? existing?.notes ?? "",
      source: "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: user.uid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  }, [user, db, events]);

  const fillRestOfYearBatch = (batch: any, current: Date, state: "VAC" | "TE" | "ROT" | "TX", currentYear: number, endGen: Date, userId: string) => {
    let iterDate = current;
    while (iterDate.getFullYear() === currentYear && isBefore(iterDate, addDays(endGen, 1))) {
      const dateKey = format(iterDate, "yyyy-MM-dd");
      const dayRef = doc(db!, "users", userId, "dayEvents", dateKey);
      const existing = events[dateKey];

      if (existing?.source === "MANUAL") {
        // Skip manual overrides but advance the date and state
        if (state === "VAC") {
           iterDate = addDays(iterDate, 26);
           state = "TE";
        } else if (state === "TE") {
           iterDate = addDays(iterDate, 1);
           state = "ROT";
        } else if (state === "ROT") {
           iterDate = addDays(iterDate, 28);
           state = "TX";
        } else if (state === "TX") {
           iterDate = addDays(iterDate, 1);
           state = "VAC";
        }
        continue;
      }

      if (state === "VAC") {
        for (let i = 0; i < 26; i++) {
          if (iterDate.getFullYear() !== currentYear) break;
          const dk = format(iterDate, "yyyy-MM-dd");
          if (events[dk]?.source !== "MANUAL") {
            batch.set(doc(db!, "users", userId, "dayEvents", dk), {
              id: dk, dateKey: dk, dayType: "VACATION", source: "GENERATED", updatedAt: Date.now(), updatedBy: userId, userId
            }, { merge: true });
          }
          iterDate = addDays(iterDate, 1);
        }
        state = "TE";
      } else if (state === "TE") {
        if (iterDate.getFullYear() === currentYear) {
          const dk = format(iterDate, "yyyy-MM-dd");
          if (events[dk]?.source !== "MANUAL") {
            batch.set(doc(db!, "users", userId, "dayEvents", dk), {
              id: dk, dateKey: dk, dayType: "TRAVEL_ENTRY", source: "GENERATED", updatedAt: Date.now(), updatedBy: userId, userId
            }, { merge: true });
          }
          iterDate = addDays(iterDate, 1);
        }
        state = "ROT";
      } else if (state === "ROT") {
        for (let i = 0; i < 28; i++) {
          if (iterDate.getFullYear() !== currentYear) break;
          const dk = format(iterDate, "yyyy-MM-dd");
          if (events[dk]?.source !== "MANUAL") {
            batch.set(doc(db!, "users", userId, "dayEvents", dk), {
              id: dk, dateKey: dk, dayType: "ROTATION", source: "GENERATED", updatedAt: Date.now(), updatedBy: userId, userId
            }, { merge: true });
          }
          iterDate = addDays(iterDate, 1);
        }
        state = "TX";
      } else if (state === "TX") {
        if (iterDate.getFullYear() === currentYear) {
          const dk = format(iterDate, "yyyy-MM-dd");
          if (events[dk]?.source !== "MANUAL") {
            batch.set(doc(db!, "users", userId, "dayEvents", dk), {
              id: dk, dateKey: dk, dayType: "TRAVEL_EXIT", source: "GENERATED", updatedAt: Date.now(), updatedBy: userId, userId
            }, { merge: true });
          }
          iterDate = addDays(iterDate, 1);
        }
        state = "VAC";
      }
    }
  };

  const generateRotations = useCallback((startDateKey: string, initialType: string, initialDuration: number) => {
    if (!user || !db) return;
    const batch = writeBatch(db);
    let current = startOfDay(parseISO(startDateKey));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    const baseType = initialType as DayType;
    for (let i = 0; i < initialDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      const dk = format(current, "yyyy-MM-dd");
      batch.set(doc(db, "users", user.uid, "dayEvents", dk), {
        id: dk, dateKey: dk, dayType: baseType, source: "GENERATED", updatedAt: Date.now(), updatedBy: user.uid, userId: user.uid
      }, { merge: true });
      current = addDays(current, 1);
    }

    let nextState: "VAC" | "TE" | "ROT" | "TX";
    if (baseType === "VACATION") nextState = "TE";
    else if (baseType === "TRAVEL_ENTRY") nextState = "ROT";
    else if (baseType === "ROTATION") nextState = "TX";
    else if (baseType === "TRAVEL_EXIT") nextState = "VAC";
    else nextState = "VAC";

    fillRestOfYearBatch(batch, current, nextState, currentYear, endGen, user.uid);
    batch.commit();
  }, [user, db, events]);

  const resyncChain = useCallback((anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db) return;
    const batch = writeBatch(db);
    let current = startOfDay(parseISO(anchorDate));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    for (let i = 0; i < newDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      const dk = format(current, "yyyy-MM-dd");
      batch.set(doc(db, "users", user.uid, "dayEvents", dk), {
        id: dk, dateKey: dk, dayType: type, source: "GENERATED", updatedAt: Date.now(), updatedBy: user.uid, userId: user.uid
      }, { merge: true });
      current = addDays(current, 1);
    }

    let nextState: "VAC" | "TE" | "ROT" | "TX";
    if (type === "VACATION") nextState = "TE";
    else if (type === "ROTATION") nextState = "TX";
    else if (type === "STANDBY") nextState = "VAC";
    else return;

    fillRestOfYearBatch(batch, current, nextState, currentYear, endGen, user.uid);
    batch.commit();
  }, [user, db, events]);

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
