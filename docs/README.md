# **Opla Documentation Index**

This folder contains all documentation for the Opla Platform v2.0 rebuild.

---

## **📖 Reading Order**

### **For New Developers / Starting Fresh**

Read in this order to understand the project:

1. **`Project Opla_PRD.md`** ⭐ START HERE
   - **Purpose:** Understand the vision, user roles, and what we're building
   - **Key Takeaway:** Opla is a low-code platform for field data collection with offline-first mobile apps

2. **`Opine Platform Rebuild_Technical Architecture.md`**
   - **Purpose:** Understand the system design and tech stack decisions
   - **Key Takeaway:** Monorepo structure, FastAPI backend, React Studio, React Native mobile

3. **`Opine Platform Rebuild_Backend Specification.md`** ⚡ CRITICAL
   - **Purpose:** Complete database schema and API contracts
   - **Key Takeaway:** Full ERD with 8+ tables, auth strategy, and endpoint specs

4. **`Form Blueprint.md`** ⚡ CRITICAL
   - **Purpose:** The JSON schema that defines forms
   - **Key Takeaway:** Forms are stored as JSONB with meta, schema, ui, and logic sections

5. **`Opine Platform Rebuild_Frontend Scaffold.md`**
   - **Purpose:** Frontend structure and routing patterns
   - **Key Takeaway:** TurboRepo with shared packages, NativeWind styling

6. **`PROJECT Opla_AI Start Guide.md`**
   - **Purpose:** High-level guide for AI developers
   - **Key Takeaway:** Quick prompts for scaffolding each phase

---

## **🚀 For Implementation**

### **Active Development**

7. **`Backend-Studio Development Roadmap.md`** ⭐ PRIMARY DEVELOPMENT GUIDE
   - **Purpose:** Detailed, phased development plan for backend + studio
   - **Scope:** Authentication → Organizations → Projects → Form Builder → Publishing
   - **Format:** 6 phases with task breakdowns, code examples, API specs, and UI mockups
   - **Timeline:** 6-8 weeks

8. **`DEVELOPMENT_CHECKLIST.md`** ✅ PROGRESS TRACKER
   - **Purpose:** Track completion of tasks across all phases
   - **Use:** Mark checkboxes as you complete tasks

---

## **📂 Document Quick Reference**

| **Document** | **Type** | **Use When...** |
|-------------|----------|-----------------|
| `README.md` | Index | **You need to navigate the documentation** |
| `DEVELOPMENT_FLOW.md` | Visual Guide | **You want a visual overview of phases and tech stack** |
| `Project Opla_PRD.md` | Product Spec | You need to understand user goals and features |
| `Opine Platform Rebuild_Technical Architecture.md` | Architecture | You need to understand system design or tech choices |
| `Opine Platform Rebuild_Backend Specification.md` | API Spec | You're implementing database schema or API endpoints |
| `Form Blueprint.md` | Data Model | You're working on the form builder or renderer |
| `Opine Platform Rebuild_Frontend Scaffold.md` | Frontend Guide | You're setting up frontend structure or routing |
| `PROJECT Opla_AI Start Guide.md` | Quick Start | You want high-level implementation phases |
| `Backend-Studio Development Roadmap.md` | Dev Plan | **You're actively developing the backend or studio** |
| `DEVELOPMENT_CHECKLIST.md` | Tracker | You want to track progress or plan next session |

---

## **🎯 Critical Information Lookup**

| **I need to know...** | **Check this file** | **Section** |
|----------------------|---------------------|-------------|
| What Opla does | `Project Opla_PRD.md` | Executive Summary |
| Database schema | `Opine Platform Rebuild_Backend Specification.md` | Section 2: ERD |
| API endpoints | `Opine Platform Rebuild_Backend Specification.md` | Section 4 |
| Form JSON structure | `Form Blueprint.md` | Entire document |
| Tech stack | `Opine Platform Rebuild_Technical Architecture.md` | Section 2 |
| How to build auth | `Backend-Studio Development Roadmap.md` | Phase 1 |
| How to build form builder | `Backend-Studio Development Roadmap.md` | Phase 4 |
| Widget types | `Form Blueprint.md` | UI section (lines 50-105) |
| Access control rules | `Opine Platform Rebuild_Backend Specification.md` | Section 3 |
| Environment setup | `Backend-Studio Development Roadmap.md` | Quick Reference |

---

## **🔄 Resuming Work After Context Loss**

**If you're coming back to this project:**

1. **Read:** `Backend-Studio Development Roadmap.md` → "TL;DR - Quick Start" section
2. **Check:** `DEVELOPMENT_CHECKLIST.md` → See what's been completed
3. **Review:** Last few commits in git to see recent changes
4. **Refer:** Quick Reference sections in the Roadmap for schema, tech stack, etc.
5. **Continue:** Pick up at the next unchecked task in the checklist

---

## **📝 Key Principles (Don't Forget)**

1. **Blueprint-Driven:** Forms are defined by JSON (see `Form Blueprint.md`)
2. **Draft vs Live:** Forms have two versions - editable draft and published live
3. **Offline-First:** Mobile app syncs data, doesn't query API directly
4. **PostgreSQL Only:** Using JSONB for flexible schema (no MongoDB)
5. **Access Control:** Role-based (collector/analyst/editor) + org-based (admin/member)

---

## **✅ What's Been Done (Initial Setup)**

- ✅ Project structure created (monorepo + backend folders)
- ✅ FastAPI backend scaffolded
- ✅ Alembic configured for migrations
- ✅ TurboRepo frontend with Studio and Mobile apps
- ✅ All documentation completed

**Next Step:** Begin Phase 1 (Authentication) from the Roadmap

---

## **🤝 Contributing**

When adding new docs:
- Keep them in this `/docs` folder
- Update this README with links
- Reference existing docs instead of duplicating information
- Use markdown format

---

**Last Updated:** 2026-02-04  
**Version:** 1.0  
**Status:** Ready for Development
