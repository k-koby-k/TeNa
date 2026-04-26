// Pitch-deck extraction agent.
// User uploads a PDF (deck, plan, one-pager). Gemini reads it natively and
// returns whatever profile / market / financial fields it can pull out.
// Anything missing is just left undefined — the UI shows what was filled.

import { GoogleGenAI, Type } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    const k = process.env.GEMINI_API_KEY;
    if (!k) throw new Error("GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: k });
  }
  return _client;
}

export interface ExtractedProfile {
  business_name?: string;
  business_type?: string;
  format?: "kiosk" | "standard" | "premium";
  stage?: "idea" | "pilot" | "scale";
  description?: string;
  target_audience?: "office" | "residents" | "students" | "tourists" | "mixed";
  owner_experience?: "none" | "some" | "established";
  district?: string;
  niche?: string;
  // Commercial / financial extractions when present in the deck
  budget_uzs?: number;
  monthly_rent_uzs?: number;
  loan_uzs?: number;
  average_ticket_uzs?: number;
  customers_per_day?: number;
  /** What the agent thinks the deck is about, in 1 sentence — shown to user. */
  source_summary?: string;
  /** Names of the fields it actually filled — drives the UI badges. */
  filled_fields: string[];
}

const SCHEMA = {
  type: Type.OBJECT,
  required: ["filled_fields"],
  properties: {
    business_name:    { type: Type.STRING, description: "Brand or company name from the deck" },
    business_type:    { type: Type.STRING, description: "Match one of: Coffee shop, Restaurant, Bakery, Pharmacy, Beauty salon, Mini-market, Gym, Dental clinic, Pet shop, Bookstore. Use 'Other' if none fit." },
    format:           { type: Type.STRING, enum: ["kiosk","standard","premium"] },
    stage:            { type: Type.STRING, enum: ["idea","pilot","scale"] },
    description:      { type: Type.STRING, description: "1-3 sentence concept description in the founder's own framing" },
    target_audience:  { type: Type.STRING, enum: ["office","residents","students","tourists","mixed"] },
    owner_experience: { type: Type.STRING, enum: ["none","some","established"] },
    district:         { type: Type.STRING, description: "Tashkent district name only if explicitly mentioned" },
    niche:            { type: Type.STRING, description: "Specific sub-category, e.g. 'specialty coffee'" },
    budget_uzs:       { type: Type.NUMBER, description: "Startup capital in UZS (raw, not millions)" },
    monthly_rent_uzs: { type: Type.NUMBER, description: "Monthly rent in UZS" },
    loan_uzs:         { type: Type.NUMBER, description: "Loan ask in UZS" },
    average_ticket_uzs:    { type: Type.NUMBER, description: "Avg revenue per customer in UZS" },
    customers_per_day:     { type: Type.INTEGER },
    source_summary:        { type: Type.STRING, description: "1 sentence — what is this deck about?" },
    filled_fields: {
      type: Type.ARRAY, items: { type: Type.STRING },
      description: "Names of the fields you actually filled with extracted (not invented) values",
    },
  },
} as const;

const SYSTEM = `You are a profile-extraction agent. The user uploads a pitch deck, \
business plan, or one-pager. Your job is to extract concrete facts that map to the \
SQB platform's business profile fields.

Hard rules:
- Only fill a field if the deck *says it explicitly* or strongly implies it.
- Never invent a number. If revenue is in USD, convert to UZS at ~12,500 UZS/USD.
- Never guess a district. Only fill if the deck names a Tashkent district.
- Description: rewrite in 1-3 clean sentences (third person, no marketing fluff).
- Always populate filled_fields with the *names* of every field you actually filled.
- It's fine to fill very few fields — leave unknowns blank.`;

export async function extractProfile(pdfBase64: string, mimeType: string): Promise<ExtractedProfile> {
  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: pdfBase64 } },
        { text: "Extract everything you can map to the schema. Leave the rest blank." },
      ],
    }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.2,
    },
  });

  const text = resp.text;
  if (!text) throw new Error("Empty response from Gemini");
  const data = JSON.parse(text) as ExtractedProfile;
  // Normalise: don't echo the literal string "Other" as the business_type
  if (data.business_type && /^other$/i.test(data.business_type)) delete data.business_type;
  return data;
}
