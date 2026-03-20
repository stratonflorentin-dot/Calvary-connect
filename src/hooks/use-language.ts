
"use client";

import { useState, useEffect } from 'react';

export type Language = 'en' | 'sw';

const translations = {
  en: {
    dashboard: "Dashboard",
    fleet: "Fleet",
    finance: "Finance",
    inventory: "Inventory",
    map: "Live Map",
    trips: "Trips & Dispatch",
    users: "User Management",
    notifications: "Notifications",
    logout: "Logout",
    active_mission: "Active Mission",
    mileage: "Mileage",
    earnings: "Earnings",
    complete_delivery: "Complete Delivery",
    start_nav: "Start Navigator",
    proof: "Proof",
    expense: "Expense",
    issue: "Report Issue",
    capture: "Capture Photo",
    take_photo: "Take Photo",
    switch_lang: "Kiswahili",
    revenue: "Total Revenue",
    expenses: "Expenses",
    net_profit: "Net Profit",
    recent_income: "Recent Income",
    recent_expenses: "Recent Expenses",
    add_vehicle: "Add Vehicle",
    warehouse: "Warehouse Inventory",
    dispatch: "Dispatch New Trip",
    camera_access: "Camera Access Required",
    camera_desc: "Please allow camera access to capture evidence.",
    report_breakdown: "Report Breakdown",
    report_maintenance: "Maintenance Need",
    issue_description: "What is wrong with the vehicle?",
    submit_report: "Send Emergency Report",
    severity: "Severity Level",
    agent_contact: "Agent Contact",
    support: "Support",
  },
  sw: {
    dashboard: "Dashibodi",
    fleet: "Karakana",
    finance: "Fedha",
    inventory: "Hesabu",
    map: "Ramani ya Moja kwa Moja",
    trips: "Safari na Usimamizi",
    users: "Watumiaji",
    notifications: "Arifa",
    logout: "Ondoka",
    active_mission: "Kazi Inayoendelea",
    mileage: "Umbali",
    earnings: "Mapato",
    complete_delivery: "Kamilisha Uwasilishaji",
    start_nav: "Anza Ramani",
    proof: "Ushahidi",
    expense: "Gharama",
    issue: "Ripoti Tatizo",
    capture: "Piga Picha",
    take_photo: "Piga Picha",
    switch_lang: "English",
    revenue: "Jumla ya Mapato",
    expenses: "Gharama",
    net_profit: "Faida Safi",
    recent_income: "Mapato ya Hivi Karibuni",
    recent_expenses: "Gharama za Hivi Karibuni",
    add_vehicle: "Ongeza Gari",
    warehouse: "Hesabu ya Ghala",
    dispatch: "Anza Safari Mpya",
    camera_access: "Ufikiaji wa Kamera Unahitajika",
    camera_desc: "Tafadhali ruhusu ufikiaji wa kamera ili kupiga picha ya ushahidi.",
    report_breakdown: "Ripoti Gari Kuharibika",
    report_maintenance: "Mahitaji ya Matengenezo",
    issue_description: "Gari lina tatizo gani?",
    submit_report: "Tuma Ripoti ya Dharura",
    severity: "Kiwango cha Tatizo",
    agent_contact: "Nambari ya Wakala",
    support: "Msaada",
  }
};

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

  const t = translations[lang];

  return { lang, toggleLanguage, t };
}
