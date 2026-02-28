"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import { DayEvent, UserSettings } from "@/lib/types";
import { format, addDays, isBefore, startOfDay, parseISO } from "date-fns";

export function useRotation() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [events, setEvents] = useState<Record<string, DayEvent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setEvents({});
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, "settings", user.uid);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as UserSettings);
      } else {
        // Default settings
        const defaultSettings: UserSettings = {
          startRotationDate: null,
          generateMonthsAhead: 18,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          updatedAt: Date.now(),
        };
        setDoc(settingsRef, defaultSettings);
      }
    });

    const eventsRef = collection(db, "dayEvents", user.uid, "days");
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
  }, [user]);

  const updateDay = async (dateKey: string, partial: Partial<DayEvent>) => {
    if (!user) return;
    const dayRef = doc(db, "dayEvents", user.uid, "days", dateKey);
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
    
    await setDoc(dayRef, newEvent);
  };

  const generateRotations = async (startDate: Date) => {
    if (!user || !settings) return;
    
    const settingsRef = doc(db, "settings", user.uid);
    await setDoc(settingsRef, {
      ...settings,
      startRotationDate: startDate.getTime(),
      updatedAt: Date.now()
    }, { merge: true });

    const totalDays = settings.generateMonthsAhead * 31; // Buffer
    let current = startOfDay(startDate);
    const endGeneration = addDays(current, totalDays);

    while (isBefore(current, endGeneration)) {
      const dateKey = format(current, "yyyy-MM-dd");
      
      // Check priority: if manual Travel or Vacation exists, skip
      const existing = events[dateKey];
      if (!existing || (existing.source === "GENERATED")) {
        // Simple logic for 28-day rotation blocks
        // For Algeria, let's assume 28 days ON, then we can adjust manually
        // The prompt says "generate blocks recurrentes de 28 días como Rotación"
        // Let's generate 28 days of ROTATION followed by 28 days of NORMAL?
        // Actually, the user says "mis rotaciones de 28 días", usually implies 4 weeks work.
        // Let's just mark 28 days as ROTATION starting from the start date.
        // Usually it repeats. Let's assume 28 ON / 28 OFF.
        
        const diffInDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = diffInDays % 56; // 28 ON + 28 OFF cycle
        
        if (cycleDay < 28) {
           const dayRef = doc(db, "dayEvents", user.uid, "days", dateKey);
           await setDoc(dayRef, {
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