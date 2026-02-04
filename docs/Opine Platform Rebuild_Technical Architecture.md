# **Opine Platform v2.0 \- Technical Architecture & Stack**

## **1\. System Context Diagram**

This diagram illustrates the high-level data flow between the **Studio** (where apps are built), the **Intelligence Layer** (the brain), and the **Players** (where work happens).

graph TD  
    subgraph "The Studio (Web Client)"  
        StudioUI\[React Admin Interface\]  
        LogicBuilder\[React Flow Logic Editor\]  
        Simulator\[App Simulator / Preview\]  
        StudioUI \--\> LogicBuilder  
        StudioUI \--\> Simulator  
    end

    subgraph "The Intelligence Layer (Backend)"  
        API\[Python API Gateway (FastAPI)\]  
        Auth\[Identity & RBAC Service\]  
          
        subgraph "The Agent Engine"  
            Watcher\[Insight Watchdog\]  
            Routine\[Routine Executor\]  
            ScriptEng\[Server-Side Script Runner\]  
        end  
          
        API \--\> Watcher  
        API \--\> Routine  
        Watcher \--\> ScriptEng  
    end

    subgraph "Data Persistence"  
        Postgres\[(PostgreSQL\\nRelational \+ JSONB)\]  
        Redis\[(Redis\\nCache, Job Queue)\]  
          
        API \<--\> Postgres  
        Routine \<--\> Redis  
    end

    subgraph "The Player (Surfaces)"  
        subgraph "Mobile App (React Native)"  
            SyncEngine\[Sync Engine\]  
            LocalDB\[(WatermelonDB)\]  
            JSSandbox\[JS Logic Sandbox\]  
            Renderer\[SDUI Renderer\]  
              
            SyncEngine \<--\> LocalDB  
            Renderer \--\> LocalDB  
            Renderer \--\> JSSandbox  
        end  
          
        subgraph "Public Web Player"  
            WebRenderer\[React Web Form Runner\]  
        end  
          
        subgraph "USSD / SMS"  
            USSDGateway\[USSD Gateway\]  
            TextRenderer\[Text Menu Renderer\]  
        end  
    end

    %% Key Data Flows  
    StudioUI \-- "1. Publish App Blueprint (JSON)" \--\> API  
    API \-- "2. Sync Blueprint & Context Data" \--\> SyncEngine  
    SyncEngine \-- "3. Store Offline" \--\> LocalDB  
    Renderer \-- "4. Read Definition" \--\> LocalDB  
    WebRenderer \-- "4a. Read Definition (Public)" \--\> API  
    USSDGateway \-- "5. Fetch Menu Tree" \--\> API  
    SyncEngine \-- "6. Push Collected Data" \--\> API  
    WebRenderer \-- "6a. Push Public Data" \--\> API  
    Watcher \-- "7. Push Alerts/Nudges" \--\> SyncEngine

## **2\. Technical Stack Breakdown**

### **A. The "Monorepo" Frontend (Web & Mobile)**

**Strategy:** We will use a Monorepo (TurboRepo or Nx) to share business logic, types, and validation rules between the Web Studio, Mobile App, and Public Web Player.

* **Shared Packages:**  
  * @opine/types: TypeScript interfaces for the JSON Schema.  
  * @opine/logic: The validation engine (e.g., isValidEmail, calculateTotal) used by Studio Simulator, Mobile App, and Web Player.  
* **Web Studio (apps/studio):** **React.js** (Vite).  
  * Includes **React Flow** for the builder and an iframe-based **Simulator**.  
* **Mobile Player (apps/mobile):** **React Native** (via **Expo**).  
  * **Expo** allows for Over-The-Air (OTA) updates, letting you fix critical bugs in the field without waiting for App Store review.  
* **Public Web Player (apps/web-player):** **React.js** (Vite).  
  * A lightweight runner optimized for mobile browsers to handle anonymous survey links.

### **B. The Intelligence Layer (Backend)**

* **Language:** **Python**.  
* **Framework:** **FastAPI** (High performance, async native \- great for high-volume data ingestion) OR **Django** (Batteries included, robust admin).  
  * *Recommendation:* **FastAPI** if you want microservices speed; **Django** if you want speed of development.  
* **Task Queue (The Agent):** **Celery** or **Huey** backed by **Redis**.  
  * This runs the "Watchdog" routines and background data processing.  
* **AI/Scripting:**  
  * **LangChain:** If integrating LLMs for the "Assistant."  
  * **PyMiniRacer (V8):** To safely run user-submitted JS scripts on the server side for verification.

### **C. Data Persistence**

* **Unified Database:** **PostgreSQL**.  
  * **Structured Data:** Users, Organizations, Permissions, Teams.  
  * **Unstructured Data (JSONB):** Form Blueprints (Schemas) and Submissions.  
  * *Benefit:* Eliminates the need for MongoDB, reducing complexity and infrastructure costs while maintaining the flexibility to store dynamic form structures.  
* **Caching:** **Redis**.

### **D. The Mobile Player (Mobile App)**

* **Framework:** **React Native (Expo)**.  
* **Local Database:** **WatermelonDB**.  
  * Highly optimized for React Native.  
  * Handles the synchronization of thousands of records without freezing the UI.  
* **Scripting Sandbox:** **quickjs-emscripten** or a confined Function scope (with strict parsing).  
  * Allows the app to run the JavaScript logic defined in the Studio dynamically.  
* **Map Rendering:** **react-native-maps**.

### **E. Infrastructure & DevOps**

* **Containerization:** **Docker**.  
* **Orchestration:** Kubernetes (K8s) or Docker Swarm.  
* **CI/CD:** GitHub Actions.  
* **Monitoring:** Prometheus \+ Grafana, Sentry.

## **3\. Key Concepts for Developers**

### **1\. The "Blueprint" (JSON Schema)**

The entire application is defined by a massive JSON object called the **Blueprint**.

* **The Studio** *writes* this JSON.  
* **The Backend** *stores* and *versions* this JSON in the forms table (JSONB column).  
* **The Mobile App** *reads* this JSON to know what to draw on the screen.  
* *Dev Note:* This decouples the UI from the code. You can change a form field in the database, and the app updates instantly.

### **2\. The "Context Slice" (Sync Logic)**

We do not sync the whole database. We sync a **Slice**.

* When a user logs in, the backend calculates their **Scope** (e.g., Region\_ID \= 5).  
* The Sync Engine packages Stores WHERE Region\_ID \= 5 and Products WHERE Active \= True.  
* This payload is sent to the device to populate the local WatermelonDB.

### **3\. The "Sandboxed Logic"**

Users can write logic like: if (store.debt \> 500\) return false;.

* **In Studio:** This is saved as a string: "code": "if (store.debt \> 500)..."  
* **On Mobile:** The app spins up a sandbox, injects the store object as a variable, runs the string code, and gets the boolean result.  
* **Why React Native?** Since the app is already JS, this execution is native and extremely fast compared to Flutter's bridge.