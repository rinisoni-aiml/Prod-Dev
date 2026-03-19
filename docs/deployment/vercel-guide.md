# Vercel Deployment Quick Start Guide

## 🚀 Deploy Frontend to Vercel (5 minutes)

### Option 1: Deploy via Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name? (accept default or customize)
# - Directory? ./ (press enter)
# - Override settings? No

# After successful deployment, deploy to production
vercel --prod
```

### Option 2: Deploy via GitHub (Easiest)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration

3. **Configure Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add these variables:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     VITE_API_URL=https://your-backend.vercel.app
     ```
   - Click "Save"

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your site is live!

---

## 📝 Environment Variables Setup

### Frontend Environment Variables (Vercel Dashboard)

Go to: Project Settings → Environment Variables

Add these:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview, Development |
| `VITE_API_URL` | `https://your-backend.vercel.app` | Production, Preview, Development |

---

## 🗄️ Supabase Setup (10 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Name: `pulseiq` (or your choice)
   - Database Password: (save this!)
   - Region: Choose closest to your users
4. Click "Create new project"
5. Wait for setup to complete (~2 minutes)

### 2. Get Your Credentials

1. Go to Project Settings → API
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`
   - **service_role key**: `eyJhbGc...` (keep secret!)

### 3. Set Up Database

1. Go to SQL Editor in Supabase Dashboard
2. Click "New Query"
3. Copy and paste the entire SQL schema from `DEPLOYMENT_PLAN.md` (Phase 2, Step 2)
4. Click "Run"
5. Verify tables are created in Table Editor

### 4. Configure Authentication

1. Go to Authentication → Providers
2. Enable "Email" provider
3. Go to Authentication → URL Configuration
4. Add your Vercel domain to "Site URL" and "Redirect URLs":
   ```
   https://your-app.vercel.app
   ```

---

## 🐍 Backend Deployment (15 minutes)

### 1. Create Backend Directory Structure

```bash
# From project root
mkdir backend
cd backend

# Create Python virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Create directory structure
mkdir -p app/routers app/services app/models app/utils
touch app/__init__.py
touch app/routers/__init__.py
touch app/services/__init__.py
touch app/models/__init__.py
touch app/utils/__init__.py
```

### 2. Copy Backend Files

Copy all the code from `BACKEND_IMPLEMENTATION.md` into the appropriate files:

- `requirements.txt`
- `vercel.json`
- `.env`
- `app/config.py`
- `app/main.py`
- `app/dependencies.py`
- `app/utils/supabase_client.py`
- `app/models/auth.py`
- `app/models/contracts.py`
- `app/models/chat.py`
- `app/services/auth_service.py`
- `app/services/ai_service.py`
- `app/routers/auth.py`
- `app/routers/dashboard.py`
- `app/routers/contracts.py`
- `app/routers/ai.py`

### 3. Configure Backend Environment

Edit `backend/.env`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SECRET_KEY=generate_this_with_openssl_rand_hex_32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
FRONTEND_URL=https://your-frontend.vercel.app
ENVIRONMENT=production
```

Generate SECRET_KEY:
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 4. Test Backend Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload

# Test in browser
# Visit: http://localhost:8000/docs
```

### 5. Deploy Backend to Vercel

```bash
# From backend directory
vercel

# Follow prompts (similar to frontend)
# After successful deployment:
vercel --prod
```

### 6. Configure Backend Environment Variables in Vercel

Go to backend project settings → Environment Variables:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGc...` (service_role key) |
| `SECRET_KEY` | (generated secret) |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `ENVIRONMENT` | `production` |

Optional (for AI features):
| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

### 7. Update Frontend with Backend URL

1. Go to frontend Vercel project
2. Update environment variable:
   ```
   VITE_API_URL=https://your-backend.vercel.app
   ```
3. Redeploy frontend (or it will auto-redeploy)

---

## ✅ Verification Checklist

### Frontend
- [ ] Frontend deploys successfully
- [ ] Landing page loads
- [ ] Can navigate between pages
- [ ] No console errors

### Backend
- [ ] Backend deploys successfully
- [ ] Can access `/health` endpoint
- [ ] API docs available at `/docs`
- [ ] No deployment errors

### Supabase
- [ ] Database tables created
- [ ] RLS policies enabled
- [ ] Auth provider enabled
- [ ] Frontend URL added to allowed URLs

### Integration
- [ ] Can sign up new user
- [ ] Can log in
- [ ] Can access dashboard (after login)
- [ ] API calls work from frontend
- [ ] Chat feature works (if AI keys configured)

---

## 🐛 Troubleshooting

### Frontend Issues

**Build fails:**
```bash
# Check build locally first
npm run build

# Check for TypeScript/ESLint errors
npm run lint
```

**Environment variables not working:**
- Make sure they start with `VITE_`
- Redeploy after adding variables
- Check browser console for actual values

**404 on page refresh:**
- Verify `vercel.json` exists with rewrites
- Check Vercel deployment logs

### Backend Issues

**Import errors:**
```bash
# Make sure all __init__.py files exist
touch app/__init__.py
touch app/routers/__init__.py
# etc.
```

**Supabase connection fails:**
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
- Check Supabase project is active
- Test connection locally first

**CORS errors:**
- Update FRONTEND_URL in backend env vars
- Check CORS middleware in `app/main.py`
- Add your domain to allowed origins

### Database Issues

**RLS policy errors:**
- Check policies in Supabase dashboard
- Verify user is authenticated
- Test queries in SQL editor

**Tables not found:**
- Run SQL schema again
- Check table names match code
- Verify schema is in `public` schema

---

## 🔄 Continuous Deployment

### Automatic Deployments

Once connected to GitHub:
- Push to `main` branch → deploys to production
- Push to other branches → creates preview deployment
- Pull requests → automatic preview deployments

### Manual Deployments

```bash
# Deploy frontend
vercel --prod

# Deploy backend
cd backend
vercel --prod
```

---

## 📊 Monitoring

### Vercel Dashboard
- View deployment logs
- Monitor function execution
- Check analytics
- View error logs

### Supabase Dashboard
- Monitor database usage
- Check auth logs
- View API requests
- Monitor storage usage

---

## 🎉 You're Done!

Your app is now live:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.vercel.app`
- API Docs: `https://your-backend.vercel.app/docs`

### Next Steps:
1. Add custom domain (optional)
2. Set up monitoring/alerts
3. Add more features
4. Invite team members
5. Configure CI/CD
6. Add tests
7. Optimize performance

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vite Documentation](https://vitejs.dev/)

---

## 🆘 Need Help?

- Check Vercel deployment logs
- Check Supabase logs
- Review browser console
- Check network tab for API calls
- Test backend endpoints in `/docs`
