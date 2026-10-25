"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { createFirstAdmin, type FirstAdminError } from "./first-admin";

export interface SetupState {
  error?: FirstAdminError;
  email?: string;
}

export async function setupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const email = String(formData.get("email") ?? "");
  const result = await createFirstAdmin(db, {
    configuredToken: process.env.SETUP_TOKEN,
    givenToken: String(formData.get("token") ?? ""),
    email,
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!result.ok) return { error: result.error, email };
  redirect("/login");
}
