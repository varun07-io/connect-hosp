import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** ₹1.2L / ₹85K — compact Indian money, for dense UI like filter hints and cards. */
export function formatCompactCurrency(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (amount >= 1_000) return `₹${Math.round(amount / 1_000)}K`;
  return `₹${amount}`;
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export function firstName(name: string) {
  const parts = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(" ");
  return parts[0] ?? name;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
