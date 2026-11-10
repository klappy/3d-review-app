// ui/assess/improve-resources.js — Improve: a resource line under each suggested (low-scoring) area.
// Source: cookbook work/active/2026-10-26-3d-improve-resources-links (Done when 2): each low-scoring category shows its resources;
// a category with none says "More resources coming."
// Supplied Pathways catalogue; source and review limits: docs/pathways-resources.md.
// One title/destination mismatch is held out for source-owner correction.
// Retain supplied titles and URLs;
// never guess a title or a URL. Shape: { '<category>': [{ title: '<as delivered>', url: 'https://…' }, …] }.
// Keys match case-insensitively against the whole suggested area ("Church", "Translation Team · Listening") first,
// then its last part after " · " (the category name as the report names it, e.g. "Listening").
export const IMPROVE_RESOURCES = Object.freeze({
  "Translation Team · Translation Brief": [
    {
      "title": "Video: What is a translation brief? Why do we need one?",
      "url": "https://app.heygen.com/videos/what-is-a-translation-brief-why-do-we-need-one-8000e24db94447029feadf62710a1ae8"
    }
  ],
  "Translation Team · Understanding the Source": [
    {
      "title": "Fia",
      "url": "https://fia.bible/"
    },
    {
      "title": "ASL FIA",
      "url": "https://fia.griffized.com/#/"
    },
    {
      "title": "https://www.btservant.ai/",
      "url": "https://www.btservant.ai/"
    },
    {
      "title": "Translating Poetry (EN)",
      "url": "https://bttraininghub.notion.site/Translating-Poetry-366a6f0e2be0815cbf8cf3f4680f2c18"
    },
    {
      "title": "Traduciendo Poesía (ES)",
      "url": "https://bttraininghub.notion.site/Traduciendo-Poes-a-e74a6f0e2be083a5a6a78151d2eb7263"
    },
    {
      "title": "Faithbridge",
      "url": "https://faithbridge.multilingualai.com/"
    },
    {
      "title": "SIL Open Translators Notes",
      "url": "https://opentn.bible/"
    },
    {
      "title": "Alpha with Angela",
      "url": "https://freegreek.online/"
    },
    {
      "title": "Aleph with Beth",
      "url": "https://freehebrew.online/resources/"
    },
    {
      "title": "Translators Workplace",
      "url": "https://www.sil.org/resources/publications/tw"
    },
    {
      "title": "Bible background videos",
      "url": "https://www.youtube.com/playlist?list=PLx9oPMUKfiHtKiKILV6Qb9CW5H_2kXFpd"
    },
    {
      "title": "The Bible Project",
      "url": "https://www.youtube.com/@bibleproject"
    },
    {
      "title": "Intro to the Old Testament Course",
      "url": "https://oyc.yale.edu/religious-studies/rlst-145"
    }
  ],
  "Translation Team · The Translation Process": [
    {
      "title": "https://churchbased.bible/training/",
      "url": "https://churchbased.bible/training/"
    },
    {
      "title": "https://foundationsbt.com/",
      "url": "https://foundationsbt.com/"
    },
    {
      "title": "Translation Process Overview Workbook",
      "url": "https://bttraininghub.notion.site/Use-the-Workbook-Approach-304a6f0e2be0814ea383d890f921267c?p=304a6f0e2be0811c8268d10d9ac0733a&pm=c"
    },
    {
      "title": "Foundations in Bible Translation",
      "url": "https://www.digitaltraininglibrary.org/"
    }
  ],
  "Translation Team · External Review": [
    {
      "title": "How to externally check Open Bible Stories",
      "url": "https://bttraininghub.notion.site/How-to-Externally-Check-Open-Bible-Stories-304a6f0e2be0815589b2d32d0a40039e"
    }
  ],
  "Translation Team · Consistency": [
    {
      "title": "Linguistics Checks",
      "url": "https://www.sil.org/resources/archives/76614"
    }
  ],
  "Translation Team · Governance/Management": [
    {
      "title": "Support the Work",
      "url": "https://bttraininghub.notion.site/2fda6f0e2be08017a424d7bf640dcb83?v=2fda6f0e2be08056b960000ce269317b&p=35ea6f0e2be08056aa4ff0024550f541&pm=c"
    },
    {
      "title": "Locally-Led, Leaders Practicum",
      "url": "https://bttraininghub.notion.site/2fda6f0e2be08017a424d7bf640dcb83?v=2fda6f0e2be08056b960000ce269317b&p=320a6f0e2be0803d9c00e20b9c05a850&pm=c"
    },
    {
      "title": "Stewarding our Commitments (EN)",
      "url": "https://bttraininghub.notion.site/Stewarding-Our-Commitments-374a6f0e2be0815882bfe06b781b4315"
    },
    {
      "title": "Administrando Nuestros Compromisos (ES)",
      "url": "https://bttraininghub.notion.site/Administrando-Nuestros-Compromisos-01ba6f0e2be08251ae1581ba1ae9cc46"
    }
  ],
  "Community · Understandable": [
    {
      "title": "Testing your translation with the community",
      "url": "https://bttraininghub.notion.site/Testing-your-Translation-with-the-Community-304a6f0e2be0816f9458eb4802127c34"
    },
    {
      "title": "Videos for Translators",
      "url": "https://www.youtube.com/@SILTraining-ju5ld/playlists"
    }
  ],
  "Community · Appealing": [
    {
      "title": "Testing your translation with the community",
      "url": "https://bttraininghub.notion.site/Testing-your-Translation-with-the-Community-304a6f0e2be0816f9458eb4802127c34"
    },
    {
      "title": "Discourse Analysis and Bible Translation",
      "url": "https://www.sil.org/resources/publications/entry/98418"
    },
    {
      "title": "Spanish",
      "url": "https://drive.google.com/drive/folders/1B1vMDdRGu2nQ4SOo6NijygOSyCDomCoN?usp=drive_link"
    },
    {
      "title": "French",
      "url": "https://drive.google.com/drive/folders/1Ux1ttMn_2dOgAik-ZvRHOIOXZFM7Klcp?usp=drive_link"
    },
    {
      "title": "Indonesian",
      "url": "https://drive.google.com/drive/folders/1lu9AvOdabqKbPjhu9Ovz7gZcfoydQKl2?usp=drive_link"
    },
    {
      "title": "Swahili",
      "url": "https://drive.google.com/drive/folders/1IME7aGTTyishREO355OG8qmxD_YWRAZb?usp=drive_link"
    },
    {
      "title": "Russian",
      "url": "https://drive.google.com/drive/folders/1PU44rAyZse11kULIf4NwOSIFDsmdot9E?usp=drive_link"
    },
    {
      "title": "Fuller Equip Certificate of Discourse Analysis: Narrative Texts",
      "url": "https://fullerequip.com/classroom/discourse-analysis-narrative-texts"
    }
  ],
  "Community · Impact": [
    {
      "title": "scriptureengagement.org",
      "url": "http://scriptureengagement.org"
    }
  ],
  "Church · Translation Brief": [
    {
      "title": "Video: What is a translation brief? Why do we need one?",
      "url": "https://app.heygen.com/videos/what-is-a-translation-brief-why-do-we-need-one-8000e24db94447029feadf62710a1ae8"
    }
  ],
  "Church · Church Involvement": [
    {
      "title": "The Church's Role in Bible Translation",
      "url": "https://bttraininghub.notion.site/The-Church-s-Role-in-Bible-Translation-304a6f0e2be081bf843dc5f29626c80e"
    },
    {
      "title": "Church Engagement, Neh 8",
      "url": "https://bttraininghub.notion.site/Church-Engagement-and-Translation-Nehemiah-8-304a6f0e2be0810582f9e4046e873c50"
    }
  ],
  "Church · Confidence in the Translation": [
    {
      "title": "Translations the Church will use - Principles for church leader checkers",
      "url": "https://bttraininghub.notion.site/Translations-the-Church-Will-Use-Principles-for-Church-Leader-Checkers-304a6f0e2be0816191def7ba68099873"
    }
  ],
  "Church · Affirmation": [
    {
      "title": "What does \"finished\" look like?",
      "url": "https://bttraininghub.notion.site/What-does-FINISHED-look-like-304a6f0e2be08136905ff5a3d1f934d1"
    }
  ],
  "Translation Team · Governance": [
    {
      "title": "Support the Work",
      "url": "https://bttraininghub.notion.site/2fda6f0e2be08017a424d7bf640dcb83?v=2fda6f0e2be08056b960000ce269317b&p=35ea6f0e2be08056aa4ff0024550f541&pm=c"
    },
    {
      "title": "Locally-Led, Leaders Practicum",
      "url": "https://bttraininghub.notion.site/2fda6f0e2be08017a424d7bf640dcb83?v=2fda6f0e2be08056b960000ce269317b&p=320a6f0e2be0803d9c00e20b9c05a850&pm=c"
    },
    {
      "title": "Stewarding our Commitments (EN)",
      "url": "https://bttraininghub.notion.site/Stewarding-Our-Commitments-374a6f0e2be0815882bfe06b781b4315"
    },
    {
      "title": "Administrando Nuestros Compromisos (ES)",
      "url": "https://bttraininghub.notion.site/Administrando-Nuestros-Compromisos-01ba6f0e2be08251ae1581ba1ae9cc46"
    }
  ],
  "Community · Impactful": [
    {
      "title": "scriptureengagement.org",
      "url": "http://scriptureengagement.org"
    }
  ],
  "Translation Team · Translation process & brief": [
    {
      "title": "Video: What is a translation brief? Why do we need one?",
      "url": "https://app.heygen.com/videos/what-is-a-translation-brief-why-do-we-need-one-8000e24db94447029feadf62710a1ae8"
    },
    {
      "title": "https://churchbased.bible/training/",
      "url": "https://churchbased.bible/training/"
    },
    {
      "title": "https://foundationsbt.com/",
      "url": "https://foundationsbt.com/"
    },
    {
      "title": "Translation Process Overview Workbook",
      "url": "https://bttraininghub.notion.site/Use-the-Workbook-Approach-304a6f0e2be0814ea383d890f921267c?p=304a6f0e2be0811c8268d10d9ac0733a&pm=c"
    },
    {
      "title": "Foundations in Bible Translation",
      "url": "https://www.digitaltraininglibrary.org/"
    }
  ]
});
export const RESOURCES_COMING = 'More resources coming.';

const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const safeUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u.trim());

/** The resources for one suggested area: [] when the table has none (or only malformed entries). */
export function resourcesFor(area, table = IMPROVE_RESOURCES) {
  const keys = Object.keys(table || {}), byKey = new Map(keys.map(k => [norm(k), table[k]]));
  const whole = norm(area), last = norm(String(area ?? '').split(' · ').pop());
  const hit = byKey.get(whole) ?? byKey.get(last) ?? [];
  return (Array.isArray(hit) ? hit : []).filter(r => r && safeUrl(r.url) && String(r.title ?? '').trim());
}

/** One short line under the area: its resource links, or "More resources coming." */
export function resourcesMarkup(area, esc, table = IMPROVE_RESOURCES) {
  const rs = resourcesFor(area, table);
  const body = rs.length
    ? rs.map(r => `<a href="${esc(r.url.trim())}" target="_blank" rel="noopener noreferrer">${esc(r.title.trim())}</a>`).join(' · ')
    : esc(RESOURCES_COMING);
  return `<p class="small muted" data-resources-for="${esc(area)}">${body}</p>`;
}

