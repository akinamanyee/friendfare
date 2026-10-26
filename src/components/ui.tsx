import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Shell({ children }: { children: ReactNode }) {
  return <main className="safe-b mx-auto min-h-screen w-full max-w-xl px-5 pt-6 sm:pt-8">{children}</main>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  full?: boolean;
};

export function Button({
  variant = "primary",
  full,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "press inline-flex h-12 items-center justify-center gap-2 rounded-md px-4 text-base font-medium disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "border border-border bg-card text-foreground",
        variant === "ghost" && "text-foreground",
        variant === "danger" && "text-danger",
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({
  selected,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "press inline-flex h-12 items-center gap-2 rounded-md border px-3.5 text-base font-medium",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-base font-medium text-foreground">{label}</div>
      {children}
      {hint ? <p className="mt-2 text-sm leading-normal text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md border border-border bg-card px-3 text-base text-foreground placeholder:text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-card px-3 py-3 text-base leading-normal text-foreground placeholder:text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-border bg-card p-5", className)}>{children}</section>;
}
