# AIMRS: how the system flows (diagrams)

Plain pictures of how things move through AIMRS. To see them: GitHub shows each diagram automatically, or copy the
text between the ```mermaid lines into **https://mermaid.live** and it draws it (you can then download it as an image or PDF).

---

## 1. The big picture: who does what

```mermaid
flowchart LR
  EMP["Employee<br/>asks for items,<br/>reports problems"]
  AO["Approving Officer<br/>says yes or no"]
  CUST["Custodian<br/>IT: computers and gadgets<br/>Property: furniture and supplies"]
  ADM["System Admin<br/>accounts, settings,<br/>full audit log"]
  MGT["Management<br/>read-only reports<br/>and dashboards"]
  DOCS["Official forms<br/>PAR, ICS, RIS and more<br/>made automatically"]
  AUD["Audit log<br/>every action recorded<br/>and cannot be changed"]

  EMP -->|"1. files a requisition"| AO
  AO -->|"2. approves"| CUST
  CUST -->|"3. issues the asset"| EMP
  EMP -->|"returns, repairs,<br/>damage, loss, theft"| CUST
  CUST --> DOCS
  ADM -.->|"steps in only when a custodian<br/>asked for something themselves"| CUST
  MGT -.->|"looks, never changes"| AUD
  EMP --> AUD
  AO --> AUD
  CUST --> AUD
```

---

## 2. Asking for an item (requisition)

```mermaid
flowchart TD
  A["Employee opens Asset Catalogue<br/>and picks an item"] --> B["Fills in how many, why, and by when<br/>then submits"]
  B --> C{"Approving Officer<br/>reviews it"}
  C -->|"Rejects with a reason"| X["Employee is told why<br/>Request ends"]
  C -->|"Approves"| D["Goes to the Custodian<br/>IT for computers, Property for furniture"]
  D --> E{"Is the item<br/>in stock?"}
  E -->|"No"| H["Custodian puts it ON HOLD<br/>Employee is notified"]
  H --> E
  E -->|"Yes"| F["Custodian fulfils it and<br/>issues the asset to the employee"]
  F --> G["Form is made automatically<br/>Asset now shows in<br/>My Assigned Assets"]

  C -. "waiting more than 12 hours" .-> W1["Reminder to the officer"]
  C -. "waiting more than 24 hours" .-> W2["Alert to Admin and Management"]
```

A custodian never approves or fulfils a request they filed themselves. Those go to the **System Admin** instead.

---

## 3. Returns and incidents (return, repair, damage, loss, theft)

```mermaid
flowchart TD
  A["Employee opens My Assigned Assets<br/>and picks the item"] --> B["Chooses what happened:<br/>Return, Repair, Damage, Loss or Theft<br/>adds details and optional photos"]
  B --> C{"Custodian<br/>reviews it"}
  C -->|"Rejects with a reason"| X["Employee is told why<br/>Request ends"]
  C -->|"Approves and sets a hand-over date"| D["Employee brings the item in<br/>or prepares documents for loss or theft"]
  D --> E["Custodian marks it RECEIVED"]
  E --> F{"What was it?"}
  F -->|"Return"| G["Asset goes back to stock<br/>Employee no longer holds it<br/>Receipt form made"]
  F -->|"Repair or Damage"| H["Asset goes to Maintenance and Repair<br/>Employee still responsible"]
  F -->|"Loss or Theft"| I["Asset is flagged for disposal<br/>Employee stays responsible<br/>until COA gives relief<br/>Loss report form made"]
  B -. "employee can cancel any time before it is finished" .-> Y["Cancelled"]
```

---

## 4. Maintenance and repair

```mermaid
flowchart TD
  A["Item arrives for repair"] --> B["Custodian opens a repair record:<br/>the problem, in-house or outside shop,<br/>and the date it should be back"]
  B --> L{"Lend the owner<br/>a spare unit?"}
  L -->|"Yes"| M["Spare is issued with a return date"]
  L -->|"No"| C
  M --> C["Repair in progress<br/>Overdue repairs are flagged daily"]
  C --> D{"Result"}
  D -->|"Repaired"| E["Goes back to the owner<br/>or back into stock<br/>Owner is notified"]
  D -->|"Cannot be repaired"| F["Flagged for disposal with the findings<br/>Owner is notified and may ask for a replacement"]
```

---

## 5. Life of an asset

```mermaid
stateDiagram-v2
  [*] --> Registered: custodian adds the asset
  Registered --> Available: ready to use
  Available --> Issued: given to an employee
  Issued --> Returned: employee hands it back
  Returned --> Available: checked and back in stock
  Issued --> UnderRepair: sent for repair
  UnderRepair --> Issued: repaired, back to the owner
  UnderRepair --> Available: repaired, into stock
  Available --> Transferred: moved to another office
  Transferred --> Available: received at the new office
  Available --> FlaggedForDisposal: unusable, lost or stolen
  Issued --> FlaggedForDisposal: lost, stolen or written off
  UnderRepair --> FlaggedForDisposal: cannot be repaired
  FlaggedForDisposal --> Available: found again or flagged by mistake
  FlaggedForDisposal --> Disposed: disposal done outside the system
  Disposed --> [*]
```

"Disposed" is the end: AIMRS only records and flags disposal. The real disposal is done by CICC through the COA process.

---

## 6. What happens behind the screen

```mermaid
flowchart LR
  U["Tester's browser"] --> G["Access page<br/>asks for the shared password<br/>UAT only"]
  G --> F["AIMRS website<br/>what you see and click"]
  F --> B["AIMRS server<br/>checks who you are and what<br/>your role may do"]
  B --> D[("Database<br/>assets, requests,<br/>accounts, history")]
  B --> P["Forms and reports<br/>PDF and Excel"]
  B --> L["Audit log<br/>who did what, when,<br/>from which address"]
  B --> R["Paper copies<br/>numbered printouts<br/>of a record"]
```

---

## 7. Which screens connect to which

```mermaid
flowchart TB
  CAT["Employee: Asset Catalogue"] --> REQ["Employee: My Requisitions"]
  REQ --> QUEUE["Approving Officer: Approval Queue"]
  QUEUE --> HIST["Approving Officer: Approval History"]
  QUEUE --> FULF["Custodian: Requisition Fulfillment"]
  FULF --> MY["Employee: My Assigned Assets"]
  CUS["Custodian: Custody and Issuance"] --> MY
  MY --> RI["Employee: Returns and Incidents"]
  RI --> CRI["Custodian: Returns and Incidents"]
  CRI --> MAINT["Custodian: Maintenance and Repair"]
  CRI --> DISP["Custodian: Disposal Recommendations"]
  FULF --> FORMS["Custodian: Reports and Forms"]
  CRI --> FORMS
  FORMS --> ARCH["Management: Forms Archive"]
  QUEUE --> AUDIT["Admin and Management: Audit Log"]
  CRI --> AUDIT
  FULF --> AUDIT
  NOTE["Everyone: Notifications<br/>tells you when something needs you"] -.-> MY
  NOTE -.-> QUEUE
  NOTE -.-> CRI
```

---

## 8. A paper copy after a step

CICC asked for a printed proof after every step on a requisition, a return or incident report, and a repair. Printing is always optional and never holds up the step.

```mermaid
flowchart TD
  A["Someone saves a step<br/>send, approve, reject, hand over,<br/>close a repair"] --> B{"Box asks:<br/>Keep a paper copy?"}
  B -->|"Not now"| C["Nothing changes<br/>the step is already saved"]
  B -->|"Print copy"| D["Server checks you may<br/>see this record"]
  G["Any time later:<br/>Paper copy box on the record"] -->|"Print copy"| D
  G -->|"Open"| H["Shows an earlier copy again"]
  D --> E["Numbered PDF is made<br/>for example PR-2026-0001<br/>facts, steps so far,<br/>signature lines, verification code"]
  E --> F["Opens in a new tab to print<br/>kept with the record<br/>and written to the audit log"]
  F -.-> I["A second copy of the same record<br/>says REPRINT: copy 2"]
```

A paper copy is not an official COA form, so it is kept on its record and is not listed in the Forms Archive.
