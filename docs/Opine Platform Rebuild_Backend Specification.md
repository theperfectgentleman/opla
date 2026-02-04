# **Opine Platform v2.0 \- Backend Specification & Schema**

**Version:** 1.1

**Status:** Draft

## **1\. Authentication & Identity Strategy**

* **Primary Auth:** Phone Number \+ OTP (Prioritizing field accessibility).  
* **Secondary Auth:** Email \+ Password (For office admins).  
* **Session Management:** JWT (JSON Web Tokens) with a long-lived Refresh Token.

## **2\. Entity Relationship Diagram (ERD)**

### **A. Identity & Structure**

* **users**  
  * id: UUID (PK)  
  * phone: String (Unique, Indexed)  
  * email: String (Unique, Nullable)  
  * full\_name: String  
  * is\_platform\_admin: Boolean  
* **organizations**  
  * id: UUID (PK)  
  * name: String  
  * owner\_id: UUID (FK \-\> users)  
* **org\_members**  
  * user\_id: UUID (FK)  
  * org\_id: UUID (FK)  
  * global\_role: Enum ('admin', 'member')  
* **teams**  
  * id: UUID (PK)  
  * org\_id: UUID (FK)  
  * name: String  
* **team\_members**  
  * team\_id: UUID (FK)  
  * user\_id: UUID (FK)

### **B. The Workspace (Projects & Forms)**

* **projects**  
  * id: UUID (PK)  
  * org\_id: UUID (FK)  
  * name: String  
  * description: Text  
* **forms**  
  * id: UUID (PK)  
  * project\_id: UUID (FK)  
  * title: String  
  * slug: String (Unique, Nullable) \-- *For Public Links (e.g., "market-survey-2026")*  
  * blueprint\_draft: JSONB \-- *The working copy (Edit Mode)*  
  * blueprint\_live: JSONB \-- *The published copy (Run Mode)*  
  * version: Integer \-- *Incremented on publish*  
  * is\_public: Boolean \-- *If true, accessible via /s/{slug} without auth*  
  * status: Enum ('draft', 'live', 'archived')  
* **project\_access**  
  * project\_id: UUID (FK)  
  * accessor\_id: UUID (Polymorphic: User or Team)  
  * accessor\_type: Enum ('user', 'team')  
  * role: Enum ('collector', 'analyst', 'editor')

### **C. Data & Submissions**

* **submissions**  
  * id: UUID (PK)  
  * form\_id: UUID (FK)  
  * user\_id: UUID (Nullable) \-- *Null for anonymous web submissions*  
  * data: JSONB  
  * metadata: JSONB  
  * created\_at: Timestamp  
* **context\_data**  
  * id: UUID (PK)  
  * org\_id: UUID (FK)  
  * collection\_name: String  
  * record\_data: JSONB  
  * tags: Array\<String\>

## **3\. Access Control Logic**

### **Scenario 1: Field Agent (App)**

* **Auth:** Required (JWT).  
* **Source:** blueprint\_live.  
* **Constraint:** Must have Project Access.

### **Scenario 2: Web Survey (Public)**

* **Auth:** None (Anonymous).  
* **Source:** blueprint\_live.  
* **Constraint:** forms.is\_public must be TRUE.

## **4\. Key API Endpoints**

### **Auth & Sync**

* POST /auth/otp/request  
* POST /auth/otp/verify  
* GET /sync/bootstrap

### **Form Operations**

* POST /forms/{id}/publish  
  * **Action:** Copies blueprint\_draft \-\> blueprint\_live, increments version.  
* POST /submissions (Authenticated)  
* POST /public/submissions/{slug} (Anonymous)

### **Management (Studio)**

* POST /projects/{id}/access  
* PUT /forms/{id}/blueprint \-- *Updates blueprint\_draft only*