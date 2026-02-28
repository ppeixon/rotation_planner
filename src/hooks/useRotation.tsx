
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings, DayType } from "@/lib/types";
import { format, addDays, isBefore, startOfDay, differenceInDays } from "date-fns";

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
      source: "MANUAL",
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

    const totalDays = settings.generateMonthsAhead * 31;
    // Empezamos un día antes para poder marcar el primer día de viaje (d-1)
    let current = addDays(startOfDay(startDate), -1);
    const endGeneration = addDays(current, totalDays + 2);

    while (isBefore(current, endGeneration)) {
      const dateKey = format(current, "yyyy-MM-dd");
      const existing = events[dateKey];
      
      // Solo sobreescribimos si no hay nada o si lo que hay fue generado automáticamente
      if (!existing || existing.source === "GENERATED") {
        const diffInDays = differenceInDays(current, startDate);
        // Ciclo de 56 días (28 trabajo + 28 descanso)
        const cycleDay = ((diffInDays % 56) + 56) % 56;
        
        let targetType: DayType = "NORMAL";
        
        if (cycleDay >= 0 && cycleDay < 28) {
          // Bloque de rotación (28 días)
          targetType = "ROTATION";
        } else if (cycleDay === 55) {
          // Día d-1 (el día anterior al inicio de la rotación)
          targetType = "TRAVEL";
        }

        // Si es un día especial del ciclo o si era generado y ahora debe ser normal, actualizamos
        if (targetType !== "NORMAL" || (existing && existing.dayType !== "NORMAL")) {
          const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
          setDocumentNonBlocking(dayRef, {
            id: dateKey,
            dateKey,
            dayType: targetType,
            flightTicketPurchased: false,
            source: "GENERATED",
            updatedAt: Date.now(),
            updatedBy: user.uid,
            userId: user.uid
          }, { merge: true });
        }
      }
      current = addDays(current, 1);
    }
  };

  return { settings, events, loading, updateDay, generateRotations };
}
