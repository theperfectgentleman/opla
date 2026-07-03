# 🚀 Quick Start Guide - Opla Studio

This guide will get you up and running with the Opla Studio in 5 minutes!

---

## Prerequisites

- ✅ Python 3.10+
- ✅ Node.js 18+
- ✅ PostgreSQL database (already configured)
- ⚠️ Redis (optional, for OTP features)

---

## 1. Start the Backend (Terminal 1)

```powershell
cd opla-backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**✅ Backend ready at:** http://localhost:8000  
**📚 API Docs:** http://localhost:8000/api/docs

---

## 2. Start the Frontend (Terminal 2)

```powershell
cd opla-frontend/apps/studio
npm run dev
```

**✅ Studio ready at:** http://localhost:5173

---

## 3. Test the Application

### **Register a New Account**

1. Open http://localhost:5173/register
2. Choose **Email** or **Phone** tab
3. Fill in your details
4. Click **Create Account**

### **Login**

1. Open http://localhost:5173/login
2. Choose **Email** or **Phone OTP** tab
3. Enter credentials
4. Click **Sign In**

---

## Test Credentials

### Email Registration:
```
Email: test@opla.ai
Password: Test1234
Full Name: Test User
```
kay@demo.com
pass123

### Phone Registration (Dev Mode):
```
Phone: +254712345678
Full Name: Phone User

Note: OTP will be displayed on screen in dev mode
```

---

## Troubleshooting

### Backend won't start
```powershell
# Install dependencies
pip install fastapi uvicorn sqlalchemy alembic pydantic pydantic-settings psycopg2-binary python-jose[cryptography] passlib[bcrypt] redis python-multipart python-dotenv email-validator

# Run migrations
cd opla-backend
python -m alembic upgrade head
```

### Frontend won't start
```powershell
# Install dependencies
cd opla-frontend/apps/studio
npm install

# Start dev server
npm run dev
```

### OTP not working
- OTP features require Redis
- Without Redis: Email/password auth still works
- Install Redis: https://redis.io/

---

## File Structure

```
opla/
├── opla-backend/          # Backend API (Python/FastAPI)
│   └── app/
│       └── main.py        # Start here
│
└── opla-frontend/         # Frontend Monorepo
    └── apps/
        └── studio/        # Studio App (React/TypeScript)
            └── src/
                └── App.tsx    # Start here
```

---

## What You Can Do Now

✅ **Register** with email or phone  
✅ **Login** with email or OTP  
✅ **View** your profile on dashboard  
✅ **Logout** and login again  
✅ **Test** token auto-refresh (wait 15 min)  

---

## Next Phase

Ready for **Phase 2: Organizations & Teams**?

See `docs/Backend-Studio Development Roadmap.md` for the full plan!

---

**Need help?** Check `docs/PHASE1_COMPLETE.md` for detailed documentation.
