// Client-safe agent metadata — no server-only imports (Genkit, Supabase
// service role, etc.), so UI components can list the roster without pulling
// in src/lib/ai-agents/roster.ts's server-side run/chat logic.
export type AgentCategory = "operations" | "finance" | "people";

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
}

export const AGENT_METADATA: AgentMetadata[] = [
  {
    id: "dispatch",
    name: "Dispatch Agent",
    description: "Finds the oldest unassigned pending trip and ranks driver + vehicle pairings for it.",
    category: "operations",
  },
  {
    id: "maintenance",
    name: "Maintenance Agent",
    description: "Predicts breakdown risk for the vehicle most likely to need service next.",
    category: "operations",
  },
  {
    id: "fuel",
    name: "Fuel Agent",
    description: "Predicts fuel consumption and cost for the current highest-priority trip.",
    category: "operations",
  },
  {
    id: "ceo-insights",
    name: "CEO Insights Agent",
    description: "Rolls up fleet, revenue, and risk metrics into board-level highlights and actions.",
    category: "finance",
  },
  {
    id: "driver-performance",
    name: "Driver Performance Agent",
    description: "Scans all drivers for who is worth a coaching conversation this week.",
    category: "people",
  },
  {
    id: "customer-relationship",
    name: "Customer Relationship Agent",
    description: "Scans customers and contracts for relationships that need attention this week.",
    category: "people",
  },
];
