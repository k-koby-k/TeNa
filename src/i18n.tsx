// Lightweight i18n: a flat string table + a useT() hook + a LanguageProvider.
// We keep ENGLISH as the canonical key so the codebase stays grep-able and
// translations don't drift.
//
// To use:  const t = useT();  …t("Run full analysis")
// Unknown keys fall back to the English key itself, so untranslated strings
// stay readable while the rest of the UI renders in Uzbek.

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export type Lang = "uz" | "en";
const STORAGE_KEY = "tena.lang";

const DICT: Record<string, { uz: string }> = {
  // === Brand / sidebar ===
  "TeNa":                                 { uz: "TeNa" },
  "SME advisor · decision cockpit":       { uz: "MSB maslahatchisi · qaror kabineti" },
  "Founder":                              { uz: "Tadbirkor" },
  "Banker":                               { uz: "Bankir" },
  "New analysis":                         { uz: "Yangi tahlil" },
  "New application":                      { uz: "Yangi ariza" },
  "Workspace":                            { uz: "Ish maydoni" },
  "Business analysis":                    { uz: "Biznes tahlili" },
  "Credit desk":                          { uz: "Kredit stoli" },
  "Bank tools":                           { uz: "Bank vositalari" },
  "Banker workspace":                     { uz: "Bankir ish maydoni" },
  "Reviewing live applications":          { uz: "Faol arizalar ko'rib chiqilmoqda" },
  "Recent":                               { uz: "Yaqindagi" },
  "View all":                             { uz: "Hammasini ko'rish" },
  "No analyses yet.":                     { uz: "Hali tahlillar yo'q." },
  "Aziza Karimova":                       { uz: "Aziza Karimova" },
  "SME Credit Analyst · SQB":             { uz: "MSB Kredit Tahlilchisi · SQB" },
  "Demo session":                         { uz: "Demo sessiya" },

  // === Nav labels (also the wizard step names) ===
  "Profile":                              { uz: "Profil" },
  "Location":                             { uz: "Joylashuv" },
  "Market":                               { uz: "Bozor" },
  "Financials":                           { uz: "Moliya" },
  "Overview":                             { uz: "Umumiy ko'rinish" },
  "Explainability":                       { uz: "Tushuntirish" },
  "History":                              { uz: "Tarix" },
  "Queue":                                { uz: "Navbat" },
  "Applications":                         { uz: "Arizalar" },
  "Deal Pipeline":                        { uz: "Bitimlar jarayoni" },

  // === Wizard stepper / footer ===
  "Done":                                 { uz: "Bajarildi" },
  "Pending":                              { uz: "Kutilmoqda" },
  "Locked":                               { uz: "Bloklangan" },
  "Current":                              { uz: "Joriy" },
  "Continue to":                          { uz: "Davom etish:" },
  "Back to":                              { uz: "Orqaga:" },

  // === Profile setup ===
  "Step 1 of 4 · Business profile":       { uz: "Qadam 1 / 4 · Biznes profili" },
  "Tell the agents about the business":   { uz: "Agentlarga biznes haqida ayting" },
  "Profile complete":                     { uz: "Profil to'liq" },
  "Profile incomplete":                   { uz: "Profil to'liq emas" },
  "Business name":                        { uz: "Biznes nomi" },
  "Business type":                        { uz: "Biznes turi" },
  "Format":                               { uz: "Format" },
  "Stage":                                { uz: "Bosqich" },
  "Concept description":                  { uz: "Kontseptsiya tavsifi" },
  "Target audience":                      { uz: "Maqsadli auditoriya" },
  "Owner experience":                     { uz: "Egasining tajribasi" },
  "Office workers / commuters":           { uz: "Ofis xodimlari / qatnovchilar" },
  "Local residents":                      { uz: "Mahalliy aholi" },
  "Students":                             { uz: "Talabalar" },
  "Tourists":                             { uz: "Sayyohlar" },
  "Mixed":                                { uz: "Aralash" },
  "Idea":                                 { uz: "G'oya" },
  "Pilot":                                { uz: "Pilot" },
  "Scale":                                { uz: "Kengaytirish" },
  "Kiosk":                                { uz: "Kiosk" },
  "Standard":                             { uz: "Standart" },
  "Premium":                              { uz: "Premium" },
  "None":                                 { uz: "Yo'q" },
  "Some":                                 { uz: "Bor" },
  "Established":                          { uz: "Tajribali" },
  "Next steps":                           { uz: "Keyingi qadamlar" },
  "Got a pitch deck?":                    { uz: "Pitch dekingiz bormi?" },
  "Optional":                             { uz: "Ixtiyoriy" },
  "Upload a PDF":                         { uz: "PDF yuklash" },

  // === Location screen ===
  "Step 2 · Location & site":             { uz: "Qadam 2 · Joylashuv va manzil" },
  "Where will it open?":                  { uz: "Qayerda ochiladi?" },
  "Search a place in Tashkent":           { uz: "Toshkentda joy qidirish" },
  "Site facts":                           { uz: "Manzil ma'lumotlari" },
  "Site size":                            { uz: "Manzil maydoni" },
  "Monthly rent":                         { uz: "Oylik ijara" },
  "Lease term":                           { uz: "Ijara muddati" },
  "Rent deposit":                         { uz: "Ijara depoziti" },
  "Operating hours":                      { uz: "Ish vaqti" },
  "Site type":                            { uz: "Manzil turi" },
  "Parking nearby":                       { uz: "Yaqin atrofdagi avtoturargoh" },
  "Site":                                 { uz: "Manzil" },
  "Competitor":                           { uz: "Raqobatchi" },
  "Transit":                              { uz: "Transport" },
  "Mall / market":                        { uz: "Savdo markazi / bozor" },
  "Quick jump:":                          { uz: "Tezkor o'tish:" },

  // === Market screen ===
  "Step 3 · Market & sales":              { uz: "Qadam 3 · Bozor va savdo" },
  "How will it sell?":                    { uz: "Qanday sotiladi?" },
  "Concept":                              { uz: "Kontseptsiya" },
  "Format / tier":                        { uz: "Format / daraja" },
  "Unit economics — what only you know":  { uz: "Birlik iqtisodiyoti — faqat siz bilgan narsalar" },
  "Average ticket":                       { uz: "O'rtacha chek" },
  "Customers per day target":             { uz: "Kuniga mijozlar maqsadi" },
  "Days open per week":                   { uz: "Haftada ish kunlari" },
  "Sales channel":                        { uz: "Savdo kanali" },
  "Reach & differentiation":              { uz: "Qamrov va farqlash" },
  "Marketing reach":                      { uz: "Marketing qamrovi" },
  "Marketing budget":                     { uz: "Marketing byudjeti" },
  "Niche":                                { uz: "Nisha" },
  "Differentiation in 1 sentence":        { uz: "Farqlash bir gapda" },
  "Price tier":                           { uz: "Narx darajasi" },
  "Comparable competitor":                { uz: "Mavjud raqobatchi" },
  "Storefront only":                      { uz: "Faqat do'kon" },
  "Storefront + online (delivery / pickup)": { uz: "Do'kon + onlayn (yetkazib berish / olib ketish)" },
  "Online only":                          { uz: "Faqat onlayn" },
  "B2B / wholesale":                      { uz: "B2B / ulgurji" },
  "Walk-by only":                         { uz: "Faqat o'tib ketuvchilar" },
  "District (signage + local ads)":       { uz: "Tuman (reklamalar bilan)" },
  "City-wide":                            { uz: "Shahar bo'ylab" },
  "Online + offline":                     { uz: "Onlayn + offlayn" },
  "Value":                                { uz: "Arzon" },
  "Mid":                                  { uz: "O'rta" },

  // === Financials screen ===
  "Step 4 · Financials & lending":        { uz: "Qadam 4 · Moliya va kreditlash" },
  "Capital, collateral and risk":         { uz: "Kapital, garov va xavf" },
  "Capital structure & use of funds":     { uz: "Kapital tuzilishi va mablag'lar ishlatilishi" },
  "Founder capital injection":            { uz: "Asoschi kapitali" },
  "Loan amount requested":                { uz: "So'ralgan kredit miqdori" },
  "Repayment horizon":                    { uz: "To'lash muddati" },
  "Grace period":                         { uz: "Imtiyozli davr" },
  "Repayment frequency":                  { uz: "To'lash tezligi" },
  "Use of funds breakdown":               { uz: "Mablag'larning ishlatilishi" },
  "Use typical split":                    { uz: "Odatiy bo'linishni qo'llash" },
  "Clear":                                { uz: "Tozalash" },
  "Equipment":                            { uz: "Uskunalar" },
  "Renovations":                          { uz: "Ta'mirlash" },
  "Inventory":                            { uz: "Tovar zaxirasi" },
  "Working cap.":                         { uz: "Aylanma kapital" },
  "Marketing":                            { uz: "Marketing" },
  "Collateral & guarantor":               { uz: "Garov va kafil" },
  "Personal financial standing":          { uz: "Shaxsiy moliyaviy holat" },
  "Risk acknowledgement":                 { uz: "Xavfni tan olish" },
  "Operating economics":                  { uz: "Operatsion iqtisodiyot" },
  "Existing debts":                       { uz: "Mavjud qarzlar" },
  "Other monthly income":                 { uz: "Boshqa oylik daromad" },
  "Dependents":                           { uz: "Qaramog'ingizdagilar" },
  "Top risk you've identified":           { uz: "Aniqlagan asosiy xavf" },
  "Contingency runway":                   { uz: "Zaxira mablag' muddati" },
  "Business insurance planned?":          { uz: "Biznes sug'urtasi rejalashtirilganmi?" },
  "Other monthly costs":                  { uz: "Boshqa oylik xarajatlar" },
  "Revenue ramp":                         { uz: "Daromad o'sishi" },
  "Collateral type":                      { uz: "Garov turi" },
  "Collateral value":                     { uz: "Garov qiymati" },
  "Already pledged elsewhere?":           { uz: "Boshqa joyda garovga qo'yilganmi?" },
  "Co-signer / guarantor":                { uz: "Kafolatchi / kafil" },
  "Real estate":                          { uz: "Ko'chmas mulk" },
  "Vehicle":                              { uz: "Avtomobil" },
  "Cash deposit":                         { uz: "Naqd depozit" },
  "Yes":                                  { uz: "Ha" },
  "No":                                   { uz: "Yo'q" },
  "Monthly":                              { uz: "Oylik" },
  "Quarterly":                            { uz: "Choraklik" },

  // === Overview / orchestrator ===
  "Run full analysis":                    { uz: "To'liq tahlilni boshlash" },
  "Re-run analysis":                      { uz: "Tahlilni qayta ishga tushirish" },
  "Running…":                             { uz: "Bajarilmoqda..." },
  "Running agents…":                      { uz: "Agentlar ishlamoqda..." },
  "Analysis ready · re-run anytime":      { uz: "Tahlil tayyor · istalgan vaqtda qayta ishga tushiring" },
  "Waiting for required inputs":          { uz: "Zarur ma'lumotlar kutilmoqda" },
  "Starting analysis…":                   { uz: "Tahlil boshlanmoqda..." },
  "Agent orchestration":                  { uz: "Agent orkestratsiyasi" },
  "Why this score":                       { uz: "Nima uchun bu baho" },
  "Why":                                  { uz: "Nima uchun" },
  "Location intelligence · live OSM map": { uz: "Joylashuv tahlili · jonli OSM xarita" },
  "Location score":                       { uz: "Joylashuv bahosi" },
  "Foot traffic":                         { uz: "Piyodalar oqimi" },
  "Walkability":                          { uz: "Piyoda yurish qulayligi" },
  "Visibility":                           { uz: "Ko'rinish" },
  "Composite score · how we decide":      { uz: "Yig'ma baho · qanday qaror qilamiz" },
  "Weighted decision policy":             { uz: "Vaznli qaror siyosati" },
  "Final score":                          { uz: "Yakuniy baho" },
  "Top positive factors":                 { uz: "Asosiy ijobiy omillar" },
  "Key risk factors":                     { uz: "Asosiy xavf omillari" },

  // === Banker queue ===
  "SQB credit officer · live queue":      { uz: "SQB kredit ofitseri · jonli navbat" },
  "SQB credit officer · application pipeline": { uz: "SQB kredit ofitseri · arizalar jarayoni" },
  "Bank sales · all analyzed businesses": { uz: "Bank savdosi · barcha tahlil qilingan bizneslar" },
  "Pre-qualified SME applications":       { uz: "Oldindan saralangan MSB arizalari" },
  "Analyzed SME applications":            { uz: "Tahlil qilingan MSB arizalari" },
  "All":                                  { uz: "Hammasi" },
  "Any":                                  { uz: "Istalgan" },
  "Score":                                { uz: "Baho" },
  "70+":                                  { uz: "70+" },
  "50-69":                                { uz: "50-69" },
  "<50":                                  { uz: "<50" },
  "Launch":                               { uz: "Boshlash" },
  "Caution":                              { uz: "Ehtiyot" },
  "Decline":                              { uz: "Rad etish" },
  "Search business / district / ID…":     { uz: "Biznes / tuman / ID qidirish..." },
  "Loading queue…":                       { uz: "Navbat yuklanmoqda..." },
  "No matches.":                          { uz: "Mos keladigan natijalar yo'q." },
  "No applications in this bucket yet.":  { uz: "Bu toifada hali arizalar yo'q." },
  "Auto-approve rate":                    { uz: "Avto-tasdiqlash darajasi" },
  "Conditions required":                  { uz: "Shartlar talab qilinadi" },
  "Avoided risk":                         { uz: "Oldini olingan xavf" },
  "Call":                                 { uz: "Qo'ng'iroq" },
  "More filters":                         { uz: "Ko'proq filtrlar" },
  "Filters":                              { uz: "Filtrlar" },
  "Reset filters":                        { uz: "Filtrlarni tozalash" },
  "Newest":                               { uz: "Eng yangi" },
  "Top score":                            { uz: "Eng yuqori baho" },
  "Lowest score":                         { uz: "Eng past baho" },
  "Recommendation":                       { uz: "Tavsiya" },
  "All types":                            { uz: "Barcha turlar" },
  "All districts":                        { uz: "Barcha tumanlar" },
  "District":                             { uz: "Tuman" },
  "just now":                             { uz: "hozirgina" },
  "min ago":                              { uz: "daqiqa oldin" },
  "h ago":                                { uz: "soat oldin" },
  "d ago":                                { uz: "kun oldin" },
  "Last refresh just now":                { uz: "Oxirgi yangilanish hozirgina" },

  // === Borrower & loan card ===
  "Borrower & founder":                   { uz: "Qarz oluvchi va asoschi" },
  "Loan ask & deal terms":                { uz: "Kredit so'rovi va shartlar" },
  "Use of funds":                         { uz: "Mablag'lardan foydalanish" },
  "Name":                                 { uz: "Ism" },
  "Owner xp":                             { uz: "Ega tajribasi" },
  "Years in industry":                    { uz: "Sohada yillar" },
  "Prior businesses":                     { uz: "Avvalgi bizneslar" },
  "Legal entity":                         { uz: "Yuridik shakl" },
  "Headcount":                            { uz: "Xodimlar soni" },
  "Principal":                            { uz: "Asosiy summa" },
  "Founder cap.":                         { uz: "Asoschi kapitali" },
  "Tenor":                                { uz: "Muddati" },
  "Grace":                                { uz: "Imtiyoz" },
  "Frequency":                            { uz: "Tezligi" },
  "Monthly pay·t":                        { uz: "Oylik to'lov" },
  "Total interest":                       { uz: "Jami foiz" },
  "DSCR":                                 { uz: "DSCR" },
  "Capital base":                         { uz: "Kapital asosi" },
  "Not allocated yet.":                   { uz: "Hali taqsimlanmagan." },
  "100% allocated":                       { uz: "100% taqsimlangan" },

  // === Assistant chat ===
  "Ask the AI":                           { uz: "AI dan so'rang" },
  "Online":                               { uz: "Onlayn" },
  "Suggested questions":                  { uz: "Tavsiya etilgan savollar" },
  "Ask a question, or hit the mic to fill the form":
                                          { uz: "Savol bering yoki shaklni to'ldirish uchun mikrofonni bosing" },
  "Listening… speak in Uzbek, Russian or English":
                                          { uz: "Tinglayapman... O'zbek, Rus yoki Ingliz tilida gapiring" },
  "Speak — I'll fill the form":           { uz: "Gapiring — men shaklni to'ldiraman" },
  "Stop recording":                       { uz: "Yozishni to'xtatish" },
  "Reset":                                { uz: "Boshidan" },
  "Grounded · uz / ru / en voice supported":
                                          { uz: "Asoslangan · O'zbek / Rus / Ingliz nutqi" },
  "thinking…":                            { uz: "o'ylayapti..." },
  "transcribing…":                        { uz: "matnga aylantirilmoqda..." },

  // === Contact gate (replaces login) ===
  "Almost there — how do we reach you?":  { uz: "Deyarli tayyor — siz bilan qanday bog'lanamiz?" },
  "Your analysis is ready. Leave a name and number so a banker can call you about it — no account needed.":
                                          { uz: "Tahlilingiz tayyor. Bankir siz bilan bog'lana olishi uchun ism va raqam qoldiring — hisob kerak emas." },
  "Your name":                            { uz: "Ismingiz" },
  "e.g. Sardor Aliyev":                   { uz: "masalan, Sardor Aliyev" },
  "Phone number":                         { uz: "Telefon raqami" },
  "Enter your name and a valid phone number to continue.":
                                          { uz: "Davom etish uchun ism va to'g'ri telefon raqamini kiriting." },
  "Show my analysis":                     { uz: "Tahlilimni ko'rsatish" },
  "We only share your contact with the bank reviewing this deal.":
                                          { uz: "Kontaktingizni faqat ushbu bitimni ko'rib chiqayotgan bank bilan bo'lishamiz." },

  // === Common ===
  "Loading…":                             { uz: "Yuklanmoqda..." },
  "Save & recompute":                     { uz: "Saqlash va qayta hisoblash" },
  "Required":                             { uz: "Majburiy" },
  "Optional ·":                           { uz: "Ixtiyoriy ·" },
  "Select…":                              { uz: "Tanlang..." },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "uz";
    return ((localStorage.getItem(STORAGE_KEY) as Lang) || "uz");
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (key: string) => {
      if (lang === "en") return key;
      const entry = DICT[key];
      return entry?.uz ?? key;
    },
  }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx.t;
}
export function useLang() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
