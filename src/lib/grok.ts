// src/lib/grok.ts
// Utility for Grok API integration (AI route, distance, geocoding, safe route)

const GROK_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const GROK_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function askGrok(prompt: string): Promise<string> {
  if (!GROK_API_KEY) throw new Error("GROQ API key not set");
  const res = await fetch(GROK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error("Grok API error");
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function getSafeRoute(origin: string, destination: string): Promise<string> {
  return askGrok(`Suggest the safest route for a truck from ${origin} to ${destination} in Tanzania. List main towns and any safety tips.`);
}

export async function getDistance(origin: string, destination: string): Promise<string> {
  return askGrok(`What is the road distance in kilometers and estimated driving time from ${origin} to ${destination} in Tanzania?`);
}

export async function geocode(address: string): Promise<string> {
  return askGrok(`What are the latitude and longitude coordinates for ${address} in Tanzania? Reply as 'lat,lng'.`);
}
