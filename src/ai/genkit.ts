// Server-only dynamic Genkit factory to avoid bundling node-only libs into client
export async function createGenkit() {
  const { genkit } = await import('genkit');
  const { groq } = await import('genkitx-groq');
  return genkit({
    plugins: [groq({ apiKey: process.env.GROQ_API_KEY })],
    model: 'groq/llama-3.3-70b-versatile',
  });
}

// Export a server-only `ai` instance for server modules that import `ai` directly.
// This uses top-level await so it will only initialize when required on the server.
export const ai = await createGenkit();
