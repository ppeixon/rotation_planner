
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings, DayType } from "@/lib/types";
import { 
  format, 
  addDays, 
  isBefore, 
  startOfDay, 
  parseISO, 
  endOfYear, 
  subDays,
  isSameYear
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

  const internalUpdateDay = (dateKey: string, type: DayType, source: "MANUAL" | "GENERATED" = "GENERATED") => {
    if (!user || !db) return;
    const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
    const existing = events[dateKey];
    
    setDocumentNonBlocking(dayRef, {
      id: dateKey,
      dateKey,
      dayType: type,
      flightTicketPurchased: existing?.flightTicketPurchased ?? false,
      flightInfo: existing?.flightInfo ?? "",
      notes: existing?.notes ?? "",
      source: source,
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: user.uid,
    }, { merge: true });
  };

  const updateDay = (dateKey: string, partial: Partial<DayEvent>) => {
    if (!user || !db) return;
    const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
    const existing = events[dateKey];
    
    const newEvent: DayEvent = {
      id: dateKey,
      dateKey,
      dayType: partial.dayType ?? existing?.dayType ?? "NORMAL",
      flightTicketPurchased: partial.flightTicketPurchased ?? existing?.flightTicketPurchased ?? false,
      flightInfo: partial.flightInfo ?? existing?.flightInfo ?? "",
      notes: partial.notes ?? existing?.notes ?? "",
      source: partial.source ?? "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: user.uid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  };

  const generateRotations = (startDate: Date) => {
    if (!user || !settings || !db) return;
    
    const start = startOfDay(startDate);
    const currentYear = start.getFullYear();
    const endGen = endOfYear(start);

    const settingsRef = doc(db, "users", user.uid, "settings", "profile");
    setDocumentNonBlocking(settingsRef, {
      ...settings,
      startRotationDate: start.getTime(),
      updatedAt: Date.now(),
    }, { merge: true });

    let current = start;

    // TRAVEL day always before starting a rotation block
    const preTravel = subDays(current, 1);
    if (preTravel.getFullYear() === currentYear) {
      internalUpdateDay(format(preTravel, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
    }

    while (isBefore(current, addDays(endGen, 1))) {
      // Rotation Block (28 days)
      for (let i = 0; i < 28; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() !== currentYear) break;

      // Vacation Block (28 days: 27 VACATION + 1 TRAVEL)
      for (let i = 0; i < 27; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() !== currentYear) break;
      
      // Last day of vacation sequence is ALWAYS TRAVEL
      internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
      current = addDays(current, 1);
    }
  };

  const resyncChain = async (anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db || !settings) return;

    const start = startOfDay(parseISO(anchorDate));
    const currentYear = start.getFullYear();
    const endGen = endOfYear(start);
    let current = start;

    if (type === "ROTATION") {
      // 1. Mandatory TRAVEL before rotation
      const preTravel = subDays(start, 1);
      if (preTravel.getFullYear() === currentYear) {
        internalUpdateDay(format(preTravel, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
      }

      // 2. Set the rotation block
      for (let i = 0; i < newDuration; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
    } else {
      // VACATION block: x-1 vacation + 1 travel
      for (let i = 0; i < newDuration - 1; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() === currentYear) {
        internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
        current = addDays(current, 1);
      }
    }

    // 3. Continue the chain with default 28/28 blocks until end of year
    // If we just finished ROTATION, next is VACATION. If we finished VACATION, next is ROTATION.
    let nextIsRotation = (type === "VACATION");

    while (isBefore(current, addDays(endGen, 1))) {
      if (nextIsRotation) {
        // Rotation block always starts with a TRAVEL day if it's not immediately following a vacation TRAVEL day
        // (But according to logic, the vacation block already ends in TRAVEL, which serves as the pre-rotation TRAVEL)
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
      } else {
        // Standard Vacation block: 27 VACATION + 1 TRAVEL
        for (let i = 0; i < 27; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
          current = addDays(current, 1);
        }
      }
      nextIsRotation = !nextIsRotation;
    }
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
