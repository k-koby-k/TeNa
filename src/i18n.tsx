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
  // === Bank loan-application form ("Loyiha pasporti") ===
  "Interest rate":                        { uz: "Kredit foizi" },
  "% per year":                           { uz: "% yillik" },
  "e.g. 19.5":                            { uz: "masalan, 19.5" },
  "State fund compensation":              { uz: "Davlat jamg'armasi kompensatsiyasi" },
  "% subtracted from the rate":           { uz: "foizdan ayiriladi" },
  "e.g. 4.2":                             { uz: "masalan, 4.2" },
  "Repayment at these terms":             { uz: "Ushbu shartlar bo'yicha to'lov" },
  "Effective rate":                       { uz: "Amaldagi foiz" },
  "after compensation":                   { uz: "kompensatsiyadan keyin" },
  "Monthly payment":                      { uz: "Oylik to'lov" },
  "UZS / month":                          { uz: "so'm / oy" },
  "During grace":                         { uz: "Imtiyozli davrda" },
  "interest only":                        { uz: "faqat foiz" },
  "over the term":                        { uz: "butun muddat uchun" },
  "Total project cost":                   { uz: "Loyihaning umumiy summasi" },
  "own funds + credit":                   { uz: "o'z mablag'i + kredit" },
  "Bank credit":                          { uz: "Bank krediti" },
  "Own funds share":                      { uz: "O'z mablag'i ulushi" },
  "Own funds":                            { uz: "O'z mablag'i" },
  "state programmes expect 20–30%":       { uz: "davlat dasturlari 20–30% talab qiladi" },
  "Goods and services to be purchased":   { uz: "Sotib olinadigan tovar va xizmatlar" },
  "The bank asks for the items themselves, not only percentages.":
                                          { uz: "Bank foizlarni emas, aniq narsalar ro'yxatini so'raydi." },
  "+ Add item":                           { uz: "+ Qo'shish" },
  "No items yet — optional, but strengthens the application.":
                                          { uz: "Hali ro'yxat yo'q — ixtiyoriy, lekin arizani kuchaytiradi." },
  "e.g. Coffee machine":                  { uz: "masalan, Qahva mashinasi" },
  "qty":                                  { uz: "soni" },
  "unit price, UZS":                      { uz: "dona narxi, so'm" },
  "Items total":                          { uz: "Ro'yxat jami" },
  "UZS":                                  { uz: "so'm" },
  "What secures the loan. The bank requires an independent appraisal per asset.":
                                          { uz: "Kreditni nima ta'minlaydi. Bank har bir aktiv uchun mustaqil baholashni talab qiladi." },
  "Pledged assets":                       { uz: "Garovga qo'yilgan aktivlar" },
  "Each asset valued separately by an independent appraiser.":
                                          { uz: "Har bir aktiv mustaqil baholovchi tomonidan alohida baholanadi." },
  "+ Add asset":                          { uz: "+ Aktiv qo'shish" },
  "No collateral pledged — the loan will be assessed as unsecured.":
                                          { uz: "Garov qo'yilmagan — kredit ta'minlanmagan sifatida baholanadi." },
  "Description and address":              { uz: "Tavsif va manzil" },
  "appraised value, UZS":                 { uz: "baholangan qiymat, so'm" },
  "area, m²":                             { uz: "maydon, m²" },
  "appraiser":                            { uz: "baholovchi" },
  "Total appraised value":                { uz: "Jami baholangan qiymat" },
  "State guarantee fund used?":           { uz: "Davlat kafolat jamg'armasi ishlatiladimi?" },
  "Entrepreneurship Support Fund":        { uz: "Tadbirkorlikni qo'llab-quvvatlash jamg'armasi" },
  "Trading history":                      { uz: "Savdo tarixi" },
  "The bank asks for the last 12 months of account turnover.":
                                          { uz: "Bank oxirgi 12 oylik hisob raqami aylanmasini so'raydi." },
  "Is the business already trading?":     { uz: "Biznes allaqachon ishlayaptimi?" },
  "changes how the loan is assessed":     { uz: "kredit baholash usulini o'zgartiradi" },
  "Taxpayer ID (STIR)":                   { uz: "Soliq to'lovchi raqami (STIR)" },
  "optional · if already registered":     { uz: "ixtiyoriy · ro'yxatdan o'tgan bo'lsangiz" },
  "e.g. 303 909 808":                     { uz: "masalan, 303 909 808" },
  "12-month turnover — credit (in)":      { uz: "12 oylik aylanma — kirim (K-t)" },
  "UZS · money received":                 { uz: "so'm · tushgan mablag'" },
  "12-month turnover — debit (out)":      { uz: "12 oylik aylanma — chiqim (D-t)" },
  "UZS · money paid out":                 { uz: "so'm · sarflangan mablag'" },
  "e.g. 122 040 000":                     { uz: "masalan, 122 040 000" },
  "New business — the agents will project revenue instead of reading turnover history.":
                                          { uz: "Yangi biznes — agentlar aylanma tarixini o'qish o'rniga daromadni bashorat qiladi." },
  "Administrative address":               { uz: "Ma'muriy manzil" },
  "Region (viloyat)":                     { uz: "Viloyat" },
  "bank form requirement":                { uz: "bank formasi talabi" },
  "e.g. Qashqadaryo":                     { uz: "masalan, Qashqadaryo" },
  "Neighbourhood (MFY)":                  { uz: "Mahalla (MFY)" },
  "state programmes are scoped by MFY":   { uz: "davlat dasturlari MFY bo'yicha belgilanadi" },
  "e.g. Navoiy mahallasi":                { uz: "masalan, Navoiy mahallasi" },
  "District (tuman)":                     { uz: "Tuman" },
  "from map pin":                         { uz: "xarita belgisidan" },
  "mo grace":                             { uz: "oy imtiyoz" },
  "min 1.25":                             { uz: "min 1.25" },
  "unsecured":                            { uz: "ta'minlanmagan" },

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
  "allocated":                            { uz: "taqsimlangan" },
  "months":                               { uz: "oy" },
  "Net income ÷ payment":                 { uz: "Sof daromad ÷ to'lov" },

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

  // === Overview chrome / breadcrumb / completion ===
  "AI Decision Cockpit":                  { uz: "AI qaror kabineti" },
  "6 flagship models active":             { uz: "6 ta yetakchi model faol" },
  "Profile required":                     { uz: "Profil talab qilinadi" },
  "No agents run yet":                    { uz: "Hali agentlar ishlamadi" },
  "All agents complete":                  { uz: "Barcha agentlar tugadi" },
  "of 3 agents complete":                 { uz: "/ 3 agent tugadi" },

  // === Recommendation header ===
  "Scenario":                             { uz: "Stsenariy" },
  "Engine v1.4":                          { uz: "Tizim v1.4" },
  "Analysis in progress":                 { uz: "Tahlil jarayonda" },
  "Yes, open here":                       { uz: "Ha, oching" },
  "Recommend Launch":                     { uz: "Boshlashni tavsiya etamiz" },
  "Proceed with caution":                 { uz: "Ehtiyotkorlik bilan" },
  "Not recommended":                      { uz: "Tavsiya etilmaydi" },
  "confidence":                           { uz: "ishonch" },
  "of 3 metrics done":                    { uz: "/ 3 ko'rsatkich bajarildi" },
  "Recommendation engine v1.4 · 6 flagship models":
                                          { uz: "Tavsiya tizimi v1.4 · 6 ta yetakchi model" },
  "Showing what's known so far.":         { uz: "Hozircha ma'lum bo'lgan ma'lumotlar." },
  "Run the remaining agents to lock in the final recommendation.":
                                          { uz: "Yakuniy tavsiyani aniqlash uchun qolgan agentlarni ishga tushiring." },
  "Share":                                { uz: "Ulashish" },
  "Export PDF":                           { uz: "PDF yuklab olish" },

  // === KPI labels ===
  "Market Opportunity":                   { uz: "Bozor imkoniyati" },
  "Demand Forecast":                      { uz: "Talab prognozi" },
  "Location Score":                       { uz: "Joylashuv bahosi" },
  "Viability Score":                      { uz: "Hayotiylik bahosi" },
  "Credit Readiness":                     { uz: "Kredit tayyorligi" },

  // === Demand card ===
  "12-month forecast":                    { uz: "12 oylik prognoz" },
  "Actual":                               { uz: "Haqiqiy" },
  "Forecast":                             { uz: "Prognoz" },
  "Customer-intent index, indexed to district avg = 100":
                                          { uz: "Mijoz qiziqishi indeksi, tuman o'rtachasi = 100" },
  "Demand forecast":                      { uz: "Talab prognozi" },
  "The dedicated demand-forecasting agent isn't live yet — this panel will show the 12-month forecast once it is. It does not affect the current composite score.":
                                          { uz: "Maxsus talab prognozi agenti hali ishga tushmagan — u ishga tushgach, bu panel 12 oylik prognozni ko'rsatadi. Bu joriy yig'ma bahoga ta'sir qilmaydi." },

  // === Score formula card ===
  "Demand":                               { uz: "Talab" },
  "Financial":                            { uz: "Moliyaviy" },
  "Risk":                                 { uz: "Xavf" },
  "score":                                { uz: "baho" },
  "risk":                                 { uz: "xavf" },
  "not run":                              { uz: "ishlamadi" },
  "Engine v1.4 · transparent linear policy":
                                          { uz: "Tizim v1.4 · shaffof chiziqli siyosat" },

  // === Market size card ===
  "Market sizing · M-A1":                 { uz: "Bozor hajmi · M-A1" },
  "Billion UZS · Y1":                     { uz: "Milliard UZS · 1-yil" },

  // === Bank action card ===
  "Bank decision support · M-F1 · M-F2":  { uz: "Bank qarorini qo'llab-quvvatlash · M-F1 · M-F2" },
  "Recommended product":                  { uz: "Tavsiya etilgan mahsulot" },
  "Suggested":                            { uz: "Taklif etilgan" },
  "Product":                              { uz: "Mahsulot" },
  "Loan size":                            { uz: "Kredit hajmi" },
  "24 months · 3M grace":                 { uz: "24 oy · 3 oy imtiyoz" },
  "Conditions & next actions":            { uz: "Shartlar va keyingi qadamlar" },

  // === Borrower card (own card) ===
  "Business owner":                       { uz: "Biznes egasi" },
  "Unnamed business":                     { uz: "Nomsiz biznes" },
  "Planned headcount":                    { uz: "Rejalashtirilgan xodimlar" },
  "Co-signer":                            { uz: "Kafil" },

  // === Locked / fill-to-see states ===
  "agent is locked":                      { uz: "agenti bloklangan" },
  "Fill the business profile first so the agent has context to ground its analysis.":
                                          { uz: "Avval biznes profilini to'ldiring, shunda agent tahlil uchun kontekstga ega bo'ladi." },
  "Open Profile":                         { uz: "Profilni ochish" },
  "not run yet":                          { uz: "hali ishlamadi" },
  "Open":                                 { uz: "Ochish" },
  "Fill the":                             { uz: "Quyidagini to'ldiring:" },
  "agent to see":                         { uz: "agentini ko'rish uchun" },
  "TAM / SAM / SOM and saturation index": { uz: "TAM / SAM / SOM va to'yinganlik indeksi" },
  "Decision support · human-in-the-loop · audit log enabled · Recommendation engine v1.4":
                                          { uz: "Qaror qo'llab-quvvatlash · inson nazoratida · audit jurnali yoqilgan · Tavsiya tizimi v1.4" },

  // === Orchestrator copy ===
  "Agents auto-ran when you opened this view. Adjust inputs and re-run for a refreshed verdict.":
                                          { uz: "Bu sahifani ochganingizda agentlar avtomatik ishladi. Ma'lumotlarni o'zgartirib, yangilangan xulosa uchun qayta ishga tushiring." },
  "Location, Market and Financials run in parallel, then Synthesis combines them. Typical total time ≈ 15–30 seconds.":
                                          { uz: "Joylashuv, Bozor va Moliya parallel ishlaydi, so'ng Sintez ularni birlashtiradi. Odatda ≈ 15–30 soniya." },
  "Synthesis":                            { uz: "Sintez" },
  "AI synthesis · bank product":          { uz: "AI sintezi · bank mahsuloti" },
  "Missing required inputs:":             { uz: "Zarur ma'lumotlar yetishmayapti:" },
  "Walk back through the wizard to fill them.":
                                          { uz: "Ularni to'ldirish uchun bosqichlarga qayting." },
  "business type":                        { uz: "biznes turi" },
  "map pin":                              { uz: "xarita belgisi" },
  "average ticket":                       { uz: "o'rtacha chek" },
  "customers/day":                        { uz: "kuniga mijozlar" },
  "monthly rent":                         { uz: "oylik ijara" },
  "startup capital":                      { uz: "boshlang'ich kapital" },
  "Selected site":                        { uz: "Tanlangan manzil" },
  "Anchors driving traffic":              { uz: "Oqim keltiruvchi nuqtalar" },
  "None found nearby — clean slate.":     { uz: "Yaqin atrofda topilmadi — toza maydon." },
  "Competitor data unavailable for this pin — score is a conservative estimate.":
                                          { uz: "Bu nuqta uchun raqobatchi ma'lumotlari mavjud emas — baho ehtiyotkorona taxmin." },
  "Mall":                                 { uz: "Savdo markazi" },
  "Re-pin to a different place — e.g. 'Mustaqillik Square', 'Inha University'…":
                                          { uz: "Boshqa joyga belgi qo'ying — masalan, 'Mustaqillik maydoni', 'Inha universiteti'…" },
  "Re-run agent after re-pinning":        { uz: "Belgini ko'chirgach agentni qayta ishga tushiring" },
  "Composite — foot traffic × anchors × competition":
                                          { uz: "Yig'ma — piyodalar oqimi × nuqtalar × raqobat" },
  "Walk":                                 { uz: "Piyoda" },
  "Comp 500m":                            { uz: "Raqobat 500m" },
  "Competitors within 1 km":              { uz: "1 km ichidagi raqobatchilar" },
  "total":                                { uz: "jami" },
  "within 500m":                          { uz: "500m ichida" },
  "more on the map":                      { uz: "xaritada ko'proq" },
  "No anchors within 800m — relies entirely on direct walk-by.":
                                          { uz: "800m ichida nuqtalar yo'q — to'liq o'tib ketuvchilarga bog'liq." },
  "OSM coverage is sparse around this point — the score is a conservative estimate.":
                                          { uz: "Bu nuqta atrofida OSM ma'lumotlari kam — baho ehtiyotkorona taxmin." },
  "Site pinned · agent not run yet":      { uz: "Manzil belgilandi · agent hali ishlamadi" },
  "Run the analysis above and this panel will show real competitors, anchors and the agent's reasoning for the location score.":
                                          { uz: "Yuqorida tahlilni ishga tushiring va bu panel haqiqiy raqobatchilar, nuqtalar va joylashuv bahosi izohini ko'rsatadi." },

  // === Explainability / History (CategoryView) ===
  "Governance · agent registry":          { uz: "Boshqaruv · agentlar reestri" },
  "Explainability & model metadata":      { uz: "Tushuntirish va model ma'lumotlari" },
  "Every agent that ran for the current scenario, with its version, confidence and model lineage. Confidence of 0 means the agent was not invoked yet.":
                                          { uz: "Joriy stsenariy uchun ishlagan har bir agent, uning versiyasi, ishonch darajasi va model kelib chiqishi bilan ko'rsatiladi. Ishonch 0 bo'lsa, agent hali chaqirilmagan." },
  "No analysis run yet — go to Overview and press":
                                          { uz: "Hali tahlil ishlamagan — Umumiy ko'rinishga o'ting va bosing:" },
  "Confidence":                           { uz: "Ishonch" },
  "ran":                                  { uz: "ishladi" },
  "Not invoked for this scenario":        { uz: "Bu stsenariy uchun chaqirilmagan" },
  "Decision support · human-in-the-loop · audit log enabled · agents and the synthesis layer all run on Gemini 2.5 Flash with structured-output schemas.":
                                          { uz: "Qaror qo'llab-quvvatlash · inson nazoratida · audit jurnali yoqilgan · agentlar va sintez qatlami Gemini 2.5 Flash asosida tuzilgan chiqish sxemalari bilan ishlaydi." },
  "Not now":                              { uz: "Hozir emas" },
  "Today":                                { uz: "Bugun" },
  "Yesterday":                            { uz: "Kecha" },
  "My workspace · analysis history":      { uz: "Mening ish maydonim · tahlillar tarixi" },
  "My Analyses":                          { uz: "Mening tahlillarim" },
  "My analyses":                          { uz: "Mening tahlillarim" },
  "Scenarios analyzed by this account. The bank Deal Pipeline includes these plus businesses sourced from other founders and partners.":
                                          { uz: "Ushbu hisob tomonidan tahlil qilingan stsenariylar. Bank bitimlar jarayoni bularga qo'shimcha, boshqa tadbirkorlar va hamkorlardan kelgan bizneslarni ham o'z ichiga oladi." },
  "Search analyses…":                     { uz: "Tahlillarni qidirish..." },
  "Sorted by most recent":                { uz: "Eng so'nggisi bo'yicha saralangan" },
  "Failed to load history:":              { uz: "Tarixni yuklab bo'lmadi:" },
  "Run your first analysis — it'll show up here.":
                                          { uz: "Birinchi tahlilingizni ishga tushiring — u shu yerda paydo bo'ladi." },
  "composite":                            { uz: "yig'ma" },

  // === Sidebar ===
  "Complete the previous step first":     { uz: "Avval oldingi qadamni yakunlang" },
  "LIVE":                                 { uz: "JONLI" },
  "now":                                  { uz: "hozir" },
  "m":                                    { uz: "d" },
  "h":                                    { uz: "s" },
  "d":                                    { uz: "k" },

  // === Profile setup — business types & extra copy ===
  "Coffee shop":                          { uz: "Qahvaxona" },
  "Restaurant":                           { uz: "Restoran" },
  "Bakery":                               { uz: "Nonvoyxona" },
  "Pharmacy":                             { uz: "Dorixona" },
  "Beauty salon":                         { uz: "Go'zallik saloni" },
  "Mini-market":                          { uz: "Mini-market" },
  "Gym":                                  { uz: "Sport zali" },
  "Dental clinic":                        { uz: "Stomatologiya klinikasi" },
  "Pet shop":                             { uz: "Uy hayvonlari do'koni" },
  "Bookstore":                            { uz: "Kitob do'koni" },
  "Identity and concept only. The Location agent picks the district from your map pin. The clearer the description, the sharper the Market agent's TAM/SAM/SOM.":
                                          { uz: "Faqat shaxsiy ma'lumot va kontseptsiya. Joylashuv agenti tumanni xarita belgisidan aniqlaydi. Tavsif qanchalik aniq bo'lsa, Bozor agentining TAM/SAM/SOM hisobi shunchalik aniq bo'ladi." },
  "how it'll show up on the dashboard":   { uz: "boshqaruv panelida qanday ko'rinishi" },
  "e.g. Black Bean Co.":                  { uz: "masalan, Black Bean Co." },
  "Select type…":                         { uz: "Turni tanlang..." },
  "positioning across the category":      { uz: "toifadagi pozitsiyalash" },
  "1–4 sentences — niche, customer, what makes it different":
                                          { uz: "1–4 gap — nisha, mijoz, nima bilan farq qiladi" },
  "e.g. Premium specialty coffee shop targeting young professionals near a metro. On-site roasting, evening dessert pairings, work-friendly seating with fast wifi.":
                                          { uz: "masalan, metro yaqinida yosh mutaxassislarga mo'ljallangan premium ixtisoslashgan qahvaxona. O'z joyida qovurish, kechki desert kombinatsiyalari, tez wifili qulay o'tirish joylari." },
  "materially shifts credit risk":        { uz: "kredit xavfini sezilarli o'zgartiradi" },
  "Fill the required fields to unlock the agents.":
                                          { uz: "Agentlarni ochish uchun majburiy maydonlarni to'ldiring." },
  "Pin the site on a real map; agent fetches competitors + anchors and derives the district.":
                                          { uz: "Manzilni haqiqiy xaritada belgilang; agent raqobatchilar va diqqatga sazovor nuqtalarni olib, tumanni aniqlaydi." },
  "Provide the commercial inputs (ticket, customers/day, reach) — agent sizes TAM/SAM/SOM.":
                                          { uz: "Tijorat ma'lumotlarini kiriting (chek, kuniga mijozlar, qamrov) — agent TAM/SAM/SOM hajmini hisoblaydi." },
  "Capital, loan and horizon — agent infers the rest from sector benchmarks.":
                                          { uz: "Kapital, kredit va muddat — qolganini agent soha ko'rsatkichlaridan chiqaradi." },
  "agent":                                { uz: "agenti" },
  "File is over 20 MB.":                  { uz: "Fayl hajmi 20 MB dan katta." },
  "Drop a PDF (deck, business plan, one-pager) and the agent pre-fills as much of the profile as it can. You can edit anything afterwards.":
                                          { uz: "PDF (taqdimot, biznes-reja, bir sahifalik hujjat) tashlang va agent profilni imkon qadar oldindan to'ldiradi. Keyinchalik istalgan maydonni tahrirlashingiz mumkin." },
  "…or drag-and-drop here · max 20 MB":   { uz: "...yoki shu yerga sudrab tashlang · maksimal 20 MB" },
  "Reading":                              { uz: "O'qilmoqda:" },
  "with Gemini…":                         { uz: "Gemini yordamida..." },
  "try again":                            { uz: "qayta urinish" },
  "Remove":                               { uz: "O'chirish" },
  "field(s) pre-filled":                  { uz: "ta maydon oldindan to'ldirildi" },
  "Edit any field below — the deck is just a starting point.":
                                          { uz: "Quyidagi istalgan maydonni tahrirlang — hujjat faqat boshlang'ich nuqta." },
  "Type":                                 { uz: "Turi" },
  "Description":                          { uz: "Tavsif" },
  "Audience":                             { uz: "Auditoriya" },
  "Experience":                           { uz: "Tajriba" },
  "Capital":                              { uz: "Kapital" },
  "Rent":                                 { uz: "Ijara" },
  "Loan":                                 { uz: "Kredit" },
  "Avg ticket":                           { uz: "O'rtacha chek" },
  "Fill business name, type, and concept description to continue.":
                                          { uz: "Davom etish uchun biznes nomi, turi va kontseptsiya tavsifini to'ldiring." },
  "Profile complete. Pin the site on a real map next.":
                                          { uz: "Profil to'liq. Endi manzilni haqiqiy xaritada belgilang." },

  // === Assistant chat — extra coverage ===
  "Hi — I'm your **Business Case Assistant**. Type a question, or hit the mic and tell me about your business in Uzbek, Russian or English — I'll fill the form for you.":
                                          { uz: "Salom — men sizning **Biznes case yordamchingizman**. Savol yozing yoki mikrofonni bosib, biznesingiz haqida o'zbek, rus yoki ingliz tilida gapiring — men shaklni siz uchun to'ldiraman." },
  "Microphone API not available in this browser.":
                                          { uz: "Ushbu brauzerda mikrofon API mavjud emas." },
  "Microphone permission denied.":        { uz: "Mikrofonga ruxsat berilmadi." },
  "(no speech detected — try again)":     { uz: "(nutq aniqlanmadi — qayta urinib ko'ring)" },
  "Got it — captured":                    { uz: "Qabul qilindi — aniqlangan maydonlar soni:" },
  "field(s)":                             { uz: "ta" },
  "Got it, but I didn't catch any specific business details. Try repeating with more detail (business type, district, capital).":
                                          { uz: "Qabul qilindi, lekin aniq biznes ma'lumotlarini ilg'ay olmadim. Ko'proq tafsilot bilan qayta gapirib ko'ring (biznes turi, tuman, kapital)." },
  "Voice transcription failed:":          { uz: "Ovozni matnga aylantirish muvaffaqiyatsiz tugadi:" },
  "Business Case Assistant":              { uz: "Biznes case yordamchisi" },
  "Ask the AI · grounded in this analysis": { uz: "AI dan so'rang · shu tahlilga asoslangan" },
  "loan":                                 { uz: "kredit" },
  "6 flagship models":                    { uz: "6 ta yetakchi model" },
  "No analysis yet — fill the form and recompute":
                                          { uz: "Hali tahlil yo'q — shaklni to'ldiring va qayta hisoblang" },
  "Why is the recommendation 'Proceed with caution'?":
                                          { uz: "Nega tavsiya 'Ehtiyotkorlik bilan davom eting'?" },
  "What are the biggest risks for this Chilonzor coffee shop?":
                                          { uz: "Ushbu Chilonzordagi qahvaxona uchun eng katta xavflar qanday?" },
  "How can I improve the credit readiness score?":
                                          { uz: "Kredit tayyorligi bahosini qanday oshirsam bo'ladi?" },
  "Compare Chilonzor vs Yunusobod for this concept.":
                                          { uz: "Ushbu kontseptsiya uchun Chilonzor va Yunusobodni solishtiring." },
  "name":                                 { uz: "ism" },
  "type":                                 { uz: "turi" },
  "format":                               { uz: "format" },
  "stage":                                { uz: "bosqich" },
  "description":                          { uz: "tavsif" },
  "audience":                             { uz: "auditoriya" },
  "experience":                           { uz: "tajriba" },
  "district":                             { uz: "tuman" },
  "niche":                                { uz: "nisha" },
  "capital":                              { uz: "kapital" },
  "rent":                                 { uz: "ijara" },
  "ticket":                               { uz: "chek" },

  // === Banker queue — extra coverage ===
  "Loan-ready businesses from founders and partner analyses. Use this view to source qualified SME borrowers for bank relationship managers.":
                                          { uz: "Tadbirkorlar va hamkorlar tahlillaridan kelib chiqqan kreditga tayyor bizneslar. Ushbu ko'rinishdan bank aloqalar menejerlari uchun malakali MSB qarz oluvchilarni tanlashda foydalaning." },
  "All deals":                            { uz: "Barcha bitimlar" },
  "Ready":                                { uz: "Tayyor" },
  "Conditional":                          { uz: "Shartli" },
  "Source":                               { uz: "Manba" },
  "All sources":                          { uz: "Barcha manbalar" },
  "Marketplace":                          { uz: "Bozor maydonchasi" },
  "Any score":                            { uz: "Istalgan baho" },
  "70+ strong":                           { uz: "70+ kuchli" },
  "50-69 conditional":                    { uz: "50-69 shartli" },
  "Below 50 decline":                     { uz: "50 dan past rad etish" },
  "Sort":                                 { uz: "Saralash" },
  "of":                                   { uz: "/" },
  "deals":                                { uz: "bitim" },
  "Rec.":                                 { uz: "Tavsiya" },
  "Business":                             { uz: "Biznes" },
  "Composite":                            { uz: "Yig'ma" },
  "Sub-scores":                           { uz: "Kichik baholar" },
  "Submitted":                            { uz: "Yuborilgan" },
  "flagged for launch":                   { uz: "ishga tushirish uchun belgilangan" },
  "Borderline — relationship-manager call": { uz: "Chegara holati — aloqalar menejeri qo'ng'irog'i kerak" },
  "TeNa flagged before disbursement":     { uz: "TeNa mablag' berishdan oldin aniqladi" },
  "My analysis":                          { uz: "Mening tahlilim" },
  "owner":                                { uz: "egasi" },
  "No contact number":                    { uz: "Kontakt raqami yo'q" },

  // === Borrower/loan card — extra coverage ===
  "y":                                    { uz: "yil" },
  "failed":                               { uz: "muvaffaqiyatsiz" },
  "Unregistered":                         { uz: "Ro'yxatdan o'tmagan" },
  "Sole proprietor":                      { uz: "Yakka tartibdagi tadbirkor" },
  "LLC":                                  { uz: "MChJ" },
  "Joint-stock":                          { uz: "Aksiyadorlik jamiyati" },

  // === Financials agent — extra coverage ===
  "The same questions a credit officer would ask. The viability agent reads all of this from the Overview and produces breakeven, ROI, DTI and a recommended product.":
                                          { uz: "Kredit ofitseri so'raydigan xuddi shu savollar. Hayotiylik agenti buning barchasini Umumiy ko'rinishdan o'qiydi va breakeven, ROI, DTI va tavsiya etilgan mahsulotni hisoblaydi." },
  "How much, from where, spent on what.": { uz: "Qancha, qayerdan, nimaga sarflanadi." },
  "UZS · what you put in":                { uz: "UZS · o'zingiz kiritgan mablag'" },
  "UZS · 0 if no loan":                   { uz: "UZS · kredit bo'lmasa 0" },
  "months without principal repayment":   { uz: "asosiy qarz to'lanmaydigan oylar" },
  "How the total capital (founder + loan) is spent. Type % directly.":
                                          { uz: "Jami kapital (asoschi + kredit) qanday sarflanishi. Foizni to'g'ridan-to'g'ri kiriting." },
  "Allocation preview":                   { uz: "Taqsimot ko'rinishi" },
  "0% allocated":                         { uz: "0% taqsimlangan" },
  "over":                                 { uz: "ortiqcha" },
  "remaining":                            { uz: "qoldi" },
  "What secures the loan.":               { uz: "Kreditni nima ta'minlaydi." },
  "UZS · only if applicable":             { uz: "UZS · agar mavjud bo'lsa" },
  "Co-signer relationship":               { uz: "Kafil bilan munosabat" },
  "e.g. spouse, parent, business partner": { uz: "masalan, turmush o'rtog'i, ota-ona, biznes hamkori" },
  "Used for debt-to-income.":             { uz: "Qarz/daromad nisbati uchun ishlatiladi." },
  "M UZS / month":                        { uz: "mln UZS / oy" },
  "M UZS · salary, rentals, etc.":        { uz: "mln UZS · maosh, ijara va h.k." },
  "people in the household":              { uz: "oiladagi jon soni" },
  "What's the worst case, and how do you cover it?":
                                          { uz: "Eng yomon holat qanday, va uni qanday qoplaysiz?" },
  "in your own words":                    { uz: "o'z so'zlaringiz bilan" },
  "e.g. Local saturation; weekend competition; supply-chain delays for premium beans":
                                          { uz: "masalan, mahalliy to'yinganlik; dam olish kunlari raqobat; premium loviya yetkazib berishdagi kechikishlar" },
  "months of personal funds if revenue misses":
                                          { uz: "daromad kutilganidek bo'lmasa, shaxsiy mablag' yetadigan oylar" },
  "Run-rate costs the agent can't infer.": { uz: "Agent chiqara olmaydigan joriy xarajatlar." },
  "M UZS · utilities, software, accounting, cleaning":
                                          { uz: "mln UZS · kommunal, dasturiy ta'minot, buxgalteriya, tozalash" },
  "months until full capacity":           { uz: "to'liq quvvatgacha bo'lgan oylar" },
  "Provide founder capital, loan amount, and monthly rent to continue.":
                                          { uz: "Davom etish uchun asoschi kapitali, kredit miqdori va oylik ijarani kiriting." },
  "All inputs captured. Open the Overview to run the full agentic analysis.":
                                          { uz: "Barcha ma'lumotlar kiritildi. To'liq agentli tahlilni ishga tushirish uchun Umumiy ko'rinishni oching." },

  // === Location agent — extra coverage ===
  "Search or click the map to pin the candidate site, then add the lease facts you know. The Location agent will run from the Overview to fetch real competitors and synthesise the score.":
                                          { uz: "Xarita orqali qidiring yoki bosing va nomzod manzilni belgilang, so'ng bilgan ijara ma'lumotlaringizni qo'shing. Joylashuv agenti Umumiy ko'rinishdan ishga tushib, haqiqiy raqobatchilarni oladi va bahoni hisoblaydi." },
  "Type a place name — 'Magic City', 'Chilonzor metro', 'Mustaqillik'…":
                                          { uz: "Joy nomini yozing — 'Magic City', 'Chilonzor metro', 'Mustaqillik'..." },
  "Pick from the results, or click anywhere on the map below to drop a pin manually.":
                                          { uz: "Natijalardan birini tanlang yoki quyidagi xaritada istalgan joyga bosib, belgi qo'ying." },
  "· 500 m solid · 1 km dashed":          { uz: "· 500 m yaxlit · 1 km chiziqli" },
  "click map or search to pin":           { uz: "belgilash uchun xaritani bosing yoki qidiring" },
  "sqm":                                  { uz: "kv.m" },
  "affects visibility":                   { uz: "ko'rinishga ta'sir qiladi" },
  "Short (≤ 8h)":                         { uz: "Qisqa (≤ 8 soat)" },
  "Standard (8–12h)":                     { uz: "Standart (8–12 soat)" },
  "Long (12–18h)":                        { uz: "Uzun (12–18 soat)" },
  "24 hours":                             { uz: "24 soat" },
  "Street-front":                         { uz: "Ko'cha old tomoni" },
  "Inside an office building":            { uz: "Ofis binosi ichida" },
  "Mall / shopping centre":               { uz: "Savdo markazi" },
  "Basement / underground":               { uz: "Yer osti / podval" },
  "Limited":                              { uz: "Cheklangan" },
  "Good":                                 { uz: "Yaxshi" },
  "All site facts are optional but improve the agent's score.":
                                          { uz: "Barcha manzil ma'lumotlari ixtiyoriy, lekin agent bahosini yaxshilaydi." },
  "Pin a site on the map to continue.":   { uz: "Davom etish uchun xaritada manzilni belgilang." },
  "Site captured. Next: tell the Market agent your commercial plan.":
                                          { uz: "Manzil belgilandi. Keyingi qadam: Bozor agentiga tijorat rejangizni ayting." },

  // === Market agent — extra coverage ===
  "The numbers only you know — what one customer spends, how many you expect, how they find you. The Market agent will run from the Overview to size TAM / SAM / SOM.":
                                          { uz: "Faqat siz biladigan raqamlar — bitta mijoz qancha sarflaydi, nechta mijoz kutyapsiz, sizni qanday topishadi. Bozor agenti Umumiy ko'rinishdan ishga tushib TAM / SAM / SOM hajmini hisoblaydi." },
  "(set on Profile)":                     { uz: "(Profilda kiritiladi)" },
  "Read from Profile — change them on the Profile screen if needed.":
                                          { uz: "Profildan olingan — kerak bo'lsa Profil sahifasida o'zgartiring." },
  "UZS / customer · the single most important number":
                                          { uz: "UZS / mijoz · eng muhim raqam" },
  "at full capacity":                     { uz: "to'liq quvvatda" },
  "optional · name a similar shop":       { uz: "ixtiyoriy · o'xshash do'kon nomini kiriting" },
  "e.g. Caffeine, Bon!":                  { uz: "masalan, Caffeine, Bon!" },
  "agent extracts if blank":              { uz: "bo'sh qoldirilsa, agent o'zi aniqlaydi" },
  "e.g. specialty coffee":                { uz: "masalan, maxsus qahva" },
  "why customers come to you, not the competitor":
                                          { uz: "mijozlar nega raqobatchiga emas, sizga kelishadi" },
  "e.g. On-site roasting, evening dessert pairings":
                                          { uz: "masalan, o'z joyida qovurish, kechki desert kombinatsiyalari" },
  "overrides the format default":         { uz: "formatning standart qiymatini bekor qiladi" },
  "Set average ticket and customers per day to continue.":
                                          { uz: "Davom etish uchun o'rtacha chek va kunlik mijozlar sonini kiriting." },
  "Commercial plan captured. Last step: capital structure and the loan ask.":
                                          { uz: "Tijorat rejasi kiritildi. Oxirgi qadam: kapital tuzilishi va kredit so'rovi." },

  // === Overview orchestrator / center workspace — extra coverage ===
  "Skipped — one or more upstream agents failed":
                                          { uz: "O'tkazib yuborildi — bir yoki bir nechta agent ishlamadi" },
  "(unnamed)":                            { uz: "(nomsiz)" },
  "Copy link to this scenario":           { uz: "Ushbu stsenariy havolasini nusxalash" },
  "Demand · M-B1":                        { uz: "Talab · M-B1" },
  "Saturation Index":                     { uz: "To'yinganlik indeksi" },
  "Total addressable":                    { uz: "Umumiy imkoniyat" },
  "Tashkent cafe segment":                { uz: "Toshkent qahvaxona segmenti" },
  "Serviceable":                          { uz: "Xizmat ko'rsatiladigan" },
  "+ adjacent districts":                 { uz: "+ qo'shni tumanlar" },
  "Obtainable Y1":                        { uz: "1-yilda erishiladigan" },
  "Realistic year-1 share":               { uz: "1-yil uchun realistik ulush" },
  "YES":                                  { uz: "HA" },
  "MAYBE":                                { uz: "EHTIYOT BILAN" },
  "NO":                                   { uz: "YO'Q" },

  // === App shell ===
  "Hide assistant":                       { uz: "Yordamchini yashirish" },
  "Show assistant":                       { uz: "Yordamchini ko'rsatish" },

  // === Numeric field placeholders ===
  "e.g. 42 000":                          { uz: "masalan, 42 000" },
  "e.g. 150":                             { uz: "masalan, 150" },
  "e.g. 3":                               { uz: "masalan, 3" },
  "e.g. 75":                              { uz: "masalan, 75" },
  "e.g. 14 000 000":                      { uz: "masalan, 14 000 000" },
  "e.g. 180 000 000":                     { uz: "masalan, 180 000 000" },
  "e.g. 120 000 000":                     { uz: "masalan, 120 000 000" },
  "e.g. 50 000 000":                      { uz: "masalan, 50 000 000" },
  "e.g. 2":                               { uz: "masalan, 2" },
  "e.g. 8":                               { uz: "masalan, 8" },
  "e.g. 6":                               { uz: "masalan, 6" },

  // === Model names / credit products (agent-generated, matched verbatim) ===
  "Market Sizing":                        { uz: "Bozor hajmini baholash" },
  "Viability Check":                      { uz: "Hayotiylik tekshiruvi" },
  "Competitor Intelligence":              { uz: "Raqobatchilar tahlili" },
  "Credit Risk Score":                    { uz: "Kredit xavfi bahosi" },
  "Demand Forecasting":                   { uz: "Talab prognozlash" },
  "No loan requested":                    { uz: "Kredit so'ralmagan" },
  "Equipment leasing":                    { uz: "Uskunalar lizingi" },
  "Secured SME term loan":                { uz: "Garovli MSB muddatli krediti" },
  "SME term loan + guarantee":            { uz: "MSB muddatli krediti + kafolat" },
  "SME working capital":                  { uz: "MSB aylanma mablag'i" },

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
