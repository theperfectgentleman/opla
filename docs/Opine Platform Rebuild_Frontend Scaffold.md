# **Opine Platform v2.0 \- Frontend Scaffold & UI Strategy**

**Version:** 1.1

**Status:** Draft

## **1\. Monorepo Structure**

We are using a **TurboRepo** setup to share code between Web (React) and Mobile (React Native).

opine-monorepo/  
├── apps/  
│   ├── studio/          \# Web Admin (Vite \+ React \+ TS)  
│   ├── mobile/          \# Field App (Expo \+ React Native \+ TS)  
│   └── web-player/      \# Public Survey Runner (Vite \+ React \+ TS)  
├── packages/  
│   ├── ui/              \# Shared UI Components  
│   ├── logic/           \# Shared Business Logic  
│   ├── types/           \# Shared TypeScript Interfaces  
│   └── config/          \# Shared ESLint/TSConfig

## **2\. UI & Styling Strategy (The "Universal" Look)**

* **Styling Engine:** **NativeWind (v4)**.  
* **Component Library:**  
  * **Web:** **shadcn/ui**.  
  * **Mobile:** Custom components built with NativeWind.

## **3\. Navigation & Routing Map**

### **A. Studio (Admin Web) \- apps/studio**

1. **Auth Layout** (/auth)  
2. **App Layout** (/org/:orgId)  
   * /dashboard  
   * /projects  
   * /forms  
   * /forms/builder/:formId \- **The React Flow Editor**.  
   * /forms/simulator/:formId \- **The Testing Sandbox**.  
   * /data  
   * /settings

### **B. Mobile App (Expo) \- apps/mobile**

1. **Auth Stack**  
2. **Main Stack**  
   * (tabs)/home  
   * (tabs)/map  
   * (tabs)/sync  
3. **Work Stack**  
   * form-renderer/:formId \- The Dynamic Form Player.

### **C. Public Web Player \- apps/web-player**

* *Purpose:* Lightweight runner for anonymous surveys.  
* **Routes:**  
  * /s/:slug \- Loads the form by slug (if public).  
  * /success \- Thank you page.

## **4\. State Management Strategy**

* **useAuthStore**: Stores user, token.  
* **useSyncStore** (Mobile Only): Tracks sync status.  
* **useBuilderStore** (Web Only): Tracks draft vs live schema state.

## **5\. The Shared Logic Package (packages/logic)**

1. **SchemaValidator.ts**: Validates form inputs.  
2. **ExpressionEngine.ts**: The sandboxed logic parser.