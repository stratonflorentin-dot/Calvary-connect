const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || 'https://openrouter.ai/api';
const OPENROUTER_MODEL = process.env.NEXT_PUBLIC_OPENROUTER_MODEL || 'minimax/minimax-m2.5:free';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  error?: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  customModel?: string
): Promise<AIResponse> {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Calvary Connect Fleet Management',
      },
      body: JSON.stringify({
        model: customModel || OPENROUTER_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        content: '',
        error: errorData.error?.message || `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || 'No response generated',
    };
  } catch (error: any) {
    return {
      content: '',
      error: error.message || 'Failed to connect to AI service',
    };
  }
}

export async function generateCode(
  prompt: string,
  language: string = 'typescript'
): Promise<AIResponse> {
  const systemMessage = `You are an expert ${language} developer. Generate clean, production-ready code. Only output the code, no explanations.`;

  return sendChatMessage([
    { role: 'system', content: systemMessage },
    { role: 'user', content: `Generate ${language} code for: ${prompt}` },
  ]);
}

export async function explainCode(code: string): Promise<AIResponse> {
  return sendChatMessage([
    { role: 'system', content: 'You are a code explanation assistant. Explain code clearly and concisely.' },
    { role: 'user', content: `Explain this code:\n\n${code}` },
  ]);
}

export async function debugCode(code: string, error?: string): Promise<AIResponse> {
  const errorContext = error ? `\n\nError message: ${error}` : '';
  return sendChatMessage([
    { role: 'system', content: 'You are a debugging assistant. Find and fix bugs in code.' },
    { role: 'user', content: `Debug this code:${errorContext}\n\n${code}` },
  ]);
}

export async function generateDocumentation(code: string): Promise<AIResponse> {
  return sendChatMessage([
    { role: 'system', content: 'You are a technical documentation writer. Generate clear documentation.' },
    { role: 'user', content: `Generate documentation for this code:\n\n${code}` },
  ]);
}

export function isAIConfigured(): boolean {
  return !!OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 0;
}
