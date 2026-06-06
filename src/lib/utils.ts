import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx + tailwind-merge.
 *
 * Default shadcn/ui helper — do not edit.
 * Dependencies (`clsx`, `tailwind-merge`) are installed automatically when
 * running `npx shadcn@latest init`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
