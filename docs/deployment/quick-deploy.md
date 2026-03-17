# Quick Deploy Reference Card

## 🚀 Deploy Frontend (Now!)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
npm run deploy
```

Then add these environment variables in Vercel dashboard:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_URL=https://your-backend.vercel.app
```

---

## 🗄️ Setup Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Copy SQL from `DEPLOYMENT_PLAN.md` Phase 2, Step 2
4. Run it
5. Save your credentials:
   - Project URL
   - anon key
   - service_role key

---

## 🐍 Deploy Backend (Later)

### 1. Create Backend Files

```bash
mkdir backend
cd backend
```

Copy all files from `BACKEND_IMPLEMENTATION.md`

### 2. Create .env

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SECRET_KEY=run_generate-secret.ps1
FRONTEND_URL=https://your-frontend.vercel.app
ENVIRONMENT=production
```

### 3. Deploy

```bash
vercel --prod
```

Add environment variables in Vercel dashboard (same as .env)

---

## ✅ Verify

- [ ] Frontend loads: `https://your-app.vercel.app`
- [ ] Backend works: `https://your-backend.vercel.app/docs`
- [ ] Can sign up
- [ ] Can log in
- [ ] Dashboard loads

---

## 📚 Full Guides

- **First time?** → [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
- **Need checklist?** → [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Want details?** → [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md)
- **Backend code?** → [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md)

---

## 🆘 Issues?

### Frontend won't build
```bash
npm run build
# Fix any errors shown
```

### Backend errors
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# Test at http://localhost:8000/docs
```

### Can't log in
- Check Supabase credentials
- Verify environment variables
- Check browser console

---

## 🎯 Quick Commands

```bash
# Deploy frontend
npm run deploy

# Deploy backend
cd backend && vercel --prod

# Test locally
npm run dev                    # Frontend
uvicorn app.main:app --reload  # Backend

# Generate secret
.\generate-secret.ps1          # Windows
openssl rand -hex 32           # Mac/Linux
```

---

**Time to Deploy**: 30-45 minutes

**Start Here**: Deploy frontend first, then Supabase, then backend!
