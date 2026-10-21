// UI Next (v4) people lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the people lane cook of the screens fanout: only that lane edits this file (and the rest of screens/people/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas) -> screen: People/PeoplePhone -> people; PeopleWorkspace/PeopleWorkspacePhone ->
// people-workspace; Workspace/WorkspacePhone -> workspace; WorkspaceGroup/WorkspaceGroupPhone -> workspace-group; Invitations/InvitationsPhone
// -> invitations; SignInPhone -> sign-in (&w=phone); SignInCheck/SignInCheckPhone -> sign-in-check. Phone twins: &w=phone.
import People from "./People.svelte";
import PeopleWorkspace from "./PeopleWorkspace.svelte";
import Workspace from "./Workspace.svelte";
import WorkspaceGroup from "./WorkspaceGroup.svelte";
import Invitations from "./Invitations.svelte";
import SignIn from "./SignIn.svelte";
import SignInCheck from "./SignInCheck.svelte";

export default {
  people: People,
  "people-workspace": PeopleWorkspace,
  workspace: Workspace,
  "workspace-group": WorkspaceGroup,
  invitations: Invitations,
  "sign-in": SignIn,
  "sign-in-check": SignInCheck,
};
