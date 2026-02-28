
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
    
    // Respetar prioridad de entradas manuales: si existe y es MANUAL, no sobreescribir con lógica automática
    const existing = events[dateKey];
    if (source === "GENERATED" && existing?.source === "MANUAL") {
      return;
    }

    // Evitar escrituras redundantes si el tipo ya es el correcto
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

  const generateRotations = (startDateKey: string) => {
    if (!user || !settings || !db) return;
    
    const start = startOfDay(parseISO(startDateKey));
    const currentYear = start.getFullYear();
    const endGen = endOfYear(start);

    const settingsRef = doc(db, "users", user.uid, "settings", "profile");
    setDocumentNonBlocking(settingsRef, {
      ...settings,
      startRotationDate: start.getTime(),
      updatedAt: Date.now(),
    }, { merge: true });

    let current = start;

    // TRAVEL day siempre antes de empezar un bloque de rotación
    const preTravel = subDays(current, 1);
    if (preTravel.getFullYear() === currentYear) {
      internalUpdateDay(format(preTravel, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
    }

    while (isBefore(current, addDays(endGen, 1))) {
      // Bloque de Rotación (28 días)
      for (let i = 0; i < 28; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() !== currentYear) break;

      // Bloque de Vacaciones (28 días: 27 VACATION + 1 TRAVEL)
      for (let i = 0; i < 27; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "VACATION", "GENERATED");
        current = addDays(current, 1);
      }
      if (current.getFullYear() !== currentYear) break;
      
      // El último día de la secuencia de vacaciones es SIEMPRE TRAVEL
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

    // 1. Aplicar el bloque editado
    if (type === "ROTATION") {
      // TRAVEL obligatorio antes de rotación
      const preTravel = subDays(start, 1);
      if (preTravel.getFullYear() === currentYear) {
        internalUpdateDay(format(preTravel, "yyyy-MM-dd"), "TRAVEL", "GENERATED");
      }

      // Marcar los nuevos días de rotación
      for (let i = 0; i < newDuration; i++) {
        if (current.getFullYear() !== currentYear) break;
        internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
        current = addDays(current, 1);
      }
    } else {
      // Bloque VACATION: n-1 vacaciones + 1 viaje
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

    // 2. Continuar la cadena con bloques estandard 28/28 hasta final de año
    let nextIsRotation = (type === "VACATION");

    while (isBefore(current, addDays(endGen, 1)) && current.getFullYear() === currentYear) {
      if (nextIsRotation) {
        // Bloque Rotación estándar (28 días)
        // No necesita TRAVEL adicional porque el bloque previo de vacaciones ya terminó en TRAVEL
        for (let i = 0; i < 28; i++) {
          if (current.getFullYear() !== currentYear) break;
          internalUpdateDay(format(current, "yyyy-MM-dd"), "ROTATION", "GENERATED");
          current = addDays(current, 1);
        }
      } else {
        // Bloque Vacaciones estándar (27 VAC + 1 TRAVEL)
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
