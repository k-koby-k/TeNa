// Voice agent — speak in Uzbek / Russian / English, get the form filled.
//
// Pattern borrowed from the YuMI medical-STT project: send audio inline to
// Gemini, ask for a transcript + structured extraction in a single call.
//
// We reuse the same response shape as the pitch-deck extractor so the
// frontend can plug the result into the same `applyToInputs()` helper.

import { GoogleGenAI, Type } from "@google/genai";
import type { ExtractedProfile } from "./extract-profile.js";

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

export interface VoiceAgentResult extends ExtractedProfile {
  transcript: string;
  language: string;            // "uz" | "ru" | "en" — agent's own detection
  reply: string;               // short conversational confirmation for the chat
}

const SCHEMA = {
  type: Type.OBJECT,
  required: ["transcript", "language", "reply", "filled_fields"],
  properties: {
    // What the user said, verbatim, in the original language.
    transcript:       { type: Type.STRING },
    language:         { type: Type.STRING, description: "ISO 639-1 code: uz | ru | en" },
    // 1-2 sentence acknowledgement to render back in the chat.
    reply:            { type: Type.STRING },
    // ---- everything below mirrors ExtractedProfile ----
    business_name:    { type: Type.STRING },
    business_type:    { type: Type.STRING },
    format:           { type: Type.STRING, enum: ["kiosk","standard","premium"] },
    stage:            { type: Type.STRING, enum: ["idea","pilot","scale"] },
    description:      { type: Type.STRING },
    target_audience:  { type: Type.STRING, enum: ["office","residents","students","tourists","mixed"] },
    owner_experience: { type: Type.STRING, enum: ["none","some","established"] },
    district:         { type: Type.STRING },
    niche:            { type: Type.STRING },
    budget_uzs:       { type: Type.NUMBER },
    monthly_rent_uzs: { type: Type.NUMBER },
    loan_uzs:         { type: Type.NUMBER },
    average_ticket_uzs:    { type: Type.NUMBER },
    customers_per_day:     { type: Type.INTEGER },
    source_summary:        { type: Type.STRING },
    filled_fields: {
      type: Type.ARRAY, items: { type: Type.STRING },
      description: "Names of every field actually populated from what was said",
    },
  },
} as const;

const SYSTEM = `You are TeNa's voice intake agent. The user records a short \
audio clip describing the business they want to open and gives you whatever \
inputs they choose to mention (capital, rent, loan, customers, etc.).

Your job:
1. Transcribe the audio verbatim into the original language (Uzbek / Russian / English).
   Do not translate. The transcript is shown back to the user — keep it accurate.
2. Detect the language and return the ISO code (uz, ru, en).
3. Extract every Profile / Market / Financial field the user mentioned, mapping
   them to the schema. Convert spoken numbers ("yuz million so'm" / "сто миллионов сум" /
   "one hundred million soums") to integer UZS. Common Uzbek/Russian shorthands:
     - "ming" / "тысяча" / "thousand" = 10^3
     - "mln" / "million" = 10^6
     - "yarim" / "поллма" = half
   - business_type: pick from the same list as the form (Coffee shop, Pharmacy, Bakery,
     Beauty salon, Restaurant, Mini-market, Gym, Dental clinic, Pet shop, Bookstore).
4. Write a friendly 1-2 sentence reply back to the user in the *same language they spoke*.
   Confirm the headline numbers you captured. Don't list every field. If they
   said something ambiguous, ask one short follow-up question.
5. populate filled_fields with the names of every field you actually set.

Do NOT invent values. Only fill what the user explicitly said. If the user only
mentioned a business type, only fill business_type (and description if it was
substantive).`;

export async function transcribeAndExtract(audioBase64: string, mimeType: string): Promise<VoiceAgentResult> {
  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        { text: "Transcribe what I said and extract every field you can map to the TeNa schema." },
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
  const data = JSON.parse(text) as VoiceAgentResult;
  // Same scale-drift normalisation we apply to extract-profile.
  if (data.business_type && /^other$/i.test(data.business_type)) (data as any).business_type = undefined;
  return data;
}
