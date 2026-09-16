/** Capability id → handler. Lane B rows here; Lane A adds domain rows (workspace/project/assessment/template/survey/participant/response/results/grant/request/support) — merge, don't replace. Missing v2.0 ids answer 501 RESERVED_NOT_BUILT honestly. */
import type { Handler } from "./types";
import * as p from "./platform";
import { docs } from "./docs";
import { opsUndo } from "./undo";
import { handlers as workspace } from "./workspace";

export const handlers: Record<string, Handler> = {
  "cap.entry.intents": p.entryIntents,
  "cap.entry.example": p.entryExample,
  "cap.auth.request_link": p.authRequestLink,
  "cap.auth.consume_link": p.authConsumeLink,
  "cap.auth.logout": p.authLogout,
  "cap.auth.me": p.authMe,
  "cap.ops.health": p.opsHealth,
  "cap.ops.feedback": p.opsFeedback,
  "cap.ops.trace": p.opsTrace,
  "cap.ops.undo": opsUndo,
  "cap.docs.get": docs,
  "cap.docs.capabilities": p.docsCapabilities,
  "cap.docs.openapi": p.docsOpenapi,
  // Lane A domain handlers (draft seed; Lane A owns): 
  ...workspace,
};
