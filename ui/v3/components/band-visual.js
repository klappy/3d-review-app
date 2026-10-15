// Extracted SVG renderers only from Steve's August 17 attachments; no respondent data.
const visuals = {};
visuals.faces=(()=>{
const STATUS = {
  good:     { color: "var(--status-good)",     wash: "var(--status-good-wash)",     label: "Strong" },
  warning:  { color: "var(--status-warning)",  wash: "var(--status-warning-wash)",  label: "Growing" },
  serious:  { color: "var(--status-serious)",  wash: "var(--status-serious-wash)",  label: "Needs support" },
  critical: { color: "var(--status-critical)", wash: "var(--status-critical-wash)", label: "Needs urgent attention" },
};

function band(word) { return {Strong:'good',Growing:'warning','Needs support':'serious','Needs urgent attention':'critical'}[word]; }

// Shapes imitate a standard emoji set (grinning / slight smile / neutral /
// worried) rather than a custom expression scale, so the four levels read as
// familiar rather than invented. Meaning is carried by face shape first —
// color (the same green/yellow/orange/red used in the other low-numeracy
// mockups) and the word label both reinforce it, never carry it alone.
function face(word, size) {
  const b = band(word);
  const s = STATUS[b];
  const r = size / 2;
  const cx = r, cy = r;
  const ink = "var(--text-primary)";
  const eyeY = cy - r * 0.08, eyeDX = r * 0.3;
  const my = cy + r * 0.3, mw = r * 0.56;

  let eyes, mouth, brows = "";

  if (b === "good") {
    // closed, squinted eyes + a big open grin — "grinning face with smiling eyes"
    const ew = r * 0.16, eh = r * 0.22;
    const eyeArc = ex => `M ${ex - ew} ${eyeY} Q ${ex} ${eyeY - eh} ${ex + ew} ${eyeY}`;
    eyes = `
      <path d="${eyeArc(cx - eyeDX)}" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="${eyeArc(cx + eyeDX)}" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
    const bulge = 0.42 * r, depth = 0.16 * r;
    mouth = `<path d="M ${cx - mw} ${my} Q ${cx} ${my + bulge} ${cx + mw} ${my} Q ${cx} ${my + bulge - depth} ${cx - mw} ${my} Z" fill="${ink}" />`;
  } else {
    // open dot eyes for the other three bands; worried face gets them a touch larger
    const eyeR = Math.max(1.8, size * 0.05) * (b === "critical" ? 1.15 : 1);
    eyes = `
      <circle cx="${cx - eyeDX}" cy="${eyeY}" r="${eyeR}" fill="${ink}" />
      <circle cx="${cx + eyeDX}" cy="${eyeY}" r="${eyeR}" fill="${ink}" />`;

    // mouth: slight smile -> dead-flat neutral line -> soft frown
    const mouthCurve = { warning: 0.16, serious: 0, critical: -0.22 }[b];
    mouth = `<path d="M ${cx - mw} ${my} Q ${cx} ${my + mouthCurve * r} ${cx + mw} ${my}" stroke="${ink}" stroke-width="2.75" fill="none" stroke-linecap="round" />`;

    // worried eyebrows (inner corners raised, outer lowered) appear only on the
    // lowest band — a gentle "worried" read, not a furrowed, angry one
    if (b === "critical") {
      const bw = r * 0.34, by = eyeY - r * 0.26, browBow = r * 0.06, lift = 0.16;
      const browL = `M ${cx - eyeDX - bw/2} ${by + lift * r * 0.4} Q ${cx - eyeDX} ${by - browBow} ${cx - eyeDX + bw/2} ${by - lift * r * 0.4}`;
      const browR = `M ${cx + eyeDX - bw/2} ${by - lift * r * 0.4} Q ${cx + eyeDX} ${by - browBow} ${cx + eyeDX + bw/2} ${by + lift * r * 0.4}`;
      brows = `
        <path d="${browL}" stroke="${ink}" stroke-width="2.25" fill="none" stroke-linecap="round" />
        <path d="${browR}" stroke="${ink}" stroke-width="2.25" fill="none" stroke-linecap="round" />`;
    }
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${s.label}">
      <circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${s.wash}" stroke="${s.color}" stroke-width="2.75" />
      ${brows}
      ${eyes}
      ${mouth}
    </svg>`;
}


return face;
})();
visuals.container=(()=>{
const STATUS = {
  good:     { color: "var(--status-good)",     wash: "var(--status-good-wash)",     label: "Strong",   fill: 0.86 },
  warning:  { color: "var(--status-warning)",  wash: "var(--status-warning-wash)",  label: "Growing",  fill: 0.60 },
  serious:  { color: "var(--status-serious)",  wash: "var(--status-serious-wash)",  label: "Needs support", fill: 0.34 },
  critical: { color: "var(--status-critical)", wash: "var(--status-critical-wash)", label: "Needs urgent attention", fill: 0.12 },
};

function band(word) { return {Strong:'good',Growing:'warning','Needs support':'serious','Needs urgent attention':'critical'}[word]; }

// Jar outline is ink-only (reads in grayscale); fill height is the primary
// signal, color the reinforcing second channel — same rule as the faces mockup.
function container(word, size) {
  const b = band(word);
  const s = STATUS[b];
  const jarW = size * 0.56, jarH = size * 0.72;
  const jx = (size - jarW) / 2, jy = size * 0.16;
  const rx = jarW * 0.12;
  const innerPad = 3;
  const innerX = jx + innerPad, innerW = jarW - innerPad * 2;
  const innerTop = jy + innerPad, innerH = jarH - innerPad * 2;
  const fillH = innerH * s.fill;
  const fillY = innerTop + innerH - fillH;
  const waveAmp = size * 0.02;

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${s.label}">
      <clipPath id="clip-${word}-${size}">
        <rect x="${innerX}" y="${innerTop}" width="${innerW}" height="${innerH}" rx="${rx * 0.8}" />
      </clipPath>
      <g clip-path="url(#clip-${word}-${size})">
        <rect x="${innerX}" y="${fillY + waveAmp}" width="${innerW}" height="${innerH}" fill="${s.wash}" />
        <path d="M ${innerX} ${fillY + waveAmp}
                 Q ${innerX + innerW * 0.25} ${fillY - waveAmp} ${innerX + innerW * 0.5} ${fillY + waveAmp}
                 Q ${innerX + innerW * 0.75} ${fillY + waveAmp * 3} ${innerX + innerW} ${fillY + waveAmp}"
              stroke="${s.color}" stroke-width="2" fill="none" />
      </g>
      <rect x="${jx}" y="${jy}" width="${jarW}" height="${jarH}" rx="${rx}"
            fill="none" stroke="var(--text-primary)" stroke-width="2.5" />
      <line x1="${jx + jarW * 0.16}" y1="${jy - 3}" x2="${jx + jarW * 0.16}" y2="${jy + 5}" stroke="var(--text-primary)" stroke-width="2" />
      <line x1="${jx + jarW * 0.84}" y1="${jy - 3}" x2="${jx + jarW * 0.84}" y2="${jy + 5}" stroke="var(--text-primary)" stroke-width="2" />
    </svg>`;
}


return container;
})();
visuals.plant=(()=>{
const STATUS = {
  good:     { color: "var(--status-good)",     wash: "var(--status-good-wash)",     label: "Strong",   stage: "good" },
  warning:  { color: "var(--status-warning)",  wash: "var(--status-warning-wash)",  label: "Growing",  stage: "warning" },
  serious:  { color: "var(--status-serious)",  wash: "var(--status-serious-wash)",  label: "Needs support", stage: "serious" },
  critical: { color: "var(--status-critical)", wash: "var(--status-critical-wash)", label: "Needs urgent attention", stage: "critical" },
};

function band(word) { return {Strong:'good',Growing:'warning','Needs support':'serious','Needs urgent attention':'critical'}[word]; }

function leaf(cx, cy, side, len, color) {
  const angle = side * 42;
  const lx = cx + side * len * 0.55, ly = cy - len * 0.25;
  return `<ellipse cx="${lx}" cy="${ly}" rx="${len * 0.55}" ry="${len * 0.24}"
            fill="${color}" fill-opacity="0.88"
            transform="rotate(${angle} ${lx} ${ly})" />`;
}

// Growth stage (height, leaf count, bud/flower, upright vs. drooping) is the
// primary signal; color is the reinforcing second channel — same rule as the
// other two mockups.
function plant(word, size) {
  const b = band(word);
  const s = STATUS[b];
  const cx = size / 2;
  const groundY = size * 0.84;
  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${s.label}">`;
  svg += `<line x1="${cx - size * 0.28}" y1="${groundY}" x2="${cx + size * 0.28}" y2="${groundY}" stroke="var(--baseline)" stroke-width="2" />`;

  if (b === "critical") {
    const topX = cx + size * 0.11, topY = groundY - size * 0.10;
    svg += `<path d="M ${cx} ${groundY} Q ${cx} ${groundY - size * 0.15} ${topX} ${topY}"
              stroke="${s.color}" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
    svg += leaf(cx - size * 0.10, groundY - size * 0.015, -1, size * 0.16, s.color);
    svg += leaf(cx + size * 0.16, groundY - size * 0.015, 1, size * 0.14, s.color);
  } else {
    const stemFrac = { good: 0.62, warning: 0.42, serious: 0.26 }[b];
    const topY = groundY - size * stemFrac;
    svg += `<line x1="${cx}" y1="${groundY}" x2="${cx}" y2="${topY}" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" />`;

    const leafCount = { good: 4, warning: 2, serious: 1 }[b];
    for (let i = 0; i < leafCount; i++) {
      const t = (i + 1) / (leafCount + 1.4);
      const ly = groundY - t * (groundY - topY);
      const side = i % 2 === 0 ? -1 : 1;
      svg += leaf(cx, ly, side, size * 0.15, s.color);
    }

    if (b === "warning") {
      svg += `<ellipse cx="${cx}" cy="${topY - size * 0.03}" rx="${size * 0.045}" ry="${size * 0.075}" fill="${s.color}" />`;
    }
    if (b === "good") {
      const petalLen = size * 0.09;
      for (let p = 0; p < 5; p++) {
        const ang = p * 72;
        const rad = ang * Math.PI / 180;
        const px = cx + Math.sin(rad) * petalLen * 0.65;
        const py = topY - Math.cos(rad) * petalLen * 0.65;
        svg += `<ellipse cx="${px}" cy="${py}" rx="${petalLen * 0.5}" ry="${petalLen * 0.28}"
                  fill="var(--surface-1)" stroke="var(--text-primary)" stroke-width="1.4"
                  transform="rotate(${ang} ${px} ${py})" />`;
      }
      svg += `<circle cx="${cx}" cy="${topY}" r="${size * 0.055}" fill="${s.color}" />`;
    }
  }

  svg += `</svg>`;
  return svg;
}


return plant;
})();


function missingVisual(style){
 const outlines={
 faces:'<circle cx="21" cy="24" r="16"/><circle cx="15" cy="22" r="1"/><circle cx="27" cy="22" r="1"/><path d="M16 31h10"/>',
 container:'<path d="M13 8h22v6l3 5v21a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V19l3-5z"/><path d="M13 14h22"/>',
 plant:'<path d="M22 41V26M22 30C10 30 8 22 8 17c10 0 14 4 14 13ZM22 26c0-11 6-16 16-16 0 9-5 16-16 16ZM9 42h26"/>'
 };
 const badge=style==='container'?'<text x="24" y="35" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui,sans-serif" font-size="22" font-weight="600">?</text>':'<circle cx="38" cy="11" r="9" fill="white"/><text x="38" y="16" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui,sans-serif" font-size="14" font-weight="600">?</text>';
 return `<span class="steve-visual" style="color:var(--muted)" aria-hidden="true" data-provenance="proposal-missing-visuals" data-origin-status="proposed-adaptation" data-missing-shape="${style}"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${outlines[style]}${badge}</svg></span>`;
}

const words=['Strong','Growing','Needs support','Needs urgent attention'];
let serial=0;
/** Rendering consumes the caller's established band WORD, never score/count/cutoffs. */
export function bandImagery(word){
 const known=words.includes(word), missing=word==='More input needed';
 if(!known&&!missing)return '';
 const level=missing?0:4-words.indexOf(word);
 const token=missing?'--pip':{Strong:'--band-strong',Growing:'--band-growing','Needs support':'--band-needs-support','Needs urgent attention':'--band-urgent'}[word];
 const bars=`<span style="color:var(${token})" class="report-band-image" data-band-image="signal" aria-hidden="true" data-provenance="cookbook-signal"><svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor">${[1,2,3,4].map((n,i)=>`<rect x="${3+i*11}" y="${40-n*8}" width="7" height="${n*8}" rx="1" ${missing?'stroke-dasharray="2 2"':n<=level?'fill="currentColor"':'opacity=".2"'}/>`).join('')}</svg></span>`;
 return bars+['faces','container','plant'].map(style=>{
 let svg=missing?missingVisual(style):visuals[style](word,48);
 const suffix='-band'+(++serial);
 svg=svg.replace(/id="([^"]+)"/g,(_,id)=>`id="${id.replaceAll(' ','-')}${suffix}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${id.replaceAll(' ','-')}${suffix})`);
 return `<span class="report-band-image" data-band-image="${style}" aria-hidden="true" data-provenance="${missing?'proposal-missing-visuals':'steve-visual-'+style}" data-origin-status="${missing?'proposed-adaptation':'source-derived'}">${svg}</span>`;
 }).join('');
}
export const bandVisualCSS=`.report-band-image{display:none;flex:none;vertical-align:middle;margin-right:8px}.report-band-image svg{width:40px;height:40px;display:block}.report-band-image .steve-visual{display:block}[data-band-style="signal"] [data-band-image="signal"],[data-band-style="faces"] [data-band-image="faces"],[data-band-style="container"] [data-band-image="container"],[data-band-style="plant"] [data-band-image="plant"]{display:inline-flex}.band-visual-control{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.band-visual-control select{font:inherit;min-height:40px}.v3-band-subs .report-band-image svg{width:28px;height:28px}.v3-band-imagery{--text-primary:var(--ink);--status-good:var(--band-strong);--status-warning:var(--band-growing);--status-serious:var(--band-needs-support);--status-critical:var(--band-urgent);--status-good-wash:color-mix(in srgb,var(--band-strong) 28%,transparent);--status-warning-wash:color-mix(in srgb,var(--band-growing) 28%,transparent);--status-serious-wash:color-mix(in srgb,var(--band-needs-support) 28%,transparent);--status-critical-wash:color-mix(in srgb,var(--band-urgent) 28%,transparent)}.v3-band-imagery .legend{flex-wrap:wrap}.v3-band-imagery .word{display:flex;align-items:center}@media print{.band-visual-control{display:none}.report-band-image{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;
