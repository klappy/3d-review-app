// UI Next (v4) explore lane: Help and FAQ copy, word for word from the boards (cookbook design/2026-10-15-glass-redesign/canvas
// Help.dc.html desktop, HelpPhone.dc.html phone). Status: provisional. No current-UI module holds this copy (searched ui/ and ui-next/src).
// TOPICS: [id, title, desktop paragraph, phone paragraph]. A desktop paragraph is a list of runs; odd runs are bold (the board's <strong>).
export const INTRO = "Everything that used to be inside the steps now lives here. The steps stay short.";
export const VIDEO = Object.freeze({ title: "What 3D Review is", duration: "2:10", also: "Also: The three perspectives (1:40) · Running a review (3:05)" });
export const TOPICS = Object.freeze([
  ["h1", "What 3D Review is",
    ["3D Review assesses the health of how a translation is being carried out — not the words themselves. It gathers short surveys from the translation team, the community and the church, and shows where they agree and where they don't. It sits alongside your checking tools and your consultant; it replaces neither."],
    "It assesses the health of how a translation is carried out — not the words. Short surveys from the team, the community and the church show where they agree and where they don't. It sits alongside your checking tools and your consultant."],
  ["h2", "The three perspectives",
    ["The ", "translation team", " speaks to preparation, review, feedback and how a passage is judged ready. The ", "community", " speaks to understanding, trust and use. The ", "church", " speaks to involvement, confidence and readiness to use the translation in church life. Results are never averaged: a gap between them is the signal."],
    "The translation team speaks to preparation, review and readiness; the community to understanding, trust and use; the church to involvement and confidence. Never averaged: a gap is the signal."],
  ["h3", "Running a review",
    ["Prepare (name it, attach the passage, choose who takes part), Collect (send the survey, QR codes or paper), Understand (levels and gaps), Improve (what you will talk about and do next). The questions are set; you don't write them. Read or play the passage to everyone before they answer."],
    "Prepare, Collect, Understand, Improve. The questions are set. Read or play the passage to everyone before they answer."],
  ["h4", "Sharing and paper surveys",
    ["Each perspective answers its own survey. Under Collect, send the survey by message or show its QR code in the room; answers arrive as people finish. Where phones are not practical, print a blank survey: it carries the survey's actual questions and its QR code for the helper who enters the paper answers later — never access codes or anything personal."],
    "Each perspective answers its own survey. Under Collect, send the survey by message or show its QR code in the room; answers arrive as people finish. Where phones are not practical, print a blank survey: it carries the survey's actual questions and its QR code for the helper who enters the paper answers later — never access codes or anything personal."],
  ["h5", "Reading results",
    ["Under Understand, every perspective is placed on the same levels — Strong, Growing, Needs support, Needs urgent attention, or More input needed when too few have answered — and they are never averaged into one number. Read the gaps first: two perspectives two levels apart or more is where to start talking. Improve holds what you will talk about and do next."],
    "Under Understand, every perspective is placed on the same levels — Strong, Growing, Needs support, Needs urgent attention, or More input needed when too few have answered — and they are never averaged into one number. Read the gaps first: two perspectives two levels apart or more is where to start talking. Improve holds what you will talk about and do next."],
  ["h6", "Privacy",
    ["Your answers are confidential. When too few people from one perspective have answered, their results are hidden and the page says so; no number is shown that could point to someone. Printed surveys and QR codes carry nothing personal."],
    "Your answers are confidential. When too few people from one perspective have answered, their results are hidden and the page says so; no number is shown that could point to someone. Printed surveys and QR codes carry nothing personal."],
  ["h7", "What changed",
    ["Addresses from the old 3D Review site now forward to the new app: to the same project where there is a match, otherwise to Your reviews. The help that used to sit inside the steps now lives on this page, so the steps stay short. Forwarding moves no answers: anything entered on the old site stays there."],
    "Addresses from the old 3D Review site now forward to the new app: to the same project where there is a match, otherwise to Your reviews. The help that used to sit inside the steps now lives on this page, so the steps stay short. Forwarding moves no answers: anything entered on the old site stays there."],
]);
export const FAQ_TITLE = Object.freeze(["h8", "Common questions"]);
export const FAQ = Object.freeze([
  ["What is the 3D Review tool?", "A survey-based review that shows a Bible translation's trustworthiness, usability and impact from three perspectives."],
  ["What are the three perspectives?", "The translation team and staff (a view of the process); the church and local leaders (a view of use and community impact); and community members (a view of understandability, appeal and personal impact)."],
  ["What kinds of projects is it suitable for?", "Written, oral or video translation, in traditional and emerging models of quality assurance."],
  ["Does it replace consultant review?", "No. It does not replace consultants or any other process or staff. It supplements them by showing process health, Scripture use and impact, and reception in the church. If no quality-assurance process is in place, the review flags that as needing attention."],
  ["How does it measure use and impact?", "Community members say how the translation has shaped their understanding and their lives; church leaders record changes they observe in their congregations. The two can be compared."],
  ["What does the report include?", "A high-level summary from each perspective, where to improve, and detailed comparisons that pinpoint disconnects. Repeated reviews show a trajectory over time."],
  ["Is there a right answer?", "No. Participants are told there are no wrong answers and may say \"I don't know\"."],
  ["How many answers do we need?", "At least 3 from each perspective before levels show, so nobody can be picked out."],
  ["Can we do this on paper?", "Yes. Print the survey in any answer language, collect it, and enter the answers under Collect."],
  ["What stage is 3D Review in?", "Experimentation. Early-adopter teams are testing it and shaping the next iterations — your feedback is part of the product."],
  ["How can my team try it?", "Use Send app feedback from the account menu, or ask the Innovation Lab team — the contact address lives on the Lab's 3D Review page."],
]);
