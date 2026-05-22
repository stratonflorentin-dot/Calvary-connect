"use client";

import { useState, useMemo } from "react"; 
import { DashboardLayout } from "@/components/dashboard/shared/dashboard-layout";
import { useRole } from "@/hooks/use-role";
import { 
  Briefcase, DollarSign, Users, Calendar, TrendingUp, BarChart2,
  CheckCircle2, Clock, AlertTriangle, Eye, FileText, MapPin,
  Navigation, Package, ArrowRight, RefreshCw, Settings, Bell,
  Sparkles, Shield, Plus, Trash2, Edit, Locate, Truck,
  Calculator, Printer, Download, Search, ChevronRight, X, Filter
} from "lucide-react";

/**
 * CALVARY CONNECT - SALESMAN DASHBOARD (ENTERPRISE EDITION)
 * A complete, standalone single-page dashboard for logistics sales management.
 */

 // ── 1. Seed Data ────────────────────────────────────────────────────────────── 
 const SEED_CLIENTS = [ 
   { id: "c1", company_name: "Simba Logistics Ltd", contact_person: "James Kimani", email: "james@simbalogistics.co.tz", phone: "+255 754 123 456", address: "P.O. Box 1234, Dar es Salaam", status: "active" }, 
   { id: "c2", company_name: "Tanga Cement Co.", contact_person: "Fatuma Hassan", email: "fatuma@tangacement.co.tz", phone: "+255 712 987 654", address: "P.O. Box 5678, Tanga", status: "active" }, 
   { id: "c3", company_name: "Kilimanjaro Traders", contact_person: "Peter Moshi", email: "peter@kilitraders.co.tz", phone: "+255 765 111 222", address: "P.O. Box 910, Moshi", status: "active" }, 
   { id: "c4", company_name: "Zanzibar Exports Ltd", contact_person: "Amina Said", email: "amina@znzexports.co.tz", phone: "+255 777 333 444", address: "P.O. Box 321, Zanzibar", status: "active" }, 
   { id: "c5", company_name: "Dodoma Agro Ltd", contact_person: "Rashid Mwamba", email: "rashid@dodomaagro.co.tz", phone: "+255 688 555 666", address: "P.O. Box 777, Dodoma", status: "inactive" }, 
 ]; 
 
 const SEED_TRIPS = [ 
   { id: "t1", tripNumber: "CAL-001", client: "c1", origin: "Dar es Salaam", destination: "Nairobi", cargo_type: "20ft Container", revenue: 850000, status: "completed", date: "2025-05-01", driver: "Ali Hassan", truck: "T.255 AAA" }, 
   { id: "t2", tripNumber: "CAL-002", client: "c2", origin: "Tanga", destination: "Mombasa", cargo_type: "40ft Container", revenue: 1200000, status: "completed", date: "2025-05-04", driver: "Moses Njeru", truck: "T.255 BBB" }, 
   { id: "t3", tripNumber: "CAL-003", client: "c3", origin: "Dar es Salaam", destination: "Lusaka", cargo_type: "Loose Cargo", revenue: 600000, status: "in_transit", date: "2025-05-10", driver: "David Odhiambo", truck: "T.255 CCC" }, 
   { id: "t4", tripNumber: "CAL-004", client: "c1", origin: "Dar es Salaam", destination: "Kampala", cargo_type: "20ft Container", revenue: 950000, status: "completed", date: "2025-05-12", driver: "Ali Hassan", truck: "T.255 AAA" }, 
   { id: "t5", tripNumber: "CAL-005", client: "c4", origin: "Zanzibar", destination: "Dar es Salaam", cargo_type: "Loose Cargo", revenue: 300000, status: "pending", date: "2025-05-18", driver: "", truck: "" }, 
   { id: "t6", tripNumber: "CAL-006", client: "c2", origin: "Dar es Salaam", destination: "Lilongwe", cargo_type: "40ft Container", revenue: 1350000, status: "completed", date: "2025-05-20", driver: "Moses Njeru", truck: "T.255 BBB" }, 
   { id: "t7", tripNumber: "CAL-007", client: "c3", origin: "Arusha", destination: "Nairobi", cargo_type: "20ft Container", revenue: 780000, status: "pending", date: "2025-05-22", driver: "", truck: "" }, 
 ]; 
 
 const SEED_INVOICES = [ 
   { id: "i1", invoice_number: "INV-2025-001", client: "c1", trip: "t1", amount: 850000, status: "paid", date: "2025-05-03", due_date: "2025-05-17" }, 
   { id: "i2", invoice_number: "INV-2025-002", client: "c2", trip: "t2", amount: 1200000, status: "paid", date: "2025-05-06", due_date: "2025-05-20" }, 
   { id: "i3", invoice_number: "INV-2025-003", client: "c3", trip: "t3", amount: 600000, status: "pending", date: "2025-05-11", due_date: "2025-05-25" }, 
   { id: "i4", invoice_number: "INV-2025-004", client: "c1", trip: "t4", amount: 950000, status: "overdue", date: "2025-05-13", due_date: "2025-05-20" }, 
   { id: "i5", invoice_number: "INV-2025-005", client: "c2", trip: "t6", amount: 1350000, status: "pending", date: "2025-05-21", due_date: "2025-06-04" }, 
 ]; 
 
 const SEED_EXPENSES = [ 
   { id: "e1", description: "Fuel – CAL-001", trip: "t1", amount: 120000, category: "Fuel", date: "2025-05-01" }, 
   { id: "e2", description: "Border crossing fees", trip: "t1", amount: 45000, category: "Fees", date: "2025-05-02" }, 
   { id: "e3", description: "Fuel – CAL-002", trip: "t2", amount: 95000, category: "Fuel", date: "2025-05-04" }, 
   { id: "e4", description: "Driver allowance", trip: "t2", amount: 30000, category: "Allowance", date: "2025-05-05" }, 
   { id: "e5", description: "Vehicle service", trip: "t4", amount: 80000, category: "Maintenance", date: "2025-05-12" }, 
 ]; 
 
 const RATE_SHEET = [ 
   { from: "Dar es Salaam", destination: "Nairobi", c20: 850000, c40: 1200000, loose: 450000, days: 2 }, 
   { from: "Dar es Salaam", destination: "Kampala", c20: 950000, c40: 1350000, loose: 500000, days: 3 }, 
   { from: "Dar es Salaam", destination: "Lusaka", c20: 1100000, c40: 1600000, loose: 600000, days: 4 }, 
   { from: "Dar es Salaam", destination: "Lilongwe", c20: 1050000, c40: 1500000, loose: 550000, days: 3 }, 
   { from: "Tanga", destination: "Mombasa", c20: 700000, c40: 1000000, loose: 380000, days: 1 }, 
   { from: "Arusha", destination: "Nairobi", c20: 780000, c40: 1100000, loose: 420000, days: 1 }, 
   { from: "Zanzibar", destination: "Dar es Salaam", c20: 350000, c40: 500000, loose: 200000, days: 1 }, 
 ]; 
 
 // ── 2. Helpers & Atoms ─────────────────────────────────────────────────────────────── 
 const fmt = (n: number) => `TZS ${Number(n || 0).toLocaleString()}`; 
 const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase(); 
 const today = () => new Date().toISOString().split("T")[0]; 
 
 const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = { 
   completed: { bg: "#d1fae5", text: "#065f46", label: "Completed" }, 
   in_transit: { bg: "#dbeafe", text: "#1e40af", label: "In Transit" }, 
   pending:    { bg: "#fef3c7", text: "#92400e", label: "Pending" }, 
   created:    { bg: "#f3f4f6", text: "#374151", label: "Created" }, 
   loading:    { bg: "#ede9fe", text: "#5b21b6", label: "Loading" }, 
   paid:       { bg: "#d1fae5", text: "#065f46", label: "Paid" }, 
   overdue:    { bg: "#fee2e2", text: "#991b1b", label: "Overdue" }, 
   active:     { bg: "#d1fae5", text: "#065f46", label: "Active" }, 
   inactive:   { bg: "#f3f4f6", text: "#6b7280", label: "Inactive" }, 
 }; 
 
 const Badge = ({ status }: { status: string }) => { 
   const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending; 
   return ( 
     <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, display: "inline-flex", alignItems: "center" }}> 
       {s.label} 
     </span> 
   ); 
 }; 

 const Modal = ({ title, onClose, children }: any) => ( 
   <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"> 
     <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"> 
       <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/50"> 
         <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">{title}</h3> 
         <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"><X size={20} /></button> 
       </div> 
       <div className="p-8 overflow-y-auto max-h-[80vh]">{children}</div> 
     </div> 
   </div> 
 ); 

 const Field = ({ label, children }: any) => ( 
   <div className="mb-5"> 
     <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{label}</label> 
     {children} 
   </div> 
 ); 

 const Input = (props: any) => (
   <input {...props} className={`w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none transition-all placeholder:text-gray-300 font-medium ${props.className || ""}`} />
 );

 const Select = ({ value, onChange, children, ...rest }: any) => ( 
   <select value={value} onChange={onChange} {...rest} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none transition-all font-medium appearance-none cursor-pointer">
     {children}
   </select> 
 ); 

 const Btn = ({ children, onClick, variant = "primary", className = "", ...rest }: any) => { 
   const styles: any = { 
     primary: "bg-[#1e3a5f] text-white hover:bg-[#162a45] shadow-lg shadow-[#1e3a5f]/20", 
     secondary: "bg-gray-100 text-gray-600 hover:bg-gray-200", 
     danger: "bg-red-50 text-red-600 hover:bg-red-100", 
     success: "bg-green-50 text-green-600 hover:bg-green-100", 
   }; 
   return (
     <button 
       onClick={onClick} 
       {...rest} 
       className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${styles[variant]} ${className}`}
     >
       {children}
     </button>
   ); 
 }; 

 // ── 3. Branded Components ───────────────────────────────────────────────────── 
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
       <strong>This Agreement is made on the ${new Date(details.contract_date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong> 
     </p> 
 
     <p><strong>Between:</strong></p> 
     <div style="display:flex;gap:40px;margin:16px 0 24px"> 
       <div style="flex:1;padding:12px;border:1px solid #ccc;border-radius:4px"> 
         <strong>${client?.company_name || "[Client Name]"}</strong><br/>${client?.address || "[Client Address]"}<br/> 
         Contact: ${client?.contact_person || "[Contact Person]"}<br/>Phone: ${client?.phone || "[Phone]"}<br/> 
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
     <p>This Agreement shall be effective from <strong>${new Date(details.start_date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>${details.end_date ? ` to <strong>${new Date(details.end_date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>` : " and shall remain in force until terminated by either party with 30 days written notice"}.</p> 
 
     <h2>3. AGREED RATES – ANNEXURE A</h2> 
     <table> 
       <thead><tr><th>From</th><th>Destination</th><th>20ft (TZS)</th><th>40ft (TZS)</th><th>Loose (TZS)</th><th>Transit Days</th></tr></thead> 
       <tbody> 
         ${rateRow ? `<tr><td>${rateRow.from}</td><td>${rateRow.destination}</td><td>${rateRow.c20.toLocaleString()}</td><td>${rateRow.c40.toLocaleString()}</td><td>${rateRow.loose.toLocaleString()}</td><td>${rateRow.days}</td></tr>` : RATE_SHEET.map((r,i)=>`<tr style="${i%2?'background:#f9f9f9':''}"><td>${r.from}</td><td>${r.destination}</td><td>${r.c20.toLocaleString()}</td><td>${r.c40.toLocaleString()}</td><td>${r.loose.toLocaleString()}</td><td>${r.days}</td></tr>`).join("")} 
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
     <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4"> 
       <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"> 
         <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/50"> 
           <div className="flex items-center gap-3">
             <div className="p-2 bg-[#1e3a5f]/10 rounded-lg text-[#1e3a5f]"><FileText size={20} /></div>
             <span className="text-lg font-black text-gray-800 uppercase tracking-tight">Contract Master Preview</span> 
           </div>
           <div className="flex gap-3"> 
             <Btn onClick={print}><Printer size={16} /> Print / Save PDF</Btn> 
             <Btn variant="secondary" onClick={onClose}><X size={16} /> Close</Btn> 
           </div> 
         </div> 
         <div className="overflow-auto p-12 bg-white flex-1" dangerouslySetInnerHTML={{ __html: html }} /> 
       </div> 
     </div> 
   ); 
 } 
 
 // ── 4. Main Dashboard Component ───────────────────────────────────────────────────────── 
 export default function SalesmanDashboard() { 
   const { role } = useRole();
   const [tab, setTab] = useState("overview"); 
   const [clients, setClients] = useState(SEED_CLIENTS); 
   const [trips, setTrips] = useState(SEED_TRIPS); 
   const [invoices, setInvoices] = useState(SEED_INVOICES); 
   const [expenses, setExpenses] = useState(SEED_EXPENSES); 
   const [modal, setModal] = useState<any>(null); // { type, data } 
   const [contractState, setContractState] = useState<any>(null); 
   const [searchQ, setSearchQ] = useState(""); 
 
   const closeModal = () => setModal(null); 
 
   // ── 5. Derived Metrics & Filters ── 
   const completedTrips = trips.filter(t => t.status === "completed"); 
   const totalRevenue = completedTrips.reduce((s, t) => s + (t.revenue || 0), 0); 
   const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0); 
   const unpaid = invoices.filter(i => i.status !== "paid"); 
   const unpaidAmount = unpaid.reduce((s, i) => s + (i.amount || 0), 0); 
   const activeTripsCount = trips.filter(t => ["in_transit", "loading"].includes(t.status)).length;
   const activeClientsCount = clients.filter(c => c.status === "active").length;
   
   const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]); 

   const filteredTrips = trips.filter(t => 
     t.tripNumber.toLowerCase().includes(searchQ.toLowerCase()) || 
     t.origin.toLowerCase().includes(searchQ.toLowerCase()) || 
     t.destination.toLowerCase().includes(searchQ.toLowerCase())
   );

   const filteredClients = clients.filter(c => 
     c.company_name.toLowerCase().includes(searchQ.toLowerCase()) || 
     c.contact_person.toLowerCase().includes(searchQ.toLowerCase())
   );
 
   // ── 6. CRUD Handlers ── 
   const saveTrip = (data: any) => { 
     if (data.id) setTrips(ts => ts.map(t => t.id === data.id ? { ...t, ...data, revenue: Number(data.revenue) } : t));
     else setTrips([...trips, { ...data, id: uid(), tripNumber: "CAL-" + (trips.length + 1).toString().padStart(3, '0'), status: "pending", date: today(), revenue: Number(data.revenue) }]);
     closeModal();
   };

   const deleteTrip = (id: string) => {
     if (confirm("Permanently delete this trip log?")) setTrips(trips.filter(t => t.id !== id));
   };

   const saveClient = (data: any) => {
     if (data.id) setClients(cs => cs.map(c => c.id === data.id ? { ...c, ...data } : c));
     else setClients([...clients, { ...data, id: uid(), status: "active" }]);
     closeModal();
   };

   const deleteClient = (id: string) => {
     if (confirm("Permanently delete this client profile?")) setClients(clients.filter(c => c.id !== id));
   };

   const saveInvoice = (data: any) => {
     const amount = data.trip_id ? (trips.find(t => t.id === data.trip_id)?.revenue || 0) : Number(data.amount);
     if (data.id) setInvoices(is => is.map(i => i.id === data.id ? { ...i, ...data, amount } : i));
     else setInvoices([...invoices, { ...data, id: uid(), invoice_number: "INV-" + today().split("-")[0] + "-" + (invoices.length + 1).toString().padStart(3, '0'), status: "pending", date: today(), amount }]);
     closeModal();
   };

   const deleteInvoice = (id: string) => {
     if (confirm("Permanently delete this invoice?")) setInvoices(invoices.filter(i => i.id !== id));
   };

   const saveExpense = (data: any) => {
     if (data.id) setExpenses(es => es.map(e => e.id === data.id ? { ...e, ...data, amount: Number(data.amount) } : e));
     else setExpenses([...expenses, { ...data, id: uid(), date: today(), amount: Number(data.amount) }]);
     closeModal();
   };

   const deleteExpense = (id: string) => {
     if (confirm("Permanently delete this expense record?")) setExpenses(expenses.filter(e => e.id !== id));
   };

   const markPaid = (id: string) => {
     setInvoices(is => is.map(i => i.id === id ? { ...i, status: "paid" } : i));
   };

   return (
     <DashboardLayout
       title="Sales Master Console"
       description="Enterprise Logistics CRM & Commercial Management"
       role={role || "SALESMAN"}
     >
       <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
         
         {/* ── Header Search & Tab Bar ── */}
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-2xl border shadow-sm sticky top-[64px] z-[50]">
           <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
             {[
               { id: "overview", label: "📊 Overview" },
               { id: "clients", label: "👥 Clients" },
               { id: "trips", label: "🚚 Trips" },
               { id: "invoices", label: "🧾 Invoices" },
               { id: "expenses", label: "💸 Expenses" },
               { id: "contracts", label: "📄 Contracts" }
             ].map(t => (
               <button
                 key={t.id}
                 onClick={() => { setTab(t.id); setSearchQ(""); }}
                 className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${tab === t.id ? "bg-[#1e3a5f] text-white shadow-lg" : "text-gray-400 hover:bg-gray-200"}`}
               >
                 {t.label}
               </button>
             ))}
           </div>
           
           {tab !== "overview" && tab !== "contracts" && (
             <div className="relative w-full md:w-80 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#1e3a5f] transition-colors" size={16} />
               <input 
                 type="text" 
                 placeholder={`Search ${tab}...`} 
                 value={searchQ}
                 onChange={(e) => setSearchQ(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none transition-all font-bold text-gray-700"
               />
             </div>
           )}
         </div>

         {/* ── 7. Module Content ── */}

         {/* OVERVIEW MODULE */}
         {tab === "overview" && (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* KPI GRID */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
               {[
                 { label: "Total Revenue", val: fmt(totalRevenue), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
                 { label: "Net Profit", val: fmt(totalRevenue - totalExpenses), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
                 { label: "Total Expenses", val: fmt(totalExpenses), icon: Calculator, color: "text-red-600", bg: "bg-red-50" },
                 { label: "Unpaid Amount", val: fmt(unpaidAmount), icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
                 { label: "Active Trips", val: activeTripsCount, icon: Truck, color: "text-cyan-600", bg: "bg-cyan-50" },
                 { label: "Active Clients", val: activeClientsCount, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
               ].map((kpi, i) => (
                 <div key={i} className="bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-shadow group">
                   <div className={`p-3 rounded-2xl w-fit mb-4 transition-transform group-hover:scale-110 ${kpi.bg} ${kpi.color}`}>
                     <kpi.icon size={20} />
                   </div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                   <p className="text-xl font-black text-gray-800 tracking-tight">{kpi.val}</p>
                 </div>
               ))}
             </div>

             <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               {/* ANALYTICS CARD */}
               <div className="xl:col-span-2 bg-white p-8 rounded-3xl border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                   <div>
                     <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Revenue Analytics</h3>
                     <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Client performance breakdown</p>
                   </div>
                   <Btn variant="secondary"><BarChart2 size={14} /> Full Report</Btn>
                 </div>
                 <div className="space-y-6">
                    {clients.slice(0, 6).map(c => {
                      const rev = trips.filter(t => t.client === c.id && t.status === "completed").reduce((s, t) => s + (t.revenue || 0), 0);
                      const tCount = trips.filter(t => t.client === c.id).length;
                      const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
                      return (
                        <div key={c.id} className="group">
                          <div className="flex justify-between text-sm mb-2 items-end">
                            <div>
                              <span className="font-black text-gray-800 text-sm group-hover:text-[#1e3a5f] transition-colors">{c.company_name}</span>
                              <span className="text-[10px] font-black text-gray-300 ml-2 uppercase tracking-tighter">{tCount} Trips</span>
                            </div>
                            <span className="font-black text-gray-900">{fmt(rev)}</span>
                          </div>
                          <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden border border-gray-100">
                            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#3a67a0] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                 </div>
               </div>

               {/* RECENT WIDGETS */}
               <div className="space-y-6">
                 <div className="bg-white p-8 rounded-3xl border shadow-sm">
                   <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <Clock className="text-orange-500" size={16} /> Recent Trips
                   </h3>
                   <div className="space-y-4">
                     {trips.slice(0, 4).map(t => (
                       <div key={t.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                         <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><Truck size={14} /></div>
                         <div className="flex-1 min-w-0">
                           <p className="text-xs font-black text-gray-800 truncate">{t.origin} → {t.destination}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{clientMap[t.client]?.company_name}</p>
                         </div>
                         <Badge status={t.status} />
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="bg-[#1e3a5f] p-8 rounded-3xl shadow-xl shadow-[#1e3a5f]/30 text-center relative overflow-hidden group">
                   <div className="absolute -right-8 -top-8 opacity-10 rotate-12 transition-transform group-hover:scale-125 duration-700">
                     <CompanyStamp size={200} />
                   </div>
                   <CompanyStamp size={100} />
                   <h4 className="mt-4 font-black text-white text-xl tracking-tight">CALVARY MASTER</h4>
                   <p className="text-[10px] text-blue-200/60 font-black uppercase tracking-[0.2em] mt-2">Logistics Command Center</p>
                   <div className="mt-6 pt-6 border-t border-white/10 flex justify-center gap-6">
                     <div>
                       <p className="text-[9px] font-black text-blue-300/60 uppercase mb-1">Status</p>
                       <p className="text-xs font-black text-white flex items-center gap-1"><Shield size={10} className="text-green-400" /> Secure</p>
                     </div>
                     <div>
                       <p className="text-[9px] font-black text-blue-300/60 uppercase mb-1">Region</p>
                       <p className="text-xs font-black text-white">East Africa</p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* CLIENTS MODULE */}
         {tab === "clients" && (
           <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/30">
               <div>
                 <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Partner Directory</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{activeClientsCount} Active Partnerships</p>
               </div>
               <Btn onClick={() => setModal({ type: "client" })}><Plus size={16} /> New Client</Btn>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                   <tr>
                     <th className="px-8 py-5">Corporate Entity</th>
                     <th className="px-8 py-5">Key Contact</th>
                     <th className="px-8 py-5">Communication</th>
                     <th className="px-8 py-5 text-center">Engagement</th>
                     <th className="px-8 py-5">Status</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {filteredClients.map(c => {
                     const tCount = trips.filter(t => t.client === c.id).length;
                     const totalSpent = trips.filter(t => t.client === c.id && t.status === "completed").reduce((s, t) => s + (t.revenue || 0), 0);
                     return (
                       <tr key={c.id} className="hover:bg-gray-50/80 transition-colors group">
                         <td className="px-8 py-5">
                           <div className="flex items-center gap-3">
                             <div className="size-10 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-gray-400 group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors">{c.company_name.charAt(0)}</div>
                             <div>
                               <div className="font-black text-gray-800 text-base">{c.company_name}</div>
                               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{c.address}</div>
                             </div>
                           </div>
                         </td>
                         <td className="px-8 py-5 font-bold text-gray-600">{c.contact_person}</td>
                         <td className="px-8 py-5">
                           <div className="text-xs font-black text-[#1e3a5f]">{c.email}</div>
                           <div className="text-[11px] font-bold text-gray-400 mt-0.5">{c.phone}</div>
                         </td>
                         <td className="px-8 py-5 text-center">
                           <div className="inline-flex flex-col items-center px-3 py-1 bg-gray-50 rounded-xl">
                             <span className="text-xs font-black text-gray-800">{tCount} Trips</span>
                             <span className="text-[9px] font-bold text-green-600 uppercase">{fmt(totalSpent)}</span>
                           </div>
                         </td>
                         <td className="px-8 py-5"><Badge status={c.status} /></td>
                         <td className="px-8 py-5 text-right">
                           <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setModal({ type: "client", data: c })} className="p-2.5 text-[#1e3a5f] hover:bg-[#1e3a5f]/10 rounded-xl transition-colors"><Edit size={16} /></button>
                             <button onClick={() => deleteClient(c.id)} className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* TRIPS MODULE */}
         {tab === "trips" && (
           <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/30">
               <div>
                 <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Movement Logs</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{activeTripsCount} Active Shipments</p>
               </div>
               <Btn onClick={() => setModal({ type: "trip" })}><Plus size={16} /> Record Movement</Btn>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                   <tr>
                     <th className="px-8 py-5">Identifier</th>
                     <th className="px-8 py-5">Logistic Path</th>
                     <th className="px-8 py-5">Consignee</th>
                     <th className="px-8 py-5">Cargo Info</th>
                     <th className="px-8 py-5 text-right">Revenue (TZS)</th>
                     <th className="px-8 py-5">Status</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {filteredTrips.map(t => (
                     <tr key={t.id} className="hover:bg-gray-50/80 transition-colors group">
                       <td className="px-8 py-5">
                         <div className="font-black text-gray-900 text-sm">{t.tripNumber}</div>
                         <div className="text-[10px] font-bold text-gray-400 mt-0.5">{new Date(t.date).toLocaleDateString()}</div>
                       </td>
                       <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                           <div className="text-gray-800 font-black text-xs uppercase">{t.origin}</div>
                           <ArrowRight size={14} className="text-gray-300" />
                           <div className="text-gray-800 font-black text-xs uppercase">{t.destination}</div>
                         </div>
                       </td>
                       <td className="px-8 py-5">
                         <div className="font-bold text-gray-700">{clientMap[t.client]?.company_name}</div>
                         <div className="text-[10px] text-gray-400 font-medium">Ref: {t.client}</div>
                       </td>
                       <td className="px-8 py-5">
                         <div className="text-xs font-bold text-gray-800">{t.cargo_type}</div>
                         <div className="text-[10px] text-gray-400 mt-0.5">{t.truck || "N/A"}</div>
                       </td>
                       <td className="px-8 py-5 text-right font-black text-[#1e3a5f]">{Number(t.revenue).toLocaleString()}</td>
                       <td className="px-8 py-5"><Badge status={t.status} /></td>
                       <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setModal({ type: "trip", data: t })} className="p-2.5 text-[#1e3a5f] hover:bg-[#1e3a5f]/10 rounded-xl"><Edit size={16} /></button>
                           <button onClick={() => deleteTrip(t.id)} className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* INVOICES MODULE */}
         {tab === "invoices" && (
           <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/30">
               <div>
                 <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Billing Center</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{unpaid.length} Pending Collections</p>
               </div>
               <Btn onClick={() => setModal({ type: "invoice" })}><Plus size={16} /> New Invoice</Btn>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                   <tr>
                     <th className="px-8 py-5">Invoice #</th>
                     <th className="px-8 py-5">Client Name</th>
                     <th className="px-8 py-5 text-right">Total Amount</th>
                     <th className="px-8 py-5">Issue Date</th>
                     <th className="px-8 py-5">Deadline</th>
                     <th className="px-8 py-5">Status</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {invoices.map(i => (
                     <tr key={i.id} className="hover:bg-gray-50/80 transition-colors group">
                       <td className="px-8 py-5 font-black text-gray-900">{i.invoice_number}</td>
                       <td className="px-8 py-5 font-bold text-gray-600">{clientMap[i.client]?.company_name}</td>
                       <td className="px-8 py-5 text-right font-black text-blue-600">{fmt(i.amount)}</td>
                       <td className="px-8 py-5 text-xs text-gray-400 font-bold">{new Date(i.date).toLocaleDateString()}</td>
                       <td className="px-8 py-5">
                         <div className={`text-xs font-black ${new Date(i.due_date) < new Date() && i.status !== "paid" ? "text-red-500" : "text-gray-800"}`}>
                           {new Date(i.due_date).toLocaleDateString()}
                         </div>
                       </td>
                       <td className="px-8 py-5"><Badge status={i.status} /></td>
                       <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-1">
                           {i.status !== "paid" && (
                             <button onClick={() => markPaid(i.id)} className="p-2.5 text-green-600 hover:bg-green-50 rounded-xl" title="Mark as Paid"><CheckCircle2 size={16} /></button>
                           )}
                           <button onClick={() => setModal({ type: "invoice", data: i })} className="p-2.5 text-[#1e3a5f] hover:bg-[#1e3a5f]/10 rounded-xl"><Edit size={16} /></button>
                           <button onClick={() => deleteInvoice(i.id)} className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* EXPENSES MODULE */}
         {tab === "expenses" && (
           <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                 { label: "Fuel Costs", val: expenses.filter(e => e.category === "Fuel").reduce((s,e) => s + e.amount, 0), icon: Droplet, color: "text-blue-600", bg: "bg-blue-50" },
                 { label: "Driver Allowances", val: expenses.filter(e => e.category === "Allowance").reduce((s,e) => s + e.amount, 0), icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
                 { label: "Fees & Tolls", val: expenses.filter(e => e.category === "Fees").reduce((s,e) => s + e.amount, 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
                 { label: "Maintenance", val: expenses.filter(e => e.category === "Maintenance").reduce((s,e) => s + e.amount, 0), icon: Wrench, color: "text-orange-600", bg: "bg-orange-50" },
               ].map((cat, i) => (
                 <div key={i} className="bg-white p-5 rounded-3xl border shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                     <div className={`p-2 rounded-xl ${cat.bg} ${cat.color}`}><cat.icon size={16} /></div>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{cat.label}</span>
                   </div>
                   <p className="text-lg font-black text-gray-800">{fmt(cat.val)}</p>
                 </div>
               ))}
             </div>

             <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
               <div className="px-8 py-6 border-b flex items-center justify-between bg-gray-50/30">
                 <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Expense Ledger</h3>
                 <Btn onClick={() => setModal({ type: "expense" })}><Plus size={16} /> Log Expense</Btn>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                     <tr>
                       <th className="px-8 py-5">Transaction Details</th>
                       <th className="px-8 py-5">Category</th>
                       <th className="px-8 py-5">Linked Trip</th>
                       <th className="px-8 py-5 text-right">Amount</th>
                       <th className="px-8 py-5">Date</th>
                       <th className="px-8 py-5 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {expenses.map(e => (
                     <tr key={e.id} className="hover:bg-gray-50/80 transition-colors group">
                       <td className="px-8 py-5 font-black text-gray-900">{e.description}</td>
                       <td className="px-8 py-5">
                         <span className="bg-gray-100 px-3 py-1 rounded-full text-[9px] font-black uppercase text-gray-500 tracking-tighter">{e.category}</span>
                       </td>
                       <td className="px-8 py-5">
                         <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-fit">
                           {trips.find(t => t.id === e.trip)?.tripNumber || "General"}
                         </div>
                       </td>
                       <td className="px-8 py-5 text-right font-black text-red-500">{fmt(e.amount)}</td>
                       <td className="px-8 py-5 text-xs text-gray-400 font-bold">{new Date(e.date).toLocaleDateString()}</td>
                       <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setModal({ type: "expense", data: e })} className="p-2.5 text-[#1e3a5f] hover:bg-[#1e3a5f]/10 rounded-xl"><Edit size={16} /></button>
                           <button onClick={() => deleteExpense(e.id)} className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
           </div>
         )}

         {/* CONTRACTS MODULE */}
         {tab === "contracts" && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white p-10 rounded-[2.5rem] border shadow-xl shadow-gray-100/50">
               <div className="flex items-center gap-4 mb-10">
                 <div className="p-4 bg-blue-50 rounded-[1.5rem] text-blue-600 shadow-sm"><FileText size={28} /></div>
                 <div>
                   <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Contract Master</h3>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Generate legal agreements instantly</p>
                 </div>
               </div>
               
               <div className="space-y-6">
                 <Field label="Counterparty (Client)">
                   <Select value={contractState?.client || ""} onChange={(e: any) => setContractState({ ...contractState, client: e.target.value })}>
                     <option value="">Select a corporate client...</option>
                     {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                   </Select>
                 </Field>
                 
                 <Field label="Operational Route Rate">
                   <Select value={contractState?.routeIdx || ""} onChange={(e: any) => setContractState({ ...contractState, routeIdx: e.target.value })}>
                     <option value="">Master Rate Sheet (Annexure A)</option>
                     {RATE_SHEET.map((r, i) => <option key={i} value={i}>{r.from} → {r.destination}</option>)}
                   </Select>
                 </Field>
                 
                 <div className="grid grid-cols-2 gap-6">
                   <Field label="Execution Date">
                     <Input type="date" value={contractState?.contract_date || today()} onChange={(e: any) => setContractState({ ...contractState, contract_date: e.target.value })} />
                   </Field>
                   <Field label="Commencement Date">
                     <Input type="date" value={contractState?.start_date || today()} onChange={(e: any) => setContractState({ ...contractState, start_date: e.target.value })} />
                   </Field>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                   <Field label="Authorized Signatory">
                     <Input placeholder="Full Name" value={contractState?.client_signatory || ""} onChange={(e: any) => setContractState({ ...contractState, client_signatory: e.target.value })} />
                   </Field>
                   <Field label="Official Title">
                     <Input placeholder="e.g. Managing Director" value={contractState?.client_title || ""} onChange={(e: any) => setContractState({ ...contractState, client_title: e.target.value })} />
                   </Field>
                 </div>
                 
                 <div className="pt-6">
                   <Btn onClick={() => setContractState({ ...contractState, showPreview: true })} className="w-full h-14 !text-base" disabled={!contractState?.client}>
                     Generate Legal Instrument
                   </Btn>
                   <p className="text-center text-[10px] text-gray-400 mt-4 font-bold uppercase tracking-widest">By generating, you agree to Calvary standard legal terms</p>
                 </div>
               </div>
             </div>

             <div className="space-y-6">
               <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                 <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                   <DollarSign className="text-green-600" size={18} /> Verified Rate Sheet
                 </h3>
                 <div className="overflow-auto max-h-[440px] rounded-2xl border border-gray-100 no-scrollbar">
                   <table className="w-full text-[11px] text-left">
                     <thead className="bg-gray-50 text-gray-400 uppercase text-[9px] font-black sticky top-0 z-10">
                       <tr>
                         <th className="px-4 py-4">Logistic Path</th>
                         <th className="px-4 py-4 text-right">20ft</th>
                         <th className="px-4 py-4 text-right">40ft</th>
                         <th className="px-4 py-4 text-center">Days</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {RATE_SHEET.map((r, i) => (
                         <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                           <td className="px-4 py-4 font-black text-gray-800">{r.from} <ChevronRight size={10} className="inline mx-1 text-gray-300" /> {r.destination}</td>
                           <td className="px-4 py-4 text-right font-bold text-gray-900">{r.c20.toLocaleString()}</td>
                           <td className="px-4 py-4 text-right font-bold text-gray-900">{r.c40.toLocaleString()}</td>
                           <td className="px-4 py-4 text-center">
                             <span className="bg-gray-100 px-2 py-0.5 rounded-lg font-black text-gray-500">{r.days}d</span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
               
               <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-[2.5rem] border border-blue-100 flex items-center justify-between group cursor-pointer hover:shadow-lg transition-all">
                 <div className="flex items-center gap-5">
                   <div className="size-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><Download size={24} /></div>
                   <div>
                     <h4 className="font-black text-gray-800 tracking-tight">Standard Operating Procedures</h4>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Download logistics guidelines</p>
                   </div>
                 </div>
                 <ArrowRight className="text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
               </div>
             </div>
           </div>
         )}
       </div>

       {/* ── 8. Modals & Previews ── */}

       {/* Contract Preview Modal */}
       {contractState?.showPreview && (
         <ContractPreview 
           client={clients.find(c => c.id === contractState.client)}
           rateRow={contractState.routeIdx !== "" ? RATE_SHEET[contractState.routeIdx] : null}
           details={contractState}
           onClose={() => setContractState({ ...contractState, showPreview: false })}
         />
       )}

       {/* CRUD Modals */}
       {modal?.type === "client" && (
         <Modal title={modal.data ? "Update Client Profile" : "Onboard New Client"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveClient(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Legal Entity Name"><Input name="company_name" defaultValue={modal.data?.company_name} placeholder="e.g. Simba Logistics Ltd" required /></Field>
             <Field label="Primary Contact Person"><Input name="contact_person" defaultValue={modal.data?.contact_person} placeholder="John Doe" required /></Field>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Official Email"><Input name="email" type="email" defaultValue={modal.data?.email} placeholder="contact@company.com" required /></Field>
               <Field label="Phone Line"><Input name="phone" defaultValue={modal.data?.phone} placeholder="+255..." required /></Field>
             </div>
             <Field label="Corporate Address"><Input name="address" defaultValue={modal.data?.address} placeholder="P.O. Box..." /></Field>
             <div className="flex justify-end gap-3 mt-8">
               <Btn variant="secondary" onClick={closeModal} type="button">Discard</Btn>
               <Btn type="submit">Complete Onboarding</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "trip" && (
         <Modal title={modal.data ? "Edit Trip Log" : "Initialize New Trip"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveTrip(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Select Consignee">
               <Select name="client" defaultValue={modal.data?.client} required>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
               </Select>
             </Field>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Origin Point"><Input name="origin" defaultValue={modal.data?.origin} required /></Field>
               <Field label="Final Destination"><Input name="destination" defaultValue={modal.data?.destination} required /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Cargo Description"><Input name="cargo_type" defaultValue={modal.data?.cargo_type} /></Field>
               <Field label="Revenue (TZS)"><Input name="revenue" type="number" defaultValue={modal.data?.revenue} required /></Field>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Assigned Driver"><Input name="driver" defaultValue={modal.data?.driver} /></Field>
               <Field label="Vehicle Plate"><Input name="truck" defaultValue={modal.data?.truck} /></Field>
             </div>
             <div className="flex justify-end gap-3 mt-8">
               <Btn variant="secondary" onClick={closeModal} type="button">Discard</Btn>
               <Btn type="submit">Record Movement</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "invoice" && (
         <Modal title={modal.data ? "Modify Invoice" : "Generate Trip Invoice"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveInvoice(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Select Billed Client">
               <Select name="client" defaultValue={modal.data?.client} required>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
               </Select>
             </Field>
             <Field label="Link to Completed Trip">
               <Select name="trip_id" defaultValue={modal.data?.trip}>
                 <option value="">Stand-alone Invoice (No Trip Link)</option>
                 {trips.filter(t => t.status === "completed").map(t => (
                   <option key={t.id} value={t.id}>{t.tripNumber} - {t.origin} to {t.destination} ({fmt(t.revenue)})</option>
                 ))}
               </Select>
             </Field>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Manual Amount (if no trip)"><Input name="amount" type="number" defaultValue={modal.data?.amount} /></Field>
               <Field label="Maturity Date"><Input name="due_date" type="date" defaultValue={modal.data?.due_date || today()} required /></Field>
             </div>
             <div className="flex justify-end gap-3 mt-8">
               <Btn variant="secondary" onClick={closeModal} type="button">Cancel</Btn>
               <Btn type="submit">Finalize Invoice</Btn>
             </div>
           </form>
         </Modal>
       )}

       {modal?.type === "expense" && (
         <Modal title={modal.data ? "Edit Expense Entry" : "Record Operational Cost"} onClose={closeModal}>
           <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveExpense(Object.fromEntries(d)); }}>
             <input type="hidden" name="id" defaultValue={modal.data?.id} />
             <Field label="Transaction Description"><Input name="description" defaultValue={modal.data?.description} required /></Field>
             <div className="grid grid-cols-2 gap-4">
               <Field label="Ledger Category">
                 <Select name="category" defaultValue={modal.data?.category}>
                   <option value="Fuel">Fuel</option>
                   <option value="Maintenance">Maintenance</option>
                   <option value="Fees">Fees</option>
                   <option value="Allowance">Allowance</option>
                   <option value="Other">Other</option>
                 </Select>
               </Field>
               <Field label="Total Amount (TZS)"><Input name="amount" type="number" defaultValue={modal.data?.amount} required /></Field>
             </div>
             <Field label="Link to Specific Trip">
               <Select name="trip" defaultValue={modal.data?.trip}>
                 <option value="">General Overhead (No Trip Link)</option>
                 {trips.map(t => <option key={t.id} value={t.id}>{t.tripNumber} ({t.origin} → {t.destination})</option>)}
               </Select>
             </Field>
             <div className="flex justify-end gap-3 mt-8">
               <Btn variant="secondary" onClick={closeModal} type="button">Discard</Btn>
               <Btn type="submit">Record Expense</Btn>
             </div>
           </form>
         </Modal>
       )}
     </DashboardLayout>
   ); 
 }

 // ── Custom Icons ───────────────────────────────────────────────────────────────
 const Droplet = ({ size = 24, ...props }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>;
 const Wrench = ({ size = 24, ...props }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
