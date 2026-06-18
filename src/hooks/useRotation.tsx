
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
  const { user, isReadOnly, targetUid } = useAuth();
  const db = useFirestore();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [events, setEvents] = useState<Record<string, DayEvent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si no hay targetUid (o user), no podemos cargar nada
    if (!targetUid || !user || !db) {
      setSettings(null);
      setEvents({});
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, "users", targetUid, "settings", "profile");
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as UserSettings);
      } else if (!isReadOnly && targetUid === user.uid) {
        // Solo el dueño puede inicializar sus settings si no existen
        const defaultSettings: UserSettings = {
          id: "profile",
          userId: targetUid,
          startRotationDate: null,
          generateMonthsAhead: 18,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          updatedAt: Date.now(),
        };
        setDocumentNonBlocking(settingsRef, defaultSettings, { merge: true });
      }
    });

    const eventsRef = collection(db, "users", targetUid, "dayEvents");
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
  }, [user, targetUid, db, isReadOnly]);

  const updateDay = useCallback((dateKey: string, partial: Partial<DayEvent>) => {
    if (!user || !db || isReadOnly || !targetUid) return;
    const dayRef = doc(db, "users", targetUid, "dayEvents", dateKey);
    const existing = events[dateKey];
    
    const newEvent: Partial<DayEvent> = {
      ...existing,
      id: dateKey,
      dateKey,
      dayType: partial.dayType ?? existing?.dayType ?? "NORMAL",
      flightTicketPurchased: partial.flightTicketPurchased ?? existing?.flightTicketPurchased ?? false,
      flightTicketPending: partial.flightTicketPending ?? existing?.flightTicketPending ?? false,
      flightInfo: partial.flightInfo ?? existing?.flightInfo ?? "",
      trainStatus: partial.trainStatus !== undefined ? partial.trainStatus : existing?.trainStatus,
      flightStatus: partial.flightStatus !== undefined ? partial.flightStatus : existing?.flightStatus,
      notes: partial.notes ?? existing?.notes ?? "",
      source: "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: targetUid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  }, [user, targetUid, db, events, isReadOnly]);


  const fillRestOfYearBatch = (batch: any, current: Date, state: "VAC" | "TE" | "ROT" | "TX", currentYear: number, endGen: Date, userId: string) => {
    let iterDate = current;
    while (iterDate.getFullYear() === currentYear && isBefore(iterDate, addDays(endGen, 1))) {
      const dateKey = format(iterDate, "yyyy-MM-dd");
      const dayRef = doc(db!, "users", userId, "dayEvents", dateKey);
      const existing = events[dateKey];

      if (existing?.source === "MANUAL") {
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
              id: dk, dateKey: dk, dayType: "VACATION", source: "GENERATED", updatedAt: Date.now(), updatedBy: user!.uid, userId
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
              id: dk, dateKey: dk, dayType: "TRAVEL_ENTRY", source: "GENERATED", updatedAt: Date.now(), updatedBy: user!.uid, userId
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
              id: dk, dateKey: dk, dayType: "ROTATION", source: "GENERATED", updatedAt: Date.now(), updatedBy: user!.uid, userId
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
              id: dk, dateKey: dk, dayType: "TRAVEL_EXIT", source: "GENERATED", updatedAt: Date.now(), updatedBy: user!.uid, userId
            }, { merge: true });
          }
          iterDate = addDays(iterDate, 1);
        }
        state = "VAC";
      }
    }
  };

  const generateRotations = useCallback((startDateKey: string, initialType: string, initialDuration: number) => {
    if (!user || !db || isReadOnly || !targetUid) return;
    const batch = writeBatch(db);
    let current = startOfDay(parseISO(startDateKey));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    const baseType = initialType as DayType;
    for (let i = 0; i < initialDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      const dk = format(current, "yyyy-MM-dd");
      batch.set(doc(db, "users", targetUid, "dayEvents", dk), {
        id: dk, dateKey: dk, dayType: baseType, source: "GENERATED", updatedAt: Date.now(), updatedBy: user.uid, userId: targetUid
      }, { merge: true });
      current = addDays(current, 1);
    }

    let nextState: "VAC" | "TE" | "ROT" | "TX";
    if (baseType === "VACATION") nextState = "TE";
    else if (baseType === "TRAVEL_ENTRY") nextState = "ROT";
    else if (baseType === "ROTATION") nextState = "TX";
    else if (baseType === "TRAVEL_EXIT") nextState = "VAC";
    else nextState = "VAC";

    fillRestOfYearBatch(batch, current, nextState, currentYear, endGen, targetUid);
    batch.commit();
  }, [user, targetUid, db, events, isReadOnly]);

  const resyncChain = useCallback((anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db || isReadOnly || !targetUid) return;
    const batch = writeBatch(db);
    let current = startOfDay(parseISO(anchorDate));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    for (let i = 0; i < newDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      const dk = format(current, "yyyy-MM-dd");
      batch.set(doc(db, "users", targetUid, "dayEvents", dk), {
        id: dk, dateKey: dk, dayType: type, source: "GENERATED", updatedAt: Date.now(), updatedBy: user.uid, userId: targetUid
      }, { merge: true });
      current = addDays(current, 1);
    }

    let nextState: "VAC" | "TE" | "ROT" | "TX" | null = null;
    if (type === "VACATION") nextState = "TE";
    else if (type === "ROTATION") nextState = "TX";

    if (nextState) {
      fillRestOfYearBatch(batch, current, nextState, currentYear, endGen, targetUid);
    }
    
    batch.commit();
  }, [user, targetUid, db, events, isReadOnly]);

  const clearYear = useCallback((year: number) => {
    if (!user || !db || isReadOnly || !targetUid) return;
    const batch = writeBatch(db);
    const yearPrefix = year.toString();
    
    Object.keys(events).forEach(dateKey => {
      if (dateKey.startsWith(yearPrefix)) {
        batch.delete(doc(db, "users", targetUid, "dayEvents", dateKey));
      }
    });
    
    batch.commit();
  }, [user, targetUid, db, events, isReadOnly]);

  return { settings, events, loading, updateDay, generateRotations, resyncChain, clearYear };
}
