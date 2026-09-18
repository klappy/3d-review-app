import contract from "../contract/capabilities.json";

export type CapClass = "read" | "write.reversible" | "write.effect" | "write.dangerous";
export type Tool = "read" | "write" | "danger";
export interface Capability {
  id: string;
  class: CapClass;
  tool: Tool;
  http: { method: string; path: string; path_inferred: boolean };
  roles: string;
  slice: string;
  section: string;
  ui_surface: string;
  notes: string;
  status: string;
  inverse: { kind: string; via?: string; provenance?: string; compensating_control?: string };
  undo_token?: boolean;
  danger?: { two_step: boolean; modes: string[]; twin_never_get: boolean; effect: string };
  public: boolean;
  params_schema?: { type?: string; properties?: Record<string, unknown>; required?: string[]; [key: string]: unknown };
  result_schema?: Record<string, unknown>;
}
export const capabilities = (contract as any).capabilities as Capability[];
export const byId = new Map(capabilities.map((c) => [c.id, c]));
export const errorCodes: string[] = (contract as any).errors;
export const tools: string[] = (contract as any).tools;
export const contractName: string = (contract as any).contract;
export const sourceSha: string = (contract as any).source.sha;
export const toolForClass = (c: CapClass): Tool => (c === "read" ? "read" : c === "write.reversible" ? "write" : "danger");
