
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
  isSameDay
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
    
    const existing = events[dateKey];
    // No sobreescribir si el día fue editado manualmente
    if (source === "GENERATED" && existing?.source === "MANUAL") {
      return;
    }

    const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
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
      source: "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: user.uid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  };

  // Máquina de estados para rellenar el ciclo de 56 días
  const fillRestOfYear = (current: Date, state: "VAC" | "TE" | "ROT" | "TX", currentYear: number, endGen: Date) => {
    let iterDate = current;
    while (iterDate.getFullYear() === currentYear && isBefore(iterDate, addDays(endGen, 1))) {
      if (state === "VAC") {
        for (let i = 0; i < 26; i++) {
          if (iterDate.getFullYear() !== currentYear) break;
          internalUpdateDay(format(iterDate, "yyyy-MM-dd"), "VACATION", "GENERATED");
          iterDate = addDays(iterDate, 1);
        }
        state = "TE";
      } else if (state === "TE") {
        if (iterDate.getFullYear() === currentYear) {
          internalUpdateDay(format(iterDate, "yyyy-MM-dd"), "TRAVEL_ENTRY", "GENERATED");
          iterDate = addDays(iterDate, 1);
        }
        state = "ROT";
      } else if (state === "ROT") {
        for (let i = 0; i < 28; i++) {
          if (iterDate.getFullYear() !== currentYear) break;
          internalUpdateDay(format(iterDate, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          iterDate = addDays(iterDate, 1);
        }
        state = "TX";
      } else if (state === "TX") {
        if (iterDate.getFullYear() === currentYear) {
          internalUpdateDay(format(iterDate, "yyyy-MM-dd"), "TRAVEL_EXIT", "GENERATED");
          iterDate = addDays(iterDate, 1);
        }
        state = "VAC";
      }
    }
  };

  const generateRotations = (startDateKey: string, initialType: string, initialDuration: number) => {
    if (!user || !db) return;
    
    let current = startOfDay(parseISO(startDateKey));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    // 1. Bloque inicial personalizado
    for (let i = 0; i < initialDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      internalUpdateDay(format(current, "yyyy-MM-dd"), initialType as DayType, "GENERATED");
      current = addDays(current, 1);
    }

    // 2. Determinar siguiente estado
    let nextState: "VAC" | "TE" | "ROT" | "TX";
    if (initialType === "VACATION") nextState = "TE";
    else if (initialType === "TRAVEL_ENTRY") nextState = "ROT";
    else if (initialType === "ROTATION") nextState = "TX";
    else if (initialType === "TRAVEL_EXIT") nextState = "VAC";
    else nextState = "VAC";

    // 3. Rellenar
    fillRestOfYear(current, nextState, currentYear, endGen);
  };

  const resyncChain = (anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db) return;

    let current = startOfDay(parseISO(anchorDate));
    const currentYear = current.getFullYear();
    const endGen = endOfYear(current);

    // 1. Aplicar bloque editado (solo VACATION o ROTATION según UI)
    for (let i = 0; i < newDuration; i++) {
      if (current.getFullYear() !== currentYear) break;
      internalUpdateDay(format(current, "yyyy-MM-dd"), type, "GENERATED");
      current = addDays(current, 1);
    }

    // 2. Determinar siguiente paso tras el bloque ajustado
    let nextState: "VAC" | "TE" | "ROT" | "TX";
    if (type === "VACATION") nextState = "TE";
    else if (type === "ROTATION") nextState = "TX";
    else return;

    // 3. Seguir el autómata de 56 días
    fillRestOfYear(current, nextState, currentYear, endGen);
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
