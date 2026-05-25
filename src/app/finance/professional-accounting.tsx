import { useState, useEffect } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Search, Globe,
  Thermometer, MapPin, X, ChevronDown, Clock, ArrowUpRight,
  ArrowDownLeft, RefreshCw, FileText, Receipt, BarChart3,
  BookOpen, AlertTriangle, CheckCircle2, ChevronRight,
  Wallet, Scale, Landmark, Truck, Pencil, Trash2, Save,
  Loader2, Menu, Bell, Settings, Upload
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SupabaseService } from "@/services/supabase-service";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { BankStatementImport } from "./bank-statement-import";

const fmtTZS = (n) => "TZS " + Math.round(n || 0).toLocaleString();
const fmtUSD = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCur = (n, cur = "TZS") => {
  if (cur === "USD") return fmtUSD(n);
  if (cur === "KES") return "KES " + Math.round(n || 0).toLocaleString();
  if (cur === "ZMW") return "ZMW " + Math.round(n || 0).toLocaleString();
  if (cur === "UGX") return "UGX " + Math.round(n || 0).toLocaleString();
  return fmtTZS(n);
};
const todayStr = () => new Date().toISOString().split("T")[0];
const NOW = new Date();
const RATES = { TZS: 1, USD: 2600, KES: 20, ZMW: 140, UGX: 0.71 };

const VEHICLES  = [];
const BORDERS   = [];
const COA_TYPES = ["Asset","Liability","Equity","Revenue","Expense"];
const CURRENCIES= ["TZS","USD","KES","ZMW","UGX"];
const TABS = [
  { id:"overview", label:"Overview",          icon:BarChart3 },
  { id:"accounts", label:"Accounts",          icon:Landmark },
  { id:"expenses", label:"Expenses",          icon:TrendingDown },
  { id:"revenue",  label:"Revenue",           icon:TrendingUp },
  { id:"invoices", label:"Invoices",          icon:FileText },
  { id:"taxes",    label:"Taxes",             icon:Scale },
  { id:"bank",     label:"Bank Statement",    icon:Wallet },
  { id:"coa",      label:"Chart of Accounts", icon:BookOpen },
  { id:"journal",  label:"Journal Entries",   icon:Receipt },
  { id:"aging",    label:"Aging Report",      icon:Clock },
];

// ── UI primitives ──────────────────────────────────────────────────────────
const Badge = ({ children, color = "slate" }) => {
  const m = { slate:"bg-slate-100 text-slate-600", green:"bg-emerald-50 text-emerald-700 border border-emerald-200", red:"bg-red-50 text-red-700 border border-red-200", amber:"bg-amber-50 text-amber-700 border border-amber-200", blue:"bg-blue-50 text-blue-700 border border-blue-200", purple:"bg-purple-50 text-purple-700 border border-purple-200", cyan:"bg-cyan-50 text-cyan-700 border border-cyan-200", orange:"bg-orange-50 text-orange-700 border border-orange-200" };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${m[color]||m.slate}`}>{children}</span>;
};
const SBadge = ({ status }) => {
  const m = { paid:["green","Paid"], pending:["amber","Pending"], overdue:["red","Overdue"], approved:["green","Approved"] };
  const [c,l] = m[status]||["slate",status];
  return <Badge color={c}>{l}</Badge>;
};
const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide?"max-w-3xl":"max-w-md"} max-h-[92vh] overflow-y-auto`}>
      <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div><h3 className="font-bold text-slate-900 text-base">{title}</h3>{subtitle&&<p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4"/></button>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>
);
const Confirm = ({ msg, detail, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-600"/></div>
        <div><p className="font-bold text-slate-900 text-sm">{msg}</p>{detail&&<p className="text-xs text-slate-500 mt-1">{detail}</p>}</div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700">Cancel</button>
        <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl">Delete</button>
      </div>
    </div>
  </div>
);
const Field = ({ label, children }) => (
  <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>{children}</div>
);
const iCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-800 placeholder-slate-400";
const eCls = "w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/60 text-slate-800";
const Sel = ({ value, onChange, options, placeholder }) => (
  <div className="relative"><select value={value} onChange={e=>onChange(e.target.value)} className={`${iCls} appearance-none pr-8`}>{placeholder&&<option value="">{placeholder}</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"/></div>
);
const SmSel = ({ value, onChange, options }) => (
  <div className="relative"><select value={value} onChange={e=>onChange(e.target.value)} className={`${eCls} appearance-none pr-5`}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none"/></div>
);
const Btn = ({ label, onClick, variant="primary", icon:Icon, sm, full, disabled }) => {
  const v = { primary:"bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm", success:"bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm", danger:"bg-red-600 hover:bg-red-700 text-white", outline:"border border-slate-200 hover:bg-slate-50 text-slate-700" };
  return <button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-2 ${sm?"px-3 py-1.5 text-xs":"px-4 py-2.5 text-sm"} font-semibold rounded-xl transition-all disabled:opacity-40 ${v[variant]||v.primary} ${full?"w-full":""}`}>{Icon&&<Icon className={sm?"w-3 h-3":"w-4 h-4"}/>}{label}</button>;
};
const THead = ({ cols }) => (
  <thead><tr className="bg-slate-50 border-b border-slate-100">{cols.map(c=><th key={c} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>)}</tr></thead>
);
const EmptyRow = ({ cols, msg, icon:Icon=FileText }) => (
  <tr><td colSpan={cols}><div className="flex flex-col items-center py-12 gap-3 text-slate-400"><Icon className="w-10 h-10 opacity-30"/><p className="text-sm">{msg}</p></div></td></tr>
);
const EditActions = ({ isEditing, onEdit, onSave, onCancel, onDelete }) => (
  isEditing ? (
    <div className="flex gap-1">
      <button onClick={onSave} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Save className="w-4 h-4"/></button>
      <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
    </div>
  ) : (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-3.5 h-3.5"/></button>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/></button>
    </div>
  )
);
const accGrad = c => ({ USD:"from-indigo-600 to-blue-700", TZS:"from-emerald-600 to-teal-700", KES:"from-violet-600 to-purple-700", ZMW:"from-orange-600 to-amber-700", UGX:"from-rose-600 to-pink-700" }[c]||"from-slate-600 to-slate-700");
const tcol = { Asset:{bg:"bg-blue-50",border:"border-blue-200",text:"text-blue-700",dot:"#3b82f6",badge:"blue"}, Liability:{bg:"bg-red-50",border:"border-red-200",text:"text-red-700",dot:"#ef4444",badge:"red"}, Equity:{bg:"bg-purple-50",border:"border-purple-200",text:"text-purple-700",dot:"#8b5cf6",badge:"purple"}, Revenue:{bg:"bg-emerald-50",border:"border-emerald-200",text:"text-emerald-700",dot:"#10b981",badge:"green"}, Expense:{bg:"bg-amber-50",border:"border-amber-200",text:"text-amber-700",dot:"#f59e0b",badge:"amber"} };

export default function CalvaryAccounting() {
  const { role, isAdmin } = useRole();
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [revenue, setRevenue]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [taxes, setTaxes]       = useState([]);
  const [coa, setCoa]           = useState([]);
  const [journal, setJournal]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cashHoldings, setCashHoldings] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accs, exps, revs, invs, txs, coas, jrnls] = await Promise.all([
        supabase.from("bank_accounts").select("*, transactions:bank_statements(*)").order("account_name"),
        SupabaseService.getExpenses(),
        SupabaseService.getSales(),
        SupabaseService.getInvoices(),
        SupabaseService.getTaxes(),
        supabase.from("accounts").select("*").order("code"),
        supabase.from("journal_entries").select("*, lines:journal_entry_lines(*)").order("entry_date", { ascending: false })
      ]);

      const accountsData = accs.data?.map(a => ({
        ...a,
        name: a.account_name,
        bank: a.bank_name,
        account_number: a.account_number,
        balance: a.current_balance,
        swift: a.swift_code,
        branch: a.branch_name
      })) || [];

      setAccounts(accountsData);
      setExpenses(exps || []);
      setRevenue(revs?.map(r => ({ ...r, amount: r.total_amount || r.amount })) || []);
      setInvoices(invs || []);
      setTaxes(txs || []);
      setCoa(coas.data || []);
      setJournal(jrnls.data || []);

      // Aggregate cash holdings by native currency
      const holdings: Record<string, number> = {};
      accountsData.forEach(acc => {
        const cur = acc.currency || "TZS";
        holdings[cur] = (holdings[cur] || 0) + (parseFloat(acc.balance) || 0);
      });
      setCashHoldings(holdings);

    } catch (error) {
      console.error("Data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [agingType, setAgingType] = useState("receivable");
  const [search, setSearch]     = useState("");
  const [invFilter, setInvFilter] = useState("all");
  const [coaFilter, setCoaFilter] = useState("All");
  const [selAcc, setSelAcc]     = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !selAcc) {
      setSelAcc(accounts[0].id);
    }
  }, [accounts, selAcc]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [expandedJE, setExpandedJE] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [editId, setEditId]     = useState(null);
  const [editBuf, setEditBuf]   = useState({});
  const [editAccOpen, setEditAccOpen] = useState(false);

  const startEdit = item => { setEditId(item.id || item.code); setEditBuf({ ...item }); };
  const cancelEdit = () => { setEditId(null); setEditBuf({}); };

  // blank forms
  const blankExp = { category:"fuel", vehicle:"", amount:"", description:"", vendor:"", payment_method:"cash", date:todayStr(), is_cross_border:false, border_point:"" };
  const blankRev = { description:"", client:"", amount:"", date:todayStr(), cargo_type:"GENERAL", is_cross_border:false };
  const blankInv = { customer_name:"", amount:"", due_date:todayStr(), invoice_number:`CAL-${Date.now()}`, is_cross_border:false, type:"receivable" };
  const blankTax = { tax_name:"", type:"VAT", amount:"", due_date:todayStr() };
  const blankCoa = { code:"", name:"", type:"Asset", normal:"debit", balance:"" };
  const blankAcc = { name:"", currency:"TZS", account_number:"", bank:"", swift:"", branch:"", balance:"" };
  const blankJe  = { date:todayStr(), reference:"", description:"", lines:[{account_code:"",account_name:"",debit:"",credit:""},{account_code:"",account_name:"",debit:"",credit:""}] };
  const [expF, setExpF] = useState(blankExp);
  const [revF, setRevF] = useState(blankRev);
  const [invF, setInvF] = useState(blankInv);
  const [taxF, setTaxF] = useState(blankTax);
  const [coaF, setCoaF] = useState(blankCoa);
  const [accF, setAccF] = useState(blankAcc);
  const [jeF,  setJeF]  = useState(blankJe);

  // totals
  const totalExp = expenses.reduce((s,e)=>s+e.amount,0);
  const totalRev = revenue.reduce((s,r)=>s+r.amount,0);
  const netProfit = totalRev - totalExp;
  const xbRev = revenue.filter(r=>r.is_cross_border).reduce((s,r)=>s+r.amount,0);
  const xbExp = expenses.filter(e=>e.is_cross_border).reduce((s,e)=>s+e.amount,0);
  const ccRev = revenue.filter(r=>r.cargo_type==="REEFER").reduce((s,r)=>s+r.amount,0);
  const totalCashTZS = accounts.reduce((s,a)=>s+(Number(a.balance)||0)*(RATES[a.currency]||1),0);
  const pendingAR = invoices.filter(i=>i.status!=="paid"&&i.type==="receivable").reduce((s,i)=>s+(Number(i.amount)||0),0);
  const pendingAP = invoices.filter(i=>i.status!=="paid"&&i.type==="payable").reduce((s,i)=>s+(Number(i.amount)||0),0);

  // COA
  const coaGroups = COA_TYPES.map(type=>({ type, rows:coa.filter(a=>a.type===type), total:coa.filter(a=>a.type===type).reduce((s,a)=>s+(Number(a.balance)||0),0) }));
  const totalAssets = coaGroups.find(g=>g.type==="Asset")?.total||0;
  const totalLiab   = coaGroups.find(g=>g.type==="Liability")?.total||0;
  const totalEquity = coaGroups.find(g=>g.type==="Equity")?.total||0;
  const netIncome   = (coaGroups.find(g=>g.type==="Revenue")?.total||0)-(coaGroups.find(g=>g.type==="Expense")?.total||0);
  // Group accounts by their group field within each type
  const getSubGroups = (type) => {
    const rows = coa.filter(a=>a.type===type);
    const groups = {};
    rows.forEach(a=>{ const g=a.group||type; if(!groups[g])groups[g]=[]; groups[g].push(a); });
    return Object.entries(groups).map(([name,accounts])=>({ name, accounts, total:accounts.reduce((s,a)=>s+(Number(a.balance)||0),0) }));
  };
  const SECTION_LABELS = { Asset:"1000 ASSETS", Liability:"2000 LIABILITIES", Equity:"3000 EQUITY", Revenue:"4000 REVENUE", Expense:"5000–7000 EXPENSES & COMPLIANCE" };

  // journal
  const jeDr = jeF.lines.reduce((s,l)=>s+(parseFloat(l.debit)||0),0);
  const jeCr = jeF.lines.reduce((s,l)=>s+(parseFloat(l.credit)||0),0);
  const jeOk = Math.abs(jeDr-jeCr)<0.01&&jeDr>0;
  const updateJeLine=(i,f,v)=>{ const l=[...jeF.lines]; l[i]={...l[i],[f]:v}; if(f==="account_code"){const a=coa.find(c=>c.code===v);if(a)l[i].account_name=a.name;} setJeF({...jeF,lines:l}); };
  const addJeLine=()=>setJeF({...jeF,lines:[...jeF.lines,{account_code:"",account_name:"",debit:"",credit:""}]});
  const remJeLine=i=>{ if(jeF.lines.length<=2)return; const l=[...jeF.lines]; l.splice(i,1); setJeF({...jeF,lines:l}); };

  // bank statement
  const activeAcc = accounts.find(a=>a.id===selAcc);
  const txSorted  = [...(activeAcc?.transactions||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const cTotal = txSorted.reduce((s,t)=>t.type==="credit"?s+t.amount:s,0);
  const dTotal = txSorted.reduce((s,t)=>t.type==="debit"?s+t.amount:s,0);
  const openBal = (activeAcc?.balance||0)-cTotal+dTotal;
  let rb = openBal;
  const stmtRows = txSorted.map(t=>{ if(t.type==="credit")rb+=t.amount; else rb-=t.amount; return{...t,runBal:rb}; }).reverse();
  const filtStmt = stmtRows.filter(t=>(!bankSearch||t.description.toLowerCase().includes(bankSearch.toLowerCase())||(t.ref||"").toLowerCase().includes(bankSearch.toLowerCase()))&&(bankFilter==="all"||t.type===bankFilter));

  // aging
  const agItems = invoices.filter(i=>i.type===agingType&&i.status!=="paid").map(inv=>{ const days=Math.floor((NOW-new Date(inv.due_date))/86400000); const bucket=days<=0?"Current":days<=30?"1–30 days":days<=60?"31–60 days":days<=90?"61–90 days":"90+ days"; return{...inv,daysOverdue:days,bucket}; });
  const agBuckets=["Current","1–30 days","31–60 days","61–90 days","90+ days"];
  const agTotals=agBuckets.map(b=>({bucket:b,total:agItems.filter(i=>i.bucket===b).reduce((s,i)=>s+i.amount,0),count:agItems.filter(i=>i.bucket===b).length}));
  const agGrand=agTotals.reduce((s,b)=>s+b.total,0);
  const bStyle={"Current":{badge:"green",bar:"bg-emerald-400",text:"text-emerald-700"},"1–30 days":{badge:"amber",bar:"bg-amber-400",text:"text-amber-700"},"31–60 days":{badge:"orange",bar:"bg-orange-400",text:"text-orange-700"},"61–90 days":{badge:"red",bar:"bg-red-400",text:"text-red-700"},"90+ days":{badge:"red",bar:"bg-red-600",text:"text-red-800"}};

  const getLinked = inv => {
    if(inv.type==="receivable"&&inv.linked_revenue) return revenue.find(r=>r.id===inv.linked_revenue);
    if(inv.type==="payable"&&inv.linked_expense)   return expenses.find(e=>e.id===inv.linked_expense);
    return null;
  };
  const catBreakdown = ["fuel","border","maintenance","allowance","customs","toll"].map(cat=>({ cat, total:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0) })).filter(c=>c.total>0);

  // CRUD
  const addExpense = async () => {
    if(!expF.amount||!expF.description) return;
    setLoading(true);
    try {
      const ne = await SupabaseService.createExpense({ ...expF, amount: parseFloat(expF.amount), status: "pending" });
      await SupabaseService.createInvoice({
        invoice_number: `BILL-${Date.now()}`,
        customer_name: expF.vendor || "Vendor",
        amount: parseFloat(expF.amount),
        due_date: expF.date,
        status: "pending",
        is_cross_border: expF.is_cross_border,
        type: "payable",
        linked_expense: ne.id
      });
      await fetchData();
      setModal(null); setExpF(blankExp);
    } catch (error) {
      console.error("Error adding expense:", error);
    } finally {
      setLoading(false);
    }
  };
  const addRevenue = async () => {
    if(!revF.amount||!revF.description) return;
    setLoading(true);
    try {
      const nr = await SupabaseService.createSale({ ...revF, total_amount: parseFloat(revF.amount), status: "pending" });
      await SupabaseService.createInvoice({
        invoice_number: `CAL-${Date.now()}`,
        customer_name: revF.client || "Client",
        amount: parseFloat(revF.amount),
        due_date: revF.date,
        status: "pending",
        is_cross_border: revF.is_cross_border,
        type: "receivable",
        linked_revenue: nr.id
      });
      await fetchData();
      setModal(null); setRevF(blankRev);
    } catch (error) {
      console.error("Error adding revenue:", error);
    } finally {
      setLoading(false);
    }
  };
  const addInvoice = async () => {
    if(!invF.customer_name||!invF.amount) return;
    setLoading(true);
    try {
      await SupabaseService.createInvoice({ ...invF, amount: parseFloat(invF.amount), status: "pending" });
      await fetchData();
      setModal(null); setInvF(blankInv);
    } catch (error) {
      console.error("Error adding invoice:", error);
    } finally {
      setLoading(false);
    }
  };
  const addTax = async () => {
    if(!taxF.tax_name||!taxF.amount) return;
    setLoading(true);
    try {
      await SupabaseService.createTax({ ...taxF, amount: parseFloat(taxF.amount), status: "pending" });
      await fetchData();
      setModal(null); setTaxF(blankTax);
    } catch (error) {
      console.error("Error adding tax:", error);
    } finally {
      setLoading(false);
    }
  };
  const addCOA = async () => {
    if(!coaF.code||!coaF.name) {
      toast({ title: "Validation Error", description: "Account code and name are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("accounts").insert({
        code: coaF.code,
        name: coaF.name,
        type: coaF.type,
        balance: parseFloat(coaF.balance) || 0,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      
      toast({ title: "Account Added", description: `${coaF.name} has been added to Chart of Accounts.` });
      await fetchData();
      setModal(null); setCoaF(blankCoa);
    } catch (error) {
      console.error("Error adding COA:", error);
      toast({ title: "Error", description: error.message || "Failed to add account to Chart of Accounts.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  const addAccount = async () => {
    if(!accF.name||!accF.account_number) {
      toast({ title: "Validation Error", description: "Account name and number are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({
        account_name: accF.name,
        currency: accF.currency,
        account_number: accF.account_number,
        bank_name: accF.bank,
        swift_code: accF.swift,
        branch_name: accF.branch,
        current_balance: parseFloat(accF.balance) || 0,
        is_active: true
      });

      if (error) throw error;

      toast({ title: "Bank Account Added", description: `${accF.name} has been successfully registered.` });
      await fetchData();
      setModal(null); setAccF(blankAcc);
    } catch (error) {
      console.error("Error adding account:", error);
      toast({ title: "Error", description: error.message || "Failed to add bank account. Please check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  const postJE = async () => {
    if(!jeOk||!jeF.description) return;
    setLoading(true);
    try {
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: jeF.date,
          description: jeF.description,
          reference_number: jeF.reference || `JE-${Date.now()}`
        })
        .select()
        .single();
      
      if (jeErr) throw jeErr;

      const lines = jeF.lines
        .filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map(l => ({
          journal_entry_id: je.id,
          account_code: l.account_code,
          account_name: l.account_name,
          debit_amount: parseFloat(l.debit) || 0,
          credit_amount: parseFloat(l.credit) || 0
        }));

      const { error: lineErr } = await supabase.from("journal_entry_lines").insert(lines);
      if (lineErr) throw lineErr;

      // Update account balances based on JE lines
      const balancePromises = lines.map(async line => {
        const { data: acc } = await supabase.from("accounts").select("balance, type").eq("code", line.account_code).single();
        if (acc) {
          let newBalance = Number(acc.balance || 0);
          // Normal debit accounts (Assets, Expenses) increase with debit, decrease with credit
          // Normal credit accounts (Liabilities, Equity, Revenue) increase with credit, decrease with debit
          const isDebitNormal = acc.type === "Asset" || acc.type === "Expense";
          if (isDebitNormal) {
            newBalance += (line.debit_amount - line.credit_amount);
          } else {
            newBalance += (line.credit_amount - line.debit_amount);
          }
          return supabase.from("accounts").update({ balance: newBalance }).eq("code", line.account_code);
        }
      });
      await Promise.all(balancePromises);

      await fetchData();
      setModal(null); setJeF(blankJe);
    } catch (error) {
      console.error("Error posting JE:", error);
    } finally {
      setLoading(false);
    }
  };
  const markPaid = async id => {
    if (!selAcc) {
      toast({ title: "Account Required", description: "Please select a bank account to process the payment.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await SupabaseService.markInvoicePaid(id, selAcc);
      await fetchData();
      setSelectedInvoice(p => p ? { ...p, status: "paid" } : null);
      toast({ title: "Payment Recorded", description: "Invoice marked as paid and bank balance updated." });
    } catch (error) {
      console.error("Error marking paid:", error);
      toast({ title: "Error", description: "Failed to process payment. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  const del = async (setter, id, table) => {
    setLoading(true);
    try {
      const realTable = table === "chart_of_accounts" ? "accounts" : table;
      await supabase.from(realTable).delete().eq(realTable === "accounts" ? "code" : "id", id);
      await fetchData();
      setConfirm(null);
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setLoading(false);
    }
  };
  const delAccount = async id => {
    setLoading(true);
    try {
      await supabase.from("bank_accounts").delete().eq("id", id);
      await fetchData();
      if(selAcc===id && accounts.length > 0) setSelAcc(accounts[0].id);
      setConfirm(null);
    } catch (error) {
      console.error("Error deleting account:", error);
    } finally {
      setLoading(false);
    }
  };
  const delInvWithLinked = async inv => {
    setLoading(true);
    try {
      await SupabaseService.deleteInvoice(inv.id);
      await fetchData();
      setConfirm(null); setSelectedInvoice(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  // save edits
  const saveExp = async () => {
    setLoading(true);
    try {
      await SupabaseService.updateExpense(editId, { ...editBuf, amount: parseFloat(editBuf.amount) || 0 });
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving expense:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveRev = async () => {
    setLoading(true);
    try {
      await SupabaseService.updateSale(editId, { ...editBuf, total_amount: parseFloat(editBuf.amount) || 0 });
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving revenue:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveInv = async () => {
    setLoading(true);
    try {
      await SupabaseService.updateInvoice(editId, { ...editBuf, amount: parseFloat(editBuf.amount) || 0 });
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving invoice:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveTax = async () => {
    setLoading(true);
    try {
      await SupabaseService.updateTax(editId, { ...editBuf, amount: parseFloat(editBuf.amount) || 0 });
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving tax:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveCOARow = async () => {
    setLoading(true);
    try {
      await supabase.from("accounts").update({
        name: editBuf.name,
        type: editBuf.type,
        balance: parseFloat(editBuf.balance) || 0,
        updated_at: new Date().toISOString()
      }).eq("code", editId);
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving COA:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveJEHeader = async () => {
    setLoading(true);
    try {
      await supabase.from("journal_entries").update({ description: editBuf.description, date: editBuf.date, reference: editBuf.reference }).eq("id", editId);
      await fetchData();
      cancelEdit();
    } catch (error) {
      console.error("Error saving JE header:", error);
    } finally {
      setLoading(false);
    }
  };
  const saveAccount = async () => {
    setLoading(true);
    try {
      await supabase.from("bank_accounts").update({
        account_name: editBuf.name,
        currency: editBuf.currency,
        account_number: editBuf.account_number,
        bank_name: editBuf.bank,
        swift_code: editBuf.swift,
        branch_name: editBuf.branch,
        current_balance: parseFloat(editBuf.balance) || 0
      }).eq("id", editId);
      await fetchData();
      cancelEdit(); setEditAccOpen(false);
    } catch (error) {
      console.error("Error saving account:", error);
    } finally {
      setLoading(false);
    }
  };
  const openEditAcc = acc => { startEdit(acc); setEditAccOpen(true); };

  const filtExp = expenses.filter(e=>[e.description,e.vendor,e.category].some(s=>s?.toLowerCase().includes(search.toLowerCase())));
  const filtRev = revenue.filter(r=>[r.description,r.client].some(s=>s?.toLowerCase().includes(search.toLowerCase())));
  const filtInv = invoices.filter(i=>{
    const ms=!search||[i.invoice_number,i.customer_name].some(s=>s?.toLowerCase().includes(search.toLowerCase()));
    const mf=invFilter==="all"||i.type===invFilter||(invFilter==="overdue"&&new Date(i.due_date)<NOW&&i.status!=="paid");
    return ms&&mf;
  });

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* ── SIDEBAR ── */}
      <Sidebar role={role || "ADMIN"} />

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 md:ml-64 min-w-0">
        {confirm && <Confirm {...confirm} onCancel={()=>setConfirm(null)}/>}

        {loading && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin"/>
              <p className="text-sm font-bold text-slate-600">Synchronizing Ledger Data...</p>
            </div>
          </div>
        )}

        {/* ... existing modals ... */}

      {/* EXPENSE MODAL */}
      {modal==="expense" && (
        <Modal title="Record Expense" subtitle="Auto-creates a vendor invoice" onClose={()=>setModal(null)}>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 font-medium flex items-center gap-2"><FileText className="w-3.5 h-3.5 flex-shrink-0"/>A payable invoice will be created automatically.</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Sel value={expF.category} onChange={v=>setExpF({...expF,category:v})} options={[{value:"fuel",label:"Fuel (5101)"},{value:"driver_salaries",label:"Driver Salaries (5102)"},{value:"allowance",label:"Driver Allowances (5103)"},{value:"truck_repairs",label:"Truck Repairs (5104)"},{value:"tires",label:"Tire Expense (5105)"},{value:"lubricants",label:"Lubricants & Oil (5106)"},{value:"border",label:"Border & Port Charges (5107)"},{value:"cargo_handling",label:"Cargo Handling (5108)"},{value:"toll",label:"Toll Fees (5109)"},{value:"insurance",label:"Vehicle Insurance (5110)"},{value:"gps",label:"GPS Tracking (5111)"},{value:"trip_loading",label:"Trip Loading (5112)"},{value:"subcontractor",label:"Freight Subcontractor (5113)"},{value:"office_rent",label:"Office Rent (6101)"},{value:"office_salaries",label:"Office Salaries (6201)"},{value:"bank_charges",label:"Bank Charges (6501)"},{value:"loan_interest",label:"Loan Interest (6502)"},{value:"other",label:"Other"}]}/></Field>
            <Field label="Vehicle"><Sel value={expF.vehicle} onChange={v=>setExpF({...expF,vehicle:v})} placeholder="Select vehicle" options={VEHICLES.map(v=>({value:v,label:v}))}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (TZS)"><input type="number" className={iCls} value={expF.amount} onChange={e=>setExpF({...expF,amount:e.target.value})} placeholder="0"/></Field>
            <Field label="Vendor"><input type="text" className={iCls} value={expF.vendor} onChange={e=>setExpF({...expF,vendor:e.target.value})} placeholder="e.g. Oryx Fuel"/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment Method"><Sel value={expF.payment_method} onChange={v=>setExpF({...expF,payment_method:v})} options={[{value:"cash",label:"Cash"},{value:"mobile_money",label:"Mobile Money"},{value:"bank_transfer",label:"Bank Transfer"},{value:"fuel_card",label:"Fuel Card"}]}/></Field>
            <Field label="Date"><input type="date" className={iCls} value={expF.date} onChange={e=>setExpF({...expF,date:e.target.value})}/></Field>
          </div>
          <Field label="Description"><textarea className={`${iCls} resize-none`} rows={2} value={expF.description} onChange={e=>setExpF({...expF,description:e.target.value})} placeholder="Details…"/></Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="rounded" checked={expF.is_cross_border} onChange={e=>setExpF({...expF,is_cross_border:e.target.checked})}/>Cross-Border Expense</label>
          {expF.is_cross_border&&<Field label="Border Point"><Sel value={expF.border_point} onChange={v=>setExpF({...expF,border_point:v})} placeholder="Select" options={BORDERS.map(b=>({value:b.split(" ")[0],label:b}))}/></Field>}
          <Btn label="Record Expense + Create Invoice" onClick={addExpense} full/>
        </Modal>
      )}

      {/* REVENUE MODAL */}
      {modal==="revenue" && (
        <Modal title="Record Trip Revenue" subtitle="Auto-creates a client invoice" onClose={()=>setModal(null)}>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2"><FileText className="w-3.5 h-3.5 flex-shrink-0"/>A receivable invoice will be created automatically.</div>
          <Field label="Route / Description"><input type="text" className={iCls} value={revF.description} onChange={e=>setRevF({...revF,description:e.target.value})} placeholder="e.g. DSM → Lusaka"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (TZS)"><input type="number" className={iCls} value={revF.amount} onChange={e=>setRevF({...revF,amount:e.target.value})} placeholder="0"/></Field>
            <Field label="Date"><input type="date" className={iCls} value={revF.date} onChange={e=>setRevF({...revF,date:e.target.value})}/></Field>
          </div>
          <Field label="Client"><input type="text" className={iCls} value={revF.client} onChange={e=>setRevF({...revF,client:e.target.value})} placeholder="Client name"/></Field>
          <Field label="Cargo Type"><Sel value={revF.cargo_type} onChange={v=>setRevF({...revF,cargo_type:v})} options={[{value:"GENERAL",label:"General Cargo"},{value:"REEFER",label:"Cold Chain (Reefer)"},{value:"LOWBED",label:"Heavy Equipment (Lowbed)"}]}/></Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="rounded" checked={revF.is_cross_border} onChange={e=>setRevF({...revF,is_cross_border:e.target.checked})}/>Cross-Border Trip</label>
          <Btn label="Record Revenue + Create Invoice" onClick={addRevenue} variant="success" full/>
        </Modal>
      )}

      {/* INVOICE MODAL */}
      {modal==="invoice" && (
        <Modal title="New Invoice" onClose={()=>setModal(null)}>
          <Field label="Invoice Number"><input className={`${iCls} bg-slate-50 text-slate-400`} value={invF.invoice_number} readOnly/></Field>
          <Field label="Customer / Vendor"><input type="text" className={iCls} value={invF.customer_name} onChange={e=>setInvF({...invF,customer_name:e.target.value})} placeholder="Name"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (TZS)"><input type="number" className={iCls} value={invF.amount} onChange={e=>setInvF({...invF,amount:e.target.value})} placeholder="0"/></Field>
            <Field label="Due Date"><input type="date" className={iCls} value={invF.due_date} onChange={e=>setInvF({...invF,due_date:e.target.value})}/></Field>
          </div>
          <Field label="Type"><Sel value={invF.type} onChange={v=>setInvF({...invF,type:v})} options={[{value:"receivable",label:"Accounts Receivable (Customer owes us)"},{value:"payable",label:"Accounts Payable (We owe vendor)"}]}/></Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="rounded" checked={invF.is_cross_border} onChange={e=>setInvF({...invF,is_cross_border:e.target.checked})}/>Cross-Border</label>
          <Btn label="Create Invoice" onClick={addInvoice} full/>
        </Modal>
      )}

      {/* TAX MODAL */}
      {modal==="tax" && (
        <Modal title="Record Tax Obligation" onClose={()=>setModal(null)}>
          <Field label="Tax Name"><input type="text" className={iCls} value={taxF.tax_name} onChange={e=>setTaxF({...taxF,tax_name:e.target.value})} placeholder="e.g. Q2 VAT Payment"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Sel value={taxF.type} onChange={v=>setTaxF({...taxF,type:v})} options={["VAT","PAYE","Income","Road","Import","Excise"].map(v=>({value:v,label:v}))}/></Field>
            <Field label="Amount (TZS)"><input type="number" className={iCls} value={taxF.amount} onChange={e=>setTaxF({...taxF,amount:e.target.value})} placeholder="0"/></Field>
          </div>
          <Field label="Due Date"><input type="date" className={iCls} value={taxF.due_date} onChange={e=>setTaxF({...taxF,due_date:e.target.value})}/></Field>
          <Btn label="Record Tax" onClick={addTax} full/>
        </Modal>
      )}

      {/* COA MODAL */}
      {modal==="coa" && (
        <Modal title="Add GL Account" onClose={()=>setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><input type="text" className={iCls} value={coaF.code} onChange={e=>setCoaF({...coaF,code:e.target.value})} placeholder="e.g. 1500"/></Field>
            <Field label="Type"><Sel value={coaF.type} onChange={v=>setCoaF({...coaF,type:v,normal:v==="Asset"||v==="Expense"?"debit":"credit"})} options={COA_TYPES.map(t=>({value:t,label:t}))}/></Field>
          </div>
          <Field label="Account Name"><input type="text" className={iCls} value={coaF.name} onChange={e=>setCoaF({...coaF,name:e.target.value})} placeholder="Account name"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Normal Balance"><Sel value={coaF.normal} onChange={v=>setCoaF({...coaF,normal:v})} options={[{value:"debit",label:"Debit"},{value:"credit",label:"Credit"}]}/></Field>
            <Field label="Opening Balance"><input type="number" className={iCls} value={coaF.balance} onChange={e=>setCoaF({...coaF,balance:e.target.value})} placeholder="0"/></Field>
          </div>
          <Btn label="Add Account" onClick={addCOA} full/>
        </Modal>
      )}

      {/* ADD BANK ACCOUNT MODAL */}
      {modal==="addAccount" && (
        <Modal title="Add Bank Account" subtitle="Supports TZS · USD · KES · ZMW · UGX" onClose={()=>setModal(null)}>
          <Field label="Account Name"><input type="text" className={iCls} value={accF.name} onChange={e=>setAccF({...accF,name:e.target.value})} placeholder="e.g. CRDB – KES Account"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency"><Sel value={accF.currency} onChange={v=>setAccF({...accF,currency:v})} options={CURRENCIES.map(c=>({value:c,label:c}))}/></Field>
            <Field label="Opening Balance"><input type="number" className={iCls} value={accF.balance} onChange={e=>setAccF({...accF,balance:e.target.value})} placeholder="0"/></Field>
          </div>
          <Field label="Account Number"><input type="text" className={iCls} value={accF.account_number} onChange={e=>setAccF({...accF,account_number:e.target.value})} placeholder="e.g. 0123-456-7890"/></Field>
          <Field label="Bank Name"><input type="text" className={iCls} value={accF.bank} onChange={e=>setAccF({...accF,bank:e.target.value})} placeholder="e.g. CRDB Bank Tanzania"/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SWIFT Code"><input type="text" className={iCls} value={accF.swift} onChange={e=>setAccF({...accF,swift:e.target.value})} placeholder="e.g. CRBDTZTZ"/></Field>
            <Field label="Branch"><input type="text" className={iCls} value={accF.branch} onChange={e=>setAccF({...accF,branch:e.target.value})} placeholder="Branch name"/></Field>
          </div>
          <Btn label="Create Account" onClick={addAccount} full disabled={!accF.name||!accF.account_number}/>
        </Modal>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editAccOpen && (
        <Modal title="Edit Account" onClose={()=>{setEditAccOpen(false);cancelEdit();}}>
          <Field label="Account Name"><input type="text" className={iCls} value={editBuf.name||""} onChange={e=>setEditBuf({...editBuf,name:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency"><Sel value={editBuf.currency||"TZS"} onChange={v=>setEditBuf({...editBuf,currency:v})} options={CURRENCIES.map(c=>({value:c,label:c}))}/></Field>
            <Field label="Balance"><input type="number" className={iCls} value={editBuf.balance||""} onChange={e=>setEditBuf({...editBuf,balance:e.target.value})}/></Field>
          </div>
          <Field label="Account Number"><input type="text" className={iCls} value={editBuf.account_number||""} onChange={e=>setEditBuf({...editBuf,account_number:e.target.value})}/></Field>
          <Field label="Bank Name"><input type="text" className={iCls} value={editBuf.bank||""} onChange={e=>setEditBuf({...editBuf,bank:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SWIFT"><input type="text" className={iCls} value={editBuf.swift||""} onChange={e=>setEditBuf({...editBuf,swift:e.target.value})}/></Field>
            <Field label="Branch"><input type="text" className={iCls} value={editBuf.branch||""} onChange={e=>setEditBuf({...editBuf,branch:e.target.value})}/></Field>
          </div>
          <div className="flex gap-2">
            <Btn label="Cancel" onClick={()=>{setEditAccOpen(false);cancelEdit();}} variant="outline" full/>
            <Btn label="Save Changes" onClick={saveAccount} variant="success" full/>
          </div>
        </Modal>
      )}

      {/* JOURNAL MODAL */}
      {modal==="journal" && (
        <Modal title="New Journal Entry" onClose={()=>setModal(null)} wide>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date"><input type="date" className={iCls} value={jeF.date} onChange={e=>setJeF({...jeF,date:e.target.value})}/></Field>
            <Field label="Reference"><input type="text" className={iCls} value={jeF.reference} onChange={e=>setJeF({...jeF,reference:e.target.value})} placeholder="Auto"/></Field>
            <div/>
          </div>
          <Field label="Narration"><input type="text" className={iCls} value={jeF.description} onChange={e=>setJeF({...jeF,description:e.target.value})} placeholder="Describe this transaction…"/></Field>
          <div>
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 uppercase mb-2 px-1"><div className="col-span-3">Code</div><div className="col-span-4">Account</div><div className="col-span-2">Dr</div><div className="col-span-2">Cr</div><div className="col-span-1"/></div>
            {jeF.lines.map((ln,i)=>(
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <div className="col-span-3"><select value={ln.account_code} onChange={e=>updateJeLine(i,"account_code",e.target.value)} className={`${iCls} appearance-none text-xs`}><option value="">Select…</option>{coa.map(a=><option key={a.code} value={a.code}>{a.code} – {a.name}</option>)}</select></div>
                <div className="col-span-4"><input className={`${iCls} bg-slate-50 text-slate-400 text-xs`} value={ln.account_name} readOnly placeholder="Auto-filled"/></div>
                <div className="col-span-2"><input type="number" className={`${iCls} text-xs`} value={ln.debit} onChange={e=>updateJeLine(i,"debit",e.target.value)} placeholder="0"/></div>
                <div className="col-span-2"><input type="number" className={`${iCls} text-xs`} value={ln.credit} onChange={e=>updateJeLine(i,"credit",e.target.value)} placeholder="0"/></div>
                <div className="col-span-1 flex justify-center"><button onClick={()=>remJeLine(i)} className="text-slate-300 hover:text-red-400 p-1"><X className="w-3.5 h-3.5"/></button></div>
              </div>
            ))}
            <button onClick={addJeLine} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-1 mt-1"><Plus className="w-3 h-3"/>Add line</button>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border text-sm">
            <div className="flex gap-6"><span>Dr: <strong>{fmtTZS(jeDr)}</strong></span><span>Cr: <strong>{fmtTZS(jeCr)}</strong></span></div>
            {jeOk?<Badge color="green"><CheckCircle2 className="w-3 h-3"/>Balanced</Badge>:<Badge color="red"><AlertTriangle className="w-3 h-3"/>Not balanced</Badge>}
          </div>
          <Btn label="Post Journal Entry" onClick={postJE} variant={jeOk?"primary":"outline"} full/>
        </Modal>
      )}

      {/* INVOICE DETAIL DRAWER */}
      {selectedInvoice&&(()=>{
        const inv=selectedInvoice;
        const isOverdue=new Date(inv.due_date)<NOW&&inv.status!=="paid";
        const linked=getLinked(inv);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div><h3 className="font-bold text-slate-900">{inv.invoice_number}</h3><p className="text-xs text-slate-500">{inv.type==="receivable"?"Accounts Receivable":"Accounts Payable"}</p></div>
                <button onClick={()=>setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-5 space-y-5 flex-1">
                <div className={`rounded-2xl p-5 text-white bg-gradient-to-r ${inv.type==="receivable"?"from-emerald-600 to-teal-700":"from-rose-600 to-red-700"}`}>
                  <p className="text-white/60 text-xs mb-1">{inv.customer_name}</p>
                  <p className="text-3xl font-bold">{fmtTZS(inv.amount)}</p>
                  <div className="flex items-center justify-between mt-3"><p className="text-white/70 text-xs">Due {inv.due_date}</p><SBadge status={isOverdue?"overdue":inv.status}/></div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  {[["Invoice #",inv.invoice_number],["Type",inv.type==="receivable"?"Customer Invoice (AR)":"Vendor Bill (AP)"],["Status",<SBadge status={isOverdue?"overdue":inv.status}/>],["Cross-Border",inv.is_cross_border?<Badge color="purple"><Globe className="w-3 h-3"/>Yes</Badge>:"No"],["Days",isOverdue?`${Math.floor((NOW-new Date(inv.due_date))/86400000)}d overdue`:`${Math.floor((new Date(inv.due_date)-NOW)/86400000)}d remaining`]].map(([k,v])=>(
                    <div key={k} className="flex items-center justify-between"><span className="text-sm text-slate-500">{k}</span><span className="text-sm font-semibold text-slate-800">{v}</span></div>
                  ))}
                </div>
                {linked&&(
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Linked {inv.type==="receivable"?"Trip Revenue":"Expense"}</p>
                    <p className="text-sm font-semibold text-slate-800">{linked.description}</p>
                    <div className="flex gap-2 flex-wrap">{inv.type==="receivable"?<Badge color="slate">{linked.cargo_type}</Badge>:<Badge color="amber">{linked.category}</Badge>}{linked.is_cross_border&&<Badge color="purple"><Globe className="w-3 h-3"/>Cross-Border</Badge>}<SBadge status={linked.status}/></div>
                    <p className="text-xs text-slate-500">{linked.date} · {inv.type==="receivable"?linked.client:linked.vendor}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {inv.status!=="paid"&&<Btn label={`Mark as ${inv.type==="receivable"?"Received":"Paid"}`} onClick={()=>markPaid(inv.id)} variant="success" full icon={CheckCircle2}/>}
                  <Btn label="Delete Invoice" onClick={()=>setConfirm({msg:`Delete ${inv.invoice_number}?`,detail:"This will also remove any linked expense or revenue record.",onConfirm:()=>delInvWithLinked(inv)})} variant="danger" full icon={Trash2}/>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAGE SHELL */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 space-y-5">

        {showImport && (
          <div className="fixed inset-0 z-[110] bg-white overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold">Bank Statement Import & Reconciliation</h2>
              <button 
                onClick={() => { setShowImport(false); fetchData(); }}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <BankStatementImport />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center"><Truck className="w-5 h-5 text-white"/></div>
              Calvary Accounting
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 ml-11">East Africa Logistics · Full Ledger Suite</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <RefreshCw className="w-3.5 h-3.5"/> {NOW.toDateString()}
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${tab===t.id?"bg-indigo-600 text-white shadow-sm":"text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
              <t.icon className="w-4 h-4"/>{t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[{label:"Total Revenue",value:fmtTZS(totalRev),sub:`${revenue.length} trips`,grad:"from-emerald-500 to-teal-600",icon:TrendingUp},{label:"Total Expenses",value:fmtTZS(totalExp),sub:`${expenses.length} entries`,grad:"from-rose-500 to-red-600",icon:TrendingDown},{label:"Net Profit",value:fmtTZS(netProfit),sub:`${totalRev>0?((netProfit/totalRev)*100).toFixed(1):0}% margin`,grad:netProfit>=0?"from-indigo-500 to-blue-600":"from-red-600 to-rose-700",icon:DollarSign}].map(s=>(
                <div key={s.label} className={`bg-gradient-to-br ${s.grad} rounded-2xl p-5 text-white`}>
                  <div className="flex items-center justify-between mb-3"><p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{s.label}</p><s.icon className="w-5 h-5 text-white/30"/></div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-white/60 text-xs mt-1">{s.sub}</p>
                </div>
              ))}
              
              {/* Multi-Currency Cash Holdings Card */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Total Cash</p>
                  <Wallet className="w-5 h-5 text-white/30"/>
                </div>
                <div className="space-y-1.5 max-h-[80px] overflow-y-auto scrollbar-hide">
                  {Object.entries(cashHoldings).length > 0 ? (
                    Object.entries(cashHoldings).map(([cur, amount]) => (
                      <div key={cur} className="flex justify-between items-baseline border-b border-white/10 last:border-0 pb-0.5">
                        <span className="text-xs font-bold text-white/60">{cur}</span>
                        <span className="text-sm font-bold">{fmtCur(amount, cur)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-lg font-bold">TZS 0</p>
                  )}
                </div>
                <p className="text-white/60 text-[10px] mt-2 border-t border-white/10 pt-1">
                  Combined ≈ {fmtTZS(totalCashTZS)}
                </p>
              </div>
            </div>

            {/* Both accounts side by side */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-base">Bank Accounts</h3>
                <Btn label="Add Account" onClick={()=>setModal("addAccount")} icon={Plus} sm/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc=>{
                  const cr=acc.transactions.filter(t=>t.type==="credit").reduce((s,t)=>s+t.amount,0);
                  const db=acc.transactions.filter(t=>t.type==="debit").reduce((s,t)=>s+t.amount,0);
                  return (
                    <div key={acc.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className={`bg-gradient-to-br ${accGrad(acc.currency)} p-5 text-white`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <p className="text-white/60 text-xs truncate">{acc.bank||"Bank"}</p>
                            <p className="font-bold truncate">{acc.name}</p>
                            <p className="font-mono text-xs text-white/50 mt-0.5 truncate">{acc.account_number}</p>
                          </div>
                          <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">{acc.currency}</span>
                        </div>
                        <p className="text-3xl font-bold">{fmtCur(acc.balance,acc.currency)}</p>
                        {acc.currency!=="TZS"&&<p className="text-white/40 text-xs mt-0.5">≈ {fmtTZS(acc.balance*(RATES[acc.currency]||1))}</p>}
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-50 rounded-xl p-2.5 text-center"><p className="text-xs text-emerald-600 mb-0.5">Credits In</p><p className="font-bold text-emerald-700 text-xs">{fmtCur(cr,acc.currency)}</p></div>
                          <div className="bg-rose-50 rounded-xl p-2.5 text-center"><p className="text-xs text-rose-600 mb-0.5">Debits Out</p><p className="font-bold text-rose-700 text-xs">{fmtCur(db,acc.currency)}</p></div>
                        </div>
                        <div className="space-y-1">
                          {acc.transactions.slice(0,2).map(t=>(
                            <div key={t.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                              <div className="flex items-center gap-1.5 min-w-0">{t.type==="credit"?<ArrowUpRight className="w-3 h-3 text-emerald-500 flex-shrink-0"/>:<ArrowDownLeft className="w-3 h-3 text-rose-500 flex-shrink-0"/>}<span className="text-xs text-slate-600 truncate">{t.description}</span></div>
                              <span className={`text-xs font-semibold flex-shrink-0 ml-1 ${t.type==="credit"?"text-emerald-600":"text-rose-600"}`}>{t.type==="credit"?"+":"−"}{fmtCur(t.amount,acc.currency)}</span>
                            </div>
                          ))}
                          {acc.transactions.length===0&&<p className="text-xs text-slate-400 text-center py-1">No transactions yet</p>}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <button onClick={()=>{setSelAcc(acc.id);setTab("bank");}} className="flex-1 text-xs font-semibold py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-1"><FileText className="w-3 h-3"/>Statement</button>
                          <button onClick={() => setShowImport(true)} className="flex-1 text-xs font-semibold py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-1"><Upload className="w-3 h-3"/>Import</button>
                          <button onClick={()=>openEditAcc(acc)} className="flex-1 text-xs font-semibold py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1"><Pencil className="w-3 h-3"/>Edit</button>
                          <button onClick={()=>setConfirm({msg:`Delete "${acc.name}"?`,detail:"All transactions will be removed.",onConfirm:()=>delAccount(acc.id)})} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={()=>setModal("addAccount")} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all group min-h-[220px]">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors"><Plus className="w-6 h-6"/></div>
                  <div className="text-center"><p className="font-semibold text-sm">Add Bank Account</p><p className="text-xs mt-0.5 opacity-70">USD · TZS · KES · ZMW · UGX</p></div>
                </button>
              </div>
            </div>

            {/* AR / AP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{label:"Accounts Receivable",value:pendingAR,type:"receivable",icon:ArrowUpRight,color:"emerald"},{label:"Accounts Payable",value:pendingAP,type:"payable",icon:ArrowDownLeft,color:"rose"}].map(s=>(
                <div key={s.label} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                  <p className="font-bold text-slate-800 flex items-center gap-2"><s.icon className={`w-4 h-4 text-${s.color}-600`}/>{s.label}</p>
                  <p className={`text-3xl font-bold text-${s.color}-700`}>{fmtTZS(s.value)}</p>
                  <p className="text-xs text-slate-500">{invoices.filter(i=>i.type===s.type&&i.status!=="paid").length} pending</p>
                  {invoices.filter(i=>i.type===s.type&&i.status!=="paid").slice(0,3).map(inv=>(
                    <div key={inv.id} className="flex justify-between text-sm cursor-pointer hover:opacity-80" onClick={()=>setSelectedInvoice(inv)}>
                      <span className="text-slate-600 truncate">{inv.customer_name}</span>
                      <span className={`font-semibold text-${s.color}-700 ml-2`}>{fmtTZS(inv.amount)}</span>
                    </div>
                  ))}
                  <button onClick={()=>{setInvFilter(s.type);setTab("invoices");}} className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1">View all <ChevronRight className="w-3 h-3"/></button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600"/>Revenue by Type</p>
                {[{label:"Cross-Border",value:xbRev,icon:Globe,c:"text-purple-600 bg-purple-50"},{label:"Local Tanzania",value:totalRev-xbRev,icon:MapPin,c:"text-blue-600 bg-blue-50"},{label:"Cold Chain",value:ccRev,icon:Thermometer,c:"text-cyan-600 bg-cyan-50"}].map(row=>(
                  <div key={row.label} className={`flex items-center justify-between p-3 rounded-xl mb-2 ${row.c.split(" ")[1]}`}>
                    <div className="flex items-center gap-2.5"><row.icon className={`w-4 h-4 ${row.c.split(" ")[0]}`}/><span className="text-sm font-semibold text-slate-700">{row.label}</span></div>
                    <span className={`font-bold text-sm ${row.c.split(" ")[0]}`}>{fmtTZS(row.value)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-600"/>Expense Categories</p>
                {catBreakdown.sort((a,b)=>b.total-a.total).map(c=>{
                  const pct=totalExp>0?(c.total/totalExp)*100:0;
                  return (<div key={c.cat} className="space-y-1 mb-2"><div className="flex justify-between text-sm"><span className="text-slate-600 capitalize font-medium">{c.cat==="border"?"Border Fees":c.cat}</span><span className="font-semibold text-slate-800">{fmtTZS(c.total)}</span></div><div className="w-full bg-slate-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-gradient-to-r from-rose-400 to-rose-600" style={{width:`${pct}%`}}/></div></div>);
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ACCOUNTS TAB ── */}
        {tab==="accounts"&&(
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Bank Accounts</h2><p className="text-sm text-slate-500">Create, edit or delete any account · hover cards for actions</p></div>
              <Btn label="Add Account" onClick={()=>setModal("addAccount")} icon={Plus}/>
            </div>
            
            {/* Multi-Currency Cash Position Banner */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-white/70 text-sm mb-1 uppercase tracking-wider font-semibold">Total Cash Position (TZS equivalent)</p>
                  <p className="text-5xl font-extrabold">{fmtTZS(totalCashTZS)}</p>
                  <p className="text-white/60 text-xs mt-3">{accounts.length} account{accounts.length!==1?"s":""} · USD={RATES.USD.toLocaleString()}, KES={RATES.KES}, ZMW={RATES.ZMW}, UGX={RATES.UGX}</p>
                </div>
                
                <div className="flex-1 max-w-md bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] font-bold text-white/50 uppercase mb-2">Native Currency Breakdown</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(cashHoldings).map(([cur, amount]) => (
                      <div key={cur} className="flex justify-between items-baseline border-b border-white/10 pb-1">
                        <span className="text-xs font-bold text-white/70">{cur}</span>
                        <span className="text-sm font-bold">{fmtCur(amount, cur)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {accounts.map(acc=>{
                const cr=acc.transactions.filter(t=>t.type==="credit").reduce((s,t)=>s+t.amount,0);
                const db=acc.transactions.filter(t=>t.type==="debit").reduce((s,t)=>s+t.amount,0);
                return (
                  <div key={acc.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden group">
                    <div className={`bg-gradient-to-br ${accGrad(acc.currency)} p-5 text-white relative`}>
                      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openEditAcc(acc)} className="bg-white/20 hover:bg-white/35 p-1.5 rounded-lg transition-colors" title="Edit account"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>setConfirm({msg:`Delete "${acc.name}"?`,detail:"All transactions will be removed.",onConfirm:()=>delAccount(acc.id)})} className="bg-white/20 hover:bg-red-400/60 p-1.5 rounded-lg transition-colors" title="Delete account"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <p className="text-white/60 text-xs">{acc.bank||"Bank"}{acc.swift?` · SWIFT: ${acc.swift}`:""}</p>
                      <p className="font-bold text-lg mt-0.5">{acc.name}</p>
                      <p className="font-mono text-xs text-white/50">{acc.account_number}</p>
                      <p className="text-3xl font-bold mt-3">{fmtCur(acc.balance,acc.currency)}</p>
                      {acc.currency!=="TZS"&&<p className="text-white/40 text-xs mt-0.5">≈ {fmtTZS(acc.balance*(RATES[acc.currency]||1))}</p>}
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-xs text-emerald-600 mb-0.5">Credits In</p><p className="font-bold text-emerald-700 text-sm">{fmtCur(cr,acc.currency)}</p></div>
                        <div className="bg-rose-50 rounded-xl p-3 text-center"><p className="text-xs text-rose-600 mb-0.5">Debits Out</p><p className="font-bold text-rose-700 text-sm">{fmtCur(db,acc.currency)}</p></div>
                      </div>
                      <div className="space-y-1.5">
                        {acc.transactions.slice(0,3).map(t=>(
                          <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">{t.type==="credit"?<ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"/>:<ArrowDownLeft className="w-3.5 h-3.5 text-rose-500 flex-shrink-0"/>}<span className="text-xs text-slate-700 truncate">{t.description}</span></div>
                            <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${t.type==="credit"?"text-emerald-600":"text-rose-600"}`}>{t.type==="credit"?"+":"−"}{fmtCur(t.amount,acc.currency)}</span>
                          </div>
                        ))}
                        {acc.transactions.length===0&&<p className="text-xs text-slate-400 text-center py-3">No transactions yet</p>}
                      </div>
                      <button onClick={()=>{setSelAcc(acc.id);setTab("bank");}} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">View full statement <ChevronRight className="w-3 h-3"/></button>
                    </div>
                  </div>
                );
              })}
              <button onClick={()=>setModal("addAccount")} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all group min-h-[200px]">
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors"><Plus className="w-6 h-6"/></div>
                <div className="text-center"><p className="font-semibold">Add Bank Account</p><p className="text-xs mt-1 opacity-70">USD · TZS · KES · ZMW · UGX</p></div>
              </button>
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab==="expenses"&&(
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Expense Management</h2><p className="text-sm text-slate-500">Hover a row → <Pencil className="w-3 h-3 inline"/> edit inline · <Trash2 className="w-3 h-3 inline"/> delete</p></div>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/><input className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <Btn label="Add Expense" onClick={()=>setModal("expense")} icon={Plus}/>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Total</p><p className="text-xl font-bold text-rose-600">{fmtTZS(totalExp)}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Pending Approval</p><p className="text-xl font-bold text-amber-600">{expenses.filter(e=>e.status==="pending").length}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Cross-Border Costs</p><p className="text-xl font-bold text-purple-600">{fmtTZS(xbExp)}</p></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <THead cols={["Date","Category","Description","Vendor","Amount","Invoice","Status",""]}/>
                  <tbody className="divide-y divide-slate-50">
                    {filtExp.length===0?<EmptyRow cols={8} msg="No expenses found"/>:filtExp.map(e=>{
                      const li=invoices.find(i=>i.linked_expense===e.id);
                      const ed=editId===e.id;
                      return (
                        <tr key={e.id} className={`group transition-colors ${ed?"bg-indigo-50/60":"hover:bg-slate-50/70"}`}>
                          <td className="px-4 py-2.5">{ed?<input type="date" className={eCls} value={editBuf.date||""} onChange={v=>setEditBuf({...editBuf,date:v.target.value})}/>:<span className="text-xs text-slate-500 whitespace-nowrap">{e.date}</span>}</td>
                          <td className="px-4 py-2.5">{ed?<input className={eCls} value={editBuf.category||""} onChange={v=>setEditBuf({...editBuf,category:v.target.value})}/>:<Badge color="amber">{e.category}</Badge>}</td>
                          <td className="px-4 py-2.5 max-w-[160px]">{ed?<input className={eCls} value={editBuf.description||""} onChange={v=>setEditBuf({...editBuf,description:v.target.value})}/>:<span className="text-slate-700 truncate block">{e.description}</span>}</td>
                          <td className="px-4 py-2.5">{ed?<input className={eCls} value={editBuf.vendor||""} onChange={v=>setEditBuf({...editBuf,vendor:v.target.value})}/>:<span className="text-xs text-slate-500">{e.vendor||"—"}</span>}</td>
                          <td className="px-4 py-2.5">{ed?<input type="number" className={eCls} value={editBuf.amount||""} onChange={v=>setEditBuf({...editBuf,amount:v.target.value})}/>:<span className="font-semibold text-rose-600 whitespace-nowrap">{fmtTZS(e.amount)}</span>}</td>
                          <td className="px-4 py-2.5">{li?<button onClick={()=>setSelectedInvoice(li)} className="text-xs text-indigo-600 font-semibold underline">{li.invoice_number}</button>:<span className="text-slate-300 text-xs">—</span>}</td>
                          <td className="px-4 py-2.5">{ed?<SmSel value={editBuf.status||"pending"} onChange={v=>setEditBuf({...editBuf,status:v})} options={[{value:"pending",label:"Pending"},{value:"approved",label:"Approved"}]}/>:<SBadge status={e.status}/>}</td>
                          <td className="px-4 py-2.5"><EditActions isEditing={ed} onEdit={()=>startEdit(e)} onSave={saveExp} onCancel={cancelEdit} onDelete={()=>setConfirm({msg:"Delete this expense?",detail:"The linked vendor invoice remains unless deleted separately.",onConfirm:()=>del(setExpenses,e.id)})}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="bg-slate-50 border-t-2 border-slate-200 font-bold"><td colSpan={4} className="px-4 py-3 text-slate-600 text-sm">Total</td><td className="px-4 py-3 text-rose-600">{fmtTZS(totalExp)}</td><td colSpan={3}/></tr></tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE ── */}
        {tab==="revenue"&&(
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Trip Revenue</h2><p className="text-sm text-slate-500">Hover a row to edit or delete inline</p></div>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/><input className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <Btn label="Record Revenue" onClick={()=>setModal("revenue")} variant="success" icon={Plus}/>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Total</p><p className="text-xl font-bold text-emerald-600">{fmtTZS(totalRev)}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Cross-Border</p><p className="text-xl font-bold text-purple-600">{fmtTZS(xbRev)}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Cold Chain</p><p className="text-xl font-bold text-cyan-600">{fmtTZS(ccRev)}</p></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <THead cols={["Date","Route","Client","Cargo","Amount","Invoice","Status",""]}/>
                  <tbody className="divide-y divide-slate-50">
                    {filtRev.length===0?<EmptyRow cols={8} msg="No revenue records" icon={TrendingUp}/>:filtRev.map(r=>{
                      const li=invoices.find(i=>i.linked_revenue===r.id);
                      const ed=editId===r.id;
                      return (
                        <tr key={r.id} className={`group transition-colors ${ed?"bg-indigo-50/60":"hover:bg-slate-50/70"}`}>
                          <td className="px-4 py-2.5">{ed?<input type="date" className={eCls} value={editBuf.date||""} onChange={v=>setEditBuf({...editBuf,date:v.target.value})}/>:<span className="text-xs text-slate-500 whitespace-nowrap">{r.date}</span>}</td>
                          <td className="px-4 py-2.5 max-w-[160px]">{ed?<input className={eCls} value={editBuf.description||""} onChange={v=>setEditBuf({...editBuf,description:v.target.value})}/>:<span className="text-slate-700 font-medium truncate block">{r.description}</span>}</td>
                          <td className="px-4 py-2.5">{ed?<input className={eCls} value={editBuf.client||""} onChange={v=>setEditBuf({...editBuf,client:v.target.value})}/>:<span className="text-slate-600">{r.client}</span>}</td>
                          <td className="px-4 py-2.5">{r.cargo_type==="REEFER"?<Badge color="cyan"><Thermometer className="w-3 h-3"/>Cold</Badge>:r.cargo_type==="LOWBED"?<Badge color="amber">Heavy</Badge>:<Badge color="slate">General</Badge>}</td>
                          <td className="px-4 py-2.5">{ed?<input type="number" className={eCls} value={editBuf.amount||""} onChange={v=>setEditBuf({...editBuf,amount:v.target.value})}/>:<span className="font-semibold text-emerald-600 whitespace-nowrap">{fmtTZS(r.amount)}</span>}</td>
                          <td className="px-4 py-2.5">{li?<button onClick={()=>setSelectedInvoice(li)} className="text-xs text-indigo-600 font-semibold underline">{li.invoice_number}</button>:<span className="text-slate-300 text-xs">—</span>}</td>
                          <td className="px-4 py-2.5">{ed?<SmSel value={editBuf.status||"pending"} onChange={v=>setEditBuf({...editBuf,status:v})} options={[{value:"pending",label:"Pending"},{value:"paid",label:"Paid"}]}/>:<SBadge status={r.status}/>}</td>
                          <td className="px-4 py-2.5"><EditActions isEditing={ed} onEdit={()=>startEdit(r)} onSave={saveRev} onCancel={cancelEdit} onDelete={()=>setConfirm({msg:"Delete this revenue record?",detail:"The linked client invoice remains unless deleted separately.",onConfirm:()=>del(setRevenue,r.id)})}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="bg-slate-50 border-t-2 border-slate-200 font-bold"><td colSpan={4} className="px-4 py-3 text-slate-600 text-sm">Total</td><td className="px-4 py-3 text-emerald-600">{fmtTZS(totalRev)}</td><td colSpan={3}/></tr></tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab==="invoices"&&(
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Invoices</h2><p className="text-sm text-slate-500">Click row to view · hover to edit · open drawer to mark paid or delete</p></div>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/><input className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <Btn label="New Invoice" onClick={()=>setModal("invoice")} icon={Plus}/>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[["all","All"],["receivable","Receivable (AR)"],["payable","Payable (AP)"],["overdue","Overdue"]].map(([v,l])=>(
                <button key={v} onClick={()=>setInvFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${invFilter===v?"bg-indigo-600 text-white":"bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{label:"Total AR",value:fmtTZS(invoices.filter(i=>i.type==="receivable"&&i.status!=="paid").reduce((s,i)=>s+i.amount,0)),color:"text-emerald-600",bg:"bg-emerald-50 border-emerald-100"},{label:"Total AP",value:fmtTZS(invoices.filter(i=>i.type==="payable"&&i.status!=="paid").reduce((s,i)=>s+i.amount,0)),color:"text-rose-600",bg:"bg-rose-50 border-rose-100"},{label:"Overdue",value:invoices.filter(i=>i.status!=="paid"&&new Date(i.due_date)<NOW).length+" invoices",color:"text-red-700",bg:"bg-red-50 border-red-100"},{label:"Paid",value:invoices.filter(i=>i.status==="paid").length+" invoices",color:"text-slate-700",bg:"bg-slate-50 border-slate-100"}].map(s=>(
                <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}><p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p><p className={`text-lg font-bold ${s.color}`}>{s.value}</p></div>
              ))}
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <THead cols={["Invoice #","Party","Type","Amount","Due Date","Days","Status",""]}/>
                  <tbody className="divide-y divide-slate-50">
                    {filtInv.length===0?<EmptyRow cols={8} msg="No invoices" icon={FileText}/>:filtInv.map(inv=>{
                      const isOverdue=new Date(inv.due_date)<NOW&&inv.status!=="paid";
                      const days=Math.floor((NOW-new Date(inv.due_date))/86400000);
                      const ed=editId===inv.id;
                      return (
                        <tr key={inv.id} className={`group transition-colors ${ed?"bg-indigo-50/60":"hover:bg-indigo-50/30 cursor-pointer"}`} onClick={!ed?()=>setSelectedInvoice(inv):undefined}>
                          <td className="px-4 py-2.5 font-mono text-xs font-bold text-indigo-600">{inv.invoice_number}</td>
                          <td className="px-4 py-2.5">{ed?<input className={eCls} value={editBuf.customer_name||""} onChange={v=>setEditBuf({...editBuf,customer_name:v.target.value})}/>:<span className="text-slate-700 font-medium">{inv.customer_name}</span>}</td>
                          <td className="px-4 py-2.5"><Badge color={inv.type==="receivable"?"green":"red"}>{inv.type==="receivable"?"AR":"AP"}</Badge></td>
                          <td className="px-4 py-2.5">{ed?<input type="number" className={eCls} value={editBuf.amount||""} onChange={v=>setEditBuf({...editBuf,amount:v.target.value})}/>:<span className={`font-bold ${inv.type==="receivable"?"text-emerald-600":"text-rose-600"}`}>{fmtTZS(inv.amount)}</span>}</td>
                          <td className="px-4 py-2.5">{ed?<input type="date" className={eCls} value={editBuf.due_date||""} onChange={v=>setEditBuf({...editBuf,due_date:v.target.value})}/>:<span className="text-xs text-slate-500 whitespace-nowrap">{inv.due_date}</span>}</td>
                          <td className={`px-4 py-2.5 text-xs font-semibold ${isOverdue?"text-red-600":"text-slate-400"}`}>{inv.status==="paid"?"—":isOverdue?`${days}d over`:`${Math.abs(days)}d left`}</td>
                          <td className="px-4 py-2.5">{ed?<SmSel value={editBuf.status||"pending"} onChange={v=>setEditBuf({...editBuf,status:v})} options={[{value:"pending",label:"Pending"},{value:"paid",label:"Paid"}]}/>:<SBadge status={isOverdue?"overdue":inv.status}/>}</td>
                          <td className="px-4 py-2.5" onClick={e=>e.stopPropagation()}><EditActions isEditing={ed} onEdit={()=>startEdit(inv)} onSave={saveInv} onCancel={cancelEdit} onDelete={()=>setConfirm({msg:`Delete ${inv.invoice_number}?`,onConfirm:()=>del(setInvoices,inv.id)})}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAXES ── */}
        {tab==="taxes"&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Tax Obligations</h2><Btn label="Record Tax" onClick={()=>setModal("tax")} icon={Plus}/></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Pending</p><p className="text-xl font-bold text-amber-600">{fmtTZS(taxes.filter(t=>t.status==="pending").reduce((s,t)=>s+t.amount,0))}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Paid</p><p className="text-xl font-bold text-emerald-600">{fmtTZS(taxes.filter(t=>t.status==="paid").reduce((s,t)=>s+t.amount,0))}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Overdue Items</p><p className="text-xl font-bold text-red-600">{taxes.filter(t=>t.status==="pending"&&new Date(t.due_date)<NOW).length}</p></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <THead cols={["Tax Name","Type","Amount","Due Date","Status",""]}/>
                <tbody className="divide-y divide-slate-50">
                  {taxes.length===0?<EmptyRow cols={6} msg="No tax records"/>:taxes.map(t=>{
                    const overdue=new Date(t.due_date)<NOW&&t.status==="pending";
                    const ed=editId===t.id;
                    return (
                      <tr key={t.id} className={`group transition-colors ${ed?"bg-indigo-50/60":"hover:bg-slate-50/70"}`}>
                        <td className="px-4 py-2.5">{ed?<input className={eCls} value={editBuf.tax_name||""} onChange={v=>setEditBuf({...editBuf,tax_name:v.target.value})}/>:<span className="font-semibold text-slate-800">{t.tax_name}</span>}</td>
                        <td className="px-4 py-2.5"><Badge color="blue">{t.type}</Badge></td>
                        <td className="px-4 py-2.5">{ed?<input type="number" className={eCls} value={editBuf.amount||""} onChange={v=>setEditBuf({...editBuf,amount:v.target.value})}/>:<span className="font-semibold text-slate-800">{fmtTZS(t.amount)}</span>}</td>
                        <td className="px-4 py-2.5">{ed?<input type="date" className={eCls} value={editBuf.due_date||""} onChange={v=>setEditBuf({...editBuf,due_date:v.target.value})}/>:<span className={`text-sm ${overdue?"text-red-600 font-semibold":"text-slate-500"}`}>{t.due_date}{overdue&&<span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Overdue</span>}</span>}</td>
                        <td className="px-4 py-2.5">{ed?<SmSel value={editBuf.status||"pending"} onChange={v=>setEditBuf({...editBuf,status:v})} options={[{value:"pending",label:"Pending"},{value:"paid",label:"Paid"}]}/>:<SBadge status={t.status}/>}</td>
                        <td className="px-4 py-2.5"><EditActions isEditing={ed} onEdit={()=>startEdit(t)} onSave={saveTax} onCancel={cancelEdit} onDelete={()=>setConfirm({msg:`Delete tax "${t.tax_name}"?`,onConfirm:()=>del(setTaxes,t.id)})}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BANK STATEMENT ── */}
        {tab==="bank"&&(
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex gap-2 flex-wrap">
                {accounts.map(a=>(
                  <button key={a.id} onClick={()=>setSelAcc(a.id)} className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selAcc===a.id?"bg-indigo-600 text-white":"border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {a.currency} <span className="opacity-60 text-xs hidden sm:inline">– {a.name.split("–")[1]?.trim()||a.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/><input className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white" placeholder="Search…" value={bankSearch} onChange={e=>setBankSearch(e.target.value)}/></div>
                <select value={bankFilter} onChange={e=>setBankFilter(e.target.value)} className="border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none"><option value="all">All</option><option value="credit">Credits</option><option value="debit">Debits</option></select>
              </div>
            </div>
            <div className={`rounded-2xl p-5 text-white bg-gradient-to-r ${accGrad(activeAcc?.currency)}`}>
              <div className="flex flex-wrap gap-6 items-center">
                <div><p className="text-white/50 text-xs">Account</p><p className="font-semibold">{activeAcc?.name}</p></div>
                <div><p className="text-white/50 text-xs">Number</p><p className="font-mono text-sm">{activeAcc?.account_number}</p></div>
                {activeAcc?.swift&&<div><p className="text-white/50 text-xs">SWIFT</p><p className="font-mono text-sm">{activeAcc?.swift}</p></div>}
                <div className="ml-auto text-right"><p className="text-white/50 text-xs">Closing Balance</p><p className="text-3xl font-bold">{fmtCur(activeAcc?.balance,activeAcc?.currency)}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Opening Balance</p><p className="font-bold text-slate-800 text-lg">{fmtCur(openBal,activeAcc?.currency)}</p></div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><p className="text-xs text-emerald-600 mb-1">Total Credits</p><p className="font-bold text-emerald-700 text-lg">{fmtCur(cTotal,activeAcc?.currency)}</p></div>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4"><p className="text-xs text-rose-600 mb-1">Total Debits</p><p className="font-bold text-rose-700 text-lg">{fmtCur(dTotal,activeAcc?.currency)}</p></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <THead cols={["Date","Ref","Description","Category","Debit","Credit","Balance"]}/>
                  <tbody className="divide-y divide-slate-50">
                    {filtStmt.length===0?<EmptyRow cols={7} msg="No transactions match"/>:filtStmt.map(t=>(
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{t.date}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{t.ref||"—"}</td>
                        <td className="px-4 py-3 text-slate-700">{t.description}</td>
                        <td className="px-4 py-3"><Badge>{t.category||"Other"}</Badge></td>
                        <td className="px-4 py-3 text-rose-600 font-medium whitespace-nowrap">{t.type==="debit"?fmtCur(t.amount,activeAcc?.currency):"—"}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium whitespace-nowrap">{t.type==="credit"?fmtCur(t.amount,activeAcc?.currency):"—"}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{fmtCur(t.runBal,activeAcc?.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-slate-50 border-t-2 border-slate-200 font-bold"><td colSpan={4} className="px-4 py-3 text-slate-600 text-sm">Closing Balance</td><td className="px-4 py-3 text-rose-600">{fmtCur(dTotal,activeAcc?.currency)}</td><td className="px-4 py-3 text-emerald-600">{fmtCur(cTotal,activeAcc?.currency)}</td><td className="px-4 py-3 text-slate-900">{fmtCur(activeAcc?.balance,activeAcc?.currency)}</td></tr></tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CHART OF ACCOUNTS ── */}
        {tab==="coa"&&(
          <div className="space-y-5">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Chart of Accounts</h2><Btn label="Add Account" onClick={()=>setModal("coa")} icon={Plus}/></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[{label:"Assets",value:totalAssets,c:"text-blue-700",bg:"bg-blue-50 border-blue-100"},{label:"Liabilities",value:totalLiab,c:"text-red-700",bg:"bg-red-50 border-red-100"},{label:"Equity",value:totalEquity,c:"text-purple-700",bg:"bg-purple-50 border-purple-100"},{label:"Net Income",value:netIncome,c:netIncome>=0?"text-emerald-700":"text-red-700",bg:"bg-emerald-50 border-emerald-100"}].map(s=>(
                <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}><p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p><p className={`text-xl font-bold ${s.c}`}>{fmtTZS(Math.abs(s.value))}</p></div>
              ))}
            </div>
            <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${Math.abs(totalAssets-totalLiab-totalEquity-netIncome)<1000?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-slate-500"/><span className="text-sm font-semibold text-slate-700">Assets = Liabilities + Equity + Net Income</span></div>
              <Badge color={Math.abs(totalAssets-totalLiab-totalEquity-netIncome)<1000?"green":"red"}>{Math.abs(totalAssets-totalLiab-totalEquity-netIncome)<1000?"✓ Balanced":"⚠ Check"}</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">{["All",...COA_TYPES].map(t=><button key={t} onClick={()=>setCoaFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${coaFilter===t?"bg-indigo-600 text-white":"bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{t}</button>)}</div>
            {coaGroups.filter(g=>coaFilter==="All"||g.type===coaFilter).map(g=>{
              const tc=tcol[g.type];
              const subGroups=getSubGroups(g.type);
              return (
                <div key={g.type} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                  {/* Section header */}
                  <div className={`flex items-center justify-between px-5 py-3.5 ${tc.bg} ${tc.border} border-b`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor:tc.dot}}/>
                      <span className={`font-bold text-sm ${tc.text}`}>{SECTION_LABELS[g.type]||g.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold bg-white/60 ${tc.text}`}>{g.rows.length} accounts</span>
                    </div>
                    <span className={`font-bold text-sm ${tc.text}`}>{fmtTZS(Math.abs(g.total))}</span>
                  </div>
                  {/* Sub-groups */}
                  {subGroups.map(sg=>(
                    <div key={sg.name}>
                      <div className="flex items-center justify-between px-5 py-2 bg-slate-50/80 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{sg.name}</span>
                        <span className="text-xs font-semibold text-slate-500">{fmtTZS(Math.abs(sg.total))}</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {sg.accounts.map(a=>{
                            const ed=editId===a.code;
                            return (
                              <tr key={a.code} className={`group transition-colors ${ed?"bg-indigo-50/60":"hover:bg-slate-50/60"}`}>
                                <td className="px-5 py-2.5 font-mono text-xs text-slate-400 font-bold w-16">{a.code}</td>
                                <td className="px-3 py-2.5">{ed?<input className={eCls} value={editBuf.name||""} onChange={v=>setEditBuf({...editBuf,name:v.target.value})}/>:<span className="text-slate-700 text-sm">{a.name}</span>}</td>
                                <td className="px-3 py-2.5 w-20"><Badge color={a.normal==="debit"?"blue":"purple"}>{a.normal}</Badge></td>
                                <td className="px-3 py-2.5 text-right w-36">{ed?<input type="number" className={`${eCls} text-right`} value={editBuf.balance||""} onChange={v=>setEditBuf({...editBuf,balance:v.target.value})}/>:<span className={`font-semibold text-sm ${a.balance<0?"text-rose-600":"text-slate-800"}`}>{fmtTZS(a.balance)}</span>}</td>
                                <td className="px-3 py-2.5 w-20"><EditActions isEditing={ed} onEdit={()=>{setEditId(a.code);setEditBuf({...a});}} onSave={saveCOARow} onCancel={cancelEdit} onDelete={()=>setConfirm({msg:`Delete ${a.code} – ${a.name}?`,onConfirm:()=>{setCoa(p=>p.filter(x=>x.code!==a.code));setConfirm(null);}})}/></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {/* Section footer */}
                  <div className={`flex items-center justify-between px-5 py-2.5 border-t-2 border-slate-200 ${tc.bg}`}>
                    <span className={`text-xs font-bold ${tc.text}`}>TOTAL {(SECTION_LABELS[g.type]||g.type).toUpperCase()}</span>
                    <span className={`font-bold text-sm ${tc.text}`}>{fmtTZS(Math.abs(g.total))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── JOURNAL ENTRIES ── */}
        {tab==="journal"&&(
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">General Journal</h2><p className="text-sm text-slate-500">Edit the header with <Pencil className="w-3 h-3 inline"/> · delete a mistaken entry with <Trash2 className="w-3 h-3 inline"/> then re-post a corrected one</p></div>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/><input className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 bg-white" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <Btn label="New Entry" onClick={()=>setModal("journal")} icon={Plus}/>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Entries</p><p className="text-2xl font-bold text-slate-800">{journal.length}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Total Debits</p><p className="text-2xl font-bold text-rose-600">{fmtTZS(journal.reduce((s,je)=>s+je.lines.reduce((ss,l)=>ss+l.debit,0),0))}</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500 mb-1">Total Credits</p><p className="text-2xl font-bold text-emerald-600">{fmtTZS(journal.reduce((s,je)=>s+je.lines.reduce((ss,l)=>ss+l.credit,0),0))}</p></div>
            </div>
            <div className="space-y-2">
              {journal.filter(je=>!search||je.description.toLowerCase().includes(search.toLowerCase())||je.reference.toLowerCase().includes(search.toLowerCase())).map(je=>{
                const totalDr=je.lines.reduce((s,l)=>s+l.debit,0);
                const isOpen=expandedJE===je.id;
                const ed=editId===je.id;
                return (
                  <div key={je.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 gap-3">
                      <button onClick={()=>setExpandedJE(isOpen?null:je.id)} className="flex items-center gap-4 flex-1 text-left hover:opacity-80 transition-opacity">
                        <div className="text-center min-w-[64px]">
                          {ed?<input className={`${eCls} text-center w-16`} value={editBuf.reference||""} onChange={v=>setEditBuf({...editBuf,reference:v.target.value})}/>:<p className="text-xs font-mono font-bold text-indigo-600">{je.reference}</p>}
                          {ed?<input type="date" className={`${eCls} mt-1`} value={editBuf.date||""} onChange={v=>setEditBuf({...editBuf,date:v.target.value})}/>:<p className="text-xs text-slate-400">{je.date}</p>}
                        </div>
                        <div className="w-px h-8 bg-slate-100 flex-shrink-0"/>
                        <div className="min-w-0 flex-1">
                          {ed?<input className={eCls} value={editBuf.description||""} onChange={v=>setEditBuf({...editBuf,description:v.target.value})}/>:<p className="font-semibold text-slate-800 truncate">{je.description}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">{je.lines.length} lines · {fmtTZS(totalDr)}</p>
                        </div>
                        {!ed&&<div className="flex items-center gap-2 flex-shrink-0"><Badge color="green"><CheckCircle2 className="w-3 h-3"/>Balanced</Badge><ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen?"rotate-180":""}`}/></div>}
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        {ed?(
                          <><button onClick={saveJEHeader} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Save className="w-4 h-4"/></button><button onClick={cancelEdit} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button></>
                        ):(
                          <><button onClick={()=>startEdit(je)} title="Edit header" className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"><Pencil className="w-3.5 h-3.5"/></button><button onClick={()=>setConfirm({msg:`Delete entry ${je.reference}?`,detail:"Delete and re-post a corrected entry to fix line items.",onConfirm:()=>del(setJournal,je.id)})} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4"/></button></>
                        )}
                      </div>
                    </div>
                    {isOpen&&(
                      <div className="border-t border-slate-100">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="text-left px-5 py-2.5 text-xs text-slate-400 font-semibold">Code</th><th className="text-left px-5 py-2.5 text-xs text-slate-400 font-semibold">Account</th><th className="text-right px-5 py-2.5 text-xs text-slate-400 font-semibold">Debit</th><th className="text-right px-5 py-2.5 text-xs text-slate-400 font-semibold">Credit</th></tr></thead>
                          <tbody className="divide-y divide-slate-50">
                            {je.lines.map((l,i)=>(
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-5 py-3 font-mono text-xs text-slate-400 font-bold">{l.account_code}</td>
                                <td className={`px-5 py-3 text-slate-700 ${l.credit>0?"pl-10":""}`}>{l.account_name}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-800">{l.debit>0?fmtTZS(l.debit):<span className="text-slate-300">—</span>}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-800">{l.credit>0?fmtTZS(l.credit):<span className="text-slate-300">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="bg-indigo-50 border-t border-indigo-100"><td colSpan={2} className="px-5 py-2.5 text-xs font-bold text-indigo-600">Totals</td><td className="px-5 py-2.5 text-right text-xs font-bold text-slate-800">{fmtTZS(totalDr)}</td><td className="px-5 py-2.5 text-right text-xs font-bold text-slate-800">{fmtTZS(totalDr)}</td></tr></tfoot>
                        </table>
                        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0"/>
                          <p className="text-xs text-amber-700">To fix line items, delete this entry and post a corrected one. The pencil icon edits the header only.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AGING REPORT ── */}
        {tab==="aging"&&(
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Aging Report</h2><p className="text-sm text-slate-500">As of {NOW.toDateString()} · click any row to open invoice</p></div>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {[["receivable","Accounts Receivable","bg-emerald-600"],["payable","Accounts Payable","bg-rose-600"]].map(([v,l,ac])=>(
                  <button key={v} onClick={()=>setAgingType(v)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${agingType===v?`${ac} text-white shadow-sm`:"text-slate-600 hover:text-slate-800"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {agTotals.map(b=>{ const pct=agGrand>0?(b.total/agGrand)*100:0; const bs=bStyle[b.bucket]; return (<div key={b.bucket} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2"><Badge color={bs.badge}>{b.bucket}</Badge><p className="text-xl font-bold text-slate-800">{fmtTZS(b.total)}</p><p className="text-xs text-slate-400">{b.count} invoice{b.count!==1?"s":""}</p><div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className={`h-1.5 rounded-full ${bs.bar}`} style={{width:`${pct}%`}}/></div><p className="text-xs text-slate-400">{pct.toFixed(1)}%</p></div>); })}
            </div>
            <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between ${agingType==="receivable"?"bg-emerald-50 border-emerald-200":"bg-rose-50 border-rose-200"}`}>
              <p className={`font-bold text-sm ${agingType==="receivable"?"text-emerald-800":"text-rose-800"}`}>Total Outstanding {agingType==="receivable"?"Receivables":"Payables"} · {agItems.length} invoices</p>
              <p className={`text-2xl font-bold ${agingType==="receivable"?"text-emerald-700":"text-rose-700"}`}>{fmtTZS(agGrand)}</p>
            </div>
            {agItems.filter(i=>i.daysOverdue>30).length>0&&(
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"/><div><p className="text-sm font-bold text-amber-800">{agItems.filter(i=>i.daysOverdue>30).length} overdue invoice{agItems.filter(i=>i.daysOverdue>30).length>1?"s":""} need attention</p><p className="text-xs text-amber-600 mt-0.5">{fmtTZS(agItems.filter(i=>i.daysOverdue>30).reduce((s,i)=>s+i.amount,0))} at risk</p></div></div>
            )}
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <THead cols={["Invoice #","Party","Amount","Due Date","Days","Bucket","Risk"]}/>
                  <tbody className="divide-y divide-slate-50">
                    {agItems.length===0?<EmptyRow cols={7} msg="All clear – no outstanding items!" icon={CheckCircle2}/>:agItems.sort((a,b)=>b.daysOverdue-a.daysOverdue).map(inv=>{ const bs=bStyle[inv.bucket]; const risk=inv.daysOverdue>90?["red","Critical"]:inv.daysOverdue>60?["red","High"]:inv.daysOverdue>30?["orange","Medium"]:inv.daysOverdue>0?["amber","Low"]:["green","Current"]; return (<tr key={inv.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={()=>setSelectedInvoice(inv)}><td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">{inv.invoice_number}</td><td className="px-4 py-3 text-slate-700 font-medium">{inv.customer_name}</td><td className={`px-4 py-3 font-bold ${agingType==="receivable"?"text-emerald-600":"text-rose-600"}`}>{fmtTZS(inv.amount)}</td><td className="px-4 py-3 text-slate-500 text-xs">{inv.due_date}</td><td className={`px-4 py-3 font-bold text-sm ${bs.text}`}>{inv.daysOverdue<=0?`${Math.abs(inv.daysOverdue)}d left`:`${inv.daysOverdue}d over`}</td><td className="px-4 py-3"><Badge color={bs.badge}>{inv.bucket}</Badge></td><td className="px-4 py-3"><Badge color={risk[0]}>{risk[1]}</Badge></td></tr>); })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  </div>
  );
}