import type { MessageKey } from "@/i18n";

/** Shared result shape for form server actions. Messages are i18n keys, never raw text. */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: MessageKey;
  fieldErrors?: Record<string, MessageKey>;
}

export const initialFormState: FormState = { status: "idle" };
