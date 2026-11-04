// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import Share from "../ui-next/src/screens/actions/Share.svelte";
import EmailDraft from "../ui-next/src/screens/actions/EmailDraft.svelte";
import ActionPlan from "../ui-next/src/screens/actions/ActionPlan.svelte";
import R from "../ui-next/fixtures/actions/review.json";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
const review = { ...R, host: "https://review.example/#survey=", shortHost: "https://review.example/#survey=", review: { ...R.review, title: "Luke & Acts?" }, surveys: [{ ...R.surveys[0], name: "Team & translators", code: "real-issued-token" }] };
const plan = { doc: "Next steps", meta: "Current report", talk: [["Trust & feedback", "2 levels apart"], ["Translation brief", "Needs support"]], review: { title: "Luke & Acts?", project: "Project", builtOn: "Today", responses: 7 }, stage: "reviewed", foot: "From the built report" };

for (const phone of [false, true]) describe(phone ? "phone email handoff" : "desktop email handoff", () => {
  it("prepares actual survey links in a recipient-free mail composer and copies the same message", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const view = render(Share, { phone, data: review, role: "member" });
    await fireEvent.click(view.getByRole("button", { name: "Email the links to someone" }));
    const draft = view.getByRole("dialog", { name: "Email draft" });
    const body = (draft.querySelector("textarea") as HTMLTextAreaElement).value;
    expect(body).toContain("Team & translators: https://review.example/#survey=real-issued-token");
    expect(body).not.toContain("proj_");
    const mail = new URL((view.getByRole("link", { name: "Open email app" }) as HTMLAnchorElement).href);
    expect(mail.protocol).toBe("mailto:"); expect(mail.pathname).toBe("");
    expect(mail.searchParams.get("subject")).toBe("Survey links: Luke & Acts?");
    expect(mail.searchParams.get("body")).toBe(body);
    await fireEvent.click(view.getByRole("button", { name: "Copy message" }));
    expect(writeText).toHaveBeenCalledWith(body);
    expect(draft.textContent).toContain("Message copied. Paste it into your email.");
    await fireEvent.click(view.getByRole("button", { name: "Close", exact: true }));
    expect(draft.hasAttribute("open")).toBe(false);
  });
  it.each(["viewer", "participant"])("does not offer bulk link disclosure to %s", role => {
    const view = render(Share, { phone, data: review, role });
    expect(view.queryByRole("button", { name: "Email the links to someone" })).toBeNull();
  });
  it("does not prepare an empty survey email", () => {
    const view = render(Share, { phone, data: { ...review, surveys: [] }, role: "owner" });
    expect(view.queryByRole("button", { name: "Email the links to someone" })).toBeNull();
  });
  it("emails the current discussion text without inventing a plan link and leaves a manual fallback on clipboard refusal", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const view = render(ActionPlan, { phone, data: plan });
    await fireEvent.click(view.getByRole("button", { name: "Email it" }));
    const draft = view.getByRole("dialog", { name: "Email draft" });
    const field = draft.querySelector("textarea") as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toContain("1. Trust & feedback — 2 levels apart");
    expect(field.value).toContain("2. Translation brief — Needs support");
    expect(field.value).toContain("What we noticed:"); expect(field.value).toContain("The next step:");
    expect(field.value).not.toContain("https:");
    await fireEvent.click(view.getByRole("button", { name: "Copy message" }));
    expect(draft.textContent).toContain("Copy failed. Select the message below and copy it.");
    expect(draft.textContent).toContain("Nothing is sent from 3D Review.");
  });
});

// A long multi-survey draft stays complete; mail-handler limits have the selectable/copy fallback.
it("retains all links and special characters in a long multi-survey draft without sending", async () => {
  const surveys = Array.from({ length: 100 }, (_, i) => ({ ...review.surveys[0], name: `Survey ${i} & team`, code: `issued_${i}_${"x".repeat(80)}` }));
  const view = render(Share, { data: { ...review, surveys }, role: "owner" });
  await fireEvent.click(view.getByRole("button", { name: "Email the links to someone" }));
  const draft = view.getByRole("dialog", { name: "Email draft" });
  const body = (draft.querySelector("textarea") as HTMLTextAreaElement).value;
  const mail = new URL((view.getByRole("link", { name: "Open email app" }) as HTMLAnchorElement).href);
  expect(body.length).toBeGreaterThan(12000);
  expect(mail.searchParams.get("body")).toBe(body);
  expect(body).toContain("Survey 99 & team: https://review.example/#survey=issued_99_");
  expect(draft.textContent).toContain("If your email app does not open, copy the message into your email.");
});

it("reuses the dialog title row and phone sheet with unique accessible titles",async()=>{
 const view=render(Share,{phone:true,data:review,role:'owner'});const trigger=view.getByRole('button',{name:'Email the links to someone'});expect(trigger.classList.contains('btn-block')).toBe(true);await fireEvent.click(trigger);
 const dialog=view.getByRole('dialog',{name:'Email draft'});expect(dialog.classList.contains('sheet')).toBe(true);expect(dialog.getAttribute('closedby')).toBe('any');expect(dialog.querySelector('.sheet-handle')).not.toBeNull();expect(dialog.querySelector('.l-row .btn-icon[aria-label="Close"]')).not.toBeNull();expect(dialog.querySelectorAll('.btn-primary')).toHaveLength(1);expect(view.container.querySelectorAll('.btn-primary')).toHaveLength(1);expect(dialog.querySelector('.btn-primary')?.textContent).toBe('Open email app');
 const other=render(EmailDraft,{subject:'Other',body:'Other'});expect(other.container.querySelector('dialog')?.getAttribute('aria-labelledby')).not.toBe(dialog.getAttribute('aria-labelledby'));
});
it("keeps the draft closed until requested and reuses backdrop dismissal",async()=>{
 const view=render(EmailDraft,{subject:'Survey',body:'Actual message'});const dialog=view.container.querySelector('dialog')!;expect(dialog.open).toBe(false);
 await fireEvent.click(view.getByRole('button',{name:'Prepare email'}));expect(dialog.open).toBe(true);
 vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue({left:10,right:210,top:10,bottom:210,width:200,height:200,x:10,y:10,toJSON:()=>({})});
 await fireEvent.click(dialog,{clientX:1,clientY:1});expect(dialog.open).toBe(false);
});
