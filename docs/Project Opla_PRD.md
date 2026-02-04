# **Product Requirements Document (PRD)**

**Project Name:** Project Opla (v2.0)

**Version:** 1.3 (Final)

**Date:** January 20, 2026

**Status:** Ready for Build

## **1\. Executive Summary**

Opine is a unified platform designed to swiftly collect and analyze data across multiple channels: Mobile App, USSD, Web Forms, and Social Media.

The goal of this rebuild (Codename: **Opla**) is to transition Opine from a static data collection tool into a **flexible, intelligence-driven field force platform**. While retaining the simplicity of a Form Builder (similar to JotForm), the new system will allow organizations to inject business logic, historical data, and dynamic scripts into the data collection process.

## **2\. High-Level Architecture**

The system is divided into three logical components:

1. **The Studio:** The command center for configuration, building, and management.  
2. **The Intelligence Layer:** The backend engine handling data synchronization, logic execution, and analytics.  
3. **The Player (Surfaces):** The client-side interfaces (Mobile, Web, USSD) that render the configuration.

## **3\. Module 1: The Studio (Configuration & Build)**

*Target User: Administrators, Project Managers, Campaign Leads.*

### **3.1 Organization & Governance**

* **Multi-Tenancy:** Create and brand Organizations (Logo, Color Schemes).  
* **User Management:** Invite users via email/SMS.  
* **Teams & Hierarchy:** Create nested groups (e.g., "National" \> "Southern Region" \> "Accra Team").  
* **RBAC:** Admin, Editor, Supervisor, Field Agent.

### **3.2 The Advanced Form Builder (The Core)**

*UX Reference: JotForm / Typeform, but with "App-like" powers.*

* **Visual Interface:** Drag-and-drop form construction.  
* **Field Types:** Standard inputs (Text, Number, Photo, GPS) plus Advanced Widgets (Barcode Scanner, Signature, Audio Recording).  
* **Visual Logic (React Flow):** Node-based interface to define complex branching logic.  
* **Data Binding:** Bind form labels or values to **Past Data** (e.g., {{Store.Debt}}).

### **3.3 The Simulator (Test Environment)**

* **Real-time Preview:** A dedicated pane in the Studio that runs the actual mobile rendering engine (via web).  
* **Context Mocking:** Designers can inject "Fake Data" (e.g., "Pretend I am in Region A" or "Pretend Store Debt is $500") to test if their logic scripts fire correctly.  
* **Device Toggles:** Switch view between "Mobile App", "Tablet", and "Web Browser" to verify responsiveness.

### **3.4 Lifecycle & Deployment (Safe Publishing)**

* **Draft vs. Live State:** Edits are *always* saved to a Draft version. Field agents *never* see Draft changes.  
* **Versioning:** Every publish creates a snapshot (v1.0, v1.1).  
* **The "Push" Action:** Users must explicitly click "Publish" to promote Draft \-\> Live.  
* **Hot Updates:** Once published, the Mobile App detects the new version and downloads it automatically on the next sync.

### **3.5 Operations & Communication**

* **Task Dispatching:** Assign forms/tasks to users via map or list.  
* **Messaging:** Broadcast messages to the mobile app.

## **4\. Module 2: The Intelligence Layer (Agent & Automation)**

*The Proactive Brain of the Platform.*

### **4.1 The Proactive Assistant**

* **Insight Watchdog:** Scans data for anomalies (e.g., sales trends).  
* **Contextual Prompts:** Nudges agents based on location.

### **4.2 Routine Automation**

* **Delegated Work:** Triggers actions based on submissions (e.g., email warehouse on "Stock Out").  
* **Scheduled Tasks:** Automated reports and broadcasts.

### **4.3 Smart Data Management**

* **The "Butler" Service:** AI-assisted data cleaning and import.  
* **Predictive Sync:** Pre-caches data based on user assignment/location.

### **4.4 Analytics & Reporting**

* **Conversational Analytics:** Ask questions in natural language.  
* **Dynamic Dashboards:** Drag-and-drop charts and geospatial analysis.

## **5\. Module 3: The Player (Surfaces)**

*The Runtime Environment.*

### **5.1 Mobile App (React Native)**

* **Framework:** React Native (Expo).  
* **Offline-First:** Fully functional without internet using WatermelonDB.  
* **Server-Driven UI (SDUI):** Renders the interface based on the JSON definition.  
* **Script Execution:** Native JavaScript execution for fast, complex logic.

### **5.2 Public Web Forms (Survey Mode)**

* **Anonymous Access:** Forms can be set to "Public".  
* **Sharable Links:** opla.app/s/{slug} allows anyone with the link to submit data via a browser.  
* **Responsive:** Adapts to mobile browsers for "Social Media" distribution.

### **5.3 USSD & SMS**

* **Text-Based Rendering:** Automatically converts the "Form" into a USSD menu tree.  
* **Fallback:** Complex logic is gracefully skipped or summarized.

## **6\. Technical Stack & Requirements**

* **Architecture:** Monorepo (TurboRepo/Nx).  
* **Frontend:** React.js (Vite) and React Native (Expo) \+ NativeWind.  
* **Backend:** Python (FastAPI).  
* **Database:** **PostgreSQL Only**.  
  * Relational tables for Identity/Structure.  
  * JSONB columns for App Blueprints and Submissions (replacing MongoDB).  
* **Caching:** Redis.