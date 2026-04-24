/**
 * Local-development switches.
 *
 *  - `LOCAL_DEV_NO_AUTH=true` disables Clerk entirely, skips middleware
 *    protection, and auto-provisions a single "local dev" user so you can
 *    exercise the full app without creating real accounts.
 *
 *  - `AI_USE_CUSTOM_PROMPT=true` switches the analysis pipeline to a
 *    single-image "test" mode that sends exactly one prompt (see
 *    `src/lib/ai/custom-prompt.ts`) to the active AI provider.
 *
 * Keep these OFF in production.
 */

export const DEV_NO_AUTH = process.env.LOCAL_DEV_NO_AUTH === "true";

export const DEV_LOCAL_CLERK_ID = "dev-local-user";
export const DEV_LOCAL_EMAIL = "dev-local@barberscan.test";

export const USE_CUSTOM_PROMPT = process.env.AI_USE_CUSTOM_PROMPT === "true";
