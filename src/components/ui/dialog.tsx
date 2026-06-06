"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Default shadcn/ui Dialog component — DO NOT MODIFY THIS FILE
// Placeholder for future shadcn init. Run `npx shadcn@latest add dialog` to generate the real component.

const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange?.(false)}>
      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export { Dialog };
