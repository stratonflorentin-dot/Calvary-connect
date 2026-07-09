// Server-only dynamic Genkit factory to avoid bundling node-only libs into client.
// Import the runtime implementation directly to skip the wrapper that initializes
// node telemetry (which pulls in @opentelemetry/sdk-node and its protobuf dependency).
export async function createGenkit() {
  const dynamicImport = (specifier: string) => import(specifier) as Promise<any>;

  const tracingModule = await dynamicImport('@genkit-ai/core/tracing').catch(() => null);
  if (tracingModule?.disableGenkitOTelInitialization) {
    tracingModule.disableGenkitOTelInitialization();
  }

  const { genkit } = await dynamicImport('genkit/lib/genkit.mjs');
  const { groq } = await dynamicImport('genkitx-groq/lib/index.mjs');

  return genkit({
    plugins: [groq({ apiKey: process.env.GROQ_API_KEY })],
    model: 'groq/llama-3.3-70b-versatile',
  });
}
