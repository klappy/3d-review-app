// Canonical candidate identities remain indexed even when their product source is not included.
// A version bump alone never admits an unmerged candidate; a reviewed inclusion changes this flag.
export function includedVersions(releases) {
  return releases.versions.filter(v => v.included_in_product !== false && !v.excluded_from?.includes(releases.current));
}
