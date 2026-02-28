
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection, writeBatch, query, where, getDocs } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings, DayType } from "@/lib/types";
import { format, addDays, isBefore, startOfDay, differenceInDays, parseISO, endOfYear, isSameYear, subDays } from "date-fns";

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
    
    const settingsRef = doc(db, "users", user.uid, "settings", "profile");
    setDocumentNonBlocking(settingsRef, {
      ...settings,
      startRotationDate: startDate.getTime(),
      updatedAt: Date.now(),
      userId: user.uid,
      id: "profile"
    }, { merge: true });

    // El día anterior al inicio de la rotación debe ser TRAVEL (si es el mismo año)
    const dayBeforeStart = subDays(startDate, 1);
    if (isSameYear(dayBeforeStart, startDate)) {
      const dbKey = format(dayBeforeStart, "yyyy-MM-dd");
      const dayRef = doc(db, "users", user.uid, "dayEvents", dbKey);
      setDocumentNonBlocking(dayRef, {
        id: dbKey,
        dateKey: dbKey,
        dayType: "TRAVEL",
        source: "GENERATED",
        updatedAt: Date.now(),
        updatedBy: user.uid,
        userId: user.uid
      }, { merge: true });
    }

    const endGeneration = endOfYear(startDate);
    let current = startOfDay(startDate);

    while (isBefore(current, addDays(endGeneration, 1))) {
      const dateKey = format(current, "yyyy-MM-dd");
      const existing = events[dateKey];
      
      if (isSameYear(current, startDate)) {
        if (!existing || existing.source === "GENERATED") {
          const diffInDays = differenceInDays(current, startDate);
          const cycleDay = ((diffInDays % 56) + 56) % 56;
          
          let targetType: DayType = "VACATION";
          
          if (cycleDay >= 0 && cycleDay < 28) {
            targetType = "ROTATION";
          } else if (cycleDay === 55) {
            // Este es el día anterior al siguiente bloque de rotación en el ciclo
            targetType = "TRAVEL";
          }

          if (!existing || existing.dayType !== targetType) {
            const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
            setDocumentNonBlocking(dayRef, {
              id: dateKey,
              dateKey,
              dayType: targetType,
              flightTicketPurchased: existing?.flightTicketPurchased ?? false,
              source: "GENERATED",
              updatedAt: Date.now(),
              updatedBy: user.uid,
              userId: user.uid
            }, { merge: true });
          }
        }
      }
      current = addDays(current, 1);
    }
  };

  const resyncChain = async (anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db || !settings) return;

    const start = startOfDay(parseISO(anchorDate));
    
    // Si el bloque editado es ROTATION, el día anterior debe ser TRAVEL
    if (type === "ROTATION") {
      const dayBefore = subDays(start, 1);
      if (isSameYear(dayBefore, start)) {
        const dbKey = format(dayBefore, "yyyy-MM-dd");
        const dayRef = doc(db, "users", user.uid, "dayEvents", dbKey);
        setDocumentNonBlocking(dayRef, {
          id: dbKey,
          dateKey: dbKey,
          dayType: "TRAVEL",
          source: "GENERATED",
          updatedAt: Date.now(),
          updatedBy: user.uid,
          userId: user.uid
        }, { merge: true });
      }
    }

    // 1. Actualizar el bloque editado
    for (let i = 0; i < newDuration; i++) {
      const current = addDays(start, i);
      if (!isSameYear(current, start)) break;

      const dateKey = format(current, "yyyy-MM-dd");
      const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
      
      setDocumentNonBlocking(dayRef, {
        id: dateKey,
        dateKey,
        dayType: type,
        source: "GENERATED",
        updatedAt: Date.now(),
        updatedBy: user.uid,
        userId: user.uid
      }, { merge: true });
    }

    // 2. Determinar qué sigue
    const nextCycleStart = addDays(start, newDuration);
    let effectiveRotationStart: Date;
    
    if (type === "ROTATION") {
      // Si acabamos de terminar una rotación, la siguiente empieza tras 28 días de vacaciones
      effectiveRotationStart = addDays(nextCycleStart, 28); 
      
      for (let i = 0; i < 28; i++) {
        const current = addDays(nextCycleStart, i);
        if (!isSameYear(current, start)) break;

        const dateKey = format(current, "yyyy-MM-dd");
        const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
        setDocumentNonBlocking(dayRef, {
          id: dateKey,
          dateKey,
          dayType: "VACATION",
          source: "GENERATED",
          updatedAt: Date.now(),
          updatedBy: user.uid,
          userId: user.uid
        }, { merge: true });
      }
    } else {
      // Si acabamos de terminar vacaciones, la rotación empieza inmediatamente
      effectiveRotationStart = nextCycleStart;
    }

    // El generador se encargará de poner el TRAVEL antes de la siguiente rotación
    generateRotations(effectiveRotationStart);
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
