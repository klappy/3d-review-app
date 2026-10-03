/**
 * Display names for survey templates (captain ruling 2026-09-29, BCS training demo bee:10809312 u3540382253-264:
 * "validation doesn't say anything to me"). The pinned source names ("Validation", "Mid-Level") stay in D1 as
 * provenance and template ids never change; every surface that shows a template name to people reads it through here.
 * `source_name` carries the pinned name wherever the display name differs, so nothing is lost.
 */
export const TEMPLATE_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  tpl_validation: "Translators",
  tpl_mid_level: "Mid-Level Quality Roles (Facilitators, Team Leaders, CiTs)",
  tpl_mid_level_v1_legacy: "Mid-Level Quality Roles (Facilitators, Team Leaders, CiTs) v1 (legacy)",
});

export function templateDisplayName(id: string, name: string): string {
  return TEMPLATE_DISPLAY_NAMES[id] ?? name;
}

/** Same row with `name` as people should read it; `source_name` added only when it differs. */
export function withDisplayName<T extends { id: string; name: string }>(row: T): T & { source_name?: string } {
  const shown = templateDisplayName(row.id, row.name);
  return shown === row.name ? row : { ...row, name: shown, source_name: row.name };
}
