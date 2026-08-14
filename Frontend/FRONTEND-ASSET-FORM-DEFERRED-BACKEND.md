# Frontend Asset Form Deferred Backend Work

The enhanced laptop registration and asset-detail workflow is frontend-only. Mock records, validation, QR/barcode values, attachments, and local draft submission are not persisted to PostgreSQL.

Fields requiring backend/database support later include:

- Laptop identity: product line, commercial model, manufacturer model number, service tag, product release year, manufacture year, manufacture date, QR code, barcode value.
- Technical specifications: processor brand/model/generation, RAM capacity/type/upgradeability, storage capacity/type, graphics, display, operating system, hostname, MAC address, IP assignment, encryption, endpoint protection, battery health, technical remarks.
- Accessories: accessory name, serial number, quantity, condition, included-on-issuance flag.
- Acquisition and warranty: supplier, purchase order, delivery receipt, IAR number, funding source, procurement reference, useful life, expected replacement date, warranty dates/provider/type.
- Assignment and location: accountable employee, division, office/section, physical location, issuance data, PAR/ICS details, acknowledgment status, expected return date.
- Lifecycle and condition: verification dates, maintenance status, repair history count, replacement eligibility, disposal status, data-sanitization status.
- Attachment metadata and real file storage.
- Assignment history, lifecycle history, maintenance history, physical verification records, and audit persistence.

Deferred production behavior:

- Backend DTO/entity updates.
- Database migrations.
- Unique serial/property-number constraints.
- Production QR/barcode generation.
- Real file upload/storage.
- Real disposal approval and COA form changes.
- Backend RBAC and record-level authorization.

