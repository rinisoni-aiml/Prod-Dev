# Repository Setup Instructions

## Current Status
You have a React-based UI that will serve as the common foundation for all industries.

## Steps to Push to New Repository

### 1. Change Remote Repository
```bash
# Replace with your new repository URL
git remote set-url origin <your-new-repo-url>

# Verify the change
git remote -v
```

### 2. Create Feature Branch for Common UI
```bash
# Create and switch to a new branch for common UI
git checkout -b feature/common/base-ui-setup

# This follows the convention: feature/common/<feature-name>
```

### 3. Reorganize Project Structure (if needed)
Based on CONTRIBUTING.md, you may want to:
- Keep current structure as `/common/frontend/` for shared UI
- Or keep it at root level since it's the base UI

**Recommended:** Since this is the common UI foundation, we can either:
- Option A: Keep current structure (simpler for now)
- Option B: Move everything into `/common/frontend/` directory

### 4. Commit Your Work
```bash
# Stage all files
git add .

# Commit with descriptive message
git commit -m "feat(common): initial common UI setup with React, Vite, and shadcn/ui

- Set up React + Vite project structure
- Integrated shadcn/ui component library
- Implemented landing page, dashboard, and core pages
- Added authentication flow with Supabase
- Configured theme system with dark mode support
- Set up routing and page transitions
- Added AI chat drawer component
- Configured ESLint and testing setup"
```

### 5. Push to Remote
```bash
# Push the feature branch to remote
git push -u origin feature/common/base-ui-setup
```

### 6. Create Pull Request
After pushing, go to your repository on GitHub/GitLab and:
1. Create a Pull Request from `feature/common/base-ui-setup` to `main`
2. Add description explaining this is the common UI foundation
3. Request reviews from team members
4. Merge after approval

### 7. Future Work - FMCG Industry
When you start FMCG-specific work:
```bash
# Create FMCG feature branch from main
git checkout main
git pull origin main
git checkout -b feature/fmcg/frontend/industry-specific-features

# Make your FMCG changes
# Commit and push
git push -u origin feature/fmcg/frontend/industry-specific-features
```

## Branch Naming Reference
- Common UI: `feature/common/<feature-name>`
- FMCG Frontend: `feature/fmcg/frontend/<feature-name>`
- FMCG Backend: `feature/fmcg/backend/<feature-name>`
- Bug fixes: `fix/<industry>/<description>`

## Next Steps
1. Provide your new repository URL
2. I'll help you execute these commands
3. Set up the proper branch structure
4. Push your code following best practices
