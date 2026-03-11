# PulseIQ - React Frontend

A modern React application for supply chain management and demand forecasting, built with Vite, React Router, and Tailwind CSS.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **Shadcn/ui** - Component library
- **Axios** - HTTP client
- **Framer Motion** - Animations
- **Recharts** - Data visualization

## Prerequisites

- Node.js 18+ or Bun
- Python 3.9+ (for FastAPI backend)

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url (optional)
VITE_SUPABASE_ANON_KEY=your_supabase_key (optional)
```

### 3. Run Development Server

```bash
npm run dev
# or
bun run dev
```

The app will be available at `http://localhost:8080`

## Backend Integration

This frontend is designed to work with a FastAPI backend. The API client is configured in `src/lib/api.js`.

### Expected Backend Endpoints

All endpoints should be prefixed with `/api`:

**Auth:**
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/profile` - Get user profile
- `PATCH /api/auth/profile` - Update profile

**Dashboard:**
- `GET /api/dashboard/kpis` - Key performance indicators
- `GET /api/dashboard/demand-trend` - Demand trend data
- `GET /api/dashboard/top-skus` - Top selling SKUs
- `GET /api/dashboard/inventory-snapshot` - Inventory overview

**Forecasting:**
- `GET /api/forecasting` - Forecast data
- `GET /api/forecasting/seasonality` - Seasonality analysis
- `GET /api/forecasting/products` - Product list

**Inventory:**
- `GET /api/inventory/overview` - Inventory overview
- `GET /api/inventory/warehouses` - Warehouse list
- `GET /api/inventory/warehouses/:id` - Warehouse details
- `GET /api/inventory/reorder-queue` - Reorder recommendations
- `GET /api/inventory/abc-analysis` - ABC analysis

**Contracts:**
- `GET /api/contracts` - List contracts
- `POST /api/contracts` - Create contract
- `PATCH /api/contracts/:id` - Update contract
- `DELETE /api/contracts/:id` - Delete contract

**Alerts:**
- `GET /api/alerts` - List alerts
- `PATCH /api/alerts/:id/resolve` - Resolve alert

**AI:**
- `GET /api/ai/insights` - AI insights
- `POST /api/ai/chat` - Chat with AI
- `GET /api/ai/sessions` - Chat sessions
- `POST /api/ai/sessions` - Create session
- `POST /api/ai/recommendations` - Get recommendations

**Data Upload:**
- `POST /api/data/upload` - Upload data file
- `GET /api/data/sources` - List data sources
- `DELETE /api/data/sources/:id` - Delete data source

## Supabase Integration (Optional)

If you want to use Supabase directly from the frontend:

1. Add your Supabase credentials to `.env`
2. Use the Supabase client from `src/lib/supabase.js`

```javascript
import { supabase } from '@/lib/supabase';

// Example usage
const { data, error } = await supabase
  .from('your_table')
  .select('*');
```

## Project Structure

```
src/
├── components/       # React components
│   ├── chat/        # AI chat components
│   ├── data/        # Data upload components
│   ├── landing/     # Landing page components
│   ├── layout/      # Layout components
│   └── ui/          # Shadcn UI components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and configurations
│   ├── api.js       # API client and endpoints
│   ├── supabase.js  # Supabase client
│   ├── utils.js     # Utility functions
│   └── mockData.js  # Mock data for development
├── pages/           # Page components
├── stores/          # Zustand stores
└── test/            # Test files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Authentication

The app uses JWT token-based authentication:

1. Login/Signup returns a token
2. Token is stored in `localStorage` as `pulseiq-token`
3. Token is automatically added to all API requests via Axios interceptor
4. 401 responses automatically redirect to login

## State Management

- **Zustand stores** for client state (auth, chat, theme)
- **TanStack Query** for server state (API data, caching, mutations)

## Styling

- **Tailwind CSS** for utility-first styling
- **CSS variables** for theming (light/dark mode)
- **Shadcn/ui** components with Radix UI primitives

## Development Notes

- Mock data is available in `src/lib/mockData.js` for development without backend
- API interceptors handle authentication and error responses
- All routes are defined in `src/App.jsx`
- Protected routes use the AppLayout wrapper

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Next Steps

1. Set up your FastAPI backend
2. Configure Supabase (optional)
3. Update API endpoints in `src/lib/api.js` if needed
4. Customize components and styling
5. Add your business logic

## License

Private
