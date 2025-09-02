import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Store } from "../../types/store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize address strings for deduplication
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;]/g, "")
    .replace(
      /\b(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b/g,
      ""
    )
    .trim();
}


