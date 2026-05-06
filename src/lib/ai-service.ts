// AI Service - NVIDIA Nemotron & OpenRouter integration
// Supports forecasting, analysis, and database queries

interface AIModel {
  provider: 'nvidia' | 'openrouter';
  model: string;
  apiKey: string;
  baseUrl: string;
}

class AIService {
  private nvidia: AIModel;
  private openrouter: AIModel;

  constructor() {
    this.nvidia = {
      provider: 'nvidia',
      model: process.env.NEXT_PUBLIC_NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      apiKey: process.env.NEXT_PUBLIC_NVIDIA_API_KEY || '',
      baseUrl: 'https://openrouter.ai/api/v1'
    };
    this.openrouter = {
      provider: 'openrouter',
      model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || 'minimax/minimax-m2.5:free',
      apiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '',
      baseUrl: process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    };
  }

  private async callAI(prompt: string, model: AIModel, systemPrompt?: string): Promise<string> {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
        'HTTP-Referer': 'https://calvary-connect.vercel.app',
        'X-Title': 'Calvary Fleet'
      },
      body: JSON.stringify({
        model: model.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async forecastRevenue(timeframe: string, data: any[]): Promise<any> {
    const prompt = `Forecast revenue for ${timeframe} based on this data: ${JSON.stringify(data)}. Return JSON with forecast, confidence, insights.`;
    const response = await this.callAI(prompt, this.nvidia, 'You are a fleet revenue forecaster.');
    try { return JSON.parse(response); } catch { return { forecast: response }; }
  }

  async forecastExpenses(timeframe: string, data: any[]): Promise<any> {
    const prompt = `Forecast expenses for ${timeframe} based on this data: ${JSON.stringify(data)}. Return JSON with forecast, confidence, insights.`;
    const response = await this.callAI(prompt, this.nvidia, 'You are a fleet expense forecaster.');
    try { return JSON.parse(response); } catch { return { forecast: response }; }
  }

  async analyzeFleet(data: any): Promise<any> {
    const prompt = `Analyze fleet performance: ${JSON.stringify(data)}. Return JSON with insights, recommendations, risks.`;
    const response = await this.callAI(prompt, this.nvidia, 'You are a fleet analyst.');
    try { return JSON.parse(response); } catch { return { analysis: response }; }
  }

  async queryDatabase(question: string, schema: string): Promise<string> {
    const prompt = `Generate SQL for: "${question}". Schema: ${schema}. Return only SQL.`;
    return await this.callAI(prompt, this.nvidia, 'You are a SQL expert.');
  }
}

export const aiService = new AIService();
