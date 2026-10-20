import type { MessageKey } from "@/i18n";

/** Shared result shape for form server actions. Messages are i18n keys, never raw text. */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: MessageKey;
  fieldErrors?: Record<string, MessageKey>;
  /** Technical detail of a rejected input (e.g. which field the validator refused). Shown under the message. */
  detail?: string;
}

export const initialFormState: FormState = { status: "idle" };
