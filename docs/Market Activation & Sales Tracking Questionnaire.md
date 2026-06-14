# **Market Activation & Sales Tracking**

This structured questionnaire is designed for field agents and sales teams to manage retail footprint expansion and real-time sales reporting. The framework utilizes the Opla (or Opine) platform's offline-first capabilities to ensure data integrity in remote areas with limited connectivity.

# **Phase 1: Store Enumeration**

This phase establishes the baseline retail database. Each entry is assigned a unique identifier (UUID) to link future sales activities to the specific outlet.

| Field Group | Question / Action | Data Type | Logic / Notes |
| :---- | :---- | :---- | :---- |
| **Location Data** | Region | Dropdown | Pre-populated list of operating regions. |
|  | Market | Filtered Dropdown | Displays markets based on selected Region. |
|  | GPS Coordinates | Auto-capture | Captures latitude/longitude at point of entry. |
| **Store Profile** | Store Name | Text Input | Formal or common trading name. |
|  | Store Owner Name | Text Input | Primary contact person for the business. |
|  | Store Contact Number | Phone Input | Validated for local number format. |
|  | Store Type | Dropdown | Kiosk, Supermarket, Open Market Stall, etc. |
|  | Operating Hours | Time Range | **Refinement:** Open and Close time selection. |
|  | Storefront Photo | Camera | High-resolution image for visual verification. |
|  | Store Barcode/QR | Scanner | Unique scan to generate the `app_id_slug`. |
| **Category Mapping** | SKU Categories | Multi-select | Broad categories (e.g., Beverage, Dairy, Snacks). |
|  | Available SKUs | Filtered List | Dynamic sub-list based on selected Categories. |

# **Phase 2: Sales Activities**

This phase is triggered by a barcode scan to ensure agents are physically present at the store. The UI adapts based on the selected activity type.

## **1\. Distributor Activities**

Focuses on wholesale supply chain monitoring and stock replenishment.

* **Inventory Check**:  
  * Action: Select available SKUs from the pre-mapped store profile.  
  * Input: Numerical quantity for each SKU.  
  * Outcome: Generates store-level distribution reports.

## **2\. Store Activities**

Focuses on retail execution, consumer-facing metrics, and financial reconciliation.

### **A. Merchandising**

| Field | Data Type | Notes |
| :---- | :---- | :---- |
| Store Layout Photo | Camera | Captures shelf visibility and brand positioning. |
| Expiry Date Capture | Date Picker | For each SKU available, user needs to be able to capture expiry date. Validates stock freshness for specific SKUs. |

### **B. Sales**

* **SKU Selection**: Select Category → Select specific SKU.  
* **Transaction**: Input Quantity.  
* **Auto-Calculation**: The system uses a predefined MSRP (Manufacturer's Suggested Retail Price) to calculate the `Total Price` in real-time.  
* **Non-Purchase Logic**: **Refinement:** If "Quantity" \= 0, the field "Reason for Non-Purchase" (Dropdown: Out of Stock, Price High, Competitor Preference, etc.) becomes mandatory.

### **C. Debt Collection**

* **Amount Paid**: Decimal input for precise financial tracking.  
* **Payment Date**: Auto-populated timestamp at the moment of submission.  
* **Payment Method**: **Refinement:** Dropdown selection (Cash, Mobile Money, Bank Transfer).

# **Submission & Metadata**

All submissions include the following system-generated metadata for audit trails:

* **Agent ID**: Person  
* **Submission Date**: Date  
* **Form Version**: File (Reference Blueprint v1.1)

