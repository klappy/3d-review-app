import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const CDN = "https://cdn.3dreview.app/overview/8fea7f793783";
const VTT_SHA = "cb6a2952a991c33a7fbff0d267a8db56fd2181e807345eff82bf55355f7a7e39";

test("Landing pins the CDN-HANDOFF overview assets and same-origin captions", () => {
  const landing = read("ui-next/src/overview-video.js");
  assert.match(landing, new RegExp(`https://cdn.3dreview.app/overview/5d92d72d3946/3D-Review-120s-Raphael-narrated-draft\\.mp4`));
  assert.match(landing, new RegExp(`${CDN}/3d-review-overview-poster\\.jpg`));
  assert.match(landing, /duration: '2:00'/);
  assert.match(landing, /captions: '\/overview\/3d-review-overview\.en\.vtt'/);
  const card = read("ui-next/src/MediaCard.svelte");
  assert.match(card, /preload="none"/);
  assert.doesNotMatch(card, /\bautoplay\b/);
  assert.doesNotMatch(card, /<track[^>]*\sdefault\b/);
  assert.match(card, /captions/);
  const sha = createHash("sha256").update(readFileSync(join(root, "ui/overview/3d-review-overview.en.vtt"))).digest("hex");
  assert.equal(sha, VTT_SHA);
});
