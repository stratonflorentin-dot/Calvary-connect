"use client";

import { useState, useEffect } from 'react';

export type Language = 'en' | 'sw';

export function useLanguage() {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('fleet_lang') as Language;
    if (saved) setLang(saved);
  }, []);

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'sw' : 'en';
    setLang(next);
    localStorage.setItem('fleet_lang', next);
  };

  const t = {
    dashboard: "Dashboard",
    fleet: "Fleet",
    finance: "Finance",
    inventory: "Inventory Control",
    map: "Live Map",
    trips: "Trips & Dispatch",
    users: "User Management",
    notifications: "Notifications",
    logout: "Logout",
  };

  return { lang, toggleLanguage, t };
}
