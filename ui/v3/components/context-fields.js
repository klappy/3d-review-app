// B09 (Bincy F06, ASK F06 option 2): browser mirror of src/context-fields.ts (test/b09-context.test.ts keeps them
// identical). Optional context around the pinned instrument; no name field anywhere.
const text = (key, label) => ({ key, label, type: "text" });
const count = (key, label) => ({ key, label, type: "count" });

export const RESPONDENT_FIELDS = [
  { key: "age_range", label: "Age range", type: "select", options: [
    { code: "under_18", label: "Under 18" }, { code: "18_24", label: "18–24" }, { code: "25_34", label: "25–34" },
    { code: "35_49", label: "35–49" }, { code: "50_64", label: "50–64" }, { code: "65_plus", label: "65 or older" },
    { code: "prefer_not", label: "Prefer not to say" }] },
  { key: "gender", label: "Gender", type: "select", options: [
    { code: "female", label: "Female" }, { code: "male", label: "Male" }, { code: "prefer_not", label: "Prefer not to say" }] },
];

export const GROUP_FIELDS = {
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

export const groupFields = perspective => GROUP_FIELDS[perspective] || [];
// Non-empty values only (the server drops empties too); counts stay digit strings, the server turns them into numbers.
export function contextValues(fields, read) {
  const out = {};
  for (const f of fields) { const v = String(read(f.key) ?? '').trim(); if (v) out[f.key] = v; }
  return out;
}
