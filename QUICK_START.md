# Quick Start Guide

Get your React frontend up and running in 3 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or bun package manager

## Setup (3 steps)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and set your backend URL
# VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server

```bash
npm run dev
```

Visit **http://localhost:8080** 🎉

## What's Working

✅ All React components
✅ All pages and routing
✅ Authentication flow (needs backend)
✅ Dashboard with mock data
✅ Forecasting page
✅ Inventory management
✅ Contracts & alerts
✅ Data upload interface
✅ AI chat interface
✅ Dark/light theme toggle
✅ Responsive design

## Using Mock Data

The app includes mock data in `src/lib/mockData.js` so you can develop without a backend. To use real data, set up your FastAPI backend (see `BACKEND_SETUP.md`).

## Project Structure

```
src/
├── components/    # Reusable React components
├── pages/         # Page components (routes)
├── lib/           # API client, utilities, mock data
├── stores/        # Zustand state management
├── hooks/         # Custom React hooks
└── test/          # Test files
```

## Available Commands

```bash
npm run dev        # Start dev server (port 8080)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run test       # Run tests
```

## Next Steps

1. ✅ Frontend is ready
2. 📝 Set up FastAPI backend (see `BACKEND_SETUP.md`)
3. 🗄️ Configure Supabase database (optional)
4. 🔗 Connect frontend to backend
5. 🚀 Deploy to production

## Need Help?

- **Frontend docs**: `README.md`
- **Backend setup**: `BACKEND_SETUP.md`
- **Migration info**: `MIGRATION_COMPLETE.md`
- **API endpoints**: Check `src/lib/api.js`

## Common Issues

### Port 8080 already in use
```bash
# Change port in vite.config.js or use:
npm run dev -- --port 3000
```

### Environment variables not loading
- Make sure `.env` file exists in root directory
- Restart dev server after changing `.env`
- Variables must start with `VITE_`

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Production Build

```bash
# Build the app
npm run build

# The output will be in dist/ directory
# Deploy dist/ to your hosting service
```

## Tech Stack Summary

- **React 18** - UI framework
- **Vite** - Build tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library
- **Zustand** - State management
- **TanStack Query** - Data fetching
- **Axios** - HTTP client

---

**Ready to code!** 🚀
