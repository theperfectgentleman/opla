We should add a name slug as app\_id\_slug. So that theMMYYYY app\_id is uuid.

{  
  "meta": {  
    "app\_id": "uuid-",  
    "app\_id\_slug": "opla\_project\_alpha",  
    "form\_id": "uuid-1234-5678",  
    "version": 1,  
    "title": "Market Activation Audit",  
    "slug": "market-audit-q1",   
    "is\_public": true,  
    "theme": {  
      "primary\_color": "\#FF5733",  
      "mode": "light"  
    }  
  },

  // SECTION 1: THE LOGIC & DATA DEFINITION (The "State")  
  // This defines the variable names and types before they are shown.  
  "schema": \[  
    {  
      "key": "store\_name",  
      "type": "string",  
      "required": true  
    },  
    {  
      "key": "visit\_date",  
      "type": "datetime",  
      "default": "now()"  
    },  
    {  
      "key": "stock\_level",  
      "type": "integer"  
    },  
    {  
      "key": "competitor\_products",  
      "type": "array",   
      "items": {  
        "properties": {  
          "brand": { "type": "string" },  
          "price": { "type": "decimal" }  
        }  
      }  
    }  
  \],

  // SECTION 2: THE UI LAYOUT (The "View")  
  // Defines the visual tree.   
  // \*NEW\*: Added "platforms" to define if a widget should hide on USSD.  
  "ui": \[  
    {  
      "id": "screen\_1",  
      "type": "screen",  
      "title": "Store Details",  
      "children": \[  
        {  
          "type": "input\_text",  
          "bind": "store\_name",  
          "label": "Store Name",  
          "placeholder": "Enter name...",  
          "icon": "store",  
          "platforms": \["mobile", "web", "ussd"\] // Works everywhere  
        },  
        {  
          "type": "gps\_capture",  
          "bind": "location",  
          "label": "Capture GPS",  
          "platforms": \["mobile", "web"\] // Hidden on USSD  
        }  
      \]  
    },  
    {  
      "id": "screen\_2",  
      "type": "screen",  
      "title": "Inventory Check",  
      "children": \[  
        // Composite Widget: Matrix  
        {  
          "type": "matrix\_grid",  
          "label": "Product Availability",  
          "row\_headers": \["Coca-Cola", "Fanta"\],  
          "col\_headers": \["500ml", "1L"\],  
          "cell\_type": "checkbox",   
          "bind\_root": "availability\_matrix",  
          "platforms": \["mobile", "web"\] // Too complex for USSD  
        },  
        // Composite Widget: Repeater  
        {  
          "type": "repeater",  
          "bind": "competitor\_products",  
          "label": "Competitor Analysis",  
          "layout\_mode": "cards",   
          "columns": \[  
            {  
              "header": "Brand Name",  
              "widget": { "type": "dropdown", "options": \["Pepsi", "Big Cola"\], "bind": "brand" }  
            },  
            {  
              "header": "Price (GHS)",  
              "widget": { "type": "input\_number", "bind": "price" }  
            }  
          \]  
        }  
      \]  
    }  
  \],

  // SECTION 3: LOGIC & SCRIPTS (The "Brain")  
  // "Action" scripts run in the Sandbox.  
  "logic": \[  
    {  
      "trigger": "on\_change",  
      "field": "stock\_level",  
      "action": "run\_script",  
      "script": "if (stock\_level \< 10\) { ui.show\_alert('Low Stock\!'); }"  
    },  
    {  
      "trigger": "on\_load",  
      "action": "prefetch\_data",  
      "source": "context\_data.sales\_history",  
      "filter": "store\_id \== current\_store.id"  
    }  
  \]  
}  
