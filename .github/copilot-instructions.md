# Project Guidelines

## Build and Test
- Use `npm run compile` after TypeScript changes.
- Use `npm run lint` for touched TypeScript files when practical; repo-wide lint may include unrelated backlog.
- Use `npm run test` only after a clean compile and lint pass because `pretest` runs both automatically.
- Use `npm run package` when the user asks to reinstall or validate the packaged extension.
- After any extension source edit, run the extension, test the changed behavior, and reinstall the packaged VSIX before considering the work complete.

## Architecture
- Keep the existing extension layering: `src/api` for Codeforces HTTP access, `src/services` for stateful singletons, `src/views` for tree providers and webviews, and `src/commands` for command registration.
- Follow the established `initX()` and `getX()` singleton pattern for services and views instead of constructing ad hoc instances.
- Register new UI actions through `src/commands/index.ts`, then wire them into tree items or `package.json` menus.
- Treat `src/extension.ts` as the orchestration point for activation, context keys, providers, and status bar wiring.

## Conventions
- Read `CODEFORCES_EXTENSION_PLAN.md` before starting substantive work, and update its completed items and verification steps when work is finished.
- Preserve the current caching approach in `storageService`: prefer TTL-backed cache reads and explicit refresh paths instead of hidden invalidation.
- Keep profile, contests, and problems views responsive by showing loading, empty, and error states rather than returning a silent empty tree.
- When problem HTML fetches fail with Codeforces `403`, preserve the existing fallback flow instead of introducing a new scrape path.
- Keep new code consistent with the current TypeScript style: explicit interfaces for tree items and domain models, small service methods, and minimal inline comments.

## Pitfalls
- Codeforces API calls are rate-limited in the client; avoid adding request bursts that bypass the existing API wrapper.
- Packaging currently includes many unnecessary files because the repo has no `.vscodeignore`; be careful when changing packaging behavior.
- The installed extension uses the packaged VSIX, so UI changes may require `npm run package` and reinstall, not just source edits.
- The `codeforces.showRatingGraph` command is expected by the profile UI; keep tree actions and command registrations in sync.