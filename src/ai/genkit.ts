// Server-only dynamic Genkit factory to avoid bundling node-only libs into client.
// Each import() below uses a literal specifier (not passed through a shared
// helper) so Next's webpack server bundler can statically resolve and
// code-split it — routing them through a `dynamicImport(specifier: string)`
// helper made every call site's argument a variable, which webpack can't
// analyze; it then fails at runtime with "Cannot find module 'genkit'" even
// though the package resolves fine under plain Node.
export async function createGenkit() {
  const tracingModule = await import('@genkit-ai/core/tracing').catch(() => null);
  if (tracingModule?.disableGenkitOTelInitialization) {
    tracingModule.disableGenkitOTelInitialization();
  }

  // The package's exports map only exposes the top-level 'genkit' and
  // 'genkitx-groq' entry points — deep paths like 'genkit/lib/genkit.mjs'
  // are blocked even though the file exists on disk.
  const { genkit } = await import('genkit');
  const { groq } = await import('genkitx-groq');

  return genkit({
    plugins: [groq({ apiKey: process.env.GROQ_API_KEY })],
    model: 'groq/llama-3.3-70b-versatile',
  });
}
