import { env } from "../env.js";

export const paymentsEnabled = () => env.PAYMENTS_ENABLED;

/** Deposit/payment fields neutralised while payments are switched off, so
 *  every client screen falls back to the free-callback flow on its own. */
const OFF: Record<string, unknown> = {
  depositRequired: false,
  paymentRequired: false,
  depositAmountSurgery: 0,
  depositAmountSecondOpinion: 0,
  payment: null,
  paymentId: null,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Recursively rewrites plain objects/arrays; leaves Dates, Decimals etc. alone. */
export function stripPayments<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPayments) as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = k in OFF ? OFF[k] : stripPayments(v);
  }
  return out as T;
}
