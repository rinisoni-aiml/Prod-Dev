# Backend Setup Instructions

This file guides you through creating the FastAPI backend for PulseIQ.

## 📁 Directory Structure to Create

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── contracts.py
│   │   └── chat.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── contracts.py
│   │   └── ai.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── forecast_service.py
│   │   └── ai_service.py
│   └── utils/
│       ├── __init__.py
│       └── supabase_client.py
├── .env
├── .gitignore
├── requirements.txt
└── vercel.json
```

## 🚀 Quick Setup

### Step 1: Create Directory

```bash
# From project root
mkdir backend
cd backend
```

### Step 2: Create Python Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
```

### Step 3: Create Directory Structure

```bash
# Windows PowerShell:
New-Item -ItemType Directory -Path app/models, app/routers, app/services, app/utils -Force
New-Item -ItemType File -Path app/__init__.py, app/models/__init__.py, app/routers/__init__.py, app/services/__init__.py, app/utils/__init__.py

# Mac/Linux:
mkdir -p app/{models,routers,services,utils}
touch app/__init__.py app/models/__init__.py app/routers/__init__.py app/services/__init__.py app/utils/__init__.py
```

### Step 4: Create Files

Copy the content from `BACKEND_IMPLEMENTATION.md` for each file:

1. **requirements.txt** - Python dependencies
2. **vercel.json** - Vercel configuration
3. **.env** - Environment variables (don't commit!)
4. **.gitignore** - Git ignore file
5. **app/config.py** - Configuration management
6. **app/main.py** - FastAPI application
7. **app/dependencies.py** - Dependency injection
8. **app/utils/supabase_client.py** - Supabase client
9. **app/models/auth.py** - Auth models
10. **app/models/contracts.py** - Contract models
11. **app/models/chat.py** - Chat models
12. **app/services/auth_service.py** - Auth service
13. **app/services/forecast_service.py** - Forecast service
14. **app/services/ai_service.py** - AI service
15. **app/routers/auth.py** - Auth endpoints
16. **app/routers/dashboard.py** - Dashboard endpoints
17. **app/routers/contracts.py** - Contract endpoints
18. **app/routers/ai.py** - AI endpoints

### Step 5: Create .gitignore

```bash
# Create .gitignore in backend directory
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Vercel
.vercel
EOF
```

### Step 6: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 7: Configure Environment

Create `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SECRET_KEY=generate_with_openssl_rand_hex_32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
FRONTEND_URL=http://localhost:8080
ENVIRONMENT=development
```

Generate SECRET_KEY:
```bash
# Windows PowerShell:
..\generate-secret.ps1

# Mac/Linux:
openssl rand -hex 32
```

### Step 8: Test Locally

```bash
# Make sure you're in backend directory with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Step 9: Deploy to Vercel

```bash
# From backend directory
vercel

# After testing, deploy to production
vercel --prod
```

### Step 10: Configure Vercel Environment Variables

Go to Vercel Dashboard → Backend Project → Settings → Environment Variables

Add all variables from your `.env` file, but update:
- `FRONTEND_URL` → Your frontend Vercel URL
- `ENVIRONMENT` → `production`

---

## 📝 File Templates

### requirements.txt
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
supabase==2.3.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
pydantic-settings==2.1.0
pydantic[email]==2.5.3
httpx==0.26.0
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
openai==1.10.0
anthropic==0.8.1
```

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

### app/__init__.py
```python
# Empty file - marks directory as Python package
```

---

## 🧪 Testing

### Test Health Endpoint
```bash
curl http://localhost:8000/health
```

### Test with API Docs
Visit http://localhost:8000/docs and try:
1. POST /api/auth/signup - Create account
2. POST /api/auth/login - Login
3. GET /api/dashboard/kpis - Get KPIs (requires auth)

### Test Authentication
```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 🐛 Troubleshooting

### Import Errors
Make sure all `__init__.py` files exist:
```bash
# Windows:
New-Item -ItemType File -Path app/__init__.py, app/models/__init__.py, app/routers/__init__.py, app/services/__init__.py, app/utils/__init__.py -Force

# Mac/Linux:
touch app/__init__.py app/models/__init__.py app/routers/__init__.py app/services/__init__.py app/utils/__init__.py
```

### Module Not Found
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Or install individually
pip install fastapi uvicorn supabase python-jose passlib
```

### Supabase Connection Error
- Verify SUPABASE_URL is correct
- Verify SUPABASE_SERVICE_KEY is correct (not anon key!)
- Check Supabase project is active
- Test connection in Supabase dashboard

### Port Already in Use
```bash
# Use different port
uvicorn app.main:app --reload --port 8001

# Or kill process on port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

### CORS Errors
- Check FRONTEND_URL in .env
- Verify CORS middleware in app/main.py
- Make sure frontend URL is in allowed origins

---

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These provide:
- Interactive API testing
- Request/response schemas
- Authentication testing
- Example requests

---

## 🔒 Security Notes

### Development
- Use `.env` file for local development
- Never commit `.env` to git
- Use development Supabase project

### Production
- Use Vercel environment variables
- Use production Supabase project
- Use strong SECRET_KEY
- Enable HTTPS only
- Review CORS settings

---

## 📊 Monitoring

### Vercel Dashboard
- View function logs
- Monitor execution time
- Check error rates
- View request counts

### Supabase Dashboard
- Monitor database queries
- Check auth logs
- View API usage
- Monitor storage

---

## 🚀 Deployment Checklist

- [ ] All files created
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Local testing successful
- [ ] Supabase connection works
- [ ] API docs accessible
- [ ] Deployed to Vercel
- [ ] Production env vars set
- [ ] Frontend can connect
- [ ] Authentication works

---

## 📖 Additional Resources

- [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md) - Complete code
- [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md) - Deployment strategy
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Python Docs](https://supabase.com/docs/reference/python)
- [Vercel Python Docs](https://vercel.com/docs/functions/serverless-functions/runtimes/python)

---

## 🆘 Need Help?

1. Check error messages in terminal
2. Review Vercel deployment logs
3. Check Supabase logs
4. Test endpoints in `/docs`
5. Verify environment variables
6. Check this documentation

---

**Next Steps**: After backend is deployed, update frontend's `VITE_API_URL` environment variable in Vercel!
