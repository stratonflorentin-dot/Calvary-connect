// Server-only dynamic Genkit factory to avoid bundling node-only libs into client
export async function createGenkit() {
  const { genkit } = await import('genkit');
  const { groq } = await import('genkitx-groq');
  return genkit({
    plugins: [groq({ apiKey: process.env.GROQ_API_KEY })],
    model: 'groq/llama-3.3-70b-versatile',
  });
}

// Note: do NOT export a top-level `ai` instance. Consumers should call
// `createGenkit()` and initialize the client in server-only contexts. This
// prevents bundling node-only telemetry and native modules into client builds.
