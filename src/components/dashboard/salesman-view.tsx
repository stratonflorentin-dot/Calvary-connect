"use client";

import { useState, useMemo, useEffect } from "react"; 
import { DashboardLayout, ActivityFeed, AlertPanel } from "@/components/dashboard/shared/dashboard-layout";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { useCustomers } from "@/hooks/data/use-customers";
import { useTrips } from "@/hooks/data/use-trips";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useRateSheets } from "@/hooks/data/use-rate-sheets";
import { useQuotations } from "@/hooks/data/use-quotations";
import { useBookings } from "@/hooks/data/use-bookings";
import { useUsers } from "@/hooks/data/use-users";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { AuditService } from "@/services/audit-service";
import { supabase } from "@/lib/supabase";
import { 
  saveCustomerAction, deleteCustomerAction,
  saveTripAction, deleteTripAction,
  saveInvoiceAction, deleteInvoiceAction,
  saveExpenseAction, deleteExpenseAction,
  saveRateSheetAction, deleteRateSheetAction,
  saveQuotationAction
} from "@/app/sales/actions";
import { 
  Briefcase, DollarSign, Users, Calendar, TrendingUp, BarChart2,
  CheckCircle2, Clock, AlertTriangle, Eye, FileText, MapPin,
  Navigation, Package, ArrowRight, RefreshCw, Settings, Bell,
  Sparkles, Shield, Plus, Trash2, Edit, Locate, Truck,
  Calculator, Printer, Download, Search, CheckCircle, XCircle, Loader2
} from "lucide-react";

 // ── Helpers ─────────────────────────────────────────────────────────────── 
 const fmtTZS = (n: number) => `TZS ${Number(n || 0).toLocaleString()}`; 
 const today = () => new Date().toISOString().split("T")[0]; 
 
 const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = { 
   completed: { bg: "#d1fae5", text: "#065f46", label: "Completed" }, 
   in_transit: { bg: "#dbeafe", text: "#1e40af", label: "In Transit" }, 
   pending:    { bg: "#fef3c7", text: "#92400e", label: "Pending" }, 
   created:    { bg: "#f3f4f6", text: "#374151", label: "Created" }, 
   loading:    { bg: "#ede9fe", text: "#5b21b6", label: "Loading" }, 
   paid:       { bg: "#d1fae5", text: "#065f46", label: "Paid" }, 
   overdue:    { bg: "#fee2e2", text: "#991b1b", label: "Overdue" }, 
   active:     { bg: "#d1fae5", text: "#065f46", label: "Active" }, 
   inactive:   { bg: "#f3f4f6", text: "#6b7280", label: "Inactive" }, 
   COMPLETED:  { bg: "#d1fae5", text: "#065f46", label: "Completed" },
   PENDING:    { bg: "#fef3c7", text: "#92400e", label: "Pending" },
   IN_TRANSIT: { bg: "#dbeafe", text: "#1e40af", label: "In Transit" },
 }; 
 
 const Badge = ({ status }: { status: string }) => { 
   const s = STATUS_COLORS[status] || STATUS_COLORS.pending; 
   return ( 
     <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}> 
       {s.label} 
     </span> 
   ); 
 }; 
 
 // ── Company Stamp SVG ───────────────────────────────────────────────────── 
 const CompanyStamp = ({ size = 110 }) => ( 
   <svg width={size} height={size} viewBox="0 0 340 340"> 
     <style>{`.st{font-family:'Times New Roman',serif;fill:#1a5fa8;letter-spacing:2px}`}</style> 
     <circle cx="170" cy="170" r="155" fill="none" stroke="#1a5fa8" strokeWidth="4"/> 
     <circle cx="170" cy="170" r="143" fill="none" stroke="#1a5fa8" strokeWidth="1.5"/> 
     <path id="ta" d="M 28,165 A 142,142 0 0,1 312,165" fill="none"/> 
     <text className="st" fontSize="17" fontWeight="700"><textPath href="#ta" startOffset="50%" textAnchor="middle">CALVARY INVESTMENT COMPANY LTD.</textPath></text> 
     <path id="ba" d="M 45,225 A 142,142 0 0,0 295,225" fill="none"/> 
     <text className="st" fontSize="15" fontWeight="700"><textPath href="#ba" startOffset="50%" textAnchor="middle">★  TANZANIA  ★</textPath></text> 
     <text x="170" y="162" className="st" fontSize="14.5" fontWeight="700" textAnchor="middle" letterSpacing="1">P. O. Box 75941</text> 
     <text x="170" y="184" className="st" fontSize="14.5" fontWeight="700" textAnchor="middle" letterSpacing="1">DAR ES SALAAM</text> 
     <line x1="90" y1="195" x2="250" y2="195" stroke="#1a5fa8" strokeWidth="1.2"/> 
     <line x1="95" y1="143" x2="245" y2="143" stroke="#1a5fa8" strokeWidth="1.2"/> 
   </svg> 
 ); 
 
 // ── Contract Preview ────────────────────────────────────────────────────── 
 function ContractPreview({ client, rateRow, details, onClose }: any) { 
   const html = ` 
     <html><head><style> 
       body{font-family:'Times New Roman',serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.7;color:#111} 
       h1{color:#1e3a5f;font-size:20px;margin:0}h2{color:#1e3a5f;font-size:16px} 
       table{width:100%;border-collapse:collapse;font-size:12px} 
       th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left} 
       td{border:1px solid #ccc;padding:6px 10px}tr:nth-child(even){background:#f9f9f9} 
       .sig-box{border-bottom:1px solid #333;height:50px;margin-bottom:8px} 
       .note{background:#fff3cd;border-left:4px solid #f59e0b;padding:10px 15px;font-size:12px;margin:16px 0} 
       .footer{text-align:center;font-size:10px;color:#888;border-top:1px solid #ccc;margin-top:50px;padding-top:12px} 
       @media print{body{padding:20px}} 
     </style></head><body> 
     <div style="display:flex;align-items:center;gap:24px;border-bottom:3px solid #1e3a5f;padding-bottom:20px;margin-bottom:28px"> 
       <svg width="90" height="90" viewBox="0 0 340 340"> 
         <style>.st{font-family:'Times New Roman',serif;fill:#1a5fa8;letter-spacing:2px}</style> 
         <circle cx="170" cy="170" r="155" fill="none" stroke="#1a5fa8" stroke-width="4"/> 
         <circle cx="170" cy="170" r="143" fill="none" stroke="#1a5fa8" stroke-width="1.5"/> 
         <path id="ta" d="M 28,165 A 142,142 0 0,1 312,165" fill="none"/> 
         <text class="st" font-size="17" font-weight="700"><textPath href="#ta" startOffset="50%" text-anchor="middle">CALVARY INVESTMENT COMPANY LTD.</textPath></text> 
         <path id="ba" d="M 45,225 A 142,142 0 0,0 295,225" fill="none"/> 
         <text class="st" font-size="15" font-weight="700"><textPath href="#ba" startOffset="50%" text-anchor="middle">★  TANZANIA  ★</textPath></text> 
         <text x="170" y="162" class="st" font-size="14.5" font-weight="700" text-anchor="middle">P. O. Box 75941</text> 
         <text x="170" y="184" class="st" font-size="14.5" font-weight="700" text-anchor="middle">DAR ES SALAAM</text> 
         <line x1="90" y1="195" x2="250" y2="195" stroke="#1a5fa8" stroke-width="1.2"/> 
         <line x1="95" y1="143" x2="245" y2="143" stroke="#1a5fa8" stroke-width="1.2"/> 
       </svg> 
       <div> 
         <h1>TRANSPORTATION SERVICES AGREEMENT</h1> 
         <p style="margin:4px 0;color:#555;font-size:13px">Calvary Investment Company Ltd &nbsp;|&nbsp; P.O. Box 75941, Dar es Salaam, Tanzania</p> 
       </div> 
     </div> 
 
     <p style="text-align:center;margin-bottom:24px"> 
       <strong>This Agreement is made on the ${new Date(details.contract_date || today()).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong> 
     </p> 
 
     <p><strong>Between:</strong></p> 
     <div style="display:flex;gap:40px;margin:16px 0 24px"> 
       <div style="flex:1;padding:12px;border:1px solid #ccc;border-radius:4px"> 
         <strong>${client?.company_name || "[Client Name]"}</strong><br/>${client?.address || "[Client Address]"}<br/> 
         Contact: ${client?.contact_person || "[Contact]"}<br/>Phone: ${client?.phone || "[Phone]"}<br/> 
         <em style="font-size:12px">(hereinafter "The Client")</em> 
       </div> 
       <div style="flex:1;padding:12px;border:1px solid #ccc;border-radius:4px"> 
         <strong>Calvary Investment Company Ltd</strong><br/>P.O. Box 75941, Dar es Salaam<br/> 
         Contact: Managing Director<br/> 
         <em style="font-size:12px">(hereinafter "The Transporter")</em> 
       </div> 
     </div> 
 
     <h2>1. SCOPE OF SERVICES</h2> 
     <p>The Transporter agrees to provide road freight transportation services to the Client for the movement of cargo between the agreed routes, subject to the rates and conditions set out in this Agreement.</p> 
 
     <h2>2. CONTRACT PERIOD</h2> 
     <p>This Agreement shall be effective from <strong>${new Date(details.start_date || today()).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>${details.end_date ? ` to <strong>${new Date(details.end_date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>` : " and shall remain in force until terminated by either party with 30 days written notice"}.</p> 
 
     <h2>3. AGREED RATES – ANNEXURE A</h2> 
     <table> 
       <thead><tr><th>From</th><th>Destination</th><th>20ft (TZS)</th><th>40ft (TZS)</th><th>Loose (TZS)</th><th>Transit Days</th></tr></thead> 
       <tbody> 
         ${rateRow ? `<tr><td>${rateRow.origin_name || rateRow.from}</td><td>${rateRow.destination_name || rateRow.destination}</td><td>${(rateRow.container_20ft_rate || rateRow.c20).toLocaleString()}</td><td>${(rateRow.container_40ft_rate || rateRow.c40).toLocaleString()}</td><td>${(rateRow.loose_cargo_rate || rateRow.loose).toLocaleString()}</td><td>${rateRow.transit_days || rateRow.days}</td></tr>` : rateSheets.map((r,i)=>`<tr style="${i%2?'background:#f9f9f9':''}"><td>${r.origin_name}</td><td>${r.destination_name}</td><td>${r.container_20ft_rate?.toLocaleString()}</td><td>${r.container_40ft_rate?.toLocaleString()}</td><td>${r.loose_cargo_rate?.toLocaleString()}</td><td>${r.transit_days}</td></tr>`).join("")} 
       </tbody> 
     </table> 
 
     <div class="note"><strong>Note:</strong> Rates are negotiable based on volume and frequency. Fuel surcharges may apply. All rates are exclusive of port/border charges unless stated.</div> 
 
     <h2>4. PAYMENT TERMS</h2> 
     <p>Invoices are due within <strong>${details.payment_days || 14} days</strong> of delivery. Overdue accounts attract 2% monthly interest. Payment by bank transfer to Calvary Investment Company Ltd — account details provided on invoice.</p> 
 
     <h2>5. LIABILITY</h2> 
     <p>The Transporter shall take reasonable care of cargo in transit. Liability for loss or damage shall be limited to the declared value of goods, provided the Client has declared such value prior to shipment. The Transporter shall not be liable for delays caused by force majeure, border closures, or road conditions beyond its control.</p> 
 
     <h2>6. INSURANCE</h2> 
     <p>Cargo insurance is the responsibility of the Client unless otherwise agreed in writing. The Transporter maintains third-party vehicle insurance as required by law.</p> 
 
     <h2>7. GOVERNING LAW</h2> 
     <p>This Agreement is governed by the Laws of the United Republic of Tanzania. Any disputes shall be resolved by arbitration in Dar es Salaam.</p> 
 
     ${details.special_notes ? `<h2>8. SPECIAL CONDITIONS</h2><p>${details.special_notes}</p>` : ""} 
 
     <div style="margin-top:50px"> 
       <p style="text-align:center;font-weight:bold;margin-bottom:30px">IN WITNESS WHEREOF, the parties have executed this Agreement:</p> 
       <div style="display:flex;gap:60px"> 
         <div style="flex:1"> 
           <p><strong>For and on behalf of The Client</strong></p> 
           <div class="sig-box"></div> 
           <p>Name: ${details.client_signatory || "___________________________"}</p> 
           <p>Title: ${details.client_title || "___________________________"}</p> 
           <p style="font-size:11px;color:#888">(Affix company stamp)</p> 
         </div> 
         <div style="flex:1"> 
           <p><strong>For and on behalf of The Transporter</strong></p> 
           <div class="sig-box"></div> 
           <p>Name: ___________________________</p> 
           <p>Title: Managing Director</p> 
           <p style="font-size:11px;color:#888">(Affix company stamp)</p> 
         </div> 
       </div> 
     </div> 
 
     <div class="footer">Calvary Investment Company Ltd | P.O. Box 75941, Dar es Salaam, Tanzania | This Agreement is governed by the Laws of the United Republic of Tanzania</div> 
     </body></html>`; 
 
   const print = () => { 
     const w = window.open("", "_blank"); 
     if (w) {
       w.document.write(html); 
       w.document.close(); 
       w.print(); 
     }
   }; 
 
   return ( 
     <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}> 
       <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}> 
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}> 
           <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>Contract Preview</span> 
           <div style={{ display: "flex", gap: 10 }}> 
             <button onClick={print} style={{ background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🖨 Print / Save PDF</button> 
             <button onClick={onClose} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>✕ Close</button> 
           </div> 
         </div> 
         <div style={{ overflow: "auto", padding: 24, flex: 1 }} dangerouslySetInnerHTML={{ __html: html }} /> 
       </div> 
     </div> 
   ); 
 } 
 
 // ── Modal Wrapper ───────────────────────────────────────────────────────── 
 function Modal({ title, onClose, children }: any) { 
   return ( 
     <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}> 
       <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}> 
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #e5e7eb" }}> 
           <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span> 
           <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button> 
         </div> 
         <div style={{ padding: 24 }}>{children}</div> 
       </div> 
     </div> 
   ); 
 } 
 
 const Field = ({ label, children }: any) => ( 
   <div style={{ marginBottom: 16 }}> 
     <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label> 
     {children} 
   </div> 
 ); 
 const Input = (props: any) => <input {...props} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", ...props.style }} />; 
 const Select = ({ value, onChange, children, ...rest }: any) => ( 
   <select value={value} onChange={onChange} {...rest} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" }}>{children}</select> 
 ); 
 const Btn = ({ children, onClick, variant = "primary", style: s = {}, ...rest }: any) => { 
   const styles: any = { 
     primary: { background: "#1e3a5f", color: "#fff" }, 
     secondary: { background: "#f3f4f6", color: "#374151" }, 
     danger: { background: "#fee2e2", color: "#991b1b" }, 
     success: { background: "#d1fae5", color: "#065f46" }, 
   }; 
   return <button onClick={onClick} {...rest} style={{ border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, ...styles[variant], ...s }}>{children}</button>; 
 }; 
 
 // ── Main Dashboard ───────────────────────────────────────────────────────── 
 export default function SalesmanDashboard() { 
   const { role } = useRole();
   const { format } = useCurrency();
   const [tab, setTab] = useState("overview"); 
   
   // Real data hooks
   const { customers, refresh: refreshCustomers } = useCustomers();
   const { trips, refresh: refreshTrips } = useTrips();
   const { invoices, refresh: refreshInvoices } = useInvoices();
   const { expenses, refresh: refreshExpenses } = useExpenses();
   const { rateSheets, refresh: refreshRateSheets } = useRateSheets();
   const { quotations, refresh: refreshQuotations } = useQuotations();
   const { bookings, refresh: refreshBookings } = useBookings();
   const { users: drivers } = useUsers();
   const { vehicles, loading: vLoading } = useFleetVehicles();

   const [modal, setModal] = useState<any>(null); // { type, data } 
   const [contractState, setContractState] = useState<any>(null); 
   const [searchQ, setSearchQ] = useState(""); 
   const [clientView, setClientView] = useState<"table" | "grid">("grid");
   const [isSaving, setIsSaving] = useState(false);
   const [alerts, setAlerts] = useState<any[]>([]);
   const [activities, setActivities] = useState<any[]>([]);
   const [extraLoading, setExtraLoading] = useState(true);

   const clientMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]); 

   useEffect(() => {
     const loadExtra = async () => {
       try {
         setExtraLoading(true);
         // Real sales activities
         const logs = await AuditService.getLogs({ limit: 5 });
         const mappedActivities = logs.filter(l => ['sales', 'customers', 'quotations', 'bookings'].includes(l.table_name)).map(log => ({
           id: log.id,
           title: log.change_summary || "Sales Activity",
           description: `${log.user_name} updated ${log.table_name}`,
           time: new Date(log.created_at).toLocaleTimeString(),
           icon: Briefcase,
           color: "bg-blue-500",
         }));
         setActivities(mappedActivities.length > 0 ? mappedActivities : [
           { id: '1', title: 'No recent sales activity', description: 'Pipeline is steady', time: 'Now', icon: Briefcase, color: 'bg-slate-400' }
         ]);

         // Real sales alerts
         const pendingBookings = bookings.filter(b => b.status === 'pending');
         const expiringQuotations = quotations.filter(q => {
           if (!q.expiry_date) return false;
           const expiry = new Date(q.expiry_date);
           return expiry > new Date() && expiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
         });
         
         const combinedAlerts = [
           ...(pendingBookings.map(b => ({
             id: b.id,
             title: "Pending Booking",
             description: `New booking #${b.booking_number} from ${clientMap[b.customer_id]?.company_name || 'Client'} needs review.`,
             severity: "warning" as const,
             time: "Recent"
           }))),
           ...(expiringQuotations.map(q => ({
             id: q.id,
             title: "Expiring Quotation",
             description: `Quotation #${q.quotation_number} for ${q.origin} expires soon.`,
             severity: "info" as const,
             time: "Action required"
           })))
         ];
         setAlerts(combinedAlerts);
       } catch (err) {
         console.error("Error loading Sales extra data:", err);
       } finally {
         setExtraLoading(false);
       }
     };
     loadExtra();
   }, [bookings, quotations, clientMap]);

   const closeModal = () => setModal(null); 
 
   // ── Derived metrics ── 
   const completedTrips = useMemo(() => trips.filter(t => t.status === "completed" || t.status === "COMPLETED"), [trips]); 
   const totalRevenue = useMemo(() => completedTrips.reduce((s, t) => s + (t.revenue || 0), 0), [completedTrips]); 
   const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]); 
   const netProfit = totalRevenue - totalExpenses;
   const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
   const unpaid = useMemo(() => invoices.filter(i => i.status !== "paid"), [invoices]); 
   const unpaidAmount = useMemo(() => unpaid.reduce((s, i) => s + (i.amount || 0), 0), [unpaid]); 
   const activeTripsCount = useMemo(() => trips.filter(t => ["in_transit", "loading", "pending", "created", "IN_TRANSIT", "PENDING"].includes(t.status)).length, [trips]);
   const activeClientsCount = useMemo(() => customers.filter(c => c.status === "active").length, [customers]);
 
   // ── Filtering logic ──
   const filteredClients = useMemo(() => customers.filter(c => 
     (c.company_name || "").toLowerCase().includes(searchQ.toLowerCase()) || 
     (c.contact_person || "").toLowerCase().includes(searchQ.toLowerCase())
   ), [customers, searchQ]);

   const filteredTrips = useMemo(() => trips.filter(t => 
     (t.trip_number || t.tripNumber || "").toLowerCase().includes(searchQ.toLowerCase()) || 
     (t.origin || "").toLowerCase().includes(searchQ.toLowerCase()) ||
     (t.destination || "").toLowerCase().includes(searchQ.toLowerCase())
   ), [trips, searchQ]);

   const filteredInvoices = useMemo(() => invoices.filter(i => 
     (i.invoice_number || "").toLowerCase().includes(searchQ.toLowerCase())
   ), [invoices, searchQ]);

   const filteredQuotations = useMemo(() => quotations.filter(q => 
     (q.quotation_number || "").toLowerCase().includes(searchQ.toLowerCase()) ||
     (q.origin || "").toLowerCase().includes(searchQ.toLowerCase()) ||
     (q.destination || "").toLowerCase().includes(searchQ.toLowerCase())
   ), [quotations, searchQ]);

   const filteredBookings = useMemo(() => bookings.filter(b => 
     (b.booking_number || "").toLowerCase().includes(searchQ.toLowerCase()) ||
     (b.origin || "").toLowerCase().includes(searchQ.toLowerCase()) ||
     (b.destination || "").toLowerCase().includes(searchQ.toLowerCase())
   ), [bookings, searchQ]);

   // ── Handlers ── 
   const saveTrip = async (data: any) => { 
     setIsSaving(true);
     try {
       // Ensure trip is linked to booking if applicable
       await saveTripAction(data);
       refreshTrips();
       if (data.booking_id) refreshBookings();
       closeModal();
     } catch (err) {
       alert("Error saving trip: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const saveRateSheet = async (data: any) => {
     setIsSaving(true);
     try {
       await saveRateSheetAction(data);
       refreshRateSheets();
       closeModal();
     } catch (err) {
       alert("Error saving rate sheet: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const deleteRateSheet = async (id: string) => {
     if (confirm("Delete this rate sheet entry?")) {
       setIsSaving(true);
       try {
         await deleteRateSheetAction(id);
         refreshRateSheets();
       } catch (err) {
         alert("Error deleting rate sheet: " + err);
       } finally {
         setIsSaving(false);
       }
     }
   };

   const saveQuotation = async (data: any) => {
     setIsSaving(true);
     try {
       await saveQuotationAction(data);
       refreshQuotations();
       closeModal();
     } catch (err) {
       alert("Error saving quotation: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const deleteTrip = async (id: string) => {
     if (confirm("Delete this trip?")) {
       setIsSaving(true);
       try {
         await deleteTripAction(id);
         refreshTrips();
       } catch (err) {
         alert("Error deleting trip: " + err);
       } finally {
         setIsSaving(false);
       }
     }
   };

   const saveClient = async (data: any) => {
     setIsSaving(true);
     try {
       await saveCustomerAction(data);
       refreshCustomers();
       closeModal();
     } catch (err) {
       alert("Error saving client: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const deleteClient = async (id: string) => {
     if (confirm("Delete this client?")) {
       setIsSaving(true);
       try {
         await deleteCustomerAction(id);
         refreshCustomers();
       } catch (err) {
         alert("Error deleting client: " + err);
       } finally {
         setIsSaving(false);
       }
     }
   };

   const saveInvoice = async (data: any) => {
     setIsSaving(true);
     try {
       await saveInvoiceAction(data);
       refreshInvoices();
       closeModal();
     } catch (err) {
       alert("Error saving invoice: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const markInvoicePaid = async (id: string) => {
     setIsSaving(true);
     try {
       const invoice = invoices.find(i => i.id === id);
       if (invoice) {
         await saveInvoiceAction({ ...invoice, status: "paid" });
         refreshInvoices();
       }
     } catch (err) {
       alert("Error marking invoice paid: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const deleteInvoice = async (id: string) => {
     if (confirm("Delete this invoice?")) {
       setIsSaving(true);
       try {
         await deleteInvoiceAction(id);
         refreshInvoices();
       } catch (err) {
         alert("Error deleting invoice: " + err);
       } finally {
         setIsSaving(false);
       }
     }
   };

   const saveExpense = async (data: any) => {
     setIsSaving(true);
     try {
       await saveExpenseAction(data);
       refreshExpenses();
       closeModal();
     } catch (err) {
       alert("Error saving expense: " + err);
     } finally {
       setIsSaving(false);
     }
   };

   const deleteExpense = async (id: string) => {
     if (confirm("Delete this expense?")) {
       setIsSaving(true);
       try {
         await deleteExpenseAction(id);
         refreshExpenses();
       } catch (err) {
         alert("Error deleting expense: " + err);
       } finally {
         setIsSaving(false);
       }
     }
   };

   if (!role) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-2" /> Loading Dashboard...</div>;

   return (
     <DashboardLayout
       title="Sales Dashboard"
       description="Calvary Connect Sales & Commercial Management"
       role={role || "SALESMAN"}
     >
       <div className="space-y-6">
         {/* Alert Panel */}
         <AlertPanel alerts={alerts} />

         {/* Top Sticky Header with Search */}
         <div className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-md pb-4 pt-2">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex bg-white p-1 rounded-xl border shadow-sm overflow-x-auto no-scrollbar w-full md:w-auto">
                    {[
                        { id: "overview", label: "📊 Overview" },
                        { id: "clients", label: "👥 Clients" },
                        { id: "quotations", label: "📝 Quotations" },
                        { id: "bookings", label: "📅 Bookings" },
                        { id: "trips", label: "🚚 Trips" },
                        { id: "invoices", label: "🧾 Invoices" },
                        { id: "expenses", label: "💸 Expenses" },
                        { id: "rates", label: "📈 Rate Sheet" }
                    ].map(t => (
                        <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-[#1e3a5f] text-white shadow-md" : "text-gray-500 hover:bg-gray-100"}`}
                        >
                        {t.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search records..." 
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm bg-white shadow-sm"
                    />
                </div>
            </div>
         </div>

         {/* Overview Tab */}
         {tab === "overview" && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm group hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><DollarSign /></div>
                   <div>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Revenue</p>
                     <p className="text-2xl font-black text-gray-800">{fmtTZS(totalRevenue)}</p>
                   </div>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm group hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all"><Calculator /></div>
                   <div>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Expenses</p>
                     <p className="text-2xl font-black text-gray-800">{fmtTZS(totalExpenses)}</p>
                   </div>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm group hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-green-50 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all"><Briefcase /></div>
                   <div>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Net Profit</p>
                     <p className="text-2xl font-black text-gray-800">{fmtTZS(netProfit)}</p>
                   </div>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm group hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-orange-50 rounded-xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all"><AlertTriangle /></div>
                   <div>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unpaid Invoices</p>
                     <p className="text-2xl font-black text-gray-800">{fmtTZS(unpaidAmount)}</p>
                   </div>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 space-y-6">
                 <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="size-5 text-blue-600" /> Top Clients Leaderboard</h3>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Margin: {profitMargin.toFixed(1)}%</span>
                    </div>
                    <div className="space-y-4">
                        {customers.slice(0, 5).sort((a,b) => {
                            const revA = trips.filter(t => (t.client_id === a.id || t.client === a.id) && (t.status === "completed" || t.status === "COMPLETED")).reduce((s, t) => s + (t.revenue || 0), 0);
                            const revB = trips.filter(t => (t.client_id === b.id || t.client === b.id) && (t.status === "completed" || t.status === "COMPLETED")).reduce((s, t) => s + (t.revenue || 0), 0);
                            return revB - revA;
                        }).map(c => {
                        const rev = trips.filter(t => (t.client_id === c.id || t.client === c.id) && (t.status === "completed" || t.status === "COMPLETED")).reduce((s, t) => s + (t.revenue || 0), 0);
                        const tripCount = trips.filter(t => (t.client_id === c.id || t.client === c.id)).length;
                        const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
                        return (
                            <div key={c.id}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{c.company_name} <span className="text-[10px] text-gray-400 font-normal">({tripCount} trips)</span></span>
                                <span className="font-bold text-gray-900">{fmtTZS(rev)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className="bg-[#1e3a5f] h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                            </div>
                            </div>
                        );
                        })}
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Navigation className="size-5 text-purple-600" /> Recent Trips Activity</h3>
                        <button onClick={() => setTab("trips")} className="text-xs font-bold text-blue-600 hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {trips.slice(-4).reverse().map(t => (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:border-blue-100 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${t.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                        <Truck size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900">{t.trip_number || t.tripNumber} — {t.origin} to {t.destination}</p>
                                        <p className="text-[10px] text-gray-500">{clientMap[t.client_id || t.client]?.company_name} | {new Date(t.date || t.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <Badge status={t.status} />
                            </div>
                        ))}
                    </div>
                 </div>
               </div>

               <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center">
                        <CompanyStamp size={140} />
                        <h4 className="mt-4 font-black text-[#1a5fa8] text-lg">CALVARY CONNECT</h4>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Official Logistics Portal</p>
                        <div className="mt-6 w-full grid grid-cols-2 gap-2">
                            <div className="bg-blue-50 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-blue-400 uppercase">Active Trips</p>
                                <p className="text-xl font-black text-blue-700">{activeTripsCount}</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-xl">
                                <p className="text-[10px] font-bold text-purple-400 uppercase">Clients</p>
                                <p className="text-xl font-black text-purple-700">{activeClientsCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><AlertTriangle className="size-4 text-orange-500" /> Pending Invoices</h3>
                        <div className="space-y-3">
                            {invoices.filter(i => i.status !== "paid").slice(0, 3).map(i => (
                                <div key={i.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <p className="text-xs font-bold text-gray-900">{i.invoice_number}</p>
                                        <p className="text-[10px] text-gray-500">{clientMap[i.client]?.company_name}</p>
                                    </div>
                                    <p className="text-xs font-black text-red-600">{fmtTZS(i.amount)}</p>
                                </div>
                            ))}
                            <button onClick={() => setTab("invoices")} className="w-full text-center text-[10px] font-black uppercase text-blue-600 hover:underline">Manage all billing</button>
                        </div>
                    </div>

                    <div className="bg-[#1e3a5f] p-6 rounded-2xl shadow-lg text-white">
                        <h3 className="font-bold mb-2 flex items-center gap-2 text-sm"><Sparkles className="size-4 text-blue-300" /> Sales Quick Action</h3>
                        <p className="text-[11px] text-blue-100 mb-4 leading-relaxed">Need to secure a new route? Use the contract generator to finalize terms in seconds.</p>
                        <button onClick={() => setTab("contracts")} className="w-full py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-bold transition-colors">Create Agreement</button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><Clock className="size-4 text-blue-500" /> Recent Activities</h3>
                        <ActivityFeed activities={activities} />
                    </div>
               </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><BarChart2 className="size-5 text-purple-600" /> Performance Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {["pending", "created", "loading", "in_transit", "completed"].map(st => {
                        const count = trips.filter(t => t.status === st).length;
                        const total = trips.length;
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        return (
                            <div key={st} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">{st.replace('_', ' ')}</p>
                                    <span className="text-xs font-black text-gray-700">{count}</span>
                                </div>
                                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${STATUS_COLORS[st]?.text === '#065f46' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                                </div>
                                <p className="text-[9px] text-gray-400 font-bold">{pct.toFixed(0)}% of total</p>
                            </div>
                        );
                    })}
                </div>
             </div>
           </div>
         )}

         {/* Clients Tab */}
         {tab === "clients" && (
           <div className="space-y-6 animate-in fade-in">
             <div className="flex items-center justify-between">
                <div className="flex bg-white p-1 rounded-xl border shadow-sm">
                    <button onClick={() => setClientView("grid")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${clientView === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>Grid View</button>
                    <button onClick={() => setClientView("table")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${clientView === 'table' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>Table View</button>
                </div>
                <Btn onClick={() => setModal({ type: "client" })}><Plus size={16} /> Add New Client</Btn>
             </div>

             {clientView === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(c => {
                        const rev = trips.filter(t => (t.client_id === c.id || t.client === c.id) && (t.status === "completed" || t.status === "COMPLETED")).reduce((s, t) => s + (t.revenue || 0), 0);
                        const tripCount = trips.filter(t => (t.client_id === c.id || t.client === c.id)).length;
                        return (
                            <div key={c.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="size-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors">
                                        <Briefcase size={24} />
                                    </div>
                                    <Badge status={c.status} />
                                </div>
                                <h4 className="font-bold text-gray-900 text-lg mb-1">{c.company_name}</h4>
                                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1"><MapPin size={10} /> {c.address}</p>
                                
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Revenue</p>
                                        <p className="text-sm font-black text-green-600">{fmtTZS(rev)}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Trips</p>
                                        <p className="text-sm font-black text-gray-800">{tripCount}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Users size={14} className="text-gray-400" /> {c.contact_person}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Bell size={14} className="text-gray-400" /> {c.phone}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <button onClick={() => { setContractState({ client: c.id }); setTab("contracts"); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><FileText size={14} /> Contract</button>
                                    <div className="flex gap-1">
                                        <button onClick={() => setModal({ type: "client", data: c })} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={14} /></button>
                                        <button onClick={() => deleteClient(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
             ) : (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Company Name</th>
                            <th className="px-6 py-4">Contact Person</th>
                            <th className="px-6 py-4">Revenue / Trips</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y">
                        {filteredClients.map(c => {
                            const rev = trips.filter(t => (t.client_id === c.id || t.client === c.id) && (t.status === "completed" || t.status === "COMPLETED")).reduce((s, t) => s + (t.revenue || 0), 0);
                            const tripCount = trips.filter(t => (t.client_id === c.id || t.client === c.id)).length;
                            return (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{c.company_name}</div>
                                        <div className="text-[10px] text-gray-400">{c.address}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-800 font-medium">{c.contact_person}</div>
                                        <div className="text-[10px] text-gray-400">{c.email} | {c.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-green-600">{fmtTZS(rev)}</div>
                                        <div className="text-[10px] text-gray-400">{tripCount} trips</div>
                                    </td>
                                    <td className="px-6 py-4"><Badge status={c.status} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => { setContractState({ client: c.id }); setTab("contracts"); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Create Contract"><FileText size={14} /></button>
                                        <button onClick={() => setModal({ type: "client", data: c })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                                        <button onClick={() => deleteClient(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-1"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    </div>
                </div>
             )}
           </div>
         )}

         {/* Trips Tab */}
         {tab === "trips" && (
           <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in">
             <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
               <h3 className="font-bold text-gray-800">Trip Logs</h3>
               <Btn onClick={() => setModal({ type: "trip" })}><Plus size={16} /> New Trip</Btn>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                   <tr>
                     <th className="px-6 py-4">Trip # / Date</th>
                     <th className="px-6 py-4">Route / Cargo</th>
                     <th className="px-6 py-4">Client / Assets</th>
                     <th className="px-6 py-4">Revenue</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {filteredTrips.map(t => (
                     <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4">
                            <div className="font-black text-gray-900">{t.trip_number || t.tripNumber}</div>
                            <div className="text-[10px] text-gray-400">{new Date(t.date || t.created_at).toLocaleDateString()}</div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-2 text-gray-800 font-medium">
                           {t.origin} <ArrowRight size={12} className="text-gray-400" /> {t.destination}
                         </div>
                         <div className="text-[10px] text-gray-400 italic">{t.cargo_type}</div>
                       </td>
                       <td className="px-6 py-4">
                            <div className="text-gray-600 font-medium">{clientMap[t.client_id || t.client]?.company_name || "Unknown"}</div>
                            <div className="text-[10px] text-gray-400">{t.driver_name || t.driver} | {t.truck_plate || t.truck}</div>
                       </td>
                       <td className="px-6 py-4 font-bold text-green-600">{fmtTZS(t.revenue)}</td>
                       <td className="px-6 py-4"><Badge status={t.status} /></td>
                       <td className="px-6 py-4 text-right">
                         <button onClick={() => setModal({ type: "trip", data: t })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                         <button onClick={() => deleteTrip(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-1"><Trash2 size={14} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* Invoices Tab */}
         {tab === "invoices" && (
           <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in">
             <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
               <h3 className="font-bold text-gray-800">Financial Invoices</h3>
               <Btn onClick={() => setModal({ type: "invoice" })}><Plus size={16} /> Create Invoice</Btn>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                   <tr>
                     <th className="px-6 py-4">Invoice #</th>
                     <th className="px-6 py-4">Client</th>
                     <th className="px-6 py-4">Amount</th>
                     <th className="px-6 py-4">Due Date</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {filteredInvoices.map(i => (
                     <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4 font-black text-gray-900">{i.invoice_number}</td>
                       <td className="px-6 py-4 text-gray-600">{i.client_name || clientMap[i.client_id || i.client]?.company_name || "Unknown"}</td>
                       <td className="px-6 py-4 font-bold text-blue-600">{fmtTZS(i.amount)}</td>
                       <td className="px-6 py-4">
                            <div className={`text-xs font-medium ${new Date(i.due_date) < new Date() && i.status !== 'paid' ? 'text-red-500' : 'text-gray-500'}`}>
                                {new Date(i.due_date).toLocaleDateString()}
                            </div>
                       </td>
                       <td className="px-6 py-4"><Badge status={new Date(i.due_date) < new Date() && i.status !== 'paid' ? 'overdue' : i.status} /></td>
                       <td className="px-6 py-4 text-right">
                         {i.status !== "paid" && <button onClick={() => markInvoicePaid(i.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Mark Paid"><CheckCircle size={14} /></button>}
                         <button onClick={() => setModal({ type: "invoice", data: i })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                         <button onClick={() => deleteInvoice(i.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-1"><Trash2 size={14} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* Expenses Tab */}
         {tab === "expenses" && (
           <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {["Fuel", "Fees", "Allowance", "Maintenance", "Other"].map(cat => {
                    const total = expenses.filter(e => e.category === cat).reduce((s,e) => s + (e.amount || 0), 0);
                    const iconMap: any = { Fuel: <Locate />, Fees: <Shield />, Allowance: <Users />, Maintenance: <Settings />, Other: <Package /> };
                    return (
                        <div key={cat} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    {iconMap[cat] || <Package size={16} />}
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">{cat}</p>
                                    <p className="text-sm font-black text-gray-800">{fmtTZS(total)}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
             </div>
             <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
                <h3 className="font-bold text-gray-800">Operational Expenses</h3>
                <Btn onClick={() => setModal({ type: "expense" })}><Plus size={16} /> Record Expense</Btn>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                        <th className="px-6 py-4">Description / Trip</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{e.description}</div>
                            <div className="text-[10px] text-gray-400">Trip: {trips.find(t => t.id === (e.trip_id || e.trip))?.trip_number || "N/A"}</div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-black uppercase text-gray-500">{e.category}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-red-600">{fmtTZS(e.amount)}</td>
                        <td className="px-6 py-4 text-gray-500">{new Date(e.expense_date || e.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => setModal({ type: "expense", data: e })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                            <button onClick={() => deleteExpense(e.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-1"><Trash2 size={14} /></button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
             </div>
           </div>
         )}

         {/* Quotations Tab */}
         {tab === "quotations" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Sales Quotations</h3>
                    <Btn onClick={() => setModal({ type: "quotation" })}><Plus size={16} /> Create Quotation</Btn>
                </div>
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4">QT #</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Route</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredQuotations.map(q => (
                                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{q.quotation_number}</td>
                                    <td className="px-6 py-4">{clientMap[q.customer_id]?.company_name || "Unknown"}</td>
                                    <td className="px-6 py-4">{q.origin} → {q.destination}</td>
                                    <td className="px-6 py-4 font-black text-blue-600">{fmtTZS(q.total_amount)}</td>
                                    <td className="px-6 py-4"><Badge status={q.status} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={14} /></button>
                                        <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg ml-1"><CheckCircle size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}

         {/* Bookings Tab */}
         {tab === "bookings" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Confirmed Bookings</h3>
                    <Btn onClick={() => setTab("quotations")} variant="secondary">From Quotation</Btn>
                </div>
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4">BK #</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Route / Date</th>
                                <th className="px-6 py-4">Cargo</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredBookings.map(b => (
                                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{b.booking_number}</td>
                                    <td className="px-6 py-4">{clientMap[b.customer_id]?.company_name}</td>
                                    <td className="px-6 py-4">
                                        <div>{b.origin} → {b.destination}</div>
                                        <div className="text-[10px] text-gray-400">{new Date(b.pickup_date).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">{b.cargo_type}</td>
                                    <td className="px-6 py-4"><Badge status={b.status} /></td>
                                    <td className="px-6 py-4 text-right">
                                        {b.status === 'confirmed' && (
                                            <button 
                                                onClick={() => setModal({ type: "trip", data: { ...b, client_id: b.customer_id, booking_id: b.id, revenue: b.amount } })}
                                                className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Generate Trip
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}

         {/* Rate Sheets Tab */}
         {tab === "rates" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Route & Rate Management</h3>
                    <Btn onClick={() => setModal({ type: "rate" })}><Plus size={16} /> Add Route</Btn>
                </div>
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Route Name</th>
                                <th className="px-6 py-4">20ft Rate</th>
                                <th className="px-6 py-4">40ft Rate</th>
                                <th className="px-6 py-4">Loose Rate/MT</th>
                                <th className="px-6 py-4">Transit Days</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rateSheets.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{r.route_name}</td>
                                    <td className="px-6 py-4 font-black text-gray-700">{fmtTZS(r.container_20ft)}</td>
                                    <td className="px-6 py-4 font-black text-gray-700">{fmtTZS(r.container_40ft)}</td>
                                    <td className="px-6 py-4 font-black text-gray-700">{fmtTZS(r.loose_rate_mt)}</td>
                                    <td className="px-6 py-4 text-center font-bold text-blue-600">{r.transit_days}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setModal({ type: "rate", data: r })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                                        <button onClick={() => deleteRateSheet(r.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-1"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}
       </div>

       {/* Contract Preview Modal */}
       {contractState?.showPreview && (
         <ContractPreview 
           client={customers.find(c => c.id === contractState.client)}
           rateRow={contractState.routeIdx !== "" ? rateSheets[contractState.routeIdx] : null}
           details={contractState}
           onClose={() => setContractState({ ...contractState, showPreview: false })}
         />
       )}

       {/* Modals for CRUD operations */}
       {modal?.type === "client" && (
         <Modal title={modal.data ? "Edit Client" : "Add New Client"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveClient(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Company Name"><Input name="company_name" defaultValue={modal.data?.company_name} required /></Field>
             <Field label="Contact Person"><Input name="contact_person" defaultValue={modal.data?.contact_person} required /></Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Email Address"><Input name="email" type="email" defaultValue={modal.data?.email} required /></Field>
                <Field label="Phone Number"><Input name="phone" defaultValue={modal.data?.phone} required /></Field>
             </div>
             <Field label="Physical Address"><Input name="address" defaultValue={modal.data?.address} /></Field>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit">Save Client</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "trip" && (
         <Modal title={modal.data ? "Edit Trip" : "New Trip Log"} onClose={closeModal}>
           <form onSubmit={(e) => { 
               e.preventDefault(); 
               const d = new FormData(e.currentTarget); 
               saveTrip(Object.fromEntries(d)); 
            }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <input type="hidden" name="booking_id" defaultValue={modal.data?.booking_id} />
             <Field label="Select Client">
               <Select name="client_id" defaultValue={modal.data?.client_id || modal.data?.client} required>
                 <option value="">Choose a client...</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
               </Select>
             </Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Select Route (Auto-Price)">
                    <Select onChange={(e: any) => {
                        if (e.target.value === "") return;
                        const route = rateSheets[e.target.value];
                        const form = e.target.closest('form');
                        form.origin.value = route.origin_name;
                        form.destination.value = route.destination_name;
                        form.revenue.value = route.container_20ft_rate; 
                    }}>
                        <option value="">Custom Route...</option>
                        {rateSheets.map((r, i) => <option key={i} value={i}>{r.origin_name} → {r.destination_name}</option>)}
                    </Select>
                </Field>
                <Field label="Trip Date"><Input name="date" type="date" defaultValue={modal.data?.date || today()} /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Origin"><Input name="origin" defaultValue={modal.data?.origin} required /></Field>
               <Field label="Destination"><Input name="destination" defaultValue={modal.data?.destination} required /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Cargo Type"><Input name="cargo_type" defaultValue={modal.data?.cargo_type} /></Field>
               <Field label="Revenue (TZS)"><Input name="revenue" type="number" defaultValue={modal.data?.revenue || modal.data?.amount} required /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Driver">
                    <Select name="driver_id" defaultValue={modal.data?.driver_id}>
                        <option value="">Assign Driver...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                    </Select>
               </Field>
               <Field label="Truck">
                    <Select name="truck_id" defaultValue={modal.data?.truck_id}>
                        <option value="">Assign Truck...</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                    </Select>
               </Field>
             </div>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit">Save Trip</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "invoice" && (
         <Modal title={modal.data ? "Edit Invoice" : "Create New Invoice"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveInvoice(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Select Trip (Auto-Amount)">
                <Select name="trip_id" defaultValue={modal.data?.trip_id || modal.data?.trip} onChange={(e: any) => {
                    const trip = trips.find(t => t.id === e.target.value);
                    if (trip) {
                        const form = e.target.closest('form');
                        form.client_id.value = trip.client_id || trip.client;
                        form.amount.value = trip.revenue;
                    }
                }}>
                    <option value="">Choose a trip...</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.trip_number || t.tripNumber} ({t.origin} → {t.destination})</option>)}
                </Select>
             </Field>
             <Field label="Select Client">
               <Select name="client_id" defaultValue={modal.data?.client_id || modal.data?.client} required>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
               </Select>
             </Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Amount (TZS)"><Input name="amount" type="number" defaultValue={modal.data?.amount} required /></Field>
                <Field label="Due Date"><Input name="due_date" type="date" defaultValue={modal.data?.due_date || today()} required /></Field>
             </div>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit">Create Invoice</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "expense" && (
         <Modal title={modal.data ? "Edit Expense" : "Record Operational Expense"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveExpense(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Description"><Input name="description" defaultValue={modal.data?.description} required /></Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Link to Trip">
                    <Select name="trip_id" defaultValue={modal.data?.trip_id || modal.data?.trip}>
                        <option value="">Optional: Choose trip...</option>
                        {trips.map(t => <option key={t.id} value={t.id}>{t.trip_number || t.tripNumber}</option>)}
                    </Select>
                </Field>
                <Field label="Category">
                    <Select name="category" defaultValue={modal.data?.category}>
                    <option value="Fuel">Fuel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Fees">Fees</option>
                    <option value="Allowance">Allowance</option>
                    <option value="Other">Other</option>
                    </Select>
                </Field>
             </div>
             <Field label="Amount (TZS)"><Input name="amount" type="number" defaultValue={modal.data?.amount} required /></Field>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit" disabled={isSaving}>Save Expense</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "rate" && (
         <Modal title={modal.data ? "Edit Route Rate" : "Add New Route"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveRateSheet(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Route Name (e.g. Dar-Nairobi)"><Input name="route_name" defaultValue={modal.data?.route_name} required /></Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Origin"><Input name="origin" defaultValue={modal.data?.origin} required /></Field>
                <Field label="Destination"><Input name="destination" defaultValue={modal.data?.destination} required /></Field>
             </div>
             <div className="grid grid-cols-3 gap-4">
                <Field label="20ft Rate"><Input name="container_20ft" type="number" defaultValue={modal.data?.container_20ft} required /></Field>
                <Field label="40ft Rate"><Input name="container_40ft" type="number" defaultValue={modal.data?.container_40ft} required /></Field>
                <Field label="Loose MT Rate"><Input name="loose_rate_mt" type="number" defaultValue={modal.data?.loose_rate_mt} required /></Field>
             </div>
             <Field label="Transit Days"><Input name="transit_days" type="number" defaultValue={modal.data?.transit_days} required /></Field>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit" disabled={isSaving}>Save Route</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "quotation" && (
         <Modal title="Create Sales Quotation" onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveQuotation(Object.fromEntries(d)); }}>
             <Field label="Select Client">
               <Select name="customer_id" required>
                 <option value="">Choose a client...</option>
                 {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
               </Select>
             </Field>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Origin"><Input name="origin" required /></Field>
                <Field label="Destination"><Input name="destination" required /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Field label="Total Amount (TZS)"><Input name="total_amount" type="number" required /></Field>
                <Field label="Validity (Days)"><Input name="validity_days" type="number" defaultValue="30" /></Field>
             </div>
             <Field label="Notes / Special Terms"><Input name="notes" /></Field>
             <div className="flex justify-end gap-2 mt-6">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit" disabled={isSaving}>Generate Quote</Btn>
             </div>
           </form>
         </Modal>
       )}
     </DashboardLayout>
   ); 
 }
