// B09 (Bincy F06, captain ruling ASK F06 option 2): optional context around the pinned instrument, never inside it.
// Group-level fields are the Kairos Laos export fields asked of the facilitator per group in setup step 3, WITHOUT any
// name field (facilitator_name, team_members_present, leader_name are never asked or stored). Respondent fields are
// the optional age range and gender on the participant form. Every field is optional; unknown keys are refused.
// Mirrored for the browser in ui/v3/context-fields.js (test/context-fields.test.ts keeps the two identical).
import { CapError } from "./handlers/errors";

export interface ContextOption { code: string; label: string }
export interface ContextField { key: string; label: string; type: "text" | "count" | "select"; options?: ContextOption[] }

const text = (key: string, label: string): ContextField => ({ key, label, type: "text" });
const count = (key: string, label: string): ContextField => ({ key, label, type: "count" });

export const RESPONDENT_FIELDS: ContextField[] = [
  { key: "age_range", label: "Age range", type: "select", options: [
    { code: "under_18", label: "Under 18" }, { code: "18_24", label: "18–24" }, { code: "25_34", label: "25–34" },
    { code: "35_49", label: "35–49" }, { code: "50_64", label: "50–64" }, { code: "65_plus", label: "65 or older" },
    { code: "prefer_not", label: "Prefer not to say" }] },
  { key: "gender", label: "Gender", type: "select", options: [
    { code: "female", label: "Female" }, { code: "male", label: "Male" }, { code: "prefer_not", label: "Prefer not to say" }] },
];

export const GROUP_FIELDS: Record<string, ContextField[]> = {
  Community: [
    text("facilitator_role", "Your role"), count("total_participants", "Number of participants"),
    text("participant_selection", "How participants were chosen"), text("location_community", "Community"),
    text("location_region", "Region"), text("location_setting", "Setting (e.g. rural, town)"),
    text("approximate_age", "Approximate ages in the group"), text("gender_composition", "Gender mix of the group"),
    text("scripture_portions_tested", "Scripture portions used"),
  ],
  "Translation Team": [
    text("roles_represented", "Roles represented"), count("total_team_size", "Team size"),
    count("full_time_translators", "Full-time translators"), count("part_time_translators", "Part-time translators"),
    count("education_primary", "Primary education (count)"), count("education_secondary", "Secondary education (count)"),
    count("education_tertiary", "Tertiary education (count)"), text("organizational_affiliations", "Organizations involved"),
  ],
  Church: [
    text("title_role", "Title or role"), text("denomination", "Denomination"), text("geographic_scope", "Area served"),
    text("how_identified", "How church leaders were identified"), text("prior_familiarity", "Prior familiarity with the translation"),
  ],
};

export const groupFields = (perspective: string): ContextField[] => GROUP_FIELDS[perspective] || [];
const TEXT_MAX = 200, COUNT_MAX = 100000;

/** Validates an optional context object against a field list. Empty values are dropped; returns {} when nothing was given. */
export function validateContext(fields: ContextField[], value: unknown, what = "context"): Record<string, string | number> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new CapError("INVALID_PARAMS", `${what} must be an object`);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const out: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const f = byKey.get(key);
    if (!f) throw new CapError("INVALID_PARAMS", `unknown ${what} field ${key}`);
    if (raw === undefined || raw === null || raw === "") continue;
    if (f.type === "select") {
      if (typeof raw !== "string" || !f.options!.some((o) => o.code === raw)) throw new CapError("INVALID_PARAMS", `invalid ${what} value for ${key}`);
      out[key] = raw;
    } else if (f.type === "count") {
      const n = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > COUNT_MAX) throw new CapError("INVALID_PARAMS", `invalid ${what} value for ${key}`);
      out[key] = n;
    } else {
      if (typeof raw !== "string" || raw.length > TEXT_MAX) throw new CapError("INVALID_PARAMS", `invalid ${what} value for ${key}`);
      const t = raw.trim(); if (t) out[key] = t;
    }
  }
  return out;
}
