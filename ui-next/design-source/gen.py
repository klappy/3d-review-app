import json, os, html, re
HELMET = open(os.path.join(os.path.dirname(__file__), 'helmet.html')).read()
# extra rules shared by the new boards, appended inside the helmet
EXTRA = """
/* §1.2 Type scale rows the marketing/read boards use (auggie-next-type-2300, provisional): were board inlines, pixels unchanged */
.app .lead,.app .small.lead{font-size:var(--t-18);line-height:28px}
.app .body-16,.app .small.body-16{font-size:var(--t-16);line-height:26px}
.app .t-15,.app .small.t-15{font-size:var(--t-15)}.app .t-16,.app .small.t-16{font-size:var(--t-16)}
.app .display-tight,.app .display.display-tight{font-size:var(--t-56);line-height:54px}/* .app-scoped (+ .small/.display compound) so the row wins over the base type classes in any sheet order */
.cap-row{border-left:var(--accent-bar) solid var(--lens);padding:2px 0 2px 12px}
.cap-name{font-weight:600;font-size:var(--t-15)}
/* §2 Perspective card (auggie-next-skin2-2105, provisional): a perspective's own card draws its accent bar from [data-lens]; was a board inline */
.glass[data-lens],.glass-hi[data-lens],.l-card[data-lens]{border-top:var(--accent-bar) solid var(--lens)}
/* §8 Layouts primitives (auggie-layouts-s2-1540, provisional): spacing between siblings is the parent's gap */
.app{--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--sp-7:48px;--sp-8:72px;--gutter:32px;--page-max:1120px;--page-max-narrow:880px;--page-max-read:520px}
.app[data-w=phone]{--gutter:16px;--page-max:100%;--page-max-narrow:100%;--page-max-read:100%}
.l-page{width:100%;max-width:var(--page-max);margin:0 auto;display:flex;flex-direction:column;gap:var(--sp-5)}
.l-page[data-w=narrow]{max-width:var(--page-max-narrow)}.l-page[data-w=read]{max-width:var(--page-max-read)}
.l-main{flex-grow:1;display:flex;flex-direction:column;align-items:center;padding:var(--sp-6) 0 56px}
.l-phone{padding:var(--sp-3) var(--gutter) 120px;flex-grow:1;gap:var(--sp-4)}
.l-shell{height:100%;display:flex;flex-direction:column}
.l-section{display:flex;flex-direction:column;gap:var(--sp-4)}
/* --g is local to each primitive (fresh-review 6302493905 #2): the zero-specificity default beats inheritance, data-gap beats the default */
:where(.l-stack){--g:var(--sp-4)}:where(.l-row){--g:var(--sp-3)}:where(.l-grid){--g:var(--sp-4)}
.l-stack{display:flex;flex-direction:column;gap:var(--g)}
.l-row{display:flex;align-items:center;gap:var(--g)}
.l-grid{display:grid;gap:var(--g)}
/* §8 Grid named hero templates (auggie-next-comp-2115, provisional): two-track hero, 64px track gap, centred */
.l-grid[data-tpl=hero-landing]{grid-template-columns:1fr 440px;gap:64px;align-items:center}.l-grid[data-tpl=hero-about]{grid-template-columns:1fr 380px;gap:64px;align-items:center}
[data-gap="1"]{--g:var(--sp-1)}[data-gap="2"]{--g:var(--sp-2)}[data-gap="3"]{--g:var(--sp-3)}[data-gap="4"]{--g:var(--sp-4)}[data-gap="5"]{--g:var(--sp-5)}[data-gap="6"]{--g:var(--sp-6)}[data-gap="7"]{--g:var(--sp-7)}[data-gap="8"]{--g:var(--sp-8)}
/* §8.2 marketing-page rhythm (auggie-next-rhythm-2235, captain 2026-10-20 22:29 ET, provisional): page padding + section gap read --rhythm */
.l-main[data-rhythm=marketing]{gap:var(--sp-8);padding:var(--sp-8) 0 64px}.l-main[data-rhythm=read]{gap:var(--sp-7);padding:var(--sp-7) 0 64px}
/* §9 phone hero card + list card paddings (were pcard/glass inlines) */
.l-card[data-pad=hero]{border-radius:var(--radius-xl);padding:28px 24px;display:flex;flex-direction:column}.l-card[data-pad=list]{border-radius:var(--radius-l);padding:8px 18px;display:flex;flex-direction:column}
details.dd>summary.dd-row{display:flex;justify-content:space-between;align-items:center;min-height:48px;font-weight:600;font-size:var(--t-15)}
/* §2 Media card (captain 2026-10-20 22:29 ET, provisional): 16:10 dark frame, play affordance, title · duration line, caption */
.l-media{border-radius:var(--radius-xl);padding:20px;display:flex;flex-direction:column;gap:14px}
.l-media-frame{aspect-ratio:16/10;border-radius:var(--radius-l);background:var(--ink);display:grid;place-items:center;color:var(--ground);position:relative;overflow:hidden}
.l-media-frame>video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.l-media-play{width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.14);color:var(--field)}
.l-media-title{position:absolute;left:16px;bottom:14px;color:rgba(255,255,255,.8)}
details.dd{position:relative}details.dd>summary{list-style:none;cursor:pointer}details.dd>summary::-webkit-details-marker{display:none}
.menu{position:absolute;right:0;top:52px;width:300px;border-radius: var(--radius-l);padding:8px;display:flex;flex-direction:column;gap:2px;z-index:5}
.mi{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-radius: var(--radius-m);text-decoration:none;color:var(--ink);font-weight:600;font-size: var(--t-15);background:transparent;border:0;font-family:inherit;cursor:pointer;text-align:left;width:100%}
.mi:hover{background:var(--line);color:var(--ink)}
.mi.danger{color:var(--b-urgent)}
.chip{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px 0 14px;border-radius:var(--radius-pill);background:var(--field);border:1px solid var(--line-2);font-weight:600;font-size: var(--t-14)}
.chip button{display:grid;place-content:center;width:24px;height:24px;border-radius:50%;border:0;background:var(--line);color:var(--ink-2);cursor:pointer}
.dz{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius: var(--radius-l);border:1.5px dashed var(--field-edge);background:var(--field)}
.th{font-size: var(--t-13);line-height:16px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);text-align:left;padding:0 12px 10px}
.td{padding:12px;border-top:1px solid var(--line);vertical-align:middle;font-size: var(--t-15)}
.paper{background:#fff;color:var(--ink);font-family:Figtree,ui-sans-serif,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.1),0 24px 48px -24px rgba(19,38,58,.4)}
.paper .q{font-size: var(--t-18);line-height:26px;margin:0 0 8px}
.paper .ptitle{font-family:'Newsreader',ui-serif,serif;font-weight:450;color:var(--ink)}
.paper .pbadge{display:inline-block;border:1.5px solid var(--ink);color:var(--ink);padding:3px 10px;font-size: var(--t-13);line-height:18px;font-weight:650;white-space:nowrap}
.paper .pfoot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:12px;font-size: var(--t-13);color:var(--ink-3)}
.psheet{overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.1),0 24px 48px -24px rgba(19,38,58,.4)}
.psheet>.paper{width:794px;transform-origin:top left;box-shadow:none}
.paper .o{display:flex;align-items:center;gap:10px;font-size: var(--t-16);line-height:26px}
.paper .o i{display:inline-block;width:16px;height:16px;border:1.5px solid var(--ink);border-radius:50%}
.paper .o i.sq{border-radius: var(--radius-hair)}
.paper .rl{height:30px;border-bottom:1px solid var(--field-edge)}
.gapbar{display:grid;grid-template-columns:200px 1fr 200px;align-items:center;gap:16px}
.gapbar .axis{position:relative;height:40px}
.gapbar .axis::before{content:"";position:absolute;left:0;right:0;top:19px;height:2px;background:var(--line-2);border-radius: var(--radius-hair)}
.pt{position:absolute;top:8px;width:24px;height:24px;border-radius:50%;border:3px solid var(--field);box-shadow:0 0 0 1.5px var(--line-2);margin-left:-12px}

.gapbar .span{position:absolute;top:17px;height:6px;border-radius: var(--radius-hair);background:var(--b-urgent);opacity:.55}
.lvl{display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size: var(--t-15)}
.ans{display:flex;flex-direction:column;gap:6px}
.ans .r{display:grid;grid-template-columns:1fr 64px 220px;align-items:center;gap:12px;min-height:36px;font-size: var(--t-15)}
.toast{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 16px;border-radius: var(--radius-m);background:var(--ink);color:var(--ground);font-weight:600;font-size: var(--t-14)}
.phone-top{display:flex;align-items:center;justify-content:space-between;padding:8px 12px 8px 16px}
.phone-bar{position:absolute;left:0;right:0;bottom:0;padding:12px 16px 28px;border-radius:0;border-width:1px 0 0;display:flex;gap:10px}
.qr{display:grid;grid-template-columns:repeat(21,1fr);gap:0;aspect-ratio:1;background:#fff;padding:8px;border-radius: var(--radius-s)}
.qr i{display:block;background:#111}
.qr i.o{background:transparent}
/* ---- semantic tokens: every board paints from these ---- */
.app{--radius-hair:3px;--radius-s:8px;--radius-m:12px;--radius-l:18px;--radius-xl:26px;
--t-11:11px;--t-12:12px;--t-13:13px;--t-14:14px;--t-15:15px;--t-16:16px;--t-18:18px;--t-20:20px;--t-24:24px;--t-30:30px;--t-36:36px;--t-40:40px;--t-56:56px;
--stage-setup:var(--ink-3);--stage-collecting:var(--ink-3);--stage-closed:var(--ink-3);--stage-results:var(--ink-3);--stage-reviewed:var(--ink-3);--stage-done:var(--ink-3);/* ruling 2026-10-15: stages are neutral; colour means perspective or level only */
--dot:10px;--accent-bar:5px;--target:44px;
--radius-pill:999px;--dot-stage:8px;/* R25: pill radius, stage dot (smaller than --dot on purpose) */
--btn-gap:8px;--btn-pad:18px;--btn-pad-lg:24px;--btn-h-lg:52px;--hl-primary:inset 0 1px 0 rgba(255,255,255,.2);/* R24: button tokens */
--dur-press:120ms;--dur-state:200ms;--dur-enter:320ms;--ease-out:cubic-bezier(.2,.8,.2,1)/* R24: motion tokens */}
.title-page{font-family:'Newsreader',ui-serif,Georgia,serif;font-weight:450;font-size:var(--t-40);line-height:46px;letter-spacing:-.008em;margin:0;text-wrap:balance}
.title-phone{font-family:'Newsreader',ui-serif,Georgia,serif;font-weight:450;font-size: var(--t-30);line-height:34px;letter-spacing:-.008em;margin:0;text-wrap:balance}
.tag{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:var(--radius-pill);font-weight:600;font-size:var(--t-12);background:var(--line);color:var(--ink-2)}
.pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px 0 9px;border-radius:var(--radius-pill);font-weight:600;font-size:var(--t-13);line-height:1;white-space:nowrap;background:var(--glass-hi);border:1px solid var(--line);color:var(--ink)}
.pill i{display:block;width:var(--dot-stage);height:var(--dot-stage);border-radius:50%;background:var(--stage)}
.pill[data-stage=setup]{--stage:var(--stage-setup)}.pill[data-stage=collecting]{--stage:var(--stage-collecting)}.pill[data-stage=closed]{--stage:var(--stage-closed)}.pill[data-stage=results]{--stage:var(--stage-results)}.pill[data-stage=reviewed]{--stage:var(--stage-reviewed)}.pill[data-stage=done]{--stage:var(--stage-done)}
@media (prefers-reduced-transparency:reduce){.pill{background:var(--field)}}/* R25, V-48: the pill turns solid like every glass surface (§1.2 Transparency) */
.lensdot{display:inline-block;width:var(--dot);height:var(--dot);border-radius:50%;flex:none}
[data-lens=team]{--lens:var(--team);--lens-soft:var(--team-soft)}[data-lens=community]{--lens:var(--community);--lens-soft:var(--community-soft)}[data-lens=church]{--lens:var(--church);--lens-soft:var(--church-soft)}/* R15: perspective paint comes from --lens / --lens-soft only */
.lensdot[data-lens],.pt[data-lens]{background:var(--lens)}
/* paper is always light: scope the light tokens so print boards read the same in dark mode */
.paper{--ink:#13263a;--field-edge:#8494a3;--ink-2:#44576a;--ink-3:#566879;--line:rgba(19,38,58,.10);--line-2:rgba(19,38,58,.16);--field:#ffffff;--b-strong:#1d5f73;--b-growing:#3a8a82;--b-support:#b27617;--b-urgent:#b0502a;--b-more:#7a8a99;--team:#268f73;--community:#3a6fc0;--church:#b0770f;color:var(--ink)}
.paper .muted{color:var(--ink-2)}.paper .rule{border-color:var(--line-2)}

.lvl .g{display:none;line-height:0}
.lvl[data-level=strong]{--lvl:var(--b-strong)}.lvl[data-level=growing]{--lvl:var(--b-growing)}.lvl[data-level=support]{--lvl:var(--b-support)}.lvl[data-level=urgent]{--lvl:var(--b-urgent)}.lvl[data-level=more]{--lvl:var(--b-more)}
.lvl .g{color:var(--lvl)}
.tag svg{flex-shrink:0}
.tag[data-kind=practice]{border:1px solid var(--line-2);color:var(--ink)}
.app[data-imagery=bars] .g-bars,.app[data-imagery=faces] .g-faces,.app[data-imagery=jars] .g-jars,.app[data-imagery=plants] .g-plants{display:inline-flex}
"""
H = HELMET.replace('</style>\n</helmet>', EXTRA + '</style>\n</helmet>')

ICONS = {
 'arrow': '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
 'back': '<path d="M19 12H5"></path><path d="M11 6l-6 6 6 6"></path>',
 'mail': '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"></rect><path d="M4 7.5l8 6 8-6"></path>',
 'globe': '<circle cx="12" cy="12" r="8.5"></circle><path d="M3.5 12h17"></path><path d="M12 3.5c2.6 2.6 2.6 14.4 0 17"></path><path d="M12 3.5c-2.6 2.6-2.6 14.4 0 17"></path>',
 'print': '<path d="M7 8V4h10v4"></path><rect x="4" y="8" width="16" height="9" rx="2"></rect><path d="M7 14h10v6H7z"></path>',
 'qr': '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"></path>',
 'copy': '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path>',
 'people': '<circle cx="9" cy="8.5" r="3"></circle><path d="M3.5 19a5.5 5.5 0 0 1 11 0"></path><circle cx="16.5" cy="9.5" r="2.5"></circle><path d="M15.6 14.1A4.6 4.6 0 0 1 21 18.5"></path>',
 'help': '<circle cx="12" cy="12" r="8.5"></circle><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.5"></path><path d="M12 17h.01"></path>',
 'chev': '<path d="M6 9l6 6 6-6"></path>',
 'check': '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
 'upload': '<path d="M12 16V5"></path><path d="M7 10l5-5 5 5"></path><path d="M4 19h16"></path>',
 'play': '<path d="M8 5.5v13l10-6.5z"></path>',
 'file': '<path d="M7 3.5h7l5 5v12H7z"></path><path d="M14 3.5v5h5"></path>',
 'dots': '<circle cx="6" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="18" cy="12" r="1.6"></circle>',
 'lock': '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
 'list': '<path d="M9 7h11"></path><path d="M9 12h11"></path><path d="M9 17h11"></path><path d="M4.5 7h.01"></path><path d="M4.5 12h.01"></path><path d="M4.5 17h.01"></path>',
 'pen': '<path d="M4 20l4-1 11-11-3-3L5 16z"></path>',
 'cal': '<rect x="4" y="5" width="16" height="15" rx="2.5"></rect><path d="M4 10h16"></path><path d="M8 3v4M16 3v4"></path>',
 'x': '<path d="M6 6l12 12M18 6L6 18"></path>',
 'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>',
 'down': '<path d="M12 4v12"></path><path d="M7 11l5 5 5-5"></path><path d="M4 20h16"></path>',
 'refresh': '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"></path><path d="M4 4v4h4"></path><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"></path><path d="M20 20v-4h-4"></path>',
 'warn': '<path d="M12 4l9 16H3z"></path><path d="M12 10v4"></path><path d="M12 17h.01"></path>',
 'eye': '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.5"></circle>',
 'plus': '<path d="M12 5v14M5 12h14"></path>',
 'search': '<circle cx="11" cy="11" r="6.5"></circle><path d="M20 20l-4.3-4.3"></path>',
 'video': '<rect x="3.5" y="6.5" width="12" height="11" rx="2"></rect><path d="M15.5 10.5l5-2.5v8l-5-2.5"></path>',
 'audio': '<rect x="9" y="4" width="6" height="11" rx="3"></rect><path d="M6 11a6 6 0 0 0 12 0"></path><path d="M12 17v3"></path>',
 'sparkle': '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"></path>',
 'clock': '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
 'church': '<path d="M12 3v4"></path><path d="M10 5h4"></path><path d="M5 21V12l7-5 7 5v9"></path><path d="M10 21v-5h4v5"></path>',
 'clipboard': '<rect x="6" y="5" width="12" height="16" rx="2"></rect><path d="M9 5V3.5h6V5"></path><path d="M9 11h6M9 15h4"></path>',
 'out': '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"></path>',
}
def ic(n, s=18, w=1.75):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[n]}</svg>'

MARK = '<svg class="mk" width="{s}" height="{s}" viewBox="0 0 30 30" aria-hidden="true"><circle data-lens="team" cx="15" cy="10" r="7" fill="var(--lens)" opacity=".92"></circle><circle data-lens="community" cx="9.6" cy="19.4" r="7" fill="var(--lens)" opacity=".82"></circle><circle data-lens="church" cx="20.4" cy="19.4" r="7" fill="var(--lens)" opacity=".82"></circle></svg>'
def brand(href='Home.dc.html', s=28, label=True):
    return f'<a class="brand" href="{href}">{MARK.format(s=s)}{"<span>3D Review</span>" if label else ""}</a>'

LENS_VAR = re.compile(r'var\(--(team|community|church)(-soft)?\)')
def lens_paint(*vals):
    """R15 / lint 'inline perspective': a perspective colour paints through [data-lens] and --lens / --lens-soft, never inline.
    Returns (' data-lens="k"' or '', vals with var(--k) -> var(--lens), var(--k-soft) -> var(--lens-soft)). Same paint, same pixels."""
    ks = {m.group(1) for v in vals for m in LENS_VAR.finditer(v)}
    if not ks: return '', vals
    assert len(ks) == 1, f'one element, one lens: {ks}'
    return f' data-lens="{ks.pop()}"', tuple(LENS_VAR.sub(lambda m: f'var(--lens{m.group(2) or ""})', v) for v in vals)

def icn(n, bg='var(--team-soft)', fg='var(--primary)', size=36, r=11, s=18):
    rt = 'var(--radius-m)' if r <= 14 else ('var(--radius-l)' if r <= 20 else 'var(--radius-xl)')
    dl, (bg, fg) = lens_paint(bg, fg)
    return f'<span class="icn"{dl} style="width: {size}px; height: {size}px; border-radius: {rt}; background: {bg}; color: {fg}">{ic(n, s)}</span>'

def btn(label, href=None, kind='', icon=None, lead=None, extra='', lg=False, block=False, aria=None):
    cls = 'btn' + (' ' + kind if kind else '') + (' btn-lg' if lg else '') + (' btn-block' if block else '')
    inner = (ic(lead) + ' ' if lead else '') + label + (' ' + ic(icon) if icon else '')
    a = f' aria-label="{aria}"' if aria else ''
    if href:
        return f'<a class="{cls}" href="{href}"{a}{(" style=%s" % json.dumps(extra)) if extra else ""}>{inner}</a>'
    return f'<button class="{cls}" type="button"{a}{(" style=%s" % json.dumps(extra)) if extra else ""}>{inner}</button>'

def iconbtn(n, aria, href=None):
    if href: return f'<a class="btn btn-quiet btn-icon" href="{href}" aria-label="{aria}">{ic(n,20)}</a>'
    return f'<button class="btn btn-quiet btn-icon" type="button" aria-label="{aria}">{ic(n,20)}</button>'

YELLOW_TAG = 'background: rgba(178,118,23,.14); color: var(--ink)'  # the Practice-copy badge colours (boards_fac.sandbox)

def room_health(opened, refused, wrap=False, instruction=True):
    """Room health (ruling 8, D2 option 1): one live line on Collect and the QR room, desktop and phone.
    Quiet: neutral .tag. Refusals: the yellow .tag plus one instruction (instruction=False when the board carries it
    elsewhere, e.g. the projector QR room). No codes on screen. Counts are survey opens, not people (§2 Room health)."""
    tag = (f'<span class="tag" style="{YELLOW_TAG}"><i class="lensdot" aria-hidden="true" style="width: 8px; height: 8px; background: var(--b-support)"></i>{refused} opens turned away</span>'
           if refused else '<span class="tag">0 opens turned away</span>')
    line = (f'<div role="status" aria-live="polite" style="display: flex; align-items: center; gap: 8px; flex-wrap: {"wrap" if wrap else "nowrap"}">'
            f'<span class="small"><strong class="tab-n">{opened}</strong> surveys opened in the last minute</span>{tag}</div>')
    if refused and instruction:
        line = (f'<div style="display: flex; flex-direction: column; gap: 4px">{line}'
                '<p class="small" style="color: var(--ink)">Ask people on shared Wi-Fi to switch to mobile data, or hand out paper surveys.</p></div>')
    return line

def topbar(crumb=None, menu_open=False, who='Bincy', right=True):
    crumbs = ''
    if crumb:
        crumbs = f'<span class="small" aria-hidden="true" style="color: var(--ink-3)">/</span><a class="link" href="Project.dc.html" style="color: var(--ink-2); font-weight: 600">Hindi New Testament</a>' + (f'<span class="small" aria-hidden="true" style="color: var(--ink-3)">/</span><span class="h3">{crumb}</span>' if crumb != 'Your reviews' else '')
    menu = ('<div class="glass-hi menu enter" role="menu">'
            + f'<div style="padding: 10px 12px 8px"><div class="h3">Bincy Kurian</div><div class="small">bincy@example.org</div></div><hr class="hr" style="margin: 4px 0">'
            + f'<a class="mi" href="Invitations.dc.html" role="menuitem">{ic("mail")} Invitations <span class="tag" style="margin-left: auto">1 new</span></a>'
            + f'<a class="mi" href="Help.dc.html" role="menuitem">{ic("help")} Help and FAQ</a>'
            + f'<a class="mi" href="About.dc.html" role="menuitem">{ic("sparkle")} Why 3D Review exists</a>'
            + f'<a class="mi" href="Feedback.dc.html" role="menuitem">{ic("pen")} Send app feedback</a>'
            + '<hr class="hr" style="margin: 4px 0">'
            + f'<a class="mi" href="Main.dc.html" role="menuitem">{ic("people")} Use another account</a>'
            + f'<a class="mi" href="Main.dc.html" role="menuitem">{ic("out")} Sign out</a></div>')
    rt = ''
    if right:
        rt = (f'<div style="margin-left: auto; display: flex; align-items: center; gap: 4px; position: relative">'
              f'{iconbtn("help", "Help", "Help.dc.html")}'
              f'<details class="dd"{" open" if menu_open else ""}><summary class="menu-btn" aria-haspopup="menu" title="Account menu"><span class="av">BK</span>{who} {ic("chev",16)}</summary>{menu}</details></div>')
    ws = '' if not right else f'<details class="dd" style="margin-left: 4px"><summary class="menu-btn" aria-haspopup="menu" title="Switch workspace" style="padding: 0 8px; font-weight: 600"><span class="av" data-lens="church" style="width: 26px; height: 26px; font-size: var(--t-11); background: var(--lens-soft); color: var(--lens)">B</span>BCS · India {ic("chev",14)}</summary><div class="glass-hi menu enter" role="menu" style="left: 0; right: auto"><div style="padding: 8px 12px 4px" class="micro">Your workspaces</div><a class="mi" href="Workspace.dc.html" role="menuitem"><span class="av" data-lens="church" style="width: 26px; height: 26px; font-size: var(--t-11); background: var(--lens-soft); color: var(--lens)">B</span>BCS · India <span style="margin-left: auto; color: var(--primary)">{ic("check",16)}</span></a><a class="mi" href="Workspace.dc.html" role="menuitem"><span class="av" style="width: 26px; height: 26px; font-size: var(--t-11)">S</span>Seed Company · partners</a><hr class="hr" style="margin: 4px 0"><a class="mi" href="Workspace.dc.html" role="menuitem">{ic("clipboard")} Open this workspace</a></div></details>'
    return f'<header class="top">{brand("Workspace.dc.html")}{ws}{crumbs}{rt}</header>'

STEPS = ['Details', 'The passage', 'Who will participate?', 'About each group', 'Launch']
def stepper(cur):
    out = []
    for i, s in enumerate(STEPS, 1):
        if i < cur:
            out.append(f'<a class="tab" href="Setup{i}.dc.html"><span class="dot done">{ic("check",13,2.5)}</span>{s}</a>')
        elif i == cur:
            out.append(f'<a class="tab" href="Setup{i}.dc.html" aria-current="page"><span class="dot" style="border-color: var(--primary); color: var(--primary)">{i}</span>{s}</a>')
        else:
            out.append(f'<span class="tab" style="color: var(--ink-3)"><span class="dot">{i}</span>{s}</span>')
    return f'<nav class="glass tabs" aria-label="Setup steps" style="width: 100%">{"".join(out)}</nav>'

def setup_shell(cur, title, body, foot, h):
    return (f'<div class="app" data-theme="{{{{theme}}}}" style="width: 1440px; height: {h}px">'
            '<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>'
            '<div class="layer l-shell">'
            f'<header class="top">{brand()}<span class="small" aria-hidden="true" style="color: var(--ink-3)">/</span><span class="h3">Start a 3D Review</span>'
            f'<div style="margin-left: auto; display: flex; align-items: center; gap: 12px"><span class="micro">Draft saved</span>{btn("Close", "Home.dc.html", "btn-quiet", lead="x")}</div></header>'
            '<div class="l-main" style="padding: var(--sp-6) 0 var(--sp-7)"><div class="l-page" data-w="narrow" style="gap: var(--sp-6)">'
            f'<div>{stepper(cur)}</div>'
            f'<section class="glass-hi enter l-stack" data-gap="6" style="border-radius: var(--radius-xl); padding: 40px 44px">'
            f'<h1 class="h1">{title}</h1>{body}'
            f'<div class="l-row" style="justify-content: space-between; padding-top: var(--sp-2)">{foot}</div>'
            '</section></div></div></div></div>')

TABS = [('Prepare', 'Setup5.dc.html'), ('Collect', 'Collect.dc.html'), ('Understand', 'Results.dc.html'), ('Improve', 'NextStep.dc.html')]
def review_tabs(cur, now, done_upto):
    out = []
    for i, (n, href) in enumerate(TABS, 1):
        dot = f'<span class="dot done">{ic("check",13,2.5)}</span>' if i <= done_upto else f'<span class="dot">{i}</span>'
        nowtag = ' <span class="now">Now</span>' if i == now else ''
        out.append(f'<a class="tab" href="{href}"{" aria-current=page" if i == cur else ""}>{dot}{n}{nowtag}</a>')
    return f'<nav class="glass tabs" aria-label="Review stages">{"".join(out)}</nav>'

STAGE = {'Setting up': 'setup', 'Collecting': 'collecting', 'Collection closed': 'closed', 'Results ready': 'results', 'Reviewed': 'reviewed', 'Completed': 'done', 'completed': 'done', 'collecting': 'collecting', 'setting up': 'setup', 'results ready': 'results'}
def status(label, color=None):
    st = STAGE.get(label)
    if st: return f'<span class="pill" data-stage="{st}"><i></i>{label}</span>'
    return f'<span class="tag"><i class="lensdot" aria-hidden="true" style="width: 8px; height: 8px; background: {color or "var(--ink-3)"}"></i>{label}</span>'

def review_head(stage_label, stage_color, cur, now, done_upto, primary, menu_open=False, name='Mark 1–4 draft', meta='Hindi New Testament · Hindi · Written', sub='Updated just now'):
    menu = ('<div class="glass-hi menu enter" role="menu" style="top: 50px; width: 320px">'
            + f'<a class="mi" href="Setup1.dc.html" role="menuitem">{ic("pen")} Edit details and dates</a>'
            + f'<a class="mi" href="People.dc.html" role="menuitem">{ic("people")} People with access</a>'
            + f'<a class="mi" href="CloseCollection.dc.html" role="menuitem">{ic("lock")} Close collection now</a>'
            + f'<a class="mi" href="Collect.dc.html#offline" role="menuitem">{ic("print")} Meeting offline? Print and paper</a>'
            + '<hr class="hr" style="margin: 4px 0">'
            + f'<button class="mi danger" type="button" role="menuitem">{ic("x")} Delete this review</button>'
            + '<p class="small" style="padding: 4px 12px 8px; font-size: var(--t-13)">Reviews with responses can\'t be deleted. This one has 18.</p></div>')
    return (f'<div style="display: flex; align-items: flex-start; gap: 24px">'
            f'<div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1">'
            f'<div style="display: flex; align-items: center; gap: 12px"><h1 class="title-page">{name}</h1>{status(stage_label, stage_color)}</div>'
            f'<p class="small" style="font-size: var(--t-15)">{meta} · <span style="color: var(--ink-3)">{sub}</span></p></div>'
            f'<div style="display: flex; gap: 8px; align-items: center; position: relative; flex-shrink: 0">'
            f'<details class="dd"{" open" if menu_open else ""}><summary class="btn btn-icon" aria-label="More actions" aria-haspopup="menu" title="More actions">{ic("dots",20)}</summary>{menu}</details>{primary}</div></div>'
            + review_tabs(cur, now, done_upto))

LEVELS = {'Strong': (4, 'var(--b-strong)'), 'Growing': (3, 'var(--b-growing)'), 'Needs support': (2, 'var(--b-support)'), 'Needs urgent attention': (1, 'var(--b-urgent)'), 'More input needed': (0, 'var(--b-more)')}
LEVEL_KEY = {'Strong': 'strong', 'Growing': 'growing', 'Needs support': 'support', 'Needs urgent attention': 'urgent', 'More input needed': 'more'}  # R9: .lvl[data-level] values (§4 level words)
def glyph_face(on):
    if on == 0: return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle></svg>'
    mouth = {4: 'M7.5 13.5c1.5 3 7.5 3 9 0', 3: 'M8 14c1.2 1.6 6.8 1.6 8 0', 2: 'M8 15h8', 1: 'M8 16c1.2-1.8 6.8-1.8 8 0'}[on]
    return f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="9" cy="10" r=".9" fill="currentColor"></circle><circle cx="15" cy="10" r=".9" fill="currentColor"></circle><path d="{mouth}"></path></svg>'
def glyph_jar(on):
    h = {4: 12, 3: 9, 2: 6, 1: 3, 0: 0}[on]
    fill = f'<rect x="7" y="{19-h}" width="10" height="{h}" fill="currentColor" opacity=".9"></rect>' if h else ''
    dash = ' stroke-dasharray="2.5 2.5"' if on == 0 else ''
    return f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"{dash}><path d="M8 4h8"></path><path d="M7 7h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"></path>{fill}</svg>'
def glyph_plant(on):
    if on == 0: return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 20h12"></path><path d="M12 20v-6"></path></svg>'
    leaves = {1: '<path d="M12 20v-5"></path>', 2: '<path d="M12 20v-7"></path><path d="M12 15c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z" fill="currentColor"></path>',
              3: '<path d="M12 20V9"></path><path d="M12 15c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z" fill="currentColor"></path><path d="M12 12c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z" fill="currentColor"></path>',
              4: '<path d="M12 20V6"></path><path d="M12 16c-3 0-5-2-5-5 3 0 5 2 5 5z" fill="currentColor"></path><path d="M12 13c3 0 5-2 5-5-3 0-5 2-5 5z" fill="currentColor"></path><path d="M12 9c-2 0-3-1-3-3 2 0 3 1 3 3z" fill="currentColor"></path>'}[on]
    return f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 20h12"></path>{leaves}</svg>'
def meter(level):
    on, _ = LEVELS[level]
    cls = 'meter gap' if on == 0 else 'meter'
    bars = ''.join(f'<b{" class=on" if i < on else ""}></b>' for i in range(4))
    return (f'<span class="lvl" data-level="{LEVEL_KEY[level]}"><span class="g g-bars {cls}" aria-hidden="true">{bars}</span><span class="g g-faces" aria-hidden="true">{glyph_face(on)}</span>'
            f'<span class="g g-jars" aria-hidden="true">{glyph_jar(on)}</span><span class="g g-plants" aria-hidden="true">{glyph_plant(on)}</span><span style="color: var(--ink)">{level}</span></span>')

def prov_panel(entries, w):
    # R45: review overlay drops .glass-hi's --sh-2 drop shadow (inline box-shadow keeps only --hl) so it never dims content under it
    if not entries: return ''
    rows = ''.join(f'<div style="display: grid; grid-template-columns: 200px 1fr; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: var(--t-13); line-height: 18px"><span style="font-weight: 650; color: var(--ink)">{html.escape(e)}</span><span style="color: var(--ink-2)">{html.escape(s)}</span></div>' for e, s in entries)
    pw = min(560, w - 32)
    return (f'<sc-if value="{{{{prov}}}}" hint-placeholder-val="{{{{false}}}}"><aside class="glass-hi" aria-label="Provenance" style="position: absolute; right: 16px; top: 16px; width: {pw}px; max-height: calc(100% - 32px); overflow: auto; z-index: 9; border-radius: var(--radius-l); padding: 16px 18px; background: var(--dialog); box-shadow: var(--hl)">'
            '<div style="display: flex; align-items: center; gap: 8px; padding-bottom: 8px"><span class="micro" style="color: var(--primary)">PROVENANCE</span><span class="micro">· where each element on this screen comes from · turn off in Tweaks</span></div>'
            f'{rows}</aside></sc-if>')

BANDS = ['Needs urgent attention', 'Needs support', 'Growing', 'Strong']
def band_of(score):
    # R35: the one level function — app v3ScoreBand() cuts (ui/assess/v3-assessment.js:80,83; captain 2026-09-24 12:22, provisional)
    return 'Strong' if score >= 75 else 'Growing' if score >= 60 else 'Needs support' if score >= 40 else 'Needs urgent attention'
def level(score):
    return 'More input needed' if score is None else band_of(score)
# R35: one score set for every board; levels are always level(score), never typed by hand.
# Constructs (cross-perspective, pinned-report-labels.json): (label, team, community, church), None = not asked.
CONSTRUCTS = [('Clarity / naturalness', 88, 30, 64), ('Impact / use', 72, 18, 70), ('Trust / readiness', 74, 72, 70), ('Brief & perceived fidelity', 90, None, 86), ('Understanding of the source', 72, None, 58), ('Appeal / beauty', None, 62, 71), ('Consistency', 70, None, 66)]
CSCORE = {n: dict(zip(['team', 'community', 'church'], v)) for n, *v in CONSTRUCTS}
# Areas (one perspective each, pinned-report-model.json subdimensions): name, score (None = fewer than 3 answers).
AREAS = {'team': [('Translation process & brief', 90), ('Understanding the source', 72), ('External review', 48), ('Consistency', 70), ('Governance', None)],
         'community': [('Understandable', 30), ('Appealing · written', 62), ('Impactful', 18), ('Trust & open feedback', 74)],
         'church': [('Confidence in the translation', 71), ('Readiness', 44), ('Translation brief', 86), ('Church involvement', 88), ('Affirmation', 70), ('Impact observation', None)]}
def area_levels(k):
    return [(a, level(s)) for a, s in AREAS[k]]
def area_level(k, name):
    return dict(area_levels(k))[name]
# R35 fix2: each perspective's overall score, so the overall level is level(score) too.
OVERALL = {'team': 68, 'community': 46, 'church': 66}
def overall(k):
    return level(OVERALL[k])
def short(l):  # prose short form already on the boards; R18/R20 still to rule on short forms outside ticks
    return 'Urgent' if l == 'Needs urgent attention' else l
def clevel(n, k):
    return level(CSCORE[n][k])
def apart(n):
    i = [BANDS.index(band_of(v)) for v in CSCORE[n].values() if v is not None]
    return max(i) - min(i)
def apart_words(n):
    a = apart(n)
    return 'same band' if a == 0 else f'{a} band{"s" if a > 1 else ""} apart'
def look_next():
    return ''.join(f'<li>{p} · {a} — {area_level(k, a)}</li>' for k, p, a in [('community', 'Community', 'Impactful'), ('community', 'Community', 'Understandable'), ('team', 'Translation team', 'External review')])
def band_barbell(area, who, scores, paper=False, phone=False):
    """Ruling 2026-10-15: outside the detailed report, perspectives sit on a four-band axis; no numbers."""
    pts = [(k, band_of(v)) for k, v in scores.items() if v is not None]
    idx = {b: i for i, b in enumerate(BANDS)}
    pos = {k: 12.5 + 25 * idx[b] for k, b in pts}
    # nudge perspectives sharing a band so all dots show
    seen = {}
    for k, b in pts:
        seen.setdefault(b, []).append(k)
    for b, ks in seen.items():
        for j, k in enumerate(ks): pos[k] += (j - (len(ks) - 1) / 2) * 5
    lo, hi = min(idx[b] for _, b in pts), max(idx[b] for _, b in pts)
    apart = hi - lo
    verdict = 'same band' if apart == 0 else ('1 band apart' if apart == 1 else f'{apart} bands apart — talk about this')
    ink = 'var(--ink)'; line = 'var(--line-2)'; soft = 'var(--line)'
    dots = ''.join(f'<span class="pt" data-lens="{k}" style="left: {pos[k]}%; top: {"11px" if paper else "18px"};{" width: 18px; height: 18px; margin-left: -9px; border: 3px solid #fff; box-shadow: 0 0 0 1px #c9d2da;" if paper else ""}" role="img" aria-label="{dict(LENS_NAMES)[k]} · {b}" title="{dict(LENS_NAMES)[k]} · {b}"></span>' for k, b in pts)
    ticks = ''.join(f'<span class="micro" style="position: absolute; left: {12.5 + 25 * i}%; bottom: -6px; transform: translateX(-50%); white-space: nowrap; font-size: var(--t-11)">{b.replace("Needs urgent attention", "Urgent").replace("Needs support", "Support")}</span>' for i, b in enumerate(BANDS))
    seps = ''.join(f'<span style="position: absolute; left: {25 * i}%; top: {"14px" if paper else "22px"}; width: 1px; height: {"12px" if paper else "14px"}; background: {line}"></span>' for i in range(1, 4))
    band = f'<span style="position: absolute; top: {"17px" if paper else "27px"}; height: 6px; border-radius: var(--radius-hair); left: {12.5 + 25 * lo}%; width: {25 * (hi - lo)}%; background: {"var(--b-urgent)" if apart >= 2 else line}; opacity: .8"></span>' if apart else ''
    axis = (f'<div style="position: relative; height: {"46px" if paper else "60px"}"><span style="position: absolute; left: 0; right: 0; top: {"19px" if paper else "29px"}; height: 2px; background: {soft}; border-radius: var(--radius-hair)"></span>{seps}{band}{dots}{ticks}</div>')
    notasked = [dict(LENS_NAMES)[k] for k, v in scores.items() if v is None]
    na = (f'<span class="small" style="color: var(--ink-3)"> · {", ".join(notasked)} not asked</span>' if notasked else '')
    if phone:  # R37: axis full card width, verdict below it (no desktop 220px columns)
        return (f'<div style="display: flex; flex-direction: column; gap: 4px">{axis}<span class="small"><strong style="color: var(--ink)">{verdict}</strong></span><span class="small">{" · ".join(dict(LENS_NAMES)[k] + " " + b for k, b in pts)}{na}</span></div>')
    if paper:
        return (f'<div style="display: grid; grid-template-columns: 180px 1fr 150px; gap: 14px; align-items: center; min-height: 56px"><span style="font-size: var(--t-13); font-weight: 600">{area}</span>{axis}<span style="font-size: var(--t-12); color: #555">{verdict}{na}</span></div>')
    return (f'<div class="glass" style="border-radius: var(--radius-l); padding: 18px 24px 24px; display: grid; grid-template-columns: 220px 1fr 220px; gap: 20px; align-items: center">'
            f'<div><div class="h3">{area}</div><span class="small">{who}</span></div>{axis}'
            f'<div style="display: flex; flex-direction: column; gap: 4px"><span class="small"><strong style="color: var(--ink)">{verdict}</strong></span><span class="small">{" · ".join(dict(LENS_NAMES)[k] + " " + b for k, b in pts)}{na}</span></div></div>')
LENS_NAMES = [('team', 'Translation team'), ('community', 'Community'), ('church', 'Church')]

def page(title, body, w, h, theme_prop=True, extra_props=None, prov=None):
    props = {"dark": {"editor": "boolean", "default": False, "section": "Theme"}, "imagery": {"editor": "enum", "default": "bars", "options": ["bars", "faces", "jars", "plants"], "section": "Levels"}, "provenance": {"editor": "boolean", "default": False, "section": "Notes"}, "$preview": {"width": w, "height": h}}
    if extra_props: props.update(extra_props)
    # placeholder: the build step swaps in prov_panel(PROV[name], w) so it overlays without changing layout
    # match the class list, not the literal attribute: shell() emits class="layer l-shell" (fresh-review 6302493905 #1)
    body, n = re.subn(r'<div class="layer(?=[\s"])', f'<!--PROV:{w}--><div class="layer', body, count=1)
    assert n == 1, f'{title}: no .layer div for the provenance placeholder'
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<title>{html.escape(title)}</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n{H}\n{body}\n</x-dc>\n'
            f"<script type=\"text/x-dc\" data-dc-script data-props='{json.dumps(props).replace(chr(39), '&#39;')}'>\n"
            "class Component extends DCLogic {\nrenderVals() {\nconst dark = this.props.dark ?? false;\nconst prov = this.props.provenance ?? false;\nconst imagery = this.props.imagery ?? 'bars';\nreturn { theme: dark ? 'dark' : 'light', prov, imagery };\n}\n}\n</script>\n</body>\n</html>\n")

def shell(body, w=1440, h=900, top=None):
    dw = ' data-w="phone"' if w < 720 else ''
    return (f'<div class="app"{dw} data-theme="{{{{theme}}}}" data-imagery="{{{{imagery}}}}" style="width: {w}px; height: {h}px">'
            '<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>'
            f'<div class="layer l-shell">{top or ""}{body}</div></div>')

def review_page(h, head, content, title):
    body = shell(f'{topbar(crumb="Mark 1–4 draft")}<main class="l-main"><div class="l-page">{head}{content}</div></main>', h=h)
    return page(title, body, 1440, h)

def phone(title, h, header, main, bar=None, w=390, hh=844):
    body = shell(f'{header}<main class="l-page l-phone" style="overflow: hidden">{main}</main>{("<div class=\"glass phone-bar\">" + bar + "</div>") if bar else ""}', w=w, h=hh)
    return page(title, body, w, hh)

def phone_header(lang=True, brandlabel=True):
    lang_btn = f'<button class="btn btn-quiet" type="button" aria-label="Language: English" style="padding: 0 10px">{ic("globe")} English {ic("chev",16)}</button>' if lang else ''
    return f'<header class="phone-top"><span class="brand" style="font-size: var(--t-16)">{MARK.format(s=26)}{"<span>3D Review</span>" if brandlabel else ""}</span>{lang_btn}</header>'

def qr(seed=7):
    cells = []
    import random
    r = random.Random(seed)
    for y in range(21):
        for x in range(21):
            finder = (x < 7 and y < 7) or (x > 13 and y < 7) or (x < 7 and y > 13)
            if finder:
                fx, fy = x % 14 if x > 13 else x, y % 14 if y > 13 else y
                on = fx in (0, 6) or fy in (0, 6) or (2 <= fx <= 4 and 2 <= fy <= 4)
            else:
                on = r.random() < .45
            cells.append('<i></i>' if on else '<i class="o"></i>')
    return f'<div class="qr" aria-hidden="true">{"".join(cells)}</div>'

# Language field: searchable suggestions state (app 0.29.1, ui/v3/language-picker.js). Borrows .chip (Setup2),
# the search input + icon (Setup2), .row-opt rows as result buttons and a quiet button; no new component.
def lang_picker(id_, phone=False):
    h = 52 if phone else 44
    chip = f'<div style="display: flex; flex-wrap: wrap; gap: 8px" aria-label="Selected language"><span class="chip">Odia · ory <button type="button" aria-label="Remove Odia · ory">{ic("x",12,2.5)}</button></span></div>'
    search = (f'<div style="position: relative"><input class="in" type="search" id="{id_}" value="odia" placeholder="Search by name or code" autocomplete="off" style="min-height: {h}px; padding-left: 40px">'
              f'<span style="position: absolute; left: 12px; top: {(h - 20) // 2}px; color: var(--ink-2)">{ic("search")}</span></div>')
    status = '<p class="small" role="status" style="margin: 0">1 match</p>'
    rows = ''.join(f'<button type="button" class="row-opt" style="font: inherit; color: var(--ink); text-align: left; width: 100%"><span style="font-weight: 600">{n} · {c}</span></button>'
                   for n, c in [('Adivasi Odia', 'ort')])
    add = btn('Add language…', kind='btn-quiet', lead='plus')
    return (f'<div style="display: flex; flex-direction: column; gap: 8px">{search}{chip}{status}'
            f'<div style="display: flex; flex-direction: column; gap: 6px">{rows}</div><div>{add}</div></div>')

# Community survey content — one source for every board that shows the survey (R33, pgl-c-01, pgl-c-03):
# PQuestion, PReview (phone), Print (paper preview), PaperEntry, ResultsAnswers. Question and answer strings verbatim from
# klappy/3d-review-app main @ae9bb35 migrations/0004_pinned_instruments.sql:12 (tpl_written v2, CW-Q1/Q2/Q3/Q7; audio :10 and
# video :11 carry the same strings). SURVEY_IDK is the design's own row (Sept 29 training: participants may say they don't know);
# the app's community items have no such option yet — CORRECTIONS.md R33. Never retype a question or answer on a board.
SURVEY_Q = {
    1: ('As a group, how would we describe how easy or difficult this translation is to understand?', 'single',
        ['Very easy to understand', 'Most of it is easy, but some parts are hard', 'Much of it is difficult to understand', 'We cannot understand it']),
    2: ('Where we find it difficult, what makes it hard?', 'multi',
        ['Some words are unfamiliar or strange', 'Some sentences are too long or complicated', 'It is not our dialect', "It doesn't sound like the way we normally speak", 'Other (please describe)']),
    3: ('How does this translation sound to us?', 'single',
        ['It sounds like our language — natural and beautiful', "Some parts sound good, some parts don't sound that good", 'It does not sound very good. This is not how our language sounds.', 'This is not our dialect']),
    7: ('As a group, how often do we use this translation?', 'single',
        ['We use it every day', 'We use it about 3 times per week', 'We use it occasionally', "We don't use it"]),
}
SURVEY_IDK = "I don't know"   # last row of every choice question, phone and paper alike; exclusive in a choose-all set (DS §2 Option row)
def survey_q(n):
    """(text, type, options + "I don't know") for question n — the only way a board gets survey copy."""
    t, k, o = SURVEY_Q[n]
    return t, k, o + [SURVEY_IDK]

# Help content — one source for Help (boards_res) and HelpPhone (boards_fphone); parity loop item 4.
HELP_SECS = ['What 3D Review is', 'The three perspectives', 'Running a review', 'Sharing and paper surveys', 'Reading results', 'Privacy', 'What changed', 'Common questions']
HELP_BODY = [None, None, None,
    'Each perspective answers its own survey. Under Collect, send the survey by message or show its QR code in the room; answers arrive as people finish. Where phones are not practical, print a blank survey: it carries the survey\'s actual questions and its QR code for the helper who enters the paper answers later — never access codes or anything personal.',
    'Under Understand, every perspective is placed on the same levels — Strong, Growing, Needs support, Needs urgent attention, or More input needed when too few have answered — and they are never averaged into one number. Read the gaps first: two perspectives two levels apart or more is where to start talking. Improve holds what you will talk about and do next.',
    'Your answers are confidential. When too few people from one perspective have answered, their results are hidden and the page says so; no number is shown that could point to someone. Printed surveys and QR codes carry nothing personal.',
    'Addresses from the old 3D Review site now forward to the new app: to the same project where there is a match, otherwise to Your reviews. The help that used to sit inside the steps now lives on this page, so the steps stay short. Forwarding moves no answers: anything entered on the old site stays there.',
    None]
HELP_FAQ = [('What is the 3D Review tool?', 'A survey-based review that shows a Bible translation\'s trustworthiness, usability and impact from three perspectives.'),
                               ('What are the three perspectives?', 'The translation team and staff (a view of the process); the church and local leaders (a view of use and community impact); and community members (a view of understandability, appeal and personal impact).'),
                               ('What kinds of projects is it suitable for?', 'Written, oral or video translation, in traditional and emerging models of quality assurance.'),
                               ('Does it replace consultant review?', 'No. It does not replace consultants or any other process or staff. It supplements them by showing process health, Scripture use and impact, and reception in the church. If no quality-assurance process is in place, the review flags that as needing attention.'),
                               ('How does it measure use and impact?', 'Community members say how the translation has shaped their understanding and their lives; church leaders record changes they observe in their congregations. The two can be compared.'),
                               ('What does the report include?', 'A high-level summary from each perspective, where to improve, and detailed comparisons that pinpoint disconnects. Repeated reviews show a trajectory over time.'),
                               ('Is there a right answer?', 'No. Participants are told there are no wrong answers and may say "I don\'t know".'),
                               ('How many answers do we need?', 'At least 3 from each perspective before levels show, so nobody can be picked out.'),
                               ('Can we do this on paper?', 'Yes. Print the survey in any answer language, collect it, and enter the answers under Collect.'),
                               ('What stage is 3D Review in?', 'Experimentation. Early-adopter teams are testing it and shaping the next iterations — your feedback is part of the product.'),
                               ('How can my team try it?', 'Use Send app feedback from the account menu, or ask the Innovation Lab team — the contact address lives on the Lab\'s 3D Review page.')]
