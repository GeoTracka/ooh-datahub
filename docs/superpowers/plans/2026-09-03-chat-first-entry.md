# Chat-first entry implementation plan

**Goal:** Make AI chat the first experience at the site, with manual campaign planning available through clearly labelled navigation.

**Architecture:** `/` redirects to `/chat`. The public chat shell never loads private threads without authentication; sending a guest message takes the visitor to sign-in and preserves their draft in tab-scoped storage. The existing manual planner moves intact to `/planner`. No database or AI endpoint permissions change.

**Tech stack:** Next.js App Router, React, existing CSS/Lucide, Vitest and Playwright.

## Design decision

Use a chat-first route with progressive disclosure of results. A chooser landing page adds an unnecessary decision; retaining the manual homepage with a chat button does not meet the request. Keep current brand styling. Show the conversation/composer prominently before results exist. On phones, opening an existing plan must not hide the chat; results remain available through explicit tabs. Use a native disclosure menu so navigation works with touch and keyboard without a modal overlay.

## Tasks

- [x] Add failing route/component regressions: guest shell visible without private threads; labelled manual link; saved plan opens in chat; guest submit makes no API call and preserves draft; fresh chat resets existing state. Root redirect covered by browser tests.
- [x] Move `src/app/(planner)/page.tsx` to `src/app/(planner)/planner/page.tsx`, add root redirect, and render guest chat shell from `src/app/chat/page.tsx` only on an authentication error.
- [x] Update `ChatWorkspaceShell.tsx`: optional user, auth-gated submit, restored draft, explicit new-chat reset, desktop/manual menu links and small-screen disclosure navigation. Keep mobile chat selected when artifacts arrive.
- [x] Update `chat.css`: centered full-width empty chat, results split only when available, bounded scroll with visible composer, readable navigation at tablet sizes, 44px controls. Add compact navigation inside the manual planner card rail, without covering map controls.
- [x] Run targeted tests, full test suite, typecheck, lint and production build. Review browser at 1440, 1024, 820, 375 and landscape sizes; verify guest, signed-in and manual flows.
- [x] Commit verified work, merge main, deploy with candidate health check and retained rollback; confirm live route/menu behavior.

## Acceptance

Visiting the bare domain shows a usable chat composer rather than the manual wizard or a login wall. Guests must sign in before any AI call. Existing private thread URLs retain authentication and ownership checks. Manual planning and return-to-chat links are visible and keyboard accessible. Chat remains visible by default on mobile. No private data is rendered in guest HTML.

## Local verification

- Full suite: 112 files / 461 tests passed; subsequent modifier-click regression also passed (8 entry tests).
- Browser: nine entry/manual-flow checks passed, plus nine sector/fine-tune checks.
- Build/typecheck and client-secret scan passed. Lint has zero errors, one existing unused-variable warning in the entity-resolution script.
- Independent review: scoped manual card sizing to desktop; protected unavailable artifact previews from blanking mobile chat; used Link onNavigate so modifier-click preserves the current tab.
- Deployed application commit `fa2954e` to `https://ooh.brainpad.me` on 2026-09-03. Container healthy with zero restarts; previous `73df8c5` container retained as rollback.
- Live guest landing, draft restoration after sign-in, real AI response, conversation reload at 375px, manual navigation and return-to-chat passed. No chat error banners; only an environment-blocked Cloudflare analytics beacon and unused preload warnings were observed.
- Temporary live test thread deleted via the authenticated API (204); subsequent GET returned 404. Signed out after testing. Temporary candidate container removed.
