# LabStation: Advanced Laboratory Resource Management - Technical Documentation

## 1. Project Overview

LabStation is a full-stack web application designed to streamline the management of laboratory equipment and facilities. It provides a robust, role-based platform for researchers, technicians, and administrators to discover, reserve, track, and maintain lab resources efficiently.

The system is built on a modern technology stack, leveraging server-side rendering and a reactive frontend to deliver a fast, secure, and user-friendly experience. Its core purpose is to maximize resource utilization, minimize scheduling conflicts, and provide administrators with powerful tools for oversight and operational control.

---

## 2. Core Features & Implementation Details

### 2.1. User & Access Management

-   **Authentication**: Secure email/password authentication is managed by **Firebase Authentication**.
-   **User Roles (RBAC)**: The system implements Role-Based Access Control with three predefined roles stored in the `users` Firestore collection:
    -   **Admin**: Full access to all system features, including user management, lab operations, and system-wide settings.
    -   **Technician**: Can view all resources and bookings. Can be assigned to and update maintenance requests.
    -   **Researcher**: The default role for new users. Can view and book resources in labs they are a member of.
-   **Signup & Approval Workflow**:
    1.  New users sign up, creating a Firebase Auth account and a corresponding user profile in the `users` Firestore collection with a `status` of `pending_approval`.
    2.  Admins are notified of the new signup request.
    3.  In the `/admin/users` page, an Admin can approve or reject the request.
    4.  **Approval**: The user's status is changed to `active`. The user is notified and can now log in.
    5.  **Rejection**: The user's Firestore profile is deleted. The Firebase Auth account may persist but cannot be used to access the application.
-   **Lab Membership**:
    -   Access to resources is gated by lab membership (unless a resource is "Global").
    -   Users can request access to specific labs from their Dashboard. This creates a `pending_approval` document in the `labMemberships` collection.
    -   Admins manage these requests in the **Lab Operations Center**, where they can grant or revoke access.

### 2.2. Resource Catalog & Management (Admin)

-   **CRUD Operations**: Admins have full CRUD (Create, Read, Update, Delete) capabilities for resources via the `/admin/resources` page.
-   **Resource Types**: Resources are categorized by `ResourceType` (e.g., "Oscilloscope", "Soldering Station"), which are managed by Admins in the **Lab Operations Center**. This allows for consistent filtering and organization.
-   **Resource Status**: Each resource has an operational status (`Working`, `Maintenance`, `Broken`). Only resources marked as `Working` are bookable.
-   **Lab Assignment**: Resources can be assigned to a specific `Lab` or left as "Global" (accessible to all active users).
-   **Remote Access**: The data model supports storing details for remotely accessible equipment (IP, hostname, protocol, credentials), which are displayed on the resource detail page.

### 2.3. Advanced Booking Engine

-   **User Workflow**: Users can create, view, modify (notes), and cancel their bookings.
-   **Admin Workflow**: Admins can approve or reject `Pending` booking requests from the `/admin/booking-requests` page.
-   **Conflict Detection**: Before a new booking is created, the system performs a server-side check against four potential conflicts:
    1.  **Existing Confirmed/Pending Bookings**: Queries for any bookings for the same resource that overlap with the requested time slot.
    2.  **Resource-Specific Unavailability**: Checks the `unavailabilityPeriods` array on the resource document. These are one-off periods for maintenance, calibration, etc.
    3.  **Lab-Wide Blackout Dates**: Checks the `blackoutDates` collection for specific dates (e.g., holidays) where the lab (or the entire system, if `labId` is null) is closed.
    4.  **Lab-Wide Recurring Unavailability**: Checks the `recurringBlackoutRules` collection for weekly repeating closures (e.g., lab closed on weekends).
-   **Waitlist & Queue Management**:
    -   If a resource has `allowQueueing` set to `true`, and a user attempts to book a conflicting slot, their booking is automatically created with a `Waitlisted` status.
    -   When a `Confirmed` booking is cancelled or rejected by an admin, a server-side function (`processWaitlistForResource`) is triggered.
    -   This function finds the first waitlisted booking that fits into the now-free slot, promotes its status to `Pending`, and notifies both the user and the administrators.

### 2.4. Maintenance & Notifications

-   **Maintenance Requests**: Users can log service issues for resources. Admins or Technicians can then update the request's status (`Open`, `In Progress`, `Resolved`, `Closed`), assign a technician, and add resolution notes.
-   **Notification System**: The `notifications` collection stores user-specific alerts. Server-side functions (`addNotification` in `firestore-helpers.ts`) are triggered by key events to create these notifications, such as:
    -   Booking status changes (approved, rejected, promoted).
    -   Signup approval.
    -   Lab access request status updates.
    -   Maintenance request updates.

### 2.5. Lab Operations Center

This is the administrative heart of the application, located at `/admin/lab-operations`. It uses a tabbed interface driven by URL query parameters (`?tab=...`) to manage different facets of the system.

-   **Manage Labs**: CRUD for Lab entities.
-   **Global/Lab-Specific Closures**: Manage `blackoutDates` and `recurringBlackoutRules` either for the whole system or for a specific lab context.
-   **Maintenance Log**: A system-wide view of all maintenance requests with advanced filtering.
-   **Lab Access Requests**: A centralized queue for approving or rejecting user requests to join labs.

---

## 3. Application Architecture

### 3.1. Frontend

-   **Framework**: **Next.js 14+** with the **App Router**. This enables a hybrid approach of server-rendered pages and client-side interactivity.
-   **Component Model**:
    -   **Server Components** are used by default for pages to fetch data directly on the server, reducing client-side bundle size and improving initial load times (e.g., initial data fetch for dashboards).
    -   **Client Components** (`'use client'`) are used for any component requiring interactivity, state, or lifecycle hooks (e.g., forms, dialogs, components with `useState` or `useEffect`).
-   **UI & Styling**:
    -   **React** is the UI library.
    -   **ShadCN UI** provides the unstyled, accessible component primitives (e.g., `Button`, `Card`, `Dialog`).
    -   **Tailwind CSS** is used for all styling, configured with CSS variables for easy theming (`globals.css`).
-   **State Management**:
    -   **React Context API**: Used for global state like authentication (`AuthContext`) and shared admin data (`AdminDataContext`).
    -   **Component State (`useState`, `useReducer`)**: Used for local UI state within components.
-   **Forms**: **React Hook Form** is used for managing form state, paired with **Zod** for robust schema validation.

### 3.2. Backend & Server-Side Logic

-   **Database**: **Firebase Firestore**, a NoSQL document database, is used for all application data. Security is enforced via Firestore Security Rules, which define access permissions for each collection.
-   **Authentication**: **Firebase Authentication** handles user identity and sessions.
-   **Server-Side Operations**:
    -   **Firebase Admin SDK**: Used for privileged server-side operations that cannot be safely performed by the client. A singleton instance is initialized in `src/lib/firebase-admin.ts`.
    -   **Server Actions (`'use server'`)**: Modern Next.js feature used for securely handling data mutations. Functions in `src/lib/firestore-helpers.ts` are implemented as Server Actions, allowing client components to call them directly as if they were local async functions. This simplifies operations like creating notifications, audit logs, and managing lab memberships without needing to write separate API routes.

---

## 4. Firestore Data Model

Below is a high-level overview of the main Firestore collections.

-   `users/{userId}`
    -   `name`, `email`, `role` (Admin, Technician, Researcher), `status` (active, pending_approval), `avatarUrl`.
-   `labs/{labId}`
    -   `name`, `location`, `description`.
-   `resourceTypes/{typeId}`
    -   `name`, `description`.
-   `resources/{resourceId}`
    -   `name`, `resourceTypeId`, `labId`, `status`, `description`, `imageUrl`, `allowQueueing`, etc.
    -   `unavailabilityPeriods`: An array of objects for specific downtime.
-   `bookings/{bookingId}`
    -   `resourceId`, `userId`, `startTime`, `endTime`, `status` (Confirmed, Pending, Cancelled, Waitlisted), `notes`.
    -   `usageDetails`: An object for post-booking usage logging.
-   `labMemberships/{membershipId}`
    -   Composite ID recommended (`${userId}_${labId}`).
    -   `userId`, `labId`, `status` (active, pending_approval, rejected, revoked), `requestedAt`, `updatedAt`.
-   `maintenanceRequests/{requestId}`
    -   `resourceId`, `reportedByUserId`, `issueDescription`, `status`, `assignedTechnicianId`, etc.
-   `blackoutDates/{blackoutId}`
    -   `date`, `reason`, `labId` (null for global).
-   `recurringBlackoutRules/{ruleId}`
    -   `name`, `daysOfWeek` (array), `reason`, `labId` (null for global).
-   `notifications/{notificationId}`
    -   `userId`, `title`, `message`, `type`, `isRead`, `createdAt`, `linkTo`.
-   `auditLogs/{logId}`
    -   `userId`, `userName`, `action`, `entityType`, `entityId`, `details`, `timestamp`.

---

## 5. Getting Started (Local Development)

### 5.1. Prerequisites

-   [Node.js](https://nodejs.org/) (version 20.x or later)
-   npm or yarn
-   A Firebase project with **Authentication** and **Firestore** enabled.

### 5.2. Firebase Configuration

1.  **Create `.env.local`**: Copy `.env.local.example` (or create a new file) in the project root.
2.  **Client-Side Keys**:
    -   In your Firebase project, go to **Project Settings** > **General**.
    -   Register a new Web App.
    -   Copy the `firebaseConfig` object values into the `NEXT_PUBLIC_FIREBASE_*` variables in your `.env.local` file.
3.  **Server-Side (Admin) Keys**:
    -   In **Project Settings** > **Service accounts**, click **Generate new private key** and download the JSON file.
    -   **Option A (Recommended)**: Set an environment variable `GOOGLE_APPLICATION_CREDENTIALS` to the *absolute path* of this downloaded file.
        ```env
        # .env.local example
        GOOGLE_APPLICATION_CREDENTIALS="/Users/yourname/path/to/your-service-account-file.json"
        ```
    -   **Option B**: If file paths are difficult, copy the *entire content* of the JSON file and paste it into a `FIREBASE_SERVICE_ACCOUNT_KEY_JSON` variable in `.env.local`.

### 5.3. Seed Initial Data

For the application to function, you must manually create the first Admin user.

1.  **Create Auth User**:
    -   In the Firebase Console, go to **Authentication > Users** and click "Add user".
    -   Create your admin user (e.g., `admin@example.com` with a password).
    -   Copy the **UID** of the newly created user.
2.  **Create Firestore User Profile**:
    -   Go to **Firestore Database > Data**.
    -   Start a new collection named `users`.
    -   Add a new document. For the **Document ID**, paste the **UID** from the previous step.
    -   Add the following fields to this document:
        -   `name`: (string, e.g., "Admin User")
        -   `email`: (string, `admin@example.com`)
        -   `role`: (string, "Admin")
        -   `status`: (string, "active")
        -   `avatarUrl`: (string, "https://placehold.co/100x100.png")
        -   `createdAt`: (timestamp, current date)

### 5.4. Firestore Rules and Indexes

1.  **Security Rules**: Copy the contents of the `firestore.rules` file from the project root and paste them into the **Firestore Database > Rules** tab in the Firebase Console. Publish the changes.
2.  **Indexes**: Firestore will automatically suggest many required composite indexes as you use the application. If you encounter a query error in the browser console with a link to create an index, **use that link**. For a proactive setup, you can pre-create indexes for common query patterns (e.g., filtering users by role and sorting by name).

### 5.5. Run the Application

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:9002`.

---

## 6. Deployment

This Next.js application is optimized for deployment on platforms like **Vercel**.

1.  Connect your Git repository to a new Vercel project.
2.  Vercel will automatically detect the Next.js framework.
3.  In the Vercel project settings, configure the same environment variables you defined in your `.env.local` file, including the client-side `NEXT_PUBLIC_` keys and the server-side `FIREBASE_SERVICE_ACCOUNT_KEY_JSON`. **It is highly recommended to use the JSON content for the service account key in a production environment variable.**
4.  Deploy! Vercel will handle the build process and deployment.
