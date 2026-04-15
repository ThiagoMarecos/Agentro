/**
 * API client para Terminal SSH + AI diagnóstico
 */

import { authFetch } from "@/lib/auth";

const API_URL = "/api/v1";

// ── Exec command ────────────────────────────────────────────

export interface ExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export async function execSSHCommand(command: string): Promise<ExecResult> {
  const res = await authFetch(`${API_URL}/admin/terminal/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al ejecutar comando");
  }
  return res.json();
}

// ── AI Diagnose ─────────────────────────────────────────────

export interface DiagnoseResult {
  analysis: string;
  commands: string[];
  risk_level: "low" | "medium" | "high";
}

export async function aiDiagnose(
  serviceName: string,
  context: string
): Promise<DiagnoseResult> {
  const res = await authFetch(`${API_URL}/admin/terminal/ai-diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_name: serviceName, context }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al diagnosticar");
  }
  return res.json();
}

// ── AI Auto-Fix ─────────────────────────────────────────────

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface AutoFixResult {
  results: CommandResult[];
  summary: string;
}

export async function aiAutoFix(
  serviceName: string,
  context: string,
  commands: string[]
): Promise<AutoFixResult> {
  const res = await authFetch(`${API_URL}/admin/terminal/ai-fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_name: serviceName, context, commands }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al ejecutar fix");
  }
  return res.json();
}
