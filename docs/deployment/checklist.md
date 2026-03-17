# Deployment Checklist

Use this checklist to ensure smooth deployment of PulseIQ.

## Pre-Deployment

### Accounts Setup
- [ ] Create Vercel account at [vercel.com](https://vercel.com)
- [ ] Create Supabase account at [supabase.com](https://supabase.com)
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Have GitHub account ready (optional, for GitHub integration)

### Local Testing
- [ ] Frontend runs locally: `npm run dev`
- [ ] Frontend builds successfully: `npm run build`
- [ ] No console errors in browser
- [ ] All pages load correctly

---

## Phase 1: Supabase Setup (10 min)

- [ ] Create new Supabase project
- [ ] Save Project URL
- [ ] Save anon (public) key
- [ ] Save service_role key (keep secret!)
- [ ] Run SQL schema from `DEPLOYMENT_PLAN.md` Phase 2
- [ ] Verify tables created in Table Editor
- [ ] Enable Email auth provider
- [ ] Configure auth settings

---

## Phase 2: Frontend Deployment (5 min)

### Deploy
- [ ] Run `vercel` from project root
- [ ] Follow CLI prompts
- [ ] Run `vercel --prod` for production
- [ ] Save deployment URL

### Configure Environment Variables
Go to Vercel Dashboard → Project → Settings → Environment Variables

- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Add `VITE_API_URL` (use placeholder for now, update after backend deployment)
- [ ] Redeploy frontend

### Test Frontend
- [ ] Visit deployment URL
- [ ] Landing page loads
- [ ] Navigation works
- [ ] No console errors
- [ ] Refresh on any page works (routing)

---

## Phase 3: Backend Setup (15 min)

### Create Backend Structure
- [ ] Create `backend` directory
- [ ] Create Python virtual environment
- [ ] Create all required files from `BACKEND_IMPLEMENTATION.md`
- [ ] Create `requirements.txt`
- [ ] Create `vercel.json` for backend
- [ ] Create `.env` file

### Configure Backend
- [ ] Add Supabase URL to `.env`
- [ ] Add Supabase service_role key to `.env`
- [ ] Generate and add SECRET_KEY: `openssl rand -hex 32`
- [ ] Add frontend URL to `.env`
- [ ] Set ENVIRONMENT=production

### Test Backend Locally
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Run: `uvicorn app.main:app --reload`
- [ ] Visit http://localhost:8000/docs
- [ ] Test health endpoint
- [ ] Test auth endpoints

---

## Phase 4: Backend Deployment (5 min)

### Deploy
- [ ] Run `vercel` from backend directory
- [ ] Follow CLI prompts
- [ ] Run `vercel --prod` for production
- [ ] Save backend deployment URL

### Configure Environment Variables
Go to Vercel Dashboard → Backend Project → Settings → Environment Variables

- [ ] Add `SUPABASE_URL`
- [ ] Add `SUPABASE_SERVICE_KEY`
- [ ] Add `SECRET_KEY`
- [ ] Add `FRONTEND_URL` (your frontend Vercel URL)
- [ ] Add `ENVIRONMENT=production`
- [ ] Add `OPENAI_API_KEY` (optional)
- [ ] Add `ANTHROPIC_API_KEY` (optional)
- [ ] Redeploy backend

### Test Backend
- [ ] Visit backend URL
- [ ] Visit backend URL + `/docs`
- [ ] Test `/health` endpoint
- [ ] Check deployment logs for errors

---

## Phase 5: Connect Frontend & Backend (2 min)

### Update Frontend
Go to Vercel Dashboard → Frontend Project → Settings → Environment Variables

- [ ] Update `VITE_API_URL` with backend URL
- [ ] Redeploy frontend (or wait for auto-deploy)

### Update Supabase
Go to Supabase Dashboard → Authentication → URL Configuration

- [ ] Add frontend URL to Site URL
- [ ] Add frontend URL to Redirect URLs

---

## Phase 6: Integration Testing (10 min)

### Authentication
- [ ] Can access signup page
- [ ] Can create new account
- [ ] Receives confirmation (check email if enabled)
- [ ] Can log in with credentials
- [ ] Redirects to dashboard after login
- [ ] Token stored in localStorage
- [ ] Can log out

### Protected Routes
- [ ] Dashboard loads after login
- [ ] Can access all pages when logged in
- [ ] Redirects to login when not authenticated
- [ ] Profile page loads user data

### API Integration
- [ ] Dashboard shows data (even if mock)
- [ ] No CORS errors in console
- [ ] API calls show in Network tab
- [ ] Error handling works

### Features
- [ ] Data upload page accessible
- [ ] Forecasting page loads
- [ ] Inventory page loads
- [ ] Contracts page loads
- [ ] AI chat opens (if configured)
- [ ] Theme toggle works

---

## Phase 7: Post-Deployment (Optional)

### Custom Domain
- [ ] Add custom domain in Vercel
- [ ] Update DNS records
- [ ] Update environment variables with new domain
- [ ] Update Supabase allowed URLs

### Monitoring
- [ ] Enable Vercel Analytics
- [ ] Check Supabase usage dashboard
- [ ] Set up error tracking
- [ ] Configure alerts

### Security
- [ ] Review Supabase RLS policies
- [ ] Rotate secrets if needed
- [ ] Enable 2FA on accounts
- [ ] Review CORS settings

### Performance
- [ ] Check Lighthouse scores
- [ ] Enable caching where appropriate
- [ ] Optimize images
- [ ] Add database indexes

---

## Troubleshooting

### If Frontend Doesn't Load
1. Check Vercel build logs
2. Verify environment variables are set
3. Check browser console for errors
4. Try rebuilding: `vercel --prod --force`

### If Backend Doesn't Work
1. Check Vercel function logs
2. Verify all environment variables
3. Test endpoints in `/docs`
4. Check Supabase connection

### If Auth Doesn't Work
1. Verify Supabase credentials
2. Check RLS policies
3. Verify frontend URL in Supabase settings
4. Check browser console for errors

### If API Calls Fail
1. Check CORS settings in backend
2. Verify VITE_API_URL is correct
3. Check Network tab in browser
4. Verify backend is deployed

---

## Success Criteria

✅ Frontend is live and accessible
✅ Backend is live and API docs work
✅ Can sign up new users
✅ Can log in
✅ Dashboard loads after login
✅ All pages are accessible
✅ No critical errors in console
✅ API calls work from frontend

---

## Quick Commands

```bash
# Deploy frontend
vercel --prod

# Deploy backend
cd backend
vercel --prod

# Test locally
npm run dev                    # Frontend
uvicorn app.main:app --reload  # Backend

# Generate secret key
openssl rand -hex 32
```

---

## Support Resources

- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md)
- [Deployment Plan](./DEPLOYMENT_PLAN.md)
- [Backend Implementation](./BACKEND_IMPLEMENTATION.md)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)

---

## Estimated Time

- **Supabase Setup**: 10 minutes
- **Frontend Deployment**: 5 minutes
- **Backend Setup**: 15 minutes
- **Backend Deployment**: 5 minutes
- **Integration**: 2 minutes
- **Testing**: 10 minutes

**Total**: ~45 minutes for first-time deployment

---

## Next Steps After Deployment

1. ✅ Share the live URL with stakeholders
2. 📊 Monitor usage and performance
3. 🔒 Review security settings
4. 🚀 Add more features
5. 📝 Write user documentation
6. 🧪 Add automated tests
7. 🎨 Customize branding
8. 📱 Test on mobile devices
