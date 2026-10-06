import type { ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted";

/** Label + control + optional error. The shared building block for all forms (login, admin CRUD). */
export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
