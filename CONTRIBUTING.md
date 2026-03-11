# Contributing Guidelines

Welcome to the project! Please follow these guidelines to ensure smooth collaboration and maintain code quality across all industries and tech stacks.

## Repository Structure

- `/common/` — Shared utilities, models, and base UI components
- `/fmcg/` — FMCG-specific code
- `/healthcare/` — Healthcare-specific code
- `/logistics/` — Logistics-specific code
- `/education/` — Education-specific code
- `/fintech/` — Fintech-specific code
- `/realestate/` — Real-estate-specific code
- `/frontend/` — UI code (Streamlit or React)
- `/backend/` — API code (FastAPI/Django)

**If each industry has both UI and backend code, use this structure:**

- `/fmcg/frontend/` — FMCG-specific UI (Streamlit/React)
- `/fmcg/backend/` — FMCG-specific backend (FastAPI/Django)
- `/healthcare/frontend/`
- `/healthcare/backend/`
- `/logistics/frontend/`
- `/logistics/backend/`
- ...etc.

## Branching Strategy

- **Main branch:** `main` (stable, production-ready code)
- **Feature branches:**
  - For industry UI: `feature/<industry>/frontend/<feature-name>` (e.g., `feature/fmcg/frontend/demand-forecasting-ui`)
  - For industry backend: `feature/<industry>/backend/<feature-name>` (e.g., `feature/fmcg/backend/demand-forecasting-api`)
  - For shared/common code: `feature/common/<feature-name>`
- **Bugfix branches:**
  - `fix/<industry>/<short-description>` (e.g., `fix/logistics/data-import-bug`)
- **Experiment branches:**
  - `experiment/<industry>/<experiment-name>` (e.g., `experiment/fmcg/new-ml-model`)
- **UI migration:**
  - `feature/ui/react-migration` (or similar)

## Workflow

1. **Create a branch** from `main` for your feature or fix.
2. **Commit changes** with clear, descriptive messages.
3. **Push your branch** to the remote repository.
4. **Open a Pull Request (PR)** to `main`.
5. **Request reviews** from relevant team members.
6. **Address feedback** and make necessary changes.
7. **Merge** after approval and passing CI checks.

## Code Organization

- Place shared code in `/common` so all industries can reuse it.
- Place industry-specific code in the respective directory.
- If an industry has both UI and backend, use `/industry/frontend/` and `/industry/backend/`.
- UI code for all industries can be in their respective `/frontend/` folders; same for backend.
- Follow existing code style and structure.

## Naming Conventions

- Branch names: lowercase, hyphens for spaces (e.g., `feature/healthcare/patient-analytics`)
- Commit messages: concise and descriptive

## Best Practices

- Write clear, maintainable code.
- Add docstrings and comments where necessary.
- Write tests for new features and bug fixes.
- Keep PRs focused and small.
- Document any major architectural or design decisions.

## Communication

- Use issues to discuss bugs, features, or questions.
- Tag relevant team members in PRs and issues.

Thank you for contributing!