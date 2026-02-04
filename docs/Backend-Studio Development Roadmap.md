# **Backend + Studio Development Roadmap**

**Project:** Opla Platform v2.0  
**Focus:** Backend API + Web Studio  
**Goal:** Complete registration → organization setup → form creation workflow  
**Status:** Development Plan

---

## **⚡ TL;DR - Quick Start**

**What is this document?**  
A comprehensive, phased development plan to build the Opla Studio (web app) and Backend API from authentication to form creation.

**Current Status:**  
✅ Apps scaffolded (FastAPI backend + Vite/React frontend in TurboRepo)  
🚧 Ready to implement Phase 1: Authentication

**What gets built:**  
A no-code platform where users can:
1. Register and create organizations
2. Invite team members
3. Create projects with access control
4. Build forms with drag-and-drop (15+ field types)
5. Publish and share forms publicly

**Tech Stack:**  
Backend: FastAPI + PostgreSQL + Alembic + Redis  
Frontend: React + Vite + React Flow (form builder)

**Timeline:** 6-8 weeks (6 phases)

**Start Here:**  
1. Read "Required Reading & Quick Reference" below
2. Begin with Phase 1: Foundation & Authentication
3. Follow checkboxes in each phase

---

## **� Required Reading & Quick Reference**

### **Essential Documents (Read Before Starting)**

Before beginning development, familiarize yourself with these core documents:

1. **`Project Opla_PRD.md`** - Product vision, user roles, module breakdown
   - Key sections: Executive Summary (lines 11-16), Module 1: The Studio (lines 25-62)
   
2. **`Opine Platform Rebuild_Technical Architecture.md`** - System architecture and tech stack
   - Key sections: Monorepo Frontend (lines 74-86), Backend (lines 88-97), Mobile Player (lines 107-116)
   
3. **`Opine Platform Rebuild_Backend Specification.md`** - Complete database schema and API contracts
   - Key sections: ERD (lines 13-76), Access Control (lines 78-90), API Endpoints (lines 92-110)
   
4. **`Form Blueprint.md`** - JSON schema specification for forms
   - This is the SOURCE OF TRUTH for the form data model
   - Review complete document for blueprint structure

5. **`Opine Platform Rebuild_Frontend Scaffold.md`** - UI structure and routing
   - Key sections: Folder structure, NativeWind setup, routing patterns

---

### **Quick Reference: Database Schema**

**Core Tables (from `Opine Platform Rebuild_Backend Specification.md`):**

```
users
├── id (UUID, PK)
├── phone (String, unique, indexed)
├── email (String, unique, nullable)
├── full_name (String)
├── password_hash (String, nullable)
└── is_platform_admin (Boolean)

organizations
├── id (UUID, PK)
├── name (String)
├── owner_id (UUID, FK → users.id)
└── created_at, updated_at

org_members
├── user_id (UUID, FK → users.id)
├── org_id (UUID, FK → organizations.id)
├── global_role (Enum: 'admin', 'member')
└── UNIQUE(user_id, org_id)

teams
├── id (UUID, PK)
├── org_id (UUID, FK → organizations.id)
└── name (String)

team_members
├── team_id (UUID, FK → teams.id)
├── user_id (UUID, FK → users.id)
└── UNIQUE(team_id, user_id)

projects
├── id (UUID, PK)
├── org_id (UUID, FK → organizations.id)
├── name (String)
└── description (Text)

project_access
├── project_id (UUID, FK → projects.id)
├── accessor_id (UUID) - polymorphic
├── accessor_type (Enum: 'user', 'team')
├── role (Enum: 'collector', 'analyst', 'editor')
└── UNIQUE(project_id, accessor_id, accessor_type)

forms
├── id (UUID, PK)
├── project_id (UUID, FK → projects.id)
├── title (String)
├── slug (String, unique)
├── blueprint_draft (JSONB)
├── blueprint_live (JSONB)
├── version (Integer)
├── is_public (Boolean)
└── status (Enum: 'draft', 'live', 'archived')
```

**Reference:** `Opine Platform Rebuild_Backend Specification.md` lines 13-76

---

### **Quick Reference: Tech Stack**

**Backend:**
- Language: Python 3.11+
- Framework: FastAPI
- Database: PostgreSQL (with JSONB support)
- ORM: SQLAlchemy
- Migrations: Alembic
- Cache: Redis (for OTP storage)
- Auth: JWT (python-jose) + bcrypt (passlib)

**Frontend (Studio):**
- Framework: React 18+ (Vite)
- Monorepo: TurboRepo
- Styling: CSS (vanilla, premium design principles)
- State: React Context API
- HTTP Client: Axios
- Form Builder: React Flow
- Routing: React Router v6

**Reference:** `Opine Platform Rebuild_Technical Architecture.md` lines 72-122

---

### **Quick Reference: API Authentication**

**Endpoints (from Backend Specification.md lines 94-105):**
- `POST /auth/otp/request` - Request OTP for phone login
- `POST /auth/otp/verify` - Verify OTP and get tokens
- `GET /sync/bootstrap` - Mobile sync endpoint (future)

**JWT Token Structure:**
- Access Token: 15 min expiry
- Refresh Token: 7 days expiry
- Include in headers: `Authorization: Bearer <token>`

---

### **Quick Reference: Form Blueprint Structure**

**From `Form Blueprint.md`:**

```json
{
  "meta": {
    "app_id": "uuid",
    "form_id": "uuid",
    "version": 1,
    "title": "Form Title",
    "slug": "form-slug",
    "is_public": true,
    "theme": { "primary_color": "#FF5733", "mode": "light" }
  },
  "schema": [
    { "key": "field_name", "type": "string", "required": true }
  ],
  "ui": [
    {
      "id": "screen_1",
      "type": "screen",
      "title": "Screen Title",
      "children": [
        {
          "type": "input_text",
          "bind": "field_name",
          "label": "Label",
          "platforms": ["mobile", "web", "ussd"]
        }
      ]
    }
  ],
  "logic": [
    {
      "trigger": "on_change",
      "field": "field_name",
      "action": "run_script",
      "script": "if (value > 10) { alert('Too high'); }"
    }
  ]
}
```

**Complete schema:** See `Form Blueprint.md` (entire document)

---

### **Quick Reference: Project Structure**

```
opla/
├── docs/                          # All documentation
│   ├── Project Opla_PRD.md
│   ├── Opine Platform Rebuild_Technical Architecture.md
│   ├── Opine Platform Rebuild_Backend Specification.md
│   ├── Form Blueprint.md
│   └── Backend-Studio Development Roadmap.md (this file)
│
├── opla-backend/                  # FastAPI backend
│   ├── alembic/                   # Database migrations
│   ├── app/
│   │   ├── api/                   # API routes
│   │   │   └── routes/
│   │   ├── models/                # SQLAlchemy models
│   │   ├── services/              # Business logic
│   │   ├── core/                  # Config, database
│   │   └── main.py                # FastAPI app
│   └── pyproject.toml             # Dependencies
│
└── opla-frontend/                 # TurboRepo monorepo
    ├── apps/
    │   ├── studio/                # Web Studio (React + Vite)
    │   │   ├── src/
    │   │   │   ├── pages/         # Route components
    │   │   │   ├── components/    # UI components
    │   │   │   ├── contexts/      # React Context
    │   │   │   └── utils/         # Helpers, API client
    │   │   └── package.json
    │   │
    │   └── mobile/                # React Native (Expo) - future
    │
    └── packages/
        └── ui/                    # Shared components
            └── src/
                ├── components/    # Shared UI
                └── types/         # TypeScript types (form blueprint)
```

---

### **Quick Reference: Environment Setup**

**Backend `.env`:**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/opla
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-secret-key-here
JWT_REFRESH_SECRET_KEY=your-refresh-secret-here
CORS_ORIGINS=http://localhost:5173
OTP_EXPIRY_MINUTES=5
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:8000
VITE_PUBLIC_URL=http://localhost:5173
```

---

### **Critical Development Principles**

**From `Opine Platform Rebuild_Technical Architecture.md` (lines 124-149):**

1. **Blueprint-Driven:** The form blueprint (JSON) is the source of truth
2. **Offline-First:** Mobile app queries local DB (WatermelonDB), not API directly
3. **Draft vs Live:** Forms have `blueprint_draft` (editable) and `blueprint_live` (published)
4. **Access Control:** Role-based (collector/analyst/editor) + org-based (admin/member)
5. **Versioning:** Every publish increments version number

---

### **Where to Find Specific Information**

| **Need to know...** | **Check this document** | **Section/Lines** |
|---------------------|------------------------|-------------------|
| User roles and permissions | `Project Opla_PRD.md` | Lines 29-34 |
| Database schema details | `Opine Platform Rebuild_Backend Specification.md` | Lines 13-76 |
| Form JSON structure | `Form Blueprint.md` | Entire document |
| Tech stack choices | `Opine Platform Rebuild_Technical Architecture.md` | Lines 72-122 |
| Widget types | `Form Blueprint.md` | Lines 50-105 |
| API endpoint contracts | `Opine Platform Rebuild_Backend Specification.md` | Lines 92-110 |
| Mobile app architecture | `Opine Platform Rebuild_Technical Architecture.md` | Lines 107-116 |
| Monorepo structure | `Opine Platform Rebuild_Technical Architecture.md` | Lines 74-86 |

---

## **�📋 Table of Contents**

1. [Development Overview](#development-overview)
2. [Phase 1: Foundation & Authentication](#phase-1-foundation--authentication)
3. [Phase 2: Organization & User Management](#phase-2-organization--user-management)
4. [Phase 3: Projects & Workspace](#phase-3-projects--workspace)
5. [Phase 4: Form Builder Core](#phase-4-form-builder-core)
6. [Phase 5: Form Publishing & Management](#phase-5-form-publishing--management)
7. [Phase 6: Access Control & Collaboration](#phase-6-access-control--collaboration)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Checklist](#deployment-checklist)

---

## **Development Overview**

### **Architecture Reference**
- **Backend:** FastAPI + PostgreSQL + Alembic (migrations)
- **Frontend:** React (Vite) + TurboRepo monorepo
- **Auth:** JWT with refresh tokens (OTP primary, email/password secondary)
- **Key Documents:**
  - `Opine Platform Rebuild_Backend Specification.md` - Database schema
  - `Opine Platform Rebuild_Technical Architecture.md` - System design
  - `Form Blueprint.md` - JSON schema specification

### **Development Principles**
1. **API-First:** Backend endpoints fully functional before UI integration
2. **Database-First:** Alembic migrations before SQLAlchemy models
3. **Test as You Build:** Each phase includes unit tests
4. **Progressive Enhancement:** Core functionality first, then polish

---

## **Phase 1: Foundation & Authentication**

**Duration:** 5-7 days  
**Goal:** Users can register and authenticate via OTP or email/password

### **1.1 Backend: Database Schema**

**File:** `opla-backend/alembic/versions/001_create_users_table.py`

**Tasks:**
- [ ] Create Alembic migration for `users` table
- [ ] Fields: `id` (UUID), `phone` (unique, indexed), `email` (unique, nullable), `full_name`, `is_platform_admin`, `password_hash` (nullable), `created_at`, `updated_at`
- [ ] Create indexes on `phone` and `email`
- [ ] Run migration: `alembic upgrade head`

**Reference:** Backend Specification.md lines 17-22

---

### **1.2 Backend: SQLAlchemy Models**

**File:** `opla-backend/app/models/user.py`

**Tasks:**
- [ ] Create `User` model matching the migration schema
- [ ] Add password hashing utility (bcrypt or passlib)
- [ ] Add UUID generation for primary keys
- [ ] Create model relationships (prepare for org_members)

**Code Structure:**
```python
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    is_platform_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

### **1.3 Backend: OTP Service**

**File:** `opla-backend/app/services/otp_service.py`

**Tasks:**
- [ ] Implement OTP generation (6-digit random)
- [ ] Store OTPs in Redis with 5-minute expiry
- [ ] Create verification function
- [ ] Add rate limiting (max 3 requests per phone per 15 minutes)

**Dependencies:**
```toml
# Add to pyproject.toml
redis = "^5.0.0"
python-dotenv = "^1.0.0"
```

**Key Functions:**
- `generate_otp(phone: str) -> str`
- `verify_otp(phone: str, otp: str) -> bool`
- `send_otp_sms(phone: str, otp: str)` (placeholder - integrate SMS provider later)

---

### **1.4 Backend: JWT Auth Service**

**File:** `opla-backend/app/services/auth_service.py`

**Tasks:**
- [ ] Implement JWT token generation
- [ ] Create access token (15 min expiry) and refresh token (7 days)
- [ ] Store refresh tokens in database or Redis
- [ ] Create token verification middleware

**Dependencies:**
```toml
python-jose = "^3.3.0"
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
```

**Key Functions:**
- `create_access_token(user_id: UUID) -> str`
- `create_refresh_token(user_id: UUID) -> str`
- `verify_token(token: str) -> dict`
- `get_current_user(token: str) -> User`

---

### **1.5 Backend: Auth API Endpoints**

**File:** `opla-backend/app/api/routes/auth.py`

**Endpoints to Implement:**

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/auth/register/email` | Email/password registration | `{email, password, full_name}` | `{user, access_token, refresh_token}` |
| POST | `/auth/register/phone` | Phone registration (triggers OTP) | `{phone, full_name}` | `{message: "OTP sent"}` |
| POST | `/auth/otp/request` | Request OTP for login | `{phone}` | `{message: "OTP sent"}` |
| POST | `/auth/otp/verify` | Verify OTP and login | `{phone, otp}` | `{user, access_token, refresh_token}` |
| POST | `/auth/login` | Email/password login | `{email, password}` | `{user, access_token, refresh_token}` |
| POST | `/auth/refresh` | Refresh access token | `{refresh_token}` | `{access_token}` |
| GET | `/auth/me` | Get current user | - | `{user}` |

**Tasks:**
- [ ] Create all endpoints with proper validation (Pydantic schemas)
- [ ] Add error handling for duplicate emails/phones
- [ ] Add password strength validation
- [ ] Add phone number format validation

---

### **1.6 Studio: Authentication Pages**

**Directory:** `opla-frontend/apps/studio/src/pages/auth/`

**Pages to Create:**

#### **1.6.1 Registration Page** (`Register.jsx`)
**Route:** `/register`

**Features:**
- [ ] Tab switcher: "Email" | "Phone"
- [ ] Email tab: Email, Password, Confirm Password, Full Name
- [ ] Phone tab: Phone (with country code), Full Name
- [ ] Form validation (real-time)
- [ ] Password strength indicator
- [ ] "Already have an account?" link to login

**UI Requirements:**
- Premium design with glassmorphism
- Smooth transitions between tabs
- Error toast notifications
- Loading states on submit

---

#### **1.6.2 Login Page** (`Login.jsx`)
**Route:** `/login`

**Features:**
- [ ] Tab switcher: "Email" | "Phone OTP"
- [ ] Email tab: Email, Password, "Forgot password?" link
- [ ] Phone tab: Phone input → OTP input (6-digit)
- [ ] Auto-focus on OTP inputs
- [ ] Resend OTP button (disabled for 60 seconds)
- [ ] "Don't have an account?" link to register

---

#### **1.6.3 OTP Verification Component** (`OTPInput.jsx`)
**Reusable Component**

**Features:**
- [ ] 6 individual input boxes
- [ ] Auto-advance on digit entry
- [ ] Auto-submit on 6th digit
- [ ] Paste support (paste full OTP)
- [ ] Clear on backspace

---

### **1.7 Studio: Authentication Context**

**File:** `opla-frontend/apps/studio/src/contexts/AuthContext.jsx`

**Tasks:**
- [ ] Create authentication context with React Context API
- [ ] Store user state, access token, refresh token
- [ ] Implement auto token refresh (background)
- [ ] Persist tokens in localStorage with encryption
- [ ] Provide login, logout, register functions
- [ ] Add loading and error states

**Context Shape:**
```javascript
{
  user: User | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  login: (credentials) => Promise<void>,
  loginWithOTP: (phone, otp) => Promise<void>,
  register: (data) => Promise<void>,
  logout: () => void,
  refreshToken: () => Promise<void>
}
```

---

### **1.8 Studio: API Client**

**File:** `opla-frontend/apps/studio/src/utils/api.js`

**Tasks:**
- [ ] Create Axios instance with base URL
- [ ] Add request interceptor (attach access token)
- [ ] Add response interceptor (handle 401, auto-refresh token)
- [ ] Create typed API methods for auth endpoints
- [ ] Add error handling wrapper

---

### **1.9 Testing - Phase 1**

**Backend Tests:**
- [ ] User model CRUD operations
- [ ] OTP generation and verification
- [ ] JWT token creation and validation
- [ ] Registration endpoint (email and phone)
- [ ] Login endpoint (email/password and OTP)

**Frontend Tests:**
- [ ] Registration form validation
- [ ] Login form validation
- [ ] OTP input component
- [ ] Auth context state management

**Manual Testing:**
- [ ] Complete email registration flow
- [ ] Complete phone OTP registration flow
- [ ] Email login
- [ ] OTP login
- [ ] Token refresh on expiry

---

## **Phase 2: Organization & User Management**

**Duration:** 7-10 days  
**Goal:** Users can create organizations, invite members, assign roles

### **2.1 Backend: Database Schema**

**File:** `opla-backend/alembic/versions/002_create_organizations.py`

**Tables to Create:**

#### **organizations**
- `id` (UUID, PK)
- `name` (String, not null)
- `slug` (String, unique, indexed) - URL-friendly name
- `owner_id` (UUID, FK → users.id)
- `logo_url` (String, nullable)
- `primary_color` (String, default: #6366f1)
- `created_at`, `updated_at`

#### **org_members**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id)
- `org_id` (UUID, FK → organizations.id)
- `global_role` (Enum: 'admin', 'member')
- `invited_by` (UUID, FK → users.id, nullable)
- `invitation_status` (Enum: 'pending', 'accepted')
- `joined_at` (DateTime)
- Unique constraint on (`user_id`, `org_id`)

#### **teams**
- `id` (UUID, PK)
- `org_id` (UUID, FK → organizations.id)
- `name` (String)
- `description` (Text, nullable)
- `created_at`, `updated_at`

#### **team_members**
- `id` (UUID, PK)
- `team_id` (UUID, FK → teams.id)
- `user_id` (UUID, FK → users.id)
- `added_at` (DateTime)
- Unique constraint on (`team_id`, `user_id`)

**Reference:** Backend Specification.md lines 23-37

---

### **2.2 Backend: SQLAlchemy Models**

**Files:**
- `opla-backend/app/models/organization.py`
- `opla-backend/app/models/org_member.py`
- `opla-backend/app/models/team.py`

**Tasks:**
- [ ] Create Organization model with relationships
- [ ] Create OrgMember model with composite key
- [ ] Create Team and TeamMember models
- [ ] Add slug generation utility (slugify from name)
- [ ] Add model methods: `organization.get_members()`, `user.get_organizations()`

---

### **2.3 Backend: Organization Service**

**File:** `opla-backend/app/services/organization_service.py`

**Tasks:**
- [ ] `create_organization(owner_id, name, **kwargs)` - Auto-add owner as admin
- [ ] `invite_member(org_id, email_or_phone, role, invited_by_id)`
- [ ] `accept_invitation(user_id, org_id)`
- [ ] `remove_member(org_id, user_id, removed_by_id)` - Check permissions
- [ ] `update_member_role(org_id, user_id, new_role, updated_by_id)`
- [ ] `create_team(org_id, name, created_by_id)`
- [ ] `add_team_member(team_id, user_id, added_by_id)`

**Business Rules:**
- Only org admins can invite members
- Owner cannot be removed
- Owner role cannot be changed (must transfer ownership)

---

### **2.4 Backend: Organization API Endpoints**

**File:** `opla-backend/app/api/routes/organizations.py`

**Endpoints:**

| Method | Endpoint | Description | Auth | Request Body |
|--------|----------|-------------|------|--------------|
| POST | `/organizations` | Create organization | Required | `{name, logo_url?, primary_color?}` |
| GET | `/organizations` | List user's organizations | Required | - |
| GET | `/organizations/{org_id}` | Get organization details | Required | - |
| PATCH | `/organizations/{org_id}` | Update organization | Required (admin) | `{name?, logo_url?, primary_color?}` |
| DELETE | `/organizations/{org_id}` | Delete organization | Required (owner) | - |
| GET | `/organizations/{org_id}/members` | List members | Required | - |
| POST | `/organizations/{org_id}/members` | Invite member | Required (admin) | `{email OR phone, role}` |
| PATCH | `/organizations/{org_id}/members/{user_id}` | Update member role | Required (admin) | `{role}` |
| DELETE | `/organizations/{org_id}/members/{user_id}` | Remove member | Required (admin) | - |
| GET | `/organizations/{org_id}/teams` | List teams | Required | - |
| POST | `/organizations/{org_id}/teams` | Create team | Required (admin) | `{name, description?}` |
| POST | `/teams/{team_id}/members` | Add team member | Required (admin) | `{user_id}` |
| DELETE | `/teams/{team_id}/members/{user_id}` | Remove team member | Required (admin) | - |

**Tasks:**
- [ ] Implement all endpoints with proper authorization checks
- [ ] Add pagination for member/team lists
- [ ] Add search/filter for members
- [ ] Add validation for duplicate slugs

---

### **2.5 Studio: Organization Setup Flow**

**Directory:** `opla-frontend/apps/studio/src/pages/onboarding/`

#### **2.5.1 Welcome/Onboarding Page** (`Welcome.jsx`)
**Route:** `/welcome`  
**Trigger:** First login (no organizations)

**Features:**
- [ ] Hero section: "Welcome to Opla, [User Name]!"
- [ ] "Create your first organization" CTA
- [ ] "Join an existing organization" option (if user has pending invitations)
- [ ] Skip option (browse as individual)

---

#### **2.5.2 Create Organization Modal** (`CreateOrgModal.jsx`)

**Features:**
- [ ] Organization Name input (auto-generates slug, editable)
- [ ] Logo upload (optional) - drag & drop or file picker
- [ ] Brand color picker (default: platform color)
- [ ] Preview card showing how org will appear
- [ ] Create button

**Validation:**
- Name: 3-50 characters
- Slug: Check availability in real-time (API call)

---

### **2.6 Studio: Organization Dashboard**

**Directory:** `opla-frontend/apps/studio/src/pages/org/`

#### **2.6.1 Organization Switcher** (`OrgSwitcher.jsx`)
**Location:** Top navigation bar

**Features:**
- [ ] Dropdown showing all user's organizations
- [ ] Current organization displayed with logo + name
- [ ] Switch organization (reload context)
- [ ] "Create new organization" button in dropdown

---

#### **2.6.2 Settings: Members Tab** (`org/[orgId]/settings/members.jsx`)

**Features:**
- [ ] Table of members: Avatar, Name, Email/Phone, Role, Joined Date, Actions
- [ ] "Invite Member" button → Opens modal
- [ ] Role dropdown (admin/member) - only for admins
- [ ] Remove member button (confirmation dialog)
- [ ] Badge for "Owner"
- [ ] Search/filter members

**Invite Member Modal:**
- Email or Phone input
- Role selector (Admin/Member)
- Send invitation button
- Show pending invitations list

---

#### **2.6.3 Settings: Teams Tab** (`org/[orgId]/settings/teams.jsx`)

**Features:**
- [ ] List of teams (card or table view)
- [ ] "Create Team" button → Modal
- [ ] Each team shows: Name, Description, Member count
- [ ] Click team → Team detail page

**Team Detail Page:**
- Team name and description (editable)
- List of team members
- Add/remove members
- Delete team (confirmation)

---

### **2.7 Studio: Organization Context**

**File:** `opla-frontend/apps/studio/src/contexts/OrgContext.jsx`

**Tasks:**
- [ ] Store current organization state
- [ ] Fetch user's organizations on mount
- [ ] Provide organization switching
- [ ] Fetch organization members and teams
- [ ] Provide CRUD functions for org management

**Context Shape:**
```javascript
{
  currentOrg: Organization | null,
  organizations: Organization[],
  members: OrgMember[],
  teams: Team[],
  isLoading: boolean,
  switchOrg: (orgId) => void,
  createOrg: (data) => Promise<Organization>,
  inviteMember: (data) => Promise<void>,
  removeMember: (userId) => Promise<void>,
  createTeam: (data) => Promise<Team>
}
```

---

### **2.8 Testing - Phase 2**

**Backend Tests:**
- [ ] Organization CRUD operations
- [ ] Member invitation flow
- [ ] Role assignment and permissions
- [ ] Team creation and member management
- [ ] Authorization checks (non-admins cannot invite)

**Frontend Tests:**
- [ ] Create organization flow
- [ ] Organization switcher
- [ ] Invite member form
- [ ] Role update functionality

**Manual Testing:**
- [ ] Create organization as new user
- [ ] Invite multiple members via email and phone
- [ ] Accept invitation from different user account
- [ ] Switch between organizations
- [ ] Create teams and add members
- [ ] Update member roles
- [ ] Remove members (check permissions)

---

## **Phase 3: Projects & Workspace**

**Duration:** 5-7 days  
**Goal:** Users can create projects within organizations

### **3.1 Backend: Database Schema**

**File:** `opla-backend/alembic/versions/003_create_projects.py`

**Tables:**

#### **projects**
- `id` (UUID, PK)
- `org_id` (UUID, FK → organizations.id)
- `name` (String, not null)
- `description` (Text, nullable)
- `created_by` (UUID, FK → users.id)
- `created_at`, `updated_at`
- Index on `org_id`

#### **project_access**
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects.id)
- `accessor_id` (UUID) - Can be user_id or team_id
- `accessor_type` (Enum: 'user', 'team')
- `role` (Enum: 'collector', 'analyst', 'editor')
- `granted_by` (UUID, FK → users.id)
- `granted_at` (DateTime)
- Unique constraint on (`project_id`, `accessor_id`, `accessor_type`)

**Reference:** Backend Specification.md lines 41-60

---

### **3.2 Backend: SQLAlchemy Models**

**Files:**
- `opla-backend/app/models/project.py`
- `opla-backend/app/models/project_access.py`

**Tasks:**
- [ ] Create Project model with organization relationship
- [ ] Create ProjectAccess model (polymorphic accessor)
- [ ] Add methods: `project.get_members()`, `project.has_access(user_id)`
- [ ] Add helper: `user.get_accessible_projects(org_id)`

---

### **3.3 Backend: Access Control Helper**

**File:** `opla-backend/app/services/access_control.py`

**Tasks:**
- [ ] `check_project_access(user_id, project_id, required_role=None) -> bool`
- [ ] `get_user_project_role(user_id, project_id) -> str | None`
- [ ] `grant_project_access(project_id, accessor_id, accessor_type, role, granted_by)`
- [ ] `revoke_project_access(project_id, accessor_id, accessor_type, revoked_by)`

**Business Rules:**
- Project creator automatically gets 'editor' role
- Org admins can access all projects (override)
- Team access applies to all team members

---

### **3.4 Backend: Project API Endpoints**

**File:** `opla-backend/app/api/routes/projects.py`

**Endpoints:**

| Method | Endpoint | Description | Auth | Request Body |
|--------|----------|-------------|------|--------------|
| POST | `/organizations/{org_id}/projects` | Create project | Required | `{name, description?}` |
| GET | `/organizations/{org_id}/projects` | List projects | Required | Query: `role?` |
| GET | `/projects/{project_id}` | Get project details | Required | - |
| PATCH | `/projects/{project_id}` | Update project | Required (editor) | `{name?, description?}` |
| DELETE | `/projects/{project_id}` | Delete project | Required (editor) | - |
| GET | `/projects/{project_id}/access` | List project access | Required | - |
| POST | `/projects/{project_id}/access` | Grant access | Required (editor) | `{accessor_id, accessor_type, role}` |
| DELETE | `/projects/{project_id}/access/{accessor_id}` | Revoke access | Required (editor) | Query: `accessor_type` |

**Tasks:**
- [ ] Implement all endpoints with access control
- [ ] Add filtering: user's projects, all org projects (admin)
- [ ] Add sorting by name, created_at
- [ ] Return access role with each project

---

### **3.5 Studio: Projects Page**

**File:** `opla-frontend/apps/studio/src/pages/org/[orgId]/projects/index.jsx`

**Route:** `/org/:orgId/projects`

**Layout:**
```
┌─────────────────────────────────────┐
│ Header: "Projects" | Create Button  │
├─────────────────────────────────────┤
│ Tabs: All | Assigned to Me | Starred│
├─────────────────────────────────────┤
│ Search Bar + Filters (Role, Date)   │
├─────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │Project │ │Project │ │Project │   │
│ │Card 1  │ │Card 2  │ │Card 3  │   │
│ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────┘
```

**Project Card:**
- Project name and description
- "X forms" count
- Last updated date
- Role badge (Collector/Analyst/Editor)
- 3-dot menu: Edit, Manage Access, Delete

**Tasks:**
- [ ] Fetch projects from API on org change
- [ ] Implement tab filtering
- [ ] Search functionality
- [ ] Grid/list view toggle
- [ ] Empty state: "No projects yet. Create your first project!"

---

### **3.6 Studio: Create/Edit Project Modal**

**Component:** `CreateProjectModal.jsx`

**Features:**
- [ ] Project Name input
- [ ] Description textarea (optional)
- [ ] "Create" or "Save" button
- [ ] Form validation

---

### **3.7 Studio: Project Access Management**

**Component:** `ProjectAccessModal.jsx`

**Features:**
- [ ] Current access list (table)
  - Columns: Name, Type (User/Team), Role, Actions
- [ ] "Grant Access" section
  - Dropdown: Select user or team
  - Dropdown: Select role (Collector, Analyst, Editor)
  - Add button
- [ ] Remove access button (confirmation)

**Role Descriptions (tooltip):**
- **Collector:** Can view forms and submit data
- **Analyst:** Can view forms, data, and analytics
- **Editor:** Can create/edit forms and manage access

---

### **3.8 Testing - Phase 3**

**Backend Tests:**
- [ ] Project creation within organization
- [ ] Access control: user access, team access
- [ ] Project filtering by role
- [ ] Update/delete permissions

**Frontend Tests:**
- [ ] Create project form
- [ ] Project list filtering
- [ ] Access management modal
- [ ] Permission-based UI rendering

**Manual Testing:**
- [ ] Create project as org member
- [ ] Grant access to specific users
- [ ] Grant access to teams (verify members can access)
- [ ] Verify collectors cannot edit projects
- [ ] Delete project (check cascade)

---

## **Phase 4: Form Builder Core**

**Duration:** 14-20 days (MOST COMPLEX)  
**Goal:** Users can build forms with drag-and-drop UI and preview

### **4.1 Backend: Database Schema**

**File:** `opla-backend/alembic/versions/004_create_forms.py`

**Table: forms**
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects.id)
- `title` (String, not null)
- `slug` (String, unique, indexed, nullable)
- `blueprint_draft` (JSONB) - Working copy
- `blueprint_live` (JSONB, nullable) - Published copy
- `version` (Integer, default: 0)
- `is_public` (Boolean, default: False)
- `status` (Enum: 'draft', 'live', 'archived')
- `created_by` (UUID, FK → users.id)
- `created_at`, `updated_at`, `published_at` (nullable)
- Index on `project_id`, `slug`

**Reference:** Backend Specification.md lines 46-55

---

### **4.2 Backend: SQLAlchemy Model**

**File:** `opla-backend/app/models/form.py`

**Tasks:**
- [ ] Create Form model
- [ ] Add JSONB field handling for blueprints
- [ ] Add slug auto-generation from title
- [ ] Add version increment on publish
- [ ] Add method: `publish()` - copy draft → live, increment version
- [ ] Add validation: ensure blueprint_draft matches schema

---

### **4.3 Backend: Blueprint Validator**

**File:** `opla-backend/app/validators/blueprint_validator.py`

**Tasks:**
- [ ] Create Pydantic schema for Form Blueprint (from Form Blueprint.md)
- [ ] Validate meta, schema, UI, logic sections
- [ ] Validate field types (input_text, dropdown, gps_capture, etc.)
- [ ] Validate bindings (ensure UI binds to defined schema fields)
- [ ] Validate logic scripts (syntax check, not execution)

**Blueprint Sections (from Form Blueprint.md):**
1. **meta:** app_id, form_id, version, title, slug, is_public, theme
2. **schema:** Field definitions (key, type, required, default)
3. **ui:** Screen tree with widgets (type, bind, label, platforms)
4. **logic:** Triggers, actions, scripts

---

### **4.4 Backend: Form API Endpoints**

**File:** `opla-backend/app/api/routes/forms.py`

**Endpoints:**

| Method | Endpoint | Description | Auth | Request Body |
|--------|----------|-------------|------|--------------|
| POST | `/projects/{project_id}/forms` | Create form | Required (editor) | `{title, slug?}` |
| GET | `/projects/{project_id}/forms` | List forms | Required | Query: `status?` |
| GET | `/forms/{form_id}` | Get form details | Required | Query: `version=draft|live` |
| PATCH | `/forms/{form_id}` | Update form metadata | Required (editor) | `{title?, slug?, is_public?}` |
| PUT | `/forms/{form_id}/blueprint` | Update blueprint (draft) | Required (editor) | `{blueprint}` (full JSON) |
| POST | `/forms/{form_id}/publish` | Publish form | Required (editor) | - |
| DELETE | `/forms/{form_id}` | Delete form | Required (editor) | - |
| GET | `/public/forms/{slug}` | Get public form (live) | None | - |

**Tasks:**
- [ ] Implement all endpoints
- [ ] Validate blueprint on PUT `/blueprint`
- [ ] Implement publish logic (draft → live, increment version)
- [ ] Add version history tracking (optional: store old versions)
- [ ] Public endpoint: only return live blueprint if `is_public = true`

---

### **4.5 Studio: Form Builder Page Structure**

**Route:** `/org/:orgId/projects/:projectId/forms/:formId/builder`

**Layout (Three-Panel Design):**
```
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: Form Title | Draft Badge | Preview | Publish Button │
├────────────┬─────────────────────────────┬───────────────────┤
│            │                             │                   │
│  Widgets   │    Canvas (React Flow)      │   Properties      │
│  Panel     │                             │   Panel           │
│            │  ┌────────────────────┐     │                   │
│ ┌────────┐ │  │  Screen 1          │     │ Selected: Input   │
│ │Input   │ │  │  ┌──────────────┐  │     │ Label: [____]     │
│ │Number  │ │  │  │ Name Field   │  │     │ Placeholder: [__] │
│ │Dropdown│ │  │  └──────────────┘  │     │ Required: [x]     │
│ │Date    │ │  │  ┌──────────────┐  │     │                   │
│ │GPS     │ │  │  │ Email Field  │  │     │                   │
│ └────────┘ │  │  └──────────────┘  │     │                   │
│            │  └────────────────────┘     │                   │
└────────────┴─────────────────────────────┴───────────────────┘
```

---

### **4.6 Studio: Shared Form Blueprint Types**

**File:** `opla-frontend/packages/ui/src/types/form-blueprint.ts`

**Tasks:**
- [ ] Create TypeScript interfaces matching Form Blueprint.md
- [ ] Export types: `FormBlueprint`, `FormMeta`, `SchemaField`, `UIElement`, `LogicRule`
- [ ] Add type guards and validators

**Type Structure (TypeScript):**
```typescript
interface FormBlueprint {
  meta: FormMeta;
  schema: SchemaField[];
  ui: UIElement[];
  logic: LogicRule[];
}

interface FormMeta {
  app_id: string;
  app_id_slug: string;
  form_id: string;
  version: number;
  title: string;
  slug: string;
  is_public: boolean;
  theme: {
    primary_color: string;
    mode: 'light' | 'dark';
  };
}

interface SchemaField {
  key: string;
  type: 'string' | 'integer' | 'datetime' | 'array' | 'object';
  required?: boolean;
  default?: any;
  items?: { properties: Record<string, any> };
}

interface UIElement {
  id?: string;
  type: 'screen' | 'input_text' | 'input_number' | 'dropdown' | 'gps_capture' | 'date_picker' | 'matrix_grid' | 'repeater';
  bind?: string;
  label?: string;
  placeholder?: string;
  icon?: string;
  platforms?: ('mobile' | 'web' | 'ussd')[];
  children?: UIElement[];
  // Type-specific fields...
}

interface LogicRule {
  trigger: 'on_load' | 'on_change' | 'on_submit';
  field?: string;
  action: 'run_script' | 'show_alert' | 'prefetch_data';
  script?: string;
  source?: string;
  filter?: string;
}
```

---

### **4.7 Studio: Form Builder - Widget Panel**

**Component:** `WidgetPanel.jsx`

**Tasks:**
- [ ] Create widget library (draggable items)
- [ ] Group widgets: Basic, Advanced, Layout, Data
- [ ] Each widget shows icon, name, description
- [ ] Implement drag start (React DnD or HTML5 drag)

**Widget Categories:**

**Basic Widgets:**
- Text Input
- Number Input
- Email Input
- Phone Input
- Date Picker
- Time Picker
- Dropdown
- Radio Group
- Checkbox Group
- Toggle/Switch
- Textarea

**Advanced Widgets:**
- GPS Capture
- Image Upload
- File Upload
- Signature Pad
- Barcode Scanner (mobile)
- Audio Recorder

**Layout:**
- Screen (container)
- Section (grouping with title)
- Divider

**Data Widgets:**
- Matrix Grid
- Repeater (dynamic list)
- Lookup (fetch from context data)

---

### **4.8 Studio: Form Builder - Canvas (React Flow)**

**Component:** `FormCanvas.jsx`

**Dependencies:**
```json
{
  "reactflow": "^11.10.0"
}
```

**Tasks:**
- [ ] Install React Flow
- [ ] Create custom node components for each widget type
- [ ] Implement drag-and-drop from Widget Panel
- [ ] Node selection (highlight in canvas)
- [ ] Node deletion (delete key or button)
- [ ] Screen navigation (tabs or sidebar)
- [ ] Auto-layout (prevent overlapping)

**Node Types:**
- `ScreenNode` - Top-level container
- `InputNode` - Generic input fields
- `DropdownNode` - Dropdowns with option preview
- `GPSNode` - GPS capture widget
- `RepeaterNode` - Shows dynamic rows

**Canvas Features:**
- Zoom in/out
- Pan
- Minimap (bottom-right)
- Undo/redo (keyboard shortcuts)
- Copy/paste nodes

---

### **4.9 Studio: Form Builder - Properties Panel**

**Component:** `PropertiesPanel.jsx`

**Tasks:**
- [ ] Display properties of selected node
- [ ] Different property forms per widget type
- [ ] Real-time updates (onChange → update blueprint)
- [ ] Validation feedback (e.g., "Bind field required")

**Common Properties (all widgets):**
- Label
- Bind (dropdown: select from schema fields)
- Required
- Platforms (checkboxes: Mobile, Web, USSD)

**Input-Specific Properties:**
- Placeholder
- Default value
- Validation (regex, min/max length)

**Dropdown Properties:**
- Options (dynamic list with add/remove)
- Allow multiple
- Searchable

**GPS Properties:**
- Auto-capture on load
- Accuracy threshold

---

### **4.10 Studio: Schema Management**

**Component:** `SchemaEditor.jsx` (Modal or Tab)

**Tasks:**
- [ ] Table view of schema fields
- [ ] Columns: Key, Type, Required, Default
- [ ] Add field button
- [ ] Edit/delete inline
- [ ] Validation: unique keys, valid types

**Business Rule:**
- Cannot delete a field if UI widget is bound to it
- Warn user of dependent widgets before deletion

---

### **4.11 Studio: Form Builder - State Management**

**File:** `opla-frontend/apps/studio/src/contexts/FormBuilderContext.jsx`

**Tasks:**
- [ ] Store entire blueprint state
- [ ] Provide actions: addWidget, updateWidget, deleteWidget, updateSchema
- [ ] Implement undo/redo stack (use Immer for immutability)
- [ ] Auto-save to backend (debounced PUT `/forms/{id}/blueprint`)
- [ ] Track dirty state (unsaved changes indicator)

**Context Shape:**
```javascript
{
  blueprint: FormBlueprint,
  selectedNode: string | null,
  isDirty: boolean,
  isLoading: boolean,
  updateMeta: (meta) => void,
  addSchemaField: (field) => void,
  updateSchemaField: (key, updates) => void,
  deleteSchemaField: (key) => void,
  addUIElement: (parentId, element) => void,
  updateUIElement: (id, updates) => void,
  deleteUIElement: (id) => void,
  addLogicRule: (rule) => void,
  save: () => Promise<void>,
  undo: () => void,
  redo: () => void
}
```

---

### **4.12 Testing - Phase 4**

**Backend Tests:**
- [ ] Form creation
- [ ] Blueprint validation (valid and invalid schemas)
- [ ] Blueprint draft save
- [ ] Publish endpoint (draft → live, version increment)

**Frontend Tests:**
- [ ] Widget drag and drop
- [ ] Node selection and property editing
- [ ] Schema field CRUD
- [ ] Blueprint save (API call)
- [ ] Undo/redo functionality

**Manual Testing:**
- [ ] Create form with 5+ different widget types
- [ ] Bind widgets to schema fields
- [ ] Edit properties and verify blueprint updates
- [ ] Save and reload form (check persistence)
- [ ] Delete widget (check removal from blueprint)

---

## **Phase 5: Form Publishing & Management**

**Duration:** 5-7 days  
**Goal:** Publish forms, preview, manage versions, public access

### **5.1 Studio: Form Preview (Simulator)**

**Component:** `FormPreview.jsx`

**Route:** `/org/:orgId/projects/:projectId/forms/:formId/preview`

**Features:**
- [ ] Device frame switcher (Mobile, Tablet, Desktop)
- [ ] Render form from blueprint_draft using renderer component
- [ ] Navigate between screens
- [ ] Fill out form (mock submission)
- [ ] Test logic rules (show alerts, conditional fields)
- [ ] Context data mocking (inject test data)

**Implementation:**
- Reuse mobile renderer component (shared package)
- Display in iframe or separate preview panel
- URL param: `?version=draft|live` to toggle preview version

---

### **5.2 Studio: Form Renderer (Shared Package)**

**File:** `opla-frontend/packages/ui/src/components/FormRenderer.jsx`

**Purpose:** Render form from blueprint JSON (used in preview and mobile app)

**Tasks:**
- [ ] Parse blueprint JSON
- [ ] Map UI elements to React components
- [ ] Handle form state (useState or react-hook-form)
- [ ] Execute logic scripts (safely, using Function)
- [ ] Handle screen navigation
- [ ] Validate inputs on submit

**Component Mapping:**
```javascript
{
  'input_text': TextInput,
  'input_number': NumberInput,
  'dropdown': Dropdown,
  'gps_capture': GPSCapture,
  'date_picker': DatePicker,
  'repeater': Repeater,
  'matrix_grid': MatrixGrid,
  // ...
}
```

---

### **5.3 Studio: Publish Flow**

**Component:** `PublishModal.jsx`

**Trigger:** Click "Publish" button in form builder

**Features:**
- [ ] Show changes summary (diff from last published version)
- [ ] Warning: "This will update the live form for all users"
- [ ] Version changelog input (optional description)
- [ ] Publish button (calls POST `/forms/{id}/publish`)

**Post-Publish:**
- Show success toast: "Form published successfully! Version X.Y"
- Update badge: "Draft" → "Live (v1.2)"
- Option to share public link if `is_public = true`

---

### **5.4 Studio: Version History**

**Component:** `VersionHistory.jsx` (Modal)

**Route:** `/org/:orgId/projects/:projectId/forms/:formId/versions`

**Features:**
- [ ] List of published versions
- [ ] Each version: Number, Published date, Published by, Changelog
- [ ] "View" button (read-only preview)
- [ ] "Restore" button (copy old version → draft)

**Backend Enhancement (Optional):**
- Add table: `form_versions` to store old blueprints
- Or store versions in JSONB array in `forms` table

---

### **5.5 Studio: Public Form Sharing**

**Component:** `ShareFormModal.jsx`

**Features:**
- [ ] Toggle "Make form public"
- [ ] Generate/edit slug (check availability)
- [ ] Display public link: `https://opla.app/s/{slug}`
- [ ] Copy link button
- [ ] Embed code (iframe)
- [ ] QR code generator

**Settings:**
- Allow anonymous submissions (default: true if public)
- Require email from respondents (optional)
- Close form after date/submission count

---

### **5.6 Backend: Public Form Endpoint**

**File:** `opla-backend/app/api/routes/public.py`

**Endpoints:**

| Method | Endpoint | Description | Auth | Response |
|--------|----------|-------------|------|----------|
| GET | `/public/forms/{slug}` | Get public form (live blueprint) | None | `{form, blueprint_live}` |
| POST | `/public/forms/{slug}/submit` | Submit data to public form | None | `{submission_id}` |

**Tasks:**
- [ ] Implement GET endpoint (check `is_public = true`)
- [ ] Return 404 if form not public or archived
- [ ] Track anonymous submissions

---

### **5.7 Testing - Phase 5**

**Backend Tests:**
- [ ] Publish form (draft → live)
- [ ] Version increment
- [ ] Public form access (authorized and unauthorized)
- [ ] Anonymous submission

**Frontend Tests:**
- [ ] Form preview rendering
- [ ] Publish modal flow
- [ ] Version history display
- [ ] Public link generation

**Manual Testing:**
- [ ] Publish a form
- [ ] Preview form (draft vs live)
- [ ] Share public link and access from incognito browser
- [ ] Submit data via public form
- [ ] Restore old version

---

## **Phase 6: Access Control & Collaboration**

**Duration:** 3-5 days  
**Goal:** Fine-tune permissions, audit logs, notifications

### **6.1 Backend: Audit Logging**

**File:** `opla-backend/alembic/versions/006_create_audit_logs.py`

**Table: audit_logs**
- `id` (UUID, PK)
- `user_id` (UUID, FK, nullable)
- `org_id` (UUID, FK, nullable)
- `action` (String) - e.g., "form.published", "member.invited"
- `resource_type` (String) - e.g., "form", "organization"
- `resource_id` (UUID)
- `metadata` (JSONB) - Additional context
- `ip_address` (String)
- `timestamp` (DateTime)

**Tasks:**
- [ ] Create migration and model
- [ ] Implement audit decorator/middleware
- [ ] Log critical actions: form publish, member add/remove, access grant

---

### **6.2 Studio: Activity Feed**

**Component:** `ActivityFeed.jsx`

**Route:** `/org/:orgId/activity`

**Features:**
- [ ] Timeline of recent actions
- [ ] Filter by user, resource type, date range
- [ ] Avatar + description: "John published Form X" (2 hours ago)
- [ ] Click to view resource

---

### **6.3 Backend: Notifications (Optional)**

**File:** `opla-backend/alembic/versions/007_create_notifications.py`

**Table: notifications**
- `id` (UUID)
- `user_id` (UUID, FK)
- `type` (String) - e.g., "invitation", "form_published"
- `title` (String)
- `message` (Text)
- `is_read` (Boolean, default: False)
- `link` (String, nullable)
- `created_at` (DateTime)

**Tasks:**
- [ ] Create notification service
- [ ] Trigger on: member invited, project access granted, form published
- [ ] API endpoints: GET `/notifications`, PATCH `/notifications/{id}/read`

---

### **6.4 Studio: Notifications Panel**

**Component:** `NotificationsPanel.jsx` (Dropdown in top bar)

**Features:**
- [ ] Bell icon with badge (unread count)
- [ ] Dropdown: List of recent notifications
- [ ] Mark as read on click
- [ ] "View all" link to full page

---

### **6.5 Testing - Phase 6**

**Backend Tests:**
- [ ] Audit log creation
- [ ] Notification triggering

**Frontend Tests:**
- [ ] Activity feed rendering
- [ ] Notification dropdown

**Manual Testing:**
- [ ] Perform actions (publish form, invite member) → check audit log
- [ ] Receive invitation → check notification

---

## **Testing Strategy**

### **Backend Testing Stack**
```toml
# Add to pyproject.toml
pytest = "^7.4.0"
pytest-asyncio = "^0.21.0"
httpx = "^0.25.0"  # For FastAPI test client
faker = "^20.0.0"
```

### **Test Structure**
```
opla-backend/tests/
├── conftest.py  # Fixtures (test DB, test client, mock auth)
├── test_auth.py
├── test_organizations.py
├── test_projects.py
├── test_forms.py
├── test_access_control.py
└── test_blueprints.py
```

### **Frontend Testing Stack**
```json
{
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/user-event": "^14.0.0",
  "jsdom": "^23.0.0"
}
```

### **Testing Checklist**
- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests for API endpoints
- [ ] Component tests for critical UI (forms, builders)
- [ ] E2E tests for key workflows (Playwright or Cypress)

---

## **Deployment Checklist**

### **Backend Deployment**

**Environment Variables:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/opla
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=<random-256-bit-key>
JWT_REFRESH_SECRET_KEY=<another-random-key>
OTP_EXPIRY_MINUTES=5
CORS_ORIGINS=https://studio.opla.app,http://localhost:5173
```

**Pre-Deployment:**
- [ ] Run migrations: `alembic upgrade head`
- [ ] Seed database (create platform admin account)
- [ ] Set up Redis for OTP storage
- [ ] Configure CORS for frontend domain
- [ ] Set up error monitoring (Sentry)
- [ ] Configure logging (file rotation)

**Deployment Options:**
- Docker + Docker Compose
- Kubernetes (production)
- Platform: Render, Railway, or AWS ECS

---

### **Studio Deployment**

**Environment Variables:**
```env
VITE_API_URL=https://api.opla.app
VITE_PUBLIC_URL=https://studio.opla.app
```

**Build Process:**
```bash
cd opla-frontend
npm run build
# Output: apps/studio/dist
```

**Hosting Options:**
- Vercel (recommended for Next.js/Vite)
- Netlify
- AWS S3 + CloudFront
- Self-hosted nginx

---

## **Next Steps After Phases 1-6**

### **Phase 7: Data Submission & Analytics**
- Implement submissions table and API
- Create data table view in Studio
- Add charts and analytics dashboard
- Export data (CSV, Excel, JSON)

### **Phase 8: Mobile App Integration**
- Build React Native app (Expo)
- Implement WatermelonDB for offline storage
- Sync engine (pull forms, push submissions)
- Form renderer on mobile

### **Phase 9: Advanced Features**
- Visual logic builder (React Flow for if/then rules)
- Contextual intelligence (data lookup, history)
- AI assistant (natural language form builder)
- USSD gateway integration

---

## **Development Resources**

### **API Documentation**
- Use Swagger/OpenAPI (FastAPI auto-generates docs at `/docs`)
- Document business rules and permissions

### **Component Library**
- Build shared UI components in `packages/ui`
- Use Storybook for component development

### **Code Quality Tools**
**Backend:**
```toml
black = "^23.0.0"  # Code formatting
flake8 = "^6.0.0"  # Linting
mypy = "^1.7.0"  # Type checking
```

**Frontend:**
```json
{
  "eslint": "^8.55.0",
  "prettier": "^3.1.0",
  "typescript": "^5.3.0"
}
```

---

## **Estimated Timeline**

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Auth | 5-7 days | ✅ User registration and login |
| Phase 2: Org Management | 7-10 days | ✅ Organizations, teams, members |
| Phase 3: Projects | 5-7 days | ✅ Project creation and access control |
| Phase 4: Form Builder | 14-20 days | ✅ Drag-and-drop form builder |
| Phase 5: Publishing | 5-7 days | ✅ Publish, preview, public forms |
| Phase 6: Collaboration | 3-5 days | ✅ Audit logs, notifications |
| **Total** | **39-56 days** | **~6-8 weeks** |

---

## **Success Criteria**

By the end of Phase 6, a user should be able to:

- ✅ Register an account (email or phone)
- ✅ Create an organization
- ✅ Invite team members
- ✅ Create a project
- ✅ Build a form with 10+ field types
- ✅ Preview the form on mobile/desktop
- ✅ Publish the form (make it live)
- ✅ Share a public link
- ✅ Receive submissions (anonymous or authenticated)

---

**Document Status:** Ready for Development  
**Last Updated:** 2026-02-04  
**Version:** 1.0
