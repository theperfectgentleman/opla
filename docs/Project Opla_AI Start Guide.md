# **🚀 AI Developer Guide: Project Opla** 

## **1\. Project Context**

**Project Opla** (formerly Opine) is a low-code application platform for field data collection and management.

* **Core Concept:** Users build dynamic "Apps" (forms \+ logic) on the Web Studio. Field agents run these apps on Mobile (React Native) or USSD, often offline.  
* **Key Differentiator:** "Contextual Intelligence" – The mobile app doesn't just collect data; it pulls past history (e.g., store debt) and runs logic scripts (e.g., "If sales \> target") on the device.

## **2\. Documentation Map**

*Use this index to find the specific rules for the code you are writing.*

| **File Name** | **Purpose** | **When to Read This** |

| **Project Opla_PRD.md** | **The Vision** | Read first to understand *why* we are building this and user roles (Admin vs. Field Agent). |

| **Opine Platform Rebuild_Technical Architecture.md** | **The Stack** | Read to understand the Monorepo structure, React Native \+ Expo decision, and Data Flow. |

| **Opine Platform Rebuild_Frontend Scaffold.md** | **UI & Scaffold** | Read before writing any React/React Native code. Contains folder structure, Routing, and NativeWind setup. |

| **Opine Platform Rebuild_Backend Specification.md** | **DB & API** | Read before writing Python/FastAPI code. Contains the ERD (SQL Schema) and API endpoints. |

| **Form Blueprint.md** | **The Data Model** | Read when building the **Form Builder** (Web) or **Form Renderer** (Mobile). This is the source of truth for the JSON structure. |

## **3\. Implementation Phases (Step-by-Step)**

### **Phase 1: The Opla Monorepo Foundation**

* **Goal:** Set up the empty workspace for Web and Mobile to share code.  
* **Primary Reference:** Opine Platform Rebuild_Frontend Scaffold.md  
* **Prompt for AI:**"Initialize a TurboRepo monorepo named opla-monorepo. Create two apps: apps/studio (Vite+React) and apps/mobile (Expo). Create a shared package packages/ui with NativeWind configured. Follow the structure in Opine Platform Rebuild_Frontend Scaffold.md."

### **Phase 2: The Backend Core**

* **Goal:** User Management, Org Creation, and Auth.  
* **Primary Reference:** Opine Platform Rebuild_Backend Specification.md  
* **Prompt for AI:**"Set up a FastAPI backend for Project Opla with PostgreSQL. Create the SQLAlchemy models for User, Organization, Team, and Project exactly as defined in the ERD section of Opine Platform Rebuild_Backend Specification.md. Implement the OTP Auth flow."

### **Phase 3: The Form Engine (The "Brain")**

* **Goal:** The Drag-and-Drop Builder and the JSON Schema storage.  
* **Primary Reference:** Form Blueprint.md AND Opine Platform Rebuild_Technical Architecture.md  
* **Prompt for AI:**"Create the shared TypeScript types for the Form Schema based on Form Blueprint.md. Then, build a React Flow editor in apps/studio that generates this JSON structure."

### **Phase 4: The Mobile Player (The "Body")**

* **Goal:** Rendering the JSON on a phone.  
* **Primary Reference:** Opine Platform Rebuild_Technical Architecture.md (Mobile Section)  
* **Prompt for AI:**"Build the 'SDUI Renderer' in apps/mobile. It should take the Opla JSON Schema and map type: 'input\_text' to a React Native Text Input component. It must use WatermelonDB for offline storage."

## **4\. Critical Technical Constraints (Do Not Violate)**

1. **Styling:** MUST use **NativeWind** (Tailwind classes) for all components. Do not use StyleSheet.create.  
2. **Logic Sharing:** Business logic (e.g., calculateTotal(price, qty)) MUST live in packages/logic, not inside the UI components.  
3. **Offline First:** The Mobile App must never query the API directly for user data. It must query **WatermelonDB**. The SyncEngine is the only thing that touches the API.  
4. **No Direct SQL in Views:** Backend must use an ORM (SQLAlchemy/Prisma) or strictly typed Service Layer.