
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings } from "@/lib/types";
import { format, addDays, isBefore, startOfDay } from "date-fns";

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
      dateKey,
      dayType: partial.dayType ?? existing?.dayType ?? "NORMAL",
      flightTicketPurchased: partial.flightTicketPurchased ?? existing?.flightTicketPurchased ?? false,
      flightInfo: partial.flightInfo ?? existing?.flightInfo ?? "",
      notes: partial.notes ?? existing?.notes ?? "",
      source: "MANUAL",
      updatedAt: Date.now(),
      updatedBy: user.uid,
    };
    
    setDocumentNonBlocking(dayRef, newEvent, { merge: true });
  };

  const generateRotations = (startDate: Date) => {
    if (!user || !settings || !db) return;
    
    const settingsRef = doc(db, "users", user.uid, "settings", "profile");
    setDocumentNonBlocking(settingsRef, {
      ...settings,
      startRotationDate: startDate.getTime(),
      updatedAt: Date.now()
    }, { merge: true });

    const totalDays = settings.generateMonthsAhead * 31;
    let current = startOfDay(startDate);
    const endGeneration = addDays(current, totalDays);

    while (isBefore(current, endGeneration)) {
      const dateKey = format(current, "yyyy-MM-dd");
      const existing = events[dateKey];
      
      if (!existing || existing.source === "GENERATED") {
        const diffInDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = diffInDays % 56;
        
        if (cycleDay < 28) {
           const dayRef = doc(db, "users", user.uid, "dayEvents", dateKey);
           setDocumentNonBlocking(dayRef, {
             dateKey,
             dayType: "ROTATION",
             flightTicketPurchased: false,
             source: "GENERATED",
             updatedAt: Date.now(),
             updatedBy: user.uid
           }, { merge: true });
        }
      }
      current = addDays(current, 1);
    }
  };

  return { settings, events, loading, updateDay, generateRotations };
}
