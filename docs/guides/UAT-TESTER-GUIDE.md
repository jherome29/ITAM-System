# AIMRS test guide for CICC officers

**Written for:** CICC officers and staff trying out the AIMRS Asset Inventory Management and Requisition System. No technical knowledge needed.
Page 1 is for everyone. After that, **each role has its own page**: read the page for your role only.
Pictures of the flow are in `SYSTEM-FLOW.md` (paste into https://mermaid.live to see them).

---

## Page 1: Start here (everyone)

**What it is.** AIMRS replaces paper and spreadsheets for CICC's equipment. Staff ask for items, officers approve, custodians
hand items out and take them back, and every step is recorded and the official forms are made automatically.

**This is a test site.** Everything in it is practice data. Nothing you do affects real records. Try things, and tell us what
confused you.

**How to open it**
1. Open the link: **[ ______________________ ]** (your coordinator fills this in)
2. A page asks for the **access password**: **[ ______________________ ]** (your coordinator fills this in)
3. You then see the AIMRS sign-in page. Sign in with the login on your role's page.

**Four rules**
- **One person per login at a time.** If two people use the same login, they keep signing each other out.
- **Use only the link above**, not any other address you may have seen.
- **Nothing is deleted.** Every action is kept in a history (the Audit Log) for COA. That is on purpose.
- **Stuck or confused? That is useful.** Write down what you clicked and what you expected, and tell us (see the last page).

**The story in five steps**
1. An **Employee** asks for an item (a requisition).
2. The **Approving Officer** says yes or no.
3. The **Custodian** hands the item over. Forms are made automatically.
4. The employee later **returns** it, or reports it **broken, lost or stolen**.
5. The **Custodian** deals with that, and **Management** and the **Admin** can see the whole history.

---

## Page 2: Employee

**You are:** a staff member who needs equipment and looks after the items given to you.

**You can:** ask for items, track your requests, see what you hold, and report a return, repair, damage, loss or theft.
**You cannot:** approve anything, see other people's records, or change settings.

| Menu | What it does |
|---|---|
| My Dashboard | A quick summary: what you hold, what is waiting |
| Asset Catalogue | Browse what is in stock and start a request |
| My Requisitions | Your requests and where each one is (waiting for approval, approved, issued) |
| My Assigned Assets | The items you hold. Start a return, repair, damage, loss or theft report from here |
| Returns & Incidents | Your reports and what the custodian decided |
| Notifications | Messages when something needs you or has changed |

**Where your work goes next:** a requisition goes to your **Approving Officer**, then to a **Custodian**. A return or incident report goes straight to a **Custodian**.

**Logins** (each tester takes one; the password is the same style for all)

| Tester | Email | Password | What this account already has |
|---|---|---|---|
| Employee 1 | uat.employee1@cicc.gov.ph | Employee1@CICC2026! | A laptop and a monitor. Nothing pending. **Try:** report a return or a repair |
| Employee 2 | uat.employee2@cicc.gov.ph | Employee2@CICC2026! | A monitor and a chair. A **return request is already filed** (AR-2026-0021). **Try:** open Returns & Incidents and follow it |
| Employee 3 | uat.employee3@cicc.gov.ph | Employee3@CICC2026! | A filing cabinet. A **requisition is waiting for approval** (REQ-2026-0054). **Try:** follow it in My Requisitions |
| Employee 4 | uat.employee4@cicc.gov.ph | Employee4@CICC2026! | An air conditioner. A **damage report is filed** (AR-2026-0022). **Try:** follow it, then see the repair |
| Employee 5 | uat.employee5@cicc.gov.ph | Employee5@CICC2026! | A chair. A requisition for a laptop is **approved and waiting for the IT custodian** (REQ-2026-0055). **Try:** watch it get issued |
| Employee (older account) | employee@cicc.gov.ph | Employee@CICC2026! | Many items and past requests (27 items, 48 requisitions): good for seeing a full history |

**Try this:** open the Asset Catalogue, request something, then follow it in My Requisitions as the other roles act on it.

---

## Page 3: Approving Officer

**You are:** the supervisor who decides whether a staff request goes ahead.

**You can:** approve or reject requests from your section (with a comment), see your decisions, and ask for your own items like anyone else.
**You cannot:** hand out assets or change accounts.

| Menu | What it does |
|---|---|
| Approval Dashboard | How many requests are waiting and how fast you answer |
| Approval Queue | The requests waiting for you. Open one to **Approve** or **Reject** (a reason is required to reject) |
| Approval History | Every decision you made and how long it took |
| My Requisitions, My Assigned Assets | Your own requests and items, like any employee |
| Notifications | New requests for you, and reminders after 12 hours |

**The 24-hour target:** a request should be answered within 24 hours. After 12 hours you get a reminder, and after 24 hours the Admin and Management are alerted.

**Where your work goes next:** an approved request goes to the **Custodian**. A rejected one goes back to the employee with your reason.

| Login | Email | Password | Covers |
|---|---|---|---|
| Approving Officer | supervisor@cicc.gov.ph | Supervisor@CICC2026! | Operations / Field Operations (the demo employees above) |
| Approving Officer (Property & Supply) | psm.approver@cicc.gov.ph | PSMApprover@2026! | Property and Supply Management staff |

**Try this:** sign in as supervisor@, open the Approval Queue, and approve or reject **REQ-2026-0054** (Employee 3's request).

---

## Page 4: IT Asset Custodian

**You are:** the keeper of **computers and ICT equipment** (laptops, monitors, servers, network devices).

**You can:** register assets, hand them out and take them back, fulfil approved ICT requests, handle returns and incident reports, run repairs, make official forms and reports.
**You cannot:** handle furniture or supplies (that is the Property Custodian), or approve or fulfil **your own** requests.

| Menu | What it does |
|---|---|
| ICT Dashboard | Stock, waiting requests, low-stock alerts |
| ICT Asset Registry | Every ICT asset, with its history. Add new ones here |
| ICT Requisition Fulfillment | Approved requests waiting for you. **Fulfil** (and pick the unit to issue) or put **on hold** if out of stock |
| Custody & Issuance | Who holds what. Issue, transfer or take back an item |
| Returns & Incidents | Employees' return, repair, damage, loss and theft reports. **Approve**, then **mark received** |
| QR Scanner | Scan an asset's QR label to open its record |
| Maintenance & Repair | Items being repaired. Update progress, lend a spare, close as repaired or not repairable |
| ICT Physical Inventory | The count sheet: what the system expects to find in each location |
| ICT Disposal Recommendations | Flag unusable items for disposal, with a written reason |
| ICT Reports & Forms | Make the official forms (PAR, ICS, PTR and others) and see the archive |
| Management Reports | Master list, issuance, returns and repair reports (PDF or Excel) |

**Where your work goes next:** the employee is notified. Forms appear in the archive for Management.

| Login | Email | Password |
|---|---|---|
| IT Asset Custodian | itpersonnel@cicc.gov.ph | CiccIT@2026!Sec |

**Try this:** open ICT Requisition Fulfillment and fulfil **REQ-2026-0055** (Employee 5's laptop). Then open ICT Reports & Forms and make a form.

---

## Page 5: Property Custodian

**You are:** the keeper of **furniture, fixed assets and office supplies**.

**You can:** the same as the IT custodian, for fixed assets and supplies, plus managing supply stock and two review screens.
**You cannot:** handle ICT equipment, or approve or fulfil your own requests.

| Menu | What it does |
|---|---|
| Property Dashboard | Stock and waiting requests |
| Fixed Asset Registry / Supply Inventory | Furniture and equipment records, and supply stock levels |
| Property Requisition Fulfillment | Approved requests waiting for you: fulfil or put on hold |
| Custody & Issuance | Who holds what; issue, transfer, take back |
| Returns & Incidents | Return, repair, damage, loss and theft reports: approve, then mark received |
| Maintenance & Repair | Items being repaired, with spares and results |
| QR Scanner, Physical Inventory | Scan labels; the count sheet |
| Property Disposal Recommendations | Flag unusable items for disposal with a reason |
| Disposal Review | Read-only list of everything flagged for disposal |
| Replacement Validation | Read-only list of replacement requests and items that qualify |
| Property Reports & Forms | Official forms and the archive |

| Login | Email | Password |
|---|---|---|
| Property Custodian | property.custodian@cicc.gov.ph | PropertyCustodian@2026! |
| Property Custodian (second) | property.custodian2@cicc.gov.ph | PropertyOfficer@2026! |

**Try this:** open Returns & Incidents. **AR-2026-0021** (a chair return) and **AR-2026-0022** (an air conditioner damage report) are waiting. Approve one, mark it received, and see what happens next (a repair record opens for the damage).

---

## Page 6: System Administrator

**You are:** the person who looks after accounts, settings and the full history.

**You can:** create and lock accounts, change roles, change settings, read the full Audit Log, and step in as the decider for a **custodian's own requests**.
**You cannot:** register or edit assets, or file requisitions yourself.

| Menu | What it does |
|---|---|
| Admin Dashboard | System health, user activity, the audit overview |
| Users & Accounts | Create, search, deactivate, unlock or sign out accounts; reset a password |
| Roles & Permissions | Change which of the six roles an account has |
| System Settings | Limits such as the approval time target, the repeat-repair limit, sign-in attempts, and the name and fund cluster printed on forms |
| Audit Log | Every action: who, what, when, from where. Filter and export it |
| Returns & Incidents, Repairs, Requisition Fulfillment | Only the requests a custodian filed for themselves |

| Login | Email | Password |
|---|---|---|
| System Administrator | admin@cicc.gov.ph | Admin@CICC2026! |

**Try this:** open Users & Accounts and look at the demo accounts, then open the Audit Log and find the actions you saw other testers do.

---

## Page 7: Management

**You are:** a viewer who checks how the system is doing. **Read-only: you cannot change anything.**

| Menu | What it does |
|---|---|
| Executive Dashboard | Key figures: requests, approvals and how fast they are, asset status |
| Asset Reports, Requisition Reports, Maintenance & Disposal Reports, Physical Count Reports | Make reports as PDF or Excel |
| Audit Log | The full history, read-only |
| Forms Archive | Every official form made so far |

| Login | Email | Password |
|---|---|---|
| Management | management@cicc.gov.ph | Management@CICC2026! |

**Try this:** make an Asset Master List PDF, open the Forms Archive, and check the Audit Log shows what the other testers did.

---

## Last page: telling us what you found

For each problem, write three lines:
1. **Where:** which role, which menu, which screen.
2. **What you did:** what you clicked or typed.
3. **What happened, and what you expected.** A screenshot helps.

Things worth reporting: anything that confused you, a button that did nothing, a message you did not understand, a step that felt
too long, a word you did not know. **There are no wrong answers.**
