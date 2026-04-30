import { sendChatMessage, ChatMessage } from './ai';
import { askGrok } from './grok';

// Hybrid AI function that tries OpenRouter first, then Groq as fallback
async function sendHybridAIRequest(messages: ChatMessage[]): Promise<{ content: string; error?: string }> {
  // Try OpenRouter first (Minimax model)
  const openRouterResult = await sendChatMessage(messages);
  
  if (!openRouterResult.error && openRouterResult.content) {
    return { content: openRouterResult.content };
  }
  
  // Fallback to Groq if OpenRouter fails
  try {
    const groqPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const groqContent = await askGrok(groqPrompt);
    
    if (groqContent) {
      return { content: groqContent };
    }
  } catch (groqError) {
    console.error('Groq fallback also failed:', groqError);
  }
  
  // Both failed - return error from OpenRouter
  return { content: '', error: openRouterResult.error || 'Both AI services failed' };
}

export interface CompanyData {
  trips: any[];
  vehicles: any[];
  drivers: any[];
  expenses: any[];
  invoices: any[];
  fuelRecords: any[];
  maintenance: any[];
  inventory: any[];
  journalEntries: any[];
  bankAccounts: any[];
  customers: any[];
  suppliers: any[];
}

export interface AnalysisResult {
  executiveSummary: string;
  keyMetrics: {
    title: string;
    value: string;
    trend: 'up' | 'down' | 'neutral';
    change?: string;
  }[];
  operationalInsights: string[];
  financialAnalysis: string[];
  riskAssessment: string[];
  recommendations: string[];
  industryBenchmarks?: string[];
}

export async function performCompanyAnalysis(data: CompanyData): Promise<AnalysisResult> {
  const systemPrompt = `You are an expert fleet management and logistics business analyst with 20+ years of experience. 
You provide comprehensive, authentic company analysis for Calvary Connect - a fleet management company.

Analyze ALL provided data holistically. Consider:
- Operational efficiency (trip completion rates, vehicle utilization, driver performance)
- Financial health (revenue, expenses, profit margins, cash flow)
- Asset management (fleet condition, maintenance schedules, vehicle ROI)
- Customer relationships (payment patterns, satisfaction indicators)
- Market positioning and competitive advantages
- Risk factors and compliance issues

Provide realistic, industry-specific insights based on African logistics market conditions.
Be specific with numbers and percentages. Identify patterns and correlations.

Output must be valid JSON matching the AnalysisResult structure.`;

  const userPrompt = `Perform a comprehensive company analysis based on this data:

## TRIPS & OPERATIONS
Total Trips: ${data.trips.length}
Active Trips: ${data.trips.filter(t => t.status === 'ACTIVE' || t.status === 'IN_PROGRESS').length}
Completed Trips: ${data.trips.filter(t => t.status === 'COMPLETED').length}
Pending Trips: ${data.trips.filter(t => t.status === 'PENDING').length}

Revenue from Trips: ${data.trips.reduce((sum, t) => sum + (t.salesAmount || 0), 0).toFixed(2)} TZS
Total Cargo Weight: ${data.trips.reduce((sum, t) => sum + (parseFloat(t.cargoWeight) || 0), 0).toFixed(1)} tons

## FLEET STATUS
Total Vehicles: ${data.vehicles.length}
Available: ${data.vehicles.filter(v => v.status === 'AVAILABLE').length}
In Use: ${data.vehicles.filter(v => v.status === 'IN_USE').length}
In Maintenance: ${data.vehicles.filter(v => v.status === 'MAINTENANCE').length}

## FINANCIALS
Expenses: ${data.expenses.length} records, Total: ${data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0).toFixed(2)} TZS
Invoices: ${data.invoices.length} records
Paid Invoices: ${data.invoices.filter(i => i.status === 'paid').length}
Outstanding: ${data.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.balance || 0), 0).toFixed(2)} TZS

Journal Entries: ${data.journalEntries.length}
Bank Accounts: ${data.bankAccounts.length}

## MAINTENANCE & FUEL
Maintenance Records: ${data.maintenance.length}
Fuel Records: ${data.fuelRecords.length}
Total Fuel Cost: ${data.fuelRecords.reduce((sum, f) => sum + (f.cost || 0), 0).toFixed(2)} TZS

## HUMAN RESOURCES
Drivers: ${data.drivers.length}
Active Drivers: ${data.drivers.filter(d => d.status === 'active').length}

## INVENTORY
Inventory Items: ${data.inventory.length}
Low Stock Items: ${data.inventory.filter(i => (i.quantity || 0) < (i.minStock || 10)).length}

Provide analysis in this JSON structure:
{
  "executiveSummary": "2-3 paragraph executive summary",
  "keyMetrics": [
    {"title": "Metric Name", "value": "Value", "trend": "up|down|neutral", "change": "+12%"}
  ],
  "operationalInsights": ["insight 1", "insight 2"],
  "financialAnalysis": ["analysis 1", "analysis 2"],
  "riskAssessment": ["risk 1", "risk 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Use hybrid AI - OpenRouter (Minimax) primary, Groq fallback
    const response = await sendHybridAIRequest(messages);
    
    if (response.error) {
      throw new Error(response.error);
    }

    // Try to extract JSON from the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AnalysisResult;
    }

    // Fallback: create structured result from text
    return createFallbackAnalysis(response.content, data);
  } catch (error) {
    console.error('AI Analysis failed:', error);
    return createBasicAnalysis(data);
  }
}

function createFallbackAnalysis(content: string, data: CompanyData): AnalysisResult {
  return {
    executiveSummary: content.substring(0, 500),
    keyMetrics: [
      { title: 'Total Trips', value: data.trips.length.toString(), trend: 'neutral' },
      { title: 'Active Fleet', value: data.vehicles.filter(v => v.status === 'AVAILABLE').length.toString(), trend: 'up' },
      { title: 'Outstanding Revenue', value: data.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.balance || 0), 0).toFixed(0) + ' TZS', trend: 'down' },
    ],
    operationalInsights: ['Analysis generated from AI response'],
    financialAnalysis: ['Financial data analyzed'],
    riskAssessment: ['Risk factors identified'],
    recommendations: ['Recommendations provided'],
  };
}

function createBasicAnalysis(data: CompanyData): AnalysisResult {
  const totalRevenue = data.trips.reduce((sum, t) => sum + (t.salesAmount || 0), 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const outstanding = data.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.balance || 0), 0);
  
  return {
    executiveSummary: `Calvary Connect currently operates ${data.trips.length} trips with ${data.vehicles.length} vehicles. Revenue stands at ${totalRevenue.toFixed(2)} TZS against expenses of ${totalExpenses.toFixed(2)} TZS. Outstanding receivables amount to ${outstanding.toFixed(2)} TZS.`,
    keyMetrics: [
      { title: 'Fleet Utilization', value: Math.round((data.trips.filter(t => t.status === 'ACTIVE').length / data.vehicles.length) * 100) + '%', trend: 'neutral' },
      { title: 'Trip Completion Rate', value: Math.round((data.trips.filter(t => t.status === 'COMPLETED').length / data.trips.length) * 100) + '%', trend: data.trips.filter(t => t.status === 'COMPLETED').length > data.trips.length * 0.7 ? 'up' : 'down' },
      { title: 'Outstanding Invoices', value: outstanding.toFixed(0) + ' TZS', trend: outstanding > 1000000 ? 'down' : 'up' },
    ],
    operationalInsights: [
      `${data.vehicles.filter(v => v.status === 'MAINTENANCE').length} vehicles currently under maintenance`,
      `${data.drivers.filter(d => d.status === 'active').length} active drivers available`,
      `Average cargo weight per trip: ${data.trips.length > 0 ? (data.trips.reduce((sum, t) => sum + (parseFloat(t.cargoWeight) || 0), 0) / data.trips.length).toFixed(1) : 0} tons`,
    ],
    financialAnalysis: [
      `Revenue to expense ratio: ${totalExpenses > 0 ? (totalRevenue / totalExpenses).toFixed(2) : 'N/A'}`,
      `${data.invoices.filter(i => i.status === 'paid').length} of ${data.invoices.length} invoices paid`,
      `Fuel costs represent ${totalExpenses > 0 ? ((data.fuelRecords.reduce((sum, f) => sum + (f.cost || 0), 0) / totalExpenses) * 100).toFixed(1) : 0}% of total expenses`,
    ],
    riskAssessment: [
      data.inventory.filter(i => (i.quantity || 0) < (i.minStock || 10)).length > 0 ? `${data.inventory.filter(i => (i.quantity || 0) < (i.minStock || 10)).length} inventory items below minimum stock` : 'No inventory shortages',
      outstanding > 5000000 ? 'High outstanding receivables may impact cash flow' : 'Receivables within normal range',
      data.maintenance.filter(m => m.status === 'URGENT').length > 0 ? `${data.maintenance.filter(m => m.status === 'URGENT').length} urgent maintenance items` : 'No urgent maintenance issues',
    ],
    recommendations: [
      'Review outstanding invoices and implement collection strategies',
      'Optimize vehicle utilization to increase revenue per asset',
      'Monitor fuel consumption patterns for cost reduction opportunities',
    ],
  };
}
