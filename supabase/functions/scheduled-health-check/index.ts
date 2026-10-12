// Invoked by pg_cron through pg_net. The function has platform JWT checks
// disabled and authenticates the scheduled caller with a dedicated secret.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

async function matchesSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("EXTERNAL_HEALTH_CHECK_SECRET");
  if (!await matchesSecret(request.headers.get("x-cron-secret"), expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  const appSecret = Deno.env.get("EXTERNAL_HEALTH_CHECK_SECRET");
  if (!appBaseUrl || !appSecret) return new Response("Health check configuration is incomplete", { status: 500 });

  try {
    const response = await fetch(new URL("/api/internal/external-health-check", appBaseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": appSecret },
      body: JSON.stringify({ source: "supabase-cron" }),
      signal: AbortSignal.timeout(55_000),
    });
    return new Response(await response.text(), {
      status: response.ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Unable to call application health-check route", error);
    return new Response("Application health check request failed", { status: 502 });
  }
});
