
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
    if (source === "GENERATED" && existing?.source === "MANUAL") {
      return;
    }

    if (existing?.dayType === type && existing?.source === source) {
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

    // Función auxiliar para avanzar el ciclo
    const applyCycle = (type: string, duration: number) => {
      for (let i = 0; i < duration; i++) {
        if (current.getFullYear() !== currentYear) break;
        
        let dayType: DayType = "NORMAL";
        if (type === "ROTATION" || type === "TRAVEL_EXIT") dayType = "ROTATION"; // Salida es amarillo
        if (type === "VACATION") dayType = "VACATION"; // Vacaciones es azul
        if (type === "TRAVEL_ENTRY") dayType = "TRAVEL"; // Entrada es verde
        if (type === "STANDBY") dayType = "STANDBY"; // Standby es gris

        internalUpdateDay(format(current, "yyyy-MM-dd"), dayType, "GENERATED");
        current = addDays(current, 1);
      }
    };

    // 1. Aplicar el bloque inicial
    applyCycle(initialType, initialDuration);

    // 2. Continuar el ciclo hasta final de año
    // Orden: Vacaciones (26) -> Viaje Entrada (1) -> Rotación (28) -> Viaje Salida (1)
    let nextStep = "";
    if (initialType === "ROTATION") nextStep = "TRAVEL_EXIT";
    else if (initialType === "TRAVEL_EXIT") nextStep = "VACATION";
    else if (initialType === "VACATION") nextStep = "TRAVEL_ENTRY";
    else if (initialType === "TRAVEL_ENTRY") nextStep = "ROTATION";
    else nextStep = "VACATION"; // Por defecto tras Standby o similar

    while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
      if (nextStep === "VACATION") {
        applyCycle("VACATION", 26);
        nextStep = "TRAVEL_ENTRY";
      } else if (nextStep === "TRAVEL_ENTRY") {
        applyCycle("TRAVEL_ENTRY", 1);
        nextStep = "ROTATION";
      } else if (nextStep === "ROTATION") {
        applyCycle("ROTATION", 28);
        nextStep = "TRAVEL_EXIT";
      } else if (nextStep === "TRAVEL_EXIT") {
        applyCycle("TRAVEL_EXIT", 1);
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

    if (type === "ROTATION") {
      // Bloque Rotación: N-1 días rotación + 1 día viaje salida (todo amarillo)
      for (let i = 0; i < newDuration; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
      
      // Tras rotación siempre vienen Vacaciones
      while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
        // Ciclo estándar desde Vacaciones
        for (let i = 0; i < 26; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED"); // Viaje Entrada
          current = addDays(current, 1);
        }
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED"); // Viaje Salida
          current = addDays(current, 1);
        }
      }
    } else {
      // Bloque Vacaciones: N-1 días vacaciones + 1 día viaje entrada (verde)
      for (let i = 0; i < newDuration - 1; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() === currentYear) {
        internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
        current = addDays(current, 1);
      }

      // Tras vacaciones siempre viene Rotación
      while (current.getFullYear() === currentYear && isBefore(current, addDays(endGen, 1))) {
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED"); // Viaje Salida
          current = addDays(current, 1);
        }
        for (let i = 0; i < 26; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
          current = addDays(current, 1);
        }
        if (current.getFullYear() === currentYear) {
          internalUpdateDay(format(current, "yyyy-MM-dd"), "TRAVEL", "GENERATED"); // Viaje Entrada
          current = addDays(current, 1);
        }
      }
    }
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
