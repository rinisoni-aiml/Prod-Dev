# Contributing to PulseIQ

> **For AI tools (Claude, Copilot, etc.):** This document is the single source of truth for how this repository is structured and how contributors should add code. Always read this before generating or modifying code in this repo.

> **For humans (interns, contributors):** Read this once, end to end, before touching any code. It tells you exactly where to put things, how to name things, and how to raise a PR. It will save you from painful merge conflicts later.

---

## Table of Contents

1. [What this project is](#1-what-this-project-is)
2. [One database, one auth system](#2-one-database-one-auth-system)
3. [Exact directory structure](#3-exact-directory-structure)
4. [What is shared vs industry-specific](#4-what-is-shared-vs-industry-specific)
5. [How to add a new industry](#5-how-to-add-a-new-industry)
6. [Branching strategy](#6-branching-strategy)
7. [Workflow: branch → dev → main](#7-workflow-branch--dev--main)
8. [Frontend rules](#8-frontend-rules)
9. [Backend rules](#9-backend-rules)
10. [Commit message format](#10-commit-message-format)
11. [Pull request rules](#11-pull-request-rules)
12. [Environment variables](#12-environment-variables)
13. [Running the project locally](#13-running-the-project-locally)
14. [Conflict prevention checklist](#14-conflict-prevention-checklist)

---

## 1. What this project is

PulseIQ is a multi-industry intelligence platform. Each industry (FMCG, Healthcare, Logistics, Education, Fintech, Real Estate) gets its own dashboard and AI-powered use cases, but they all share:

- The same React frontend theme and design system
- The same landing page, login, signup, and onboarding flow
- The same Supabase database (one DB, one auth system)
- The same FastAPI backend server (routes are namespaced per industry)

The platform determines which industry-specific features to show based on the logged-in user's `industry` field set during onboarding.

At the end of development, everything merges into one codebase and deploys as one app on Vercel.

---

## 2. One database, one auth system

**There is one Supabase project for all industries.** Do not create separate databases.

- **Authentication** is handled by Supabase Auth. Every user gets one account regardless of industry.
- **Onboarding** sets `profiles.industry` for the user (`fmcg`, `healthcare`, `logistics`, etc.).
- **Row-level security (RLS)** in Supabase ensures each user only sees their own data. Always use `user_id = auth.uid()` in your RLS policies.
- **Tables** should be prefixed with the industry name if they are industry-specific (e.g. `fmcg_inventory_items`), unless the table is truly universal.
- **Shared tables** (e.g. `profiles`, `chat_sessions`, `data_files`) are used by all industries.

---

## 3. Exact directory structure

This is the **canonical structure**. Every file must go in its correct place. Do not create top-level folders not listed here.

```
Prod-dev/
│
├── src/                          ← Frontend (React + Vite)
│   ├── components/               ← SHARED UI components
│   │   ├── ui/                   ← shadcn/ui — DO NOT edit these files
│   │   ├── layout/               ← AppLayout, shared navigation shell
│   │   ├── landing/              ← Landing page sections (Hero, Footer, etc.)
│   │   ├── chat/                 ← AI chat drawer (shared across industries)
│   │   ├── data/                 ← Data upload + schema mapping (shared)
│   │   └── common/               ← Any other shared UI components
│   │
│   ├── industries/               ← ALL industry-specific frontend code lives here
│   │   ├── fmcg/
│   │   │   ├── pages/            ← FMCG page components
│   │   │   │   ├── DashboardPage.jsx
│   │   │   │   ├── ForecastingPage.jsx
│   │   │   │   ├── InventoryPage.jsx
│   │   │   │   ├── ContractsAlertsPage.jsx
│   │   │   │   └── DataUploadPage.jsx
│   │   │   ├── components/       ← FMCG-only reusable UI components
│   │   │   └── routes.jsx        ← Exports fmcgDashboardRoutes array
│   │   ├── healthcare/           ← (same sub-structure as fmcg/)
│   │   ├── logistics/
│   │   ├── education/
│   │   ├── fintech/
│   │   └── realestate/
│   │
│   ├── pages/                    ← SHARED pages only (same for every industry)
│   │   ├── LandingPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── SignupPage.jsx
│   │   ├── OnboardingPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── NotFound.jsx
│   │
│   ├── lib/                      ← Shared utilities
│   │   ├── api.js                ← Axios client + all API calls (namespaced per industry)
│   │   ├── supabase.js           ← Supabase client init
│   │   ├── dataFiles.js          ← File upload/download helpers
│   │   ├── forecast.js           ← Client-side forecasting algorithms
│   │   └── utils.js              ← General helpers
│   │
│   ├── stores/                   ← Zustand state (shared)
│   │   ├── authStore.js          ← Auth + user profile state
│   │   ├── themeStore.js         ← Light/dark mode
│   │   └── chatStore.js          ← AI chat state
│   │
│   ├── hooks/                    ← Shared React hooks
│   └── App.jsx                   ← Main router — imports industry routes here
│
├── backend/
│   └── app/
│       ├── routers/
│       │   ├── auth.py           ← SHARED auth routes (/api/auth/...)
│       │   └── fmcg/             ← FMCG routes (/api/fmcg/...)
│       │       ├── __init__.py
│       │       ├── dashboard.py
│       │       ├── inventory.py
│       │       ├── alerts.py
│       │       ├── contracts.py
│       │       ├── forecasting.py
│       │       ├── ai.py
│       │       └── data.py
│       │
│       ├── services/
│       │   ├── auth_service.py   ← SHARED
│       │   └── fmcg/             ← FMCG business logic
│       │       ├── __init__.py
│       │       ├── forecast_service.py
│       │       └── ai_service.py
│       │
│       ├── models/
│       │   ├── auth.py           ← SHARED Pydantic models
│       │   └── fmcg/             ← FMCG Pydantic models
│       │       ├── __init__.py
│       │       ├── alerts.py
│       │       ├── contracts.py
│       │       ├── chat.py
│       │       └── inventory.py
│       │
│       ├── utils/                ← Shared utilities (supabase_client.py, etc.)
│       ├── config.py             ← App settings via pydantic-settings
│       ├── dependencies.py       ← JWT auth dependency for protected routes
│       └── main.py               ← Registers all routers; add new ones here
│
├── docs/                         ← All project documentation
│   ├── deployment/               ← Deployment guides and checklists
│   ├── backend-readme.md
│   ├── tech-stack.md
│   └── start-here.md
│
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md  ← Used automatically when opening a PR
│   └── workflows/
│       └── ci.yml                ← Lint + test on every PR to dev or main
│
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json                   ← Frontend Vercel deployment config
├── backend/vercel.json           ← Backend Vercel serverless config
├── .env.example                  ← Commit this. Never commit .env
├── CONTRIBUTING.md               ← This file
└── README.md
```

---

## 4. What is shared vs industry-specific

### Shared — belongs to the core team, changes require review

| Path | Description |
|------|-------------|
| `src/components/ui/` | shadcn/ui — never edit directly |
| `src/components/layout/` | App shell and navigation |
| `src/components/landing/` | Landing page sections |
| `src/components/chat/` | AI chat drawer |
| `src/components/data/` | Data upload and schema mapping |
| `src/pages/LandingPage.jsx` | Marketing landing |
| `src/pages/LoginPage.jsx` | Auth pages |
| `src/pages/SignupPage.jsx` | Auth pages |
| `src/pages/OnboardingPage.jsx` | First-time setup |
| `src/pages/ProfilePage.jsx` | User profile |
| `src/pages/SettingsPage.jsx` | App settings |
| `src/lib/api.js` | HTTP client and API call definitions |
| `src/lib/supabase.js` | Supabase client |
| `src/stores/` | All Zustand stores |
| `src/App.jsx` | Main router |
| `backend/app/routers/auth.py` | Auth API |
| `backend/app/services/auth_service.py` | Auth logic |
| `backend/app/utils/` | Shared DB utilities |
| `backend/app/config.py` | Settings |
| `backend/app/main.py` | App entry point |

**Rule:** If you change a shared file, call it out explicitly in your PR description. The change will get extra review.

### Industry-specific — fully owned by each team

| Path | Who owns it |
|------|------------|
| `src/industries/fmcg/` | FMCG team |
| `src/industries/healthcare/` | Healthcare team |
| `backend/app/routers/fmcg/` | FMCG team |
| `backend/app/services/fmcg/` | FMCG team |
| `backend/app/models/fmcg/` | FMCG team |

You can freely create and edit files in your own industry's folder. Never touch another industry's folder.

---

## 5. How to add a new industry

This is the exact process for onboarding a new industry team. Follow it step by step.

### Frontend

1. Create the folder `src/industries/<industry>/pages/`
2. Create the folder `src/industries/<industry>/components/` (can be empty for now)
3. Build your pages inside `src/industries/<industry>/pages/`
4. Create `src/industries/<industry>/routes.jsx` exporting your route array:

```jsx
// src/industries/healthcare/routes.jsx
import DashboardPage from './pages/DashboardPage';
import PatientAnalyticsPage from './pages/PatientAnalyticsPage';

export const healthcareDashboardRoutes = [
  { index: true, element: <DashboardPage /> },
  { path: 'patients', element: <PatientAnalyticsPage /> },
];
```

5. Add your API calls to `src/lib/api.js` under a `// ── Healthcare ──` section, using `/api/healthcare/` prefixed URLs.

6. In `src/App.jsx`, import your routes and register them:

```jsx
import { healthcareDashboardRoutes } from './industries/healthcare/routes';

// Inside the /dashboard Route:
{healthcareDashboardRoutes.map((route, i) =>
  route.index
    ? <Route key={i} index element={route.element} />
    : <Route key={i} path={route.path} element={route.element} />
)}
```

### Backend

1. Create `backend/app/routers/<industry>/` with `__init__.py`
2. Create `backend/app/services/<industry>/` with `__init__.py`
3. Create `backend/app/models/<industry>/` with `__init__.py`
4. Write your router files with prefix convention `/api/<industry>/<resource>`:

```python
# backend/app/routers/healthcare/dashboard.py
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user

router = APIRouter()

@router.get("/kpis")
async def get_kpis(current_user=Depends(get_current_user)):
    ...
```

5. Register your router in `backend/app/main.py`:

```python
from app.routers.healthcare import dashboard as hc_dashboard
app.include_router(hc_dashboard.router, prefix="/api/healthcare/dashboard", tags=["Healthcare - Dashboard"])
```

---

## 6. Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production. Only merged into after full integration testing across all industries. Never push directly. |
| `dev` | Integration branch. All industry PRs merge here first. This is where conflicts get resolved. |
| `feature/<industry>/frontend/<name>` | Industry frontend feature |
| `feature/<industry>/backend/<name>` | Industry backend feature |
| `feature/common/<name>` | Shared code change |
| `fix/<industry>/<description>` | Bug fix |
| `experiment/<industry>/<name>` | Experiment — never merged to `dev` directly |

**Branch naming examples:**
```
feature/fmcg/frontend/demand-forecasting-v2
feature/healthcare/backend/patient-analytics-api
feature/common/dark-mode-improvements
fix/logistics/csv-encoding-bug
experiment/fmcg/lstm-forecasting-model
```

**Always branch from `dev`:**
```bash
git checkout dev
git pull origin dev
git checkout -b feature/fmcg/frontend/my-feature
```

---

## 7. Workflow: branch → dev → main

```
Your feature branch
       ↓
   Pull Request (reviewed, CI passes)
       ↓
      dev     ← all industries integrate here; conflicts resolved here
       ↓
   Pull Request (full integration test by lead)
       ↓
      main    ← deployed to production
```

**Step-by-step:**

1. Branch from `dev` (not `main`).
2. Write your code following all the rules in this document.
3. Push your branch: `git push origin feature/fmcg/frontend/my-feature`
4. Open a PR on GitHub targeting **`dev`** (not `main`).
5. The PR template will auto-fill — complete the checklist.
6. Wait for CI (lint + test) to pass.
7. At least one reviewer must approve.
8. Merge to `dev`.
9. Only the project lead merges `dev` → `main` after all industries have integrated.

---

## 8. Frontend rules

### Page location

FMCG pages → `src/industries/fmcg/pages/`
Healthcare pages → `src/industries/healthcare/pages/`
...and so on.

**Never put industry-specific pages in `src/pages/`.** That folder is for pages that are identical across all industries (Landing, Login, Signup, Onboarding, Profile, Settings, NotFound).

### Importing shared code

All pages can freely import from:
- `@/components/ui/*` — design system components
- `@/components/layout/*` — layout shell
- `@/components/chat/*` — AI chat
- `@/components/data/*` — data upload
- `@/lib/*` — API client, Supabase, utilities
- `@/stores/*` — auth, theme, chat state
- `@/hooks/*` — shared hooks

The `@/` alias maps to `src/`. Do not use relative paths like `../../lib/api`.

### API calls from pages

All HTTP calls go through `src/lib/api.js`. Never call `fetch()` or `axios` directly in a page component. If you need a new API call, add it to `api.js` in your industry's section.

### Styling rules

- Use Tailwind utility classes only. No `.css` files in industry folders.
- Use CSS variables from the design system (defined in `src/index.css`). Do not hardcode hex colours.
- Dark mode is handled by `useThemeStore`. Do not implement your own.
- Use the existing shared `glass-card`, `gradient-brand`, `hover-lift` utility classes for consistent styling.

### State management

- **Server state** (API data): use `@tanstack/react-query` `useQuery` / `useMutation`.
- **Client state** (auth, theme, chat): use the existing Zustand stores.
- Do not create new global Zustand stores for industry-specific state. Use local `useState` for that.

### Navigation links

When linking between pages, use React Router `<Link>` or `useNavigate()`. Do not use `<a href>` for internal navigation.

---

## 9. Backend rules

### Route prefix convention

Every industry route **must** start with `/api/<industry>/`:

```
/api/auth/...          ← shared
/api/fmcg/dashboard/...
/api/fmcg/inventory/...
/api/healthcare/patients/...
/api/logistics/routes/...
```

This ensures zero overlap between industries.

### Auth protection

All industry routes must require auth. Use the shared dependency:

```python
from app.dependencies import get_current_user

@router.get("/some-endpoint")
async def my_endpoint(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    # Always filter DB queries by uid
```

Never return data without filtering by `user_id` / `uid`. Supabase RLS is a backup, not the primary gate.

### Importing shared utilities

```python
from app.utils.supabase_client import supabase    # DB client
from app.dependencies import get_current_user      # Auth
from app.config import settings                    # Config / secrets
from app.services.auth_service import ...          # Auth logic
```

Do not re-implement these. Do not create a second Supabase client.

### Error handling pattern

Every route should handle exceptions gracefully. The standard pattern:

```python
@router.get("/data")
async def get_data(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("my_table").select("*").eq("user_id", uid).execute()
        return resp.data or []
    except Exception:
        return []   # graceful empty response, never crash the server
```

For mutations (POST/PATCH/DELETE) that need to report errors, raise `HTTPException`:

```python
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

### Pydantic models

Define request/response models for your industry in `backend/app/models/<industry>/`. Import them in your router:

```python
from app.models.fmcg.contracts import ContractCreate
```

---

## 10. Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>
```

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no functional change |
| `test` | Adding or fixing tests |
| `chore` | Dependency updates, config changes |

**Scope** = industry name (`fmcg`, `healthcare`, `logistics`, etc.) or `common` for shared changes.

**Examples:**
```
feat(fmcg): add SKU-level demand forecasting endpoint
fix(healthcare): resolve date parsing bug in patient data upload
docs(common): update API route documentation in CONTRIBUTING
refactor(fmcg): move inventory service to industry subfolder
test(logistics): add unit tests for route optimization service
chore(common): upgrade react-query to v5
```

---

## 11. Pull request rules

### PR target

- **Always target `dev`**, never `main` directly.

### PR title format

```
feat(fmcg): demand forecasting dashboard
fix(healthcare): patient record date parsing
```

### Before opening a PR, verify:

- [ ] You branched from `dev`
- [ ] PR targets `dev`
- [ ] All industry-specific code is inside `src/industries/<industry>/` or `backend/app/routers/<industry>/`
- [ ] If you touched a shared file, you've described why in the PR body
- [ ] `npm run lint` passes locally
- [ ] `npm run test` passes locally
- [ ] No `.env` files in the diff
- [ ] No hardcoded API keys, credentials, or production URLs
- [ ] No `console.log` in production code

### PR size

Keep PRs small and focused. One feature = one PR. Large PRs are hard to review and likely to cause conflicts. If a feature is large, split it into frontend and backend PRs.

---

## 12. Environment variables

### Frontend (`/.env`)

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- All Vite env vars must be prefixed `VITE_`.
- Access them as `import.meta.env.VITE_*`. Never use `process.env`.
- Commit `.env.example` with placeholder values. **Never commit `.env`.**

### Backend (`/backend/.env`)

```bash
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ENVIRONMENT=development
```

- All backend config is managed via `backend/app/config.py` (pydantic-settings).
- Access as `settings.supabase_url`, `settings.groq_api_key`, etc.
- **Never hardcode secrets.** **Never commit `backend/.env`.**

---

## 13. Running the project locally

### Frontend

```bash
# From repo root
npm install
npm run dev        # runs on http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in your Supabase and AI keys
uvicorn app.main:app --reload   # runs on http://localhost:8000
```

Visit `http://localhost:8000/docs` for the interactive API documentation (Swagger UI).

### Both together

Run frontend and backend in two separate terminals. The frontend's `VITE_API_URL` points to the backend.

---

## 14. Conflict prevention checklist

The most common sources of merge conflicts and how to avoid them:

| Risk | Prevention |
|------|-----------|
| Two industries name their page `DashboardPage.jsx` | Pages go in `src/industries/<industry>/pages/` — filenames are isolated |
| Two industry backends use the same URL path | All routes prefixed `/api/<industry>/` — paths are isolated |
| Multiple people edit `src/App.jsx` simultaneously | Each industry only appends to the `{fmcgDashboardRoutes.map(...)}` pattern — append-only |
| Multiple people edit `backend/app/main.py` | Each industry only appends a new `app.include_router(...)` block — append-only |
| Shared component changes break another industry | Shared component changes get PR review; use props to extend, never fork |
| `package.json` conflicts | Only add packages you actually need; call out new dependencies in your PR |
| `tailwind.config.js` conflicts | Only the core team modifies this file |
| Database schema conflicts | All schema changes go in `backend/database/schema.sql`; coordinate with lead before adding tables |
| Committing secrets | The CI pipeline checks for tracked `.env` files and fails the build |

---

*Questions? Open a GitHub Issue and tag the relevant team member. Do not start a large feature without alignment on the approach first.*
