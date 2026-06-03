// Anonymous identity = a signed httpOnly cookie. No login: on first visit we
// mint a random id, HMAC-sign it, and set it. Every later request carries it,
// so we can scope "my analyses" to a person and rate-limit per person.
//
// Value format: "<uid>.<hex-hmac>". The HMAC stops a client from forging
// someone else's id. Uses Web Crypto (works on Workers and Node 18+).

import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const COOKIE = "tena_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function secret(): string {
  return process.env.COOKIE_SECRET || "dev-insecure-secret-change-me";
}

/** Read + verify the uid cookie, or mint and set a fresh one. Returns the uid. */
export async function getOrSetUid(c: Context): Promise<string> {
  const raw = getCookie(c, COOKIE);
  if (raw) {
    const dot = raw.lastIndexOf(".");
    if (dot > 0) {
      const uid = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      if (timingSafeEqual(sig, await hmac(uid, secret()))) return uid;
    }
  }
  const uid = crypto.randomUUID();
  const signed = `${uid}.${await hmac(uid, secret())}`;
  setCookie(c, COOKIE, signed, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return uid;
}
