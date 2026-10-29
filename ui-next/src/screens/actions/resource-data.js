// One content source for both UIs: the current UI's category table (PR577).
// Only supplied title/URL rows belong there; recommendations remain a separate, unbuilt capability.
import { resourcesFor, RESOURCES_COMING } from "../../../../ui/assess/improve-resources.js";
export { RESOURCES_COMING };

export function reviewResources(weak = []) {
  return weak.map((area) => ({
    label: area.label,
    resources: resourcesFor(area.label).flatMap((r) => {
      try {
        const url = new URL(r.url.trim());
        return ["https:", "http:"].includes(url.protocol) && url.hostname
          ? [{ title: String(r.title).trim(), url: url.href }] : [];
      } catch { return []; }
    }),
  }));
}
