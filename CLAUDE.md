# CLAUDE.md — PulseIQ Project Instructions

> This file is automatically loaded by Claude Code at the start of every session.
> The canonical source of truth for all rules is [`CONTRIBUTING.md`](CONTRIBUTING.md).
> Always read CONTRIBUTING.md before making structural decisions. The rules below are the
> actionable summary Claude must follow for every task in this repo.

---

## What this project is

PulseIQ is a **multi-industry intelligence platform** (FMCG, Healthcare, Logistics, Education, Fintech, Real Estate).
All industries share one React frontend, one FastAPI backend, and one Supabase database.
Industry-specific code is **strictly namespaced** — never touch another industry's folder.

---

## File placement rules (strict — never violate)

### Frontend
| What | Where |
|------|-------|
| Industry pages | `src/industries/<industry>/pages/` |
| Industry components | `src/industries/<industry>/components/` |
| Industry routes | `src/industries/<industry>/routes.jsx` |
| Shared UI (design system) | `src/components/ui/` — **never edit these** |
| Shared layout / chat / data upload | `src/components/layout/`, `src/components/chat/`, `src/components/data/` |
| Pages identical across all industries | `src/pages/` (Landing, Login, Signup, Onboarding, Profile, Settings, NotFound only) |
| API calls | `src/lib/api.js` — never call `fetch()` or `axios` directly in a page |
| Zustand stores | `src/stores/` — do not create new global stores for industry-specific state |

### Backend
| What | Where |
|------|-------|
| Industry routers | `backend/app/routers/<industry>/` |
| Industry services / logic | `backend/app/services/<industry>/` |
| Industry Pydantic models | `backend/app/models/<industry>/` |
| Shared auth, config, DB client | `backend/app/routers/auth.py`, `backend/app/config.py`, `backend/app/utils/supabase_client.py` |
| Database schema changes | `backend/database/schema.sql` — coordinate with lead before adding tables |

---

## Branching rules

- **Always branch from `dev`**, never from `main`.
- **PRs always target `dev`**, never `main` directly.
- Only the project lead merges `dev → main`.

### Branch naming format
```
feature/<industry>/frontend/<name>   # e.g. feature/fmcg/frontend/demand-chart-v2
feature/<industry>/backend/<name>    # e.g. feature/fmcg/backend/inventory-api
feature/common/<name>                # shared code changes
fix/<industry>/<description>         # bug fixes
experiment/<industry>/<name>         # never merged to dev directly
```

### Starting a new branch
```bash
git checkout dev
git pull origin dev
git checkout -b feature/fmcg/frontend/my-feature
```

---

## Git commit authorship (strict)

- Every commit must be authored by **`rinisoni-aiml`** (the personal GitHub account), never from the organisation/company account.
- **Never** add a `Co-Authored-By:` line — not for Claude, not for any other tool or account.
- The commit message ends after the description — no trailers, no footers, no attribution lines of any kind.

---

## Commit message format (Conventional Commits — mandatory)

```
<type>(<scope>): <short description>
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no functional change |
| `test` | Adding or fixing tests |
| `chore` | Dependency updates, config |

**Scope** = industry name (`fmcg`, `healthcare`, `logistics`, etc.) or `common` for shared changes.

**Examples:**
```
feat(fmcg): add SKU-level demand forecasting endpoint
fix(healthcare): resolve date parsing bug in patient data upload
refactor(fmcg): move inventory service to industry subfolder
chore(common): upgrade react-query to v5
```

---

## Pull request rules

- Title format: same as commit format — `feat(fmcg): demand forecasting dashboard`
- Target branch: **`dev`** always
- Before opening a PR, verify:
  - Branched from `dev`
  - All industry code is inside the correct `src/industries/<industry>/` or `backend/app/routers/<industry>/` folder
  - If a shared file was touched, explain why in the PR body
  - No `.env` files, hardcoded secrets, or production URLs in the diff
  - No `console.log` in production code

---

## Code rules

### Frontend
- Use **Tailwind utility classes only** — no `.css` files in industry folders
- Use CSS variables from the design system — do not hardcode hex colours
- Server state: use `@tanstack/react-query` (`useQuery` / `useMutation`)
- Client state: use existing Zustand stores in `src/stores/`
- Internal navigation: use React Router `<Link>` or `useNavigate()` — not `<a href>`
- Import alias: use `@/` (maps to `src/`) — never use relative paths like `../../lib/api`

### Backend
- Every route URL must be prefixed `/api/<industry>/`
- Every route must use `get_current_user` dependency — never return unfiltered data
- Always filter DB queries by `uid`
- Graceful error handling: reads return `[]` / `{}` on exception; mutations raise `HTTPException`
- Never create a second Supabase client — always import from `app.utils.supabase_client`

### Environment variables
- Frontend: prefix `VITE_`, access as `import.meta.env.VITE_*`
- Backend: managed via `backend/app/config.py` (pydantic-settings), access as `settings.<key>`
- **Never commit `.env` or `backend/.env`** — only commit `.env.example` with placeholders

---

## Running locally

```bash
# Frontend (from repo root)
npm install && npm run dev          # http://localhost:5173

# Backend
cd backend
source venv/bin/activate            # Windows: venv\Scripts\activate
uvicorn app.main:app --reload       # http://localhost:8000
# Swagger docs: http://localhost:8000/docs
```

---

## Current active industry: FMCG

The FMCG feature set is actively being developed on branch `feature/common/repo-structure`.
Key FMCG paths:
- Frontend pages: `src/industries/fmcg/pages/`
- Backend routers: `backend/app/routers/fmcg/`
- Backend services: `backend/app/services/fmcg/`
- API calls: `src/lib/api.js` under the `// ── FMCG ──` sections
- State: `src/stores/fmcgStore.js` (Zustand + localStorage for forecast/inventory results)
- Database: Supabase — see `backend/database/schema.sql` for all table definitions
