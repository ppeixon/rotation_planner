
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection, writeBatch, query, where, getDocs } from "firebase/firestore";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings, DayType } from "@/lib/types";
import { format, addDays, isBefore, startOfDay, differenceInDays, parseISO } from "date-fns";

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
    let current = addDays(startOfDay(startDate), -1);
    const endGeneration = addDays(current, totalDays + 2);

    while (isBefore(current, endGeneration)) {
      const dateKey = format(current, "yyyy-MM-dd");
      const existing = events[dateKey];
      
      if (!existing || existing.source === "GENERATED") {
        const diffInDays = differenceInDays(current, startDate);
        const cycleDay = ((diffInDays % 56) + 56) % 56;
        
        let targetType: DayType = "VACATION";
        
        if (cycleDay >= 0 && cycleDay < 28) {
          targetType = "ROTATION";
        } else if (cycleDay === 55) {
          targetType = "TRAVEL";
        }

        if (!existing || existing.dayType !== targetType) {
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

  const resyncChain = async (anchorDate: string, newDuration: number, type: DayType) => {
    if (!user || !db || !settings) return;

    const start = startOfDay(parseISO(anchorDate));
    const nextCycleStart = addDays(start, newDuration);
    
    // 1. Update the first block (the one being edited)
    for (let i = 0; i < newDuration; i++) {
      const current = addDays(start, i);
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

    // 2. Determine what follows. If we just finished a ROTATION of X days, 
    // we start a normal 28/28 cycle starting with VACATION.
    // So the "new" start date for the 28/28 logic will be the start of the *next* block.
    // But our generateRotations expects the start of a ROTATION block.
    // If we just edited a ROTATION, the next block is VACATION (28 days).
    // So the next ROTATION starts in 28 days.
    
    let effectiveRotationStart: Date;
    if (type === "ROTATION") {
      effectiveRotationStart = addDays(nextCycleStart, 28); // Next rotation starts after 28 days of vacation
      
      // Fill the vacation gap manually
      for (let i = 0; i < 28; i++) {
        const current = addDays(nextCycleStart, i);
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
      // If we just edited VACATION, the next block is ROTATION
      effectiveRotationStart = nextCycleStart;
    }

    // Call standard generator from the new calculated rotation start
    generateRotations(effectiveRotationStart);
  };

  return { settings, events, loading, updateDay, generateRotations, resyncChain };
}
