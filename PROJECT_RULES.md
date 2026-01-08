# Inoia Backend — Project Rules for AI Coding Agent

These rules **must be followed** for all work on Inoia. They keep the backend secure, safe for mental health use, testable, and professional.

## 1. Mental Health Safety (MUST — Highest Priority)
- AI chat listener **MUST**:
  - Be empathetic, validating, non-judgmental
  - Use open-ended questions and reflective listening
  - **NEVER** diagnose, prescribe medication, or give medical advice
  - Detect high-risk content via analysis (riskLevel 0-10)
  - At riskLevel ≥ 7: gently suggest professional help in response
  - At riskLevel ≥ 8: override with strong safety fallback message
- Up/down voting is allowed — monitor impact via reports
- Reporting & moderation system **MUST** remain fully functional

## 2. Security (MUST)
- Default authentication: `AtGuard` (global JWT guard)
  - Exceptions allowed: `RtGuard` (refresh), `OptionalAuthGuard`, documented webhooks
- Roles enforcement via `RolesGuard` (global)
- Rate limiting **SHOULD** be applied to abuse-prone endpoints (auth, reports, content creation)
- Input validation via DTOs + global ValidationPipe **MUST** remain active
- Stack traces **MUST** be hidden in production (via exception filter)

## 3. Data Exposure & Privacy (MUST)
- **NEVER** return secrets (passwordHash, refreshTokenHash, resetToken, verificationToken)
- Public UUIDs (userId, postId, etc.) **MUST** be returned when needed for client functionality
- User endpoints (e.g., /users/me) **MUST** exclude sensitive fields using Prisma select or DTO mapping
- Chat content is stored for product functionality — avoid adding extra PII
- **NEVER** log raw user messages or full AI responses containing sensitive content
  - On error, log only error type (not message content)

## 4. Code Quality & Best Practices (MUST/SHOULD)
- Follow NestJS conventions: modules, services, controllers, DTOs
- Changes **SHOULD** be focused: one feature = one logical commit
- Prefer small, incremental changes
- Use meaningful names; comment only complex logic
- Avoid unnecessary `any` — prefer proper types or `unknown` with assertions

## 5. Linting & Type Safety (SHOULD)
- Current ~20–25 `@typescript-eslint/no-unsafe-*` warnings are acceptable (common in NestJS + Prisma)
- **MUST NOT** introduce new lint errors in touched files
- Fix obvious issues in changed files (unused imports, syntax)
- Use targeted `// eslint-disable-next-line` with reason when needed
- Avoid `@ts-ignore` except for unavoidable library gaps
- Never trigger large refactors just for linting

## 6. Testing (MUST)
- After any change:
  - `npm run build` **MUST** pass
  - Run relevant tests:
    - API/DB/auth changes → `npm run test:e2e` (full suite)
    - Minor changes → targeted unit tests
- **NEVER** ignore failing tests
- Add E2E tests for new endpoints
- Add unit tests for complex service logic
- Keep useful verification scripts (e.g., `scripts/manual-e2e-test.js`)

## 7. Prisma & Database (MUST)
- Schema changes require proper migration
- Avoid raw SQL unless necessary
- Update E2E tests and cleanDb when adding models/relations

## 8. Git & Commits (MUST)
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- Messages must be clear and descriptive
- Push only when explicitly instructed
- Keep valuable scripts in repo
- Do not commit temporary files or secrets

## 9. General
- Prioritize **functionality, user safety, and mental health impact**
- If uncertain about requirements, ask before major changes

Last updated: January 08, 2026