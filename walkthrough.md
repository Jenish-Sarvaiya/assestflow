# AssetFlow — System Walkthrough & Feature Verification

AssetFlow is a production-grade Enterprise Asset & Resource Management System built for the hackathon. It manages hardware inventories, monitors allocations and booking calendars, processes department approvals, triggers background overdue checks, and maps utilization heatmaps.

---

## 1. Seed Accounts & Credentials

The system seeds key roles using a local company domain structure. All passwords are **`admin123`** (for Admin) / **`manager123`** / **`head123`** / **`employee123`**.

| Role | Employee Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Admin** | System Admin | `admin@assetflow.local` | `admin123` |
| **Asset Manager** | Sarah Connor | `sarah.connor@assetflow.local` | `manager123` |
| **Asset Manager** | John Connor | `john.connor@assetflow.local` | `manager123` |
| **Department Head** | Miles Dyson | `miles.dyson@assetflow.local` | `head123` |
| **Department Head** | Marcus Wright | `marcus.wright@assetflow.local` | `head123` |
| **Employee** | Priya Sharma | `priya.sharma@assetflow.local` | `employee123` |
| **Employee** | Raj Patel | `raj.patel@assetflow.local` | `employee123` |

---

## 2. Core Functional Components Built

### Phase 1: Auth & RBAC
- Built Express-session JWT verification and secure Zustand state storage on the client.
- Implemented `/forgot-password` and `/reset-password` token validations with backend logs.
- Guarded frontend routes dynamically using a custom `<ProtectedRoute>` component.

### Phase 2: Organization Setup
- Admin dashboard panel for creating and editing multi-tier department structures.
- Dynamic Schema Builder: Allows admins to declare custom attribute requirements per category (e.g. RAM, storage capacity, operating system) stored as JSON fields.
- Directory screen to promote roles, deactivate accounts, or transfer employees to departments.

### Phase 3: Asset Directory
- Developed asset registers auto-generating serial tags (e.g., `AF-0001`) within transaction blocks.
- Custom categories rendering dynamic form fields dynamically to let users log specific specs.
- Multer upload handlers saving defect photos or warranties under `uploads/`.
- Client-side QR generation logic for instant equipment tag scanning.

### Phase 4: Allocation & Transfer
- Direct assigns to Employees or Departments.
- **Priya/Raj Conflict Interceptor (409)**: If the asset is already allocated, the API returns a `409 Conflict` containing holder metadata. The frontend intercepts this error and opens a resolution modal enabling the user to submit a **Request Transfer** workflow.
- Gated approval queue: Asset Managers can authorize any transfer, and Department Heads can only approve transfers destined for their department.

### Phase 5: Resource Booking
- Created booking registers checking time ranges (`existingStart < newEnd AND existingEnd > newStart`), allowing back-to-back reservations.
- Derived states calculated at load time (`ONGOING`, `COMPLETED`, `UPCOMING`), preventing rescheduling or cancellations of active/past bookings.

### Phase 6: Maintenance Management
- Service tickets progressing through `PENDING` -> `APPROVED`/`REJECTED` -> `TECHNICIAN_ASSIGNED` -> `IN_PROGRESS` -> `RESOLVED`.
- Dynamic status syncing: Approvals mark assets `UNDER_MAINTENANCE` (blocking allocations/bookings). Resolving tickets runs checks to restore status to `ALLOCATED` if there is an active allocation, otherwise setting it to `AVAILABLE`.

### Phase 7: Asset Audit
- Audit cycles planned by department or location scopes. Creation automatically generates a checklist of items to verify.
- Gated checklist: Only assigned auditors can mark results (`Verified`, `Missing`, `Damaged`).
- Cycle Lock: Locking an audit cycle locks the records and automatically sets all assets corresponding to `MISSING` items to `LOST` status in the DB.

### Phase 8: Notifications & Activity Log
- Interactive Bell dropdown showing a real-time unread alert count, with single read triggers and bulk dismissal.
- Background sweeps running every 5 minutes checking for overdue allocations and booking reminders.
- Administrative audit logs feed tracking database changes with formatted JSON metadata payloads.

### Phase 9: Personalized Dashboards
- Personalized greetings displaying role permissions.
- Custom HSL tiles showing stock statistics, unread alert tallies, and ongoing bookings.
- Category distribution gauges.

### Phase 10: Reports & Analytics
- Utilization statistics ranking bookable resources.
- Tracking repeat repair ticket rates to flag repeating asset failures.
- Real-time heatmaps parsing hour slots and week day capacity loads.
