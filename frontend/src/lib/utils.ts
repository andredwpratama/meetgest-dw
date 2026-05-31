import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-[#8CC0EB]/30 text-[#1E293B]",
  "bg-[#BFDDF0]/40 text-[#1E293B]",
  "bg-[#FFEBCC]/40 text-[#1E293B]",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
];

export function getAvatarBg(name: string): string {
  if (!name) return "bg-slate-100 text-slate-400";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { dateStyle: "medium" } as Intl.DateTimeFormatOptions);
}

export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.toLocaleDateString(undefined, { dateStyle: "medium" } as Intl.DateTimeFormatOptions)} at ${d.toLocaleTimeString(undefined, { timeStyle: "short" } as Intl.DateTimeFormatOptions)}`;
}

export function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "meeting-notes";
}
