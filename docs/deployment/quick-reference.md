# Quick Reference Card

## 🚀 Deploy Commands

```bash
# Frontend
npm run deploy                    # Production
npm run deploy:preview            # Preview

# Backend
cd backend && vercel --prod       # Production

# Local Development
npm run dev                       # Frontend
uvicorn app.main:app --reload     # Backend
```

---

## 🔑 Environment Variables

### Frontend (Vercel Dashboard)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL
```

### Backend (Vercel Dashboard)
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
SECRET_KEY
FRONTEND_URL
ENVIRONMENT=production
```

---

## 📚 Documentation Quick Links

| Need | Read |
|------|------|
| Start deployment | [START_HERE.md](./START_HERE.md) |
| Quick commands | [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) |
| Step-by-step | [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md) |
| Checklist | [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) |
| Backend code | [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md) |
| Overview | [DEPLOYMENT_COMPLETE.md](./DEPLOYMENT_COMPLETE.md) |

---

## 🌐 URLs After Deployment

```
Frontend:  https://your-app.vercel.app
Backend:   https://your-backend.vercel.app
API Docs:  https://your-backend.vercel.app/docs
Supabase:  https://your-project.supabase.co
```

---

## ⏱️ Time Estimates

| Task | Time |
|------|------|
| Frontend deploy | 5 min |
| Supabase setup | 10 min |
| Backend setup | 10 min |
| Backend deploy | 5 min |
| Integration | 5 min |
| **Total** | **35 min** |

---

## ✅ Deployment Checklist

```
[ ] Frontend deployed
[ ] Supabase created
[ ] Database schema run
[ ] Backend deployed
[ ] Environment variables set
[ ] Can sign up
[ ] Can log in
[ ] Dashboard works
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run build` locally |
| CORS error | Check FRONTEND_URL in backend |
| Can't login | Verify Supabase credentials |
| 404 errors | Check vercel.json exists |
| Import errors | Check all __init__.py files |

---

## 🔐 Generate Secret Key

```bash
# Windows
.\generate-secret.ps1

# Mac/Linux
openssl rand -hex 32
```

---

## 📊 API Endpoints

```
POST   /api/auth/login
POST   /api/auth/signup
GET    /api/auth/profile
GET    /api/dashboard/kpis
GET    /api/contracts
POST   /api/ai/chat
```

Full docs: `https://your-backend.vercel.app/docs`

---

## 🆘 Support

- Check deployment logs in Vercel
- Check Supabase logs
- Review browser console
- Test in `/docs` endpoint

---

## 💰 Cost

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth |
| Supabase | 500MB database |
| **Total** | **$0/month** |

---

## 🎯 Success Criteria

- ✅ Frontend loads
- ✅ Backend responds
- ✅ Can authenticate
- ✅ Dashboard works
- ✅ No errors

---

**Print this card for quick reference!**
