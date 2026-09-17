// vitest-only stand-in for the runtime module the borrowed OAuth provider imports.
export class WorkerEntrypoint<E = unknown, P = unknown> { ctx: any; env: E; constructor(ctx: any, env: E) { this.ctx = ctx; this.env = env; } }
