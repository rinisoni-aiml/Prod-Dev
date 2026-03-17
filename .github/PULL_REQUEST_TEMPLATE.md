## What does this PR do?

<!-- One paragraph summary. State the feature, fix, or change clearly. -->

## Type of change

- [ ] New feature (industry-specific)
- [ ] New feature (shared/common)
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs update

## Industry / Scope

<!-- e.g. FMCG, Healthcare, Common -->

## Checklist

**Structure**
- [ ] Industry-specific frontend pages are in `src/industries/<industry>/pages/`
- [ ] Industry-specific backend routes are in `backend/app/routers/<industry>/`
- [ ] Shared files (`src/components/`, `src/lib/`, `backend/app/routers/auth.py`, etc.) were NOT modified — or if they were, it is explicitly called out below

**Code quality**
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run test` passes (or new tests added for new features)
- [ ] No `console.log` left in production code
- [ ] No hardcoded credentials, API keys, or environment-specific URLs

**Git hygiene**
- [ ] This PR targets `dev`, NOT `main`
- [ ] Branch name follows convention: `feature/<industry>/<frontend|backend>/<name>`
- [ ] Commits follow Conventional Commits format: `feat(fmcg): ...`
- [ ] No `.env` files committed

**If shared files were modified, describe why:**

<!-- Leave blank if no shared files were changed -->

## How to test locally

1. `npm install && npm run dev`
2. `cd backend && uvicorn app.main:app --reload`
3. Steps to trigger the change:
   -
   -

## Screenshots (if UI change)

<!-- Paste before/after screenshots here -->
