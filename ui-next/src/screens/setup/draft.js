// UI Next (v4) setup lane: what steps 4 and 5 derive from step 3's checked state. Status: provisional (playbook rule 12).
// One source for the surveys, so step 4 asks about the surveys step 3 chose and step 5's summary says the same thing
// (VALIDATION-setup F9, VALIDATION-setup-r2 N3: Setup5Phone named Church while phone steps 3 and 4 leave it out). Step 3 draws its
// group checkboxes from isChecked too, so a group the later steps skip never shows as checked.
// Plain JS, no Svelte, so the lane test imports it. Input: ui-next/fixtures/setup/setup.json groups and context.values.
// The phone reads phoneChecked where step 3's phone board (SetupPhone) unchecks a group, else checked.

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const chosenRoles = (g) => (g.roles ? g.roles.filter((r) => r.checked) : null);
/** A group is chosen when it is checked and, if it has roles, at least one of them is: a roles group with none checked has no survey,
 *  so steps 3, 4 and 5 all treat it as unchecked (VALIDATION-setup-r3 N10: "Church (0 roles)", "0 expected", an empty disclosure). */
export const isChecked = (g, phone = false) => (phone ? (g.phoneChecked ?? g.checked) : g.checked) === true && (chosenRoles(g)?.length ?? 1) > 0;
export const chosenGroups = (groups, phone = false) => groups.filter((g) => isChecked(g, phone));

/** One survey per checked role of a checked group, or the group itself when it has no roles; key = slug of the survey name. */
export function surveys(groups, phone = false) {
  return chosenGroups(groups, phone)
    .flatMap((g) => chosenRoles(g)?.map((r) => ({ g, name: r.name, expected: r.expected })) ?? [{ g, name: g.name, expected: g.expected }])
    .map((s) => ({ ...s, key: slug(s.name) }));
}

const total = (xs) => xs.reduce((n, x) => n + (Number(x) || 0), 0);

/** Desktop "Who will participate" (Setup5): [group, "roles · n expected"] per checked group. */
export function whoLines(groups, phone = false) {
  return chosenGroups(groups, phone).map((g) => {
    const rs = chosenRoles(g);
    return [g.name, `${rs ? rs.map((r) => r.name).join(", ") : g.name} · ${total(rs ? rs.map((r) => r.expected) : [g.expected])} expected`];
  });
}

/** Phone "Who" (Setup5Phone): the checked groups, with "(n roles)" where only some of a group's roles are chosen ("Church (2 roles)"). */
export function whoShort(groups, phone = true) {
  return chosenGroups(groups, phone)
    .map((g) => { const rs = chosenRoles(g); return rs && rs.length < g.roles.length ? `${g.name} (${rs.length} ${rs.length === 1 ? "role" : "roles"})` : g.name; })
    .join(" · ");
}

/** "About each group" (Setup5 / Setup5Phone): the surveys with an answer, then how many were left blank. */
export function aboutLine(list, values = {}, phone = false) {
  const described = list.filter((s) => Object.values(values[s.key] ?? {}).some((v) => String(v ?? "").trim()));
  const blank = list.length - described.length;
  return [
    described.length && `${described.map((s) => s.name).join(", ")} described`,
    blank && `${blank} ${phone ? "" : blank === 1 ? "survey " : "surveys "}left blank`,
  ].filter(Boolean).join(" · ");
}
