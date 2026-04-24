"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

const ToastContext = React.createContext<{
  toast: (t: Omit<ToastItem, "id">) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitives.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitives.Root
            key={t.id}
            className={cn(
              "pointer-events-auto relative flex w-full max-w-sm items-start justify-between gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 pr-6 shadow-luxe data-[state=closed]:animate-out data-[state=open]:animate-in",
              t.variant === "destructive" && "border-red-300 bg-red-50 text-red-900",
            )}
          >
            <div className="grid gap-1">
              {t.title && (
                <ToastPrimitives.Title className="text-sm font-semibold">{t.title}</ToastPrimitives.Title>
              )}
              {t.description && (
                <ToastPrimitives.Description className="text-sm opacity-90">
                  {t.description}
                </ToastPrimitives.Description>
              )}
            </div>
          </ToastPrimitives.Root>
        ))}
        <ToastPrimitives.Viewport className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-[420px] flex-col gap-2" />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
}
