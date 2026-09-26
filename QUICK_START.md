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

### Studio Ops (Attendance + Review)

Open a **project** → **Ops** → **Attendance** or **Review**. These screens call the local API (`http://localhost:8000/api/v1`):

- Attendance: `GET/POST /organizations/{orgId}/projects/{projectId}/attendance` (list, `my-status`, `check-in`, `check-out`)
- Review: `GET /forms/{formId}/submissions` and `PATCH /submissions/{id}/review`

Agents check in from mobile; Studio lists the live roster and reviews submissions. No mock data.

### AI credits

Studio **Settings** shows the organisation AI credit balance, history, and a manual top-up (org admin or platform admin). The survey wizard spends AI credits on interview, draft, and revise. With a zero balance those buttons stop and show a top-up message; the rest of Studio still works. Compile and generate do not spend credits. Action costs are edited on that Settings card — do not hard-code them.

Local check (API on `:8000`, Studio on `:5173`, repo-root `.env` with `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`):

1. `cd opla-backend && poetry run alembic upgrade head`
2. Register, open **Settings**, add AI credits, confirm the history row.
3. Open a project’s AI survey wizard with balance 0 and confirm the top-up message. Top up, then run an interview only if `GROQ_API_KEY` is set.

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
