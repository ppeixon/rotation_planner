
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
  subDays 
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
    // No sobreescribir si el día ya fue editado manualmente y la fuente actual es generada
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
      source: partial.source ?? "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
      userId: user.uid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  };

  const generateRotations = (startDateKey: string, initialType: string, initialDuration: number) => {
    if (!user || !db) return;
    
    const start = startOfDay(parseISO(startDateKey));
    const currentYear = start.getFullYear();
    const endGen = endOfYear(start);
    let current = start;

    const applyCyclePart = (type: string, duration: number) => {
      for (let i = 0; i < duration; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), type as DayType, "GENERATED");
        current = addDays(current, 1);
      }
    };

    // 1. Aplicar el bloque inicial tal cual lo pide el usuario
    applyCyclePart(initialType, initialDuration);

    // 2. Determinar el siguiente paso del ciclo estandar
    let nextStep = "";
    if (initialType === "ROTATION" || initialType === "TRAVEL_EXIT") nextStep = "VACATION";
    else if (initialType === "VACATION" || initialType === "TRAVEL_ENTRY") nextStep = "ROTATION";
    else nextStep = "VACATION";

    // 3. Completar el ciclo hasta fin de año
    while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
      if (nextStep === "VACATION") {
        applyCyclePart("VACATION", 27); // 27 días de vacaciones
        applyCyclePart("TRAVEL_ENTRY", 1); // 1 día de viaje entrada (verde)
        nextStep = "ROTATION";
      } else if (nextStep === "ROTATION") {
        applyCyclePart("ROTATION", 28); // 28 días de rotación (naranja)
        applyCyclePart("TRAVEL_EXIT", 1); // 1 día de viaje salida (amarillo)
        nextStep = "VACATION";
      }
    }
  };

  const resyncChain = async (anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db) return;

    const start = startOfDay(parseISO(anchorDate));
    const currentYear = start.getFullYear();
    const endGen = endOfYear(start);
    let current = start;

    // Ajustamos el bloque actual
    if (type === "ROTATION") {
      // Bloque Rotación: N-1 días naranja + 1 amarillo
      for (let i = 0; i < newDuration - 1; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() === currentYear) {
        internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_EXIT", "GENERATED");
        current = addDays(current, 1);
      }
      
      // Siguiente es Vacaciones
      while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
        for (let i = 0; i < 27; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_ENTRY", "GENERATED");
          current = addDays(current, 1);
        }
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_EXIT", "GENERATED");
          current = addDays(current, 1);
        }
      }
    } else if (type === "VACATION") {
      // Bloque Vacaciones: N-1 días azul + 1 verde
      for (let i = 0; i < newDuration - 1; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() === currentYear) {
        internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_ENTRY", "GENERATED");
        current = addDays(current, 1);
      }

      // Siguiente es Rotación
      while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_EXIT", "GENERATED");
          current = addDays(current, 1);
        }
        for (let i = 0; i < 27; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL_ENTRY", "GENERATED");
          current = addDays(current, 1);
        }
      }
    }
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
