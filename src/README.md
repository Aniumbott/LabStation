
# LabStation - Advanced Lab Resource Management

LabStation is a comprehensive web application designed to streamline the management and booking of laboratory resources. It provides a user-friendly interface for researchers, technicians, and lab managers to efficiently discover, reserve, and track the usage of lab equipment and facilities. The system incorporates role-based access control, detailed resource cataloging, an intelligent booking engine, and administrative tools for robust lab operations.

## Core Features

*   **User Management & Authentication:**
    *   Secure **Email/Password Authentication** powered by Firebase.
    *   User **Signup** with an admin approval workflow.
    *   User **Login** and persistent sessions.
    *   **User Profiles:** Users can view and manage their basic profile information (e.g., update name) and a mock password change UI.
    *   **Role-Based Access Control (RBAC):** Predefined roles (Admin, Technician, Researcher) with UI elements and actions conditionally rendered based on user role.
*   **Resource Catalog & Management (Admin):**
    *   Add, edit, view, and delete detailed information for lab resources (e.g., oscilloscopes, power supplies, soldering stations).
    *   Resource operational status: 'Working', 'Maintenance', 'Broken'.
    *   Categorize resources using customizable **Resource Types**.
    *   Store manufacturer, model, serial number, purchase date, and general notes.
    *   Manage **Remote Host Integration** details (IP/DNS, protocol, credentials) for remotely accessible equipment.
*   **Advanced Booking Engine:**
    *   Users can create, view, modify, and cancel bookings for available resources.
    *   **Conflict Detection:** Prevents double-bookings by checking against:
        *   Other existing bookings.
        *   Resource-specific one-off unavailability periods (maintenance, etc.).
        *   Lab-wide specific blackout dates.
        *   Lab-wide weekly recurring unavailability rules.
    *   **Availability Scheduling:**
        *   Admins can define resource-specific unavailability periods (e.g., for maintenance). Resource must be in 'Working' status to be bookable.
        *   Manage lab-wide **Blackout Dates** (specific holidays or closure days).
        *   Define lab-wide **Recurring Unavailability Rules** (e.g., lab closed on weekends).
    *   **Queue Management (Basic):**
        *   Resources can be configured to allow waitlisting.
        *   If a slot is full, users can join a waitlist.
        *   Bookings are automatically promoted from the waitlist (to 'Pending' status) when a conflicting confirmed booking is cancelled or rejected by an admin.
        *   Users can see their position in the waitlist (if this UI is implemented).
    *   **Booking Approval Workflow (Admin):** New booking requests enter a 'Pending' state and require approval from an Admin before being confirmed.
*   **Maintenance Requests:**
    *   Log service issues for specific resources.
    *   Admins/Technicians can assign requests, update status (Open, In Progress, Resolved, Closed), and add resolution notes.
*   **Notifications:**
    *   In-app **Notification Center** to alert users about:
        *   Booking confirmations, rejections, and pending approvals.
        *   Promotion from a waitlist.
        *   New maintenance requests or status updates.
        *   Signup approvals.
        *   Lab access request status updates (approved, rejected, revoked).
*   **Usage Logging:**
    *   After a booking is completed, users can log usage details: actual start/end times, outcome (Success, Failure, Interrupted), data storage location, and comments.
*   **Reporting & Analytics (Admin):**
    *   Visual dashboard with charts for:
        *   Bookings per resource.
        *   Maintenance request status distribution.
        *   Resource utilization (conceptual, based on booked days).
        *   Peak booking hours.
        *   Current waitlist sizes.
    *   (Note: The global reports page is deprecated; these reports are now available per-lab in the Lab Operations Center.)
*   **Audit Logging (Admin):**
    *   Tracks key system events and actions for administrative review.
*   **Lab Operations Center (Admin):**
    *   Centralized management for Labs, Resource Types, Lab Closures (Blackout Dates & Recurring Rules), Maintenance Requests (admin view), and Lab Access Requests.
    *   Context-driven interface to manage system-wide settings or focus on specific lab operations.
*   **Lab & Membership Management:**
    *   Admins can manage **Labs** (CRUD operations for lab entities: name, location, description).
    *   Admins can manage **Resource Types** (CRUD operations for resource categories).
    *   Users can request access to specific labs.
    *   Admins can approve or reject lab access requests.
    *   Admins can manually grant or revoke lab access for users.
    *   Users can leave labs they are members of.

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **UI Library:** React
*   **Component Library:** ShadCN UI
*   **Styling:** Tailwind CSS
*   **State Management (Frontend):** React Context API (for Auth) & component-level state.
*   **Form Management:** React Hook Form
*   **Schema Validation:** Zod
*   **Date Utilities:** date-fns
*   **Icons:** Lucide React
*   **Authentication:** Firebase Authentication (Email/Password)
*   **Database:** Firebase Firestore (for user profiles and application data)
*   **Server-Side Operations:** Firebase Admin SDK (for notifications, audit logs, and other server-side operations like lab membership management)

## Getting Started (Local Development)

### Prerequisites

*   [Node.js](https://nodejs.org/) (version 18.x or later recommended)
*   npm or yarn
*   A Firebase project

### Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <project-directory-name>
    ```

2.  **Install Dependencies:**
    ```bash
    npm install # or yarn install
    npm install firebase-admin # ensure firebase-admin is installed
    ```

3.  **Set up Firebase:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
    *   **Enable Authentication:** In your Firebase project, go to "Authentication" -> "Sign-in method" and enable the "Email/Password" provider.
    *   **Enable Firestore:** In your Firebase project, go to "Firestore Database" -> "Create database". Start in **Test Mode** for development (remember to secure rules for production). Choose a location.
    *   **Register your Web App:** In Project Overview, click the Web icon (`</>`) to add your app. Get the `firebaseConfig` object.
    *   **Service Account for Admin SDK (CRITICAL for server-side functions like notifications/audit logs):**
        *   Go to Project Settings > Service accounts.
        *   Click "Generate new private key" and download the JSON file. This file contains sensitive credentials. **Store this file securely and DO NOT commit it to your Git repository.**
        *   Note the absolute path to this file on your system.

4.  **Configure Environment Variables:**
    *   Create a `.env.local` file in the root of your project by copying `.env.local.example` (if it exists, otherwise create it).
    *   Fill in your Firebase project's configuration values from the `firebaseConfig` object (for client-side Firebase):
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
        NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id # Optional
        ```
    *   **For Firebase Admin SDK (Server-Side Operations):** Choose **ONE** of the following methods:
        *   **Option A (Recommended for local dev - File Path):**
            Set `GOOGLE_APPLICATION_CREDENTIALS` to the **absolute path** of the service account JSON file you downloaded.
            ```env
            # Example for GOOGLE_APPLICATION_CREDENTIALS (replace with your actual path)
            # macOS/Linux: /Users/yourname/path/to/your-service-account-file.json
            # Windows: C:\\Users\\yourname\\path\\to\\your-service-account-file.json
            GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
            ```
        *   **Option B (JSON Content):**
            If file paths are problematic, you can set `FIREBASE_SERVICE_ACCOUNT_KEY_JSON` to the *entire JSON content* of the service account key file.
            ```env
            # Example for FIREBASE_SERVICE_ACCOUNT_KEY_JSON (paste the JSON content as a single line or ensure your environment handles multi-line)
            # FIREBASE_SERVICE_ACCOUNT_KEY_JSON='{"type": "service_account", ...}'
            ```
            The `src/lib/firebase-admin.ts` is configured to prioritize `FIREBASE_SERVICE_ACCOUNT_KEY_JSON` if both are set.
    *   **Important:** Add `.env.local` to your `.gitignore` file to prevent committing your Firebase credentials.

5.  **Seed Initial Admin User (Important!):**
    *   In the **Firebase Console > Authentication > Users** tab, click "Add user" and create your admin user (e.g., `admin@labstation.com` with a password). Note down the UID of this user.
    *   In the **Firebase Console > Firestore Database > Data** tab:
        *   Click "+ Start collection", name it `users`.
        *   Click "+ Add document". For the **Document ID**, paste the **UID** of the admin user you just created.
        *   Add the following fields to this document:
            *   `name`: (Your Admin's Name, e.g., "Admin User") - Type: string
            *   `email`: (Your Admin's Email) - Type: string
            *   `role`: "Admin" - Type: string
            *   `status`: "active" - Type: string
            *   `avatarUrl`: "https://placehold.co/100x100.png" - Type: string
            *   `createdAt`: (Current timestamp) - Type: timestamp
    *   **Security Rules:** Update your Firestore security rules. Go to **Firestore Database > Rules** tab and replace the default rules with the following comprehensive version. **Review and adapt these rules for your production security needs.**
        ```firestore-rules
        rules_version = '2';

        service cloud.firestore {
          match /databases/{database}/documents {

            // Helper function to check if a user is an Admin
            function isAdmin(userId) {
              return get(/databases/$(database)/documents/users/$(userId)).data.role == 'Admin';
            }

            // Helper function to check if a user is a Technician
            function isTechnician(userId) {
              return get(/databases/$(database)/documents/users/$(userId)).data.role == 'Technician';
            }

            // Helper function to check if the request is from the owner of the document
            function isOwner(userId) {
              return request.auth.uid == userId;
            }

            // USERS Collection
            match /users/{userId} {
              // New users are created with 'pending_approval' status and 'Researcher' role by default.
              allow create: if request.auth != null
                              && isOwner(userId) // User can only create their own profile
                              && request.resource.data.email == request.auth.token.email // Email must match token
                              && request.resource.data.status == 'pending_approval'
                              && request.resource.data.role == 'Researcher'
                              && !("createdAt" in request.resource.data); // Prevent client from setting createdAt

              // Users can read their own profile. Admins and Technicians can read any user profile.
              allow read: if request.auth != null && (
                            isOwner(userId) ||
                            isAdmin(request.auth.uid) ||
                            isTechnician(request.auth.uid)
                          );

              // Admins and Technicians can list users (e.g., for admin panels or technician assignment).
              allow list: if request.auth != null && (isAdmin(request.auth.uid) || isTechnician(request.auth.uid));

              // Users can update their own 'name' and 'avatarUrl'.
              // Admins can update 'name', 'role', 'status', 'avatarUrl' for any user.
              // Admin cannot demote themselves from Admin role.
              allow update: if request.auth != null && (
                              (isOwner(userId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'avatarUrl'])) ||
                              (isAdmin(request.auth.uid) &&
                               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'role', 'status', 'avatarUrl']) &&
                               !(isOwner(userId) && resource.data.role == 'Admin' && request.resource.data.role != 'Admin')
                              )
                            );

              // Admins can delete user profiles (note: this doesn't delete Firebase Auth user).
              // Prevent Admin from deleting their own profile through this rule.
              allow delete: if request.auth != null && isAdmin(request.auth.uid) && !isOwner(userId);
            }

            // LABS Collection
            match /labs/{labId} {
              // Authenticated users can read and list labs.
              allow read, list: if request.auth != null;
              // Only Admins can create, update, or delete labs.
              allow write: if request.auth != null && isAdmin(request.auth.uid);
            }

            // RESOURCE TYPES Collection
            match /resourceTypes/{typeId} {
              // All authenticated users can read and list resource types.
              allow read, list: if request.auth != null;
              // Only Admins can create, update, or delete resource types.
              allow write: if request.auth != null && isAdmin(request.auth.uid);
            }

            // RESOURCES Collection
            match /resources/{resourceId} {
              // Authenticated users can read and list resources if they are members of the lab the resource belongs to, or if the resource has no labId.
              // Admins can read and list all resources.
              function isMemberOfResourceLab(resourceData) {
                return resourceData.labId == null ||
                       exists(/databases/$(database)/documents/labMemberships/$(request.auth.uid + '_' + resourceData.labId)) &&
                       get(/databases/$(database)/documents/labMemberships/$(request.auth.uid + '_' + resourceData.labId)).data.status == 'active';
              }

              allow read: if request.auth != null && (isAdmin(request.auth.uid) || isMemberOfResourceLab(resource.data));
              allow list: if request.auth != null; // Listing typically needs broader read, specific filtering happens client-side or via secure queries. For simplicity, allow list, but detail view is secured.
              
              // Only Admins can create, update, or delete resources.
              allow write: if request.auth != null && isAdmin(request.auth.uid);
            }

            // LABMEMBERSHIPS Collection
            match /labMemberships/{membershipId} {
              // Users can create their own 'pending_approval' requests.
              allow create: if request.auth != null && request.resource.data.userId == request.auth.uid
                              && request.resource.data.status == 'pending_approval'
                              && !("updatedAt" in request.resource.data) // Cannot set by client
                              && !("actingAdminId" in request.resource.data); // Cannot set by client
              
              // Users can read their own memberships. Admins can read any.
              allow read: if request.auth != null && (isOwner(request.resource.data.userId) || isAdmin(request.auth.uid));
              
              // Users can list their own memberships. Admins can list all for management.
              allow list: if request.auth != null; // Let client filter, or create specific rules for admin listing
              
              // Users can delete their own 'pending_approval' or 'rejected' or 'revoked' memberships (essentially cancelling/clearing).
              // Users can delete their own 'active' memberships (leaving a lab).
              // Admins can delete any membership (effectively revoking or cleaning up).
              allow delete: if request.auth != null && (
                              (isOwner(resource.data.userId) && (resource.data.status == 'pending_approval' || resource.data.status == 'rejected' || resource.data.status == 'revoked' || resource.data.status == 'active')) ||
                              isAdmin(request.auth.uid)
                            );
              
              // Updates (like status changes from pending to active/rejected) are handled by Admin SDK (server-side).
              allow update: if false; // No client-side updates allowed for now, only server-side.
            }

            // BOOKINGS Collection
            match /bookings/{bookingId} {
              // All authenticated users can list bookings (e.g., for conflict checking).
              allow list: if request.auth != null;

              // Users can read their own bookings. Admins and Technicians can read any booking.
              allow read: if request.auth != null &&
                            (resource.data.userId == request.auth.uid || // Owner
                             isAdmin(request.auth.uid) ||   // Admin
                             isTechnician(request.auth.uid)             // Technician can also read any booking
                            );

              // Authenticated users can create bookings for themselves, which start in 'Pending' or 'Waitlisted' status.
              // Client should not be able to set createdAt.
              // Users can only book resources in labs they are members of, or global resources.
              function canBookResource(resourceId) {
                let resourceData = get(/databases/$(database)/documents/resources/$(resourceId)).data;
                return resourceData.labId == null ||
                       exists(/databases/$(database)/documents/labMemberships/$(request.auth.uid + '_' + resourceData.labId)) &&
                       get(/databases/$(database)/documents/labMemberships/$(request.auth.uid + '_' + resourceData.labId)).data.status == 'active';
              }
              allow create: if request.auth != null && request.resource.data.userId == request.auth.uid
                              && (request.resource.data.status == 'Pending' || request.resource.data.status == 'Waitlisted')
                              && !("createdAt" in request.resource.data)
                              && canBookResource(request.resource.data.resourceId);


              // Users can cancel their own 'Pending', 'Waitlisted', or 'Confirmed' bookings.
              // Users can log usage ('usageDetails') for their own 'Confirmed' bookings if the booking is in the past.
              // Admins can perform other updates (e.g., change status).
              allow update: if request.auth != null && (
                              // User cancelling their own pending/waitlisted/confirmed booking
                              (resource.data.userId == request.auth.uid &&
                               (resource.data.status == 'Pending' || resource.data.status == 'Waitlisted' || resource.data.status == 'Confirmed') &&
                               request.resource.data.status == 'Cancelled' &&
                               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])) ||
                              // User logging usage details for their past confirmed booking
                              (resource.data.userId == request.auth.uid &&
                               resource.data.status == 'Confirmed' &&
                               resource.data.endTime < request.time && // Check if booking is past
                               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usageDetails'])) ||
                              // Admin can update (e.g., approve, reject, modify other details)
                              (isAdmin(request.auth.uid))
                            );

              // Users can delete their own 'Pending' or 'Waitlisted' bookings (if direct deletion is allowed instead of just 'Cancelled' status).
              // Admins can delete any booking.
              allow delete: if request.auth != null &&
                             ( (resource.data.userId == request.auth.uid &&
                                (resource.data.status == 'Pending' || resource.data.status == 'Waitlisted') ) ||
                               isAdmin(request.auth.uid) );
            }

            // MAINTENANCE REQUESTS Collection
            match /maintenanceRequests/{requestId} {
              // All authenticated users can read and list maintenance requests.
              allow read, list: if request.auth != null;

              // Authenticated users can create maintenance requests for a resource, which start in 'Open' status.
              // Users can only report issues for resources in labs they are members of, or global resources.
              allow create: if request.auth != null && request.resource.data.reportedByUserId == request.auth.uid
                              && request.resource.data.status == 'Open'
                              && !("dateReported" in request.resource.data)
                              && !("dateResolved" in request.resource.data)
                              && canBookResource(request.resource.data.resourceId); // Reusing canBookResource for simplicity, implies lab membership

              // Admins can perform broader updates.
              // Assigned Technicians can update status, resolution notes, and resolved date.
              // The user who reported the issue can update the description if the status is still 'Open'.
              allow update: if request.auth != null && (
                              (isAdmin(request.auth.uid)) ||
                              (resource.data.assignedTechnicianId != null && resource.data.assignedTechnicianId == request.auth.uid &&
                               request.resource.data.diff(resource.data).affectedKeys().hasAny(['status', 'resolutionNotes', 'dateResolved'])) ||
                              (resource.data.reportedByUserId == request.auth.uid && resource.data.status == 'Open' &&
                               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['issueDescription']))
                            );

              // Only Admins can delete maintenance requests.
              allow delete: if request.auth != null && isAdmin(request.auth.uid);
            }

            // BLACKOUT DATES (Specific) Collection
            match /blackoutDates/{blackoutId} {
              allow read, list: if request.auth != null;
              allow write: if request.auth != null && isAdmin(request.auth.uid);
            }

            // RECURRING BLACKOUT RULES Collection
            match /recurringBlackoutRules/{ruleId} {
              allow read, list: if request.auth != null;
              allow write: if request.auth != null && isAdmin(request.auth.uid);
            }

            // NOTIFICATIONS Collection - Creation handled by Admin SDK (server-side)
            match /notifications/{notificationId} {
              allow read: if request.auth != null && resource.data.userId == request.auth.uid;
              allow update: if request.auth != null && resource.data.userId == request.auth.uid &&
                               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRead']);
              allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
              allow create: if false; // Creation is server-side only via Admin SDK
            }

            // AUDIT LOGS Collection - Creation handled by Admin SDK (server-side)
            match /auditLogs/{logId} {
              allow read, list: if request.auth != null && isAdmin(request.auth.uid);
              allow create: if false; // Creation is server-side only via Admin SDK
              allow update, delete: if false;
            }
          }
        }
        ```

6.  **Firestore Indexes:**
    *   **Note on Automatic Single-Field Indexes:** Firestore automatically creates single-field indexes for every field (both ascending and descending). You do not need to manually create these.
    *   **Note on `__name__` in Indexes:** Firestore may automatically append `__name__ (asc)` or `__name__ (desc)` to composite index definitions for internal consistency and tie-breaking, especially when suggested via an error link in the console. This is normal, and you should typically accept it.
    *   **Proactively create these essential COMPOSITE indexes** in the Firebase console. Firestore might prompt for others if specific query patterns are not covered.

        *   **`users` collection:**
            *   `role (Ascending), name (Ascending)`
                *   *Purpose: For filtering users by role and sorting them by name (e.g., in admin user lists, technician dropdowns).*

        *   **`bookings` collection:**
            *   `userId (Ascending), startTime (Ascending)`
                *   *Purpose: For users to view their own bookings, sorted by start time (My Bookings page).*
            *   `userId (Ascending), endTime (Ascending), startTime (Ascending)`
                 *   *Purpose: Critical for dashboard query of user's upcoming bookings (`where('userId', '==', ...).where('endTime', '>=', ...).orderBy('startTime', 'asc')`).*
            *   `resourceId (Ascending), status (Ascending), startTime (Ascending)`
                *   *Purpose: For viewing bookings for a specific resource, filtered by status, and ordered by start time (e.g., on admin booking requests page if filtered by resource).*
            *   `resourceId (Ascending), status (Ascending), endTime (Ascending), startTime (Ascending)`
                *   *Purpose: Critical for booking conflict checks (`where('resourceId', ...).where('status', 'in', ...).where('startTime', '<', ...).where('endTime', '>', ...)`).*
            *   `status (Ascending), startTime (Ascending)`
                *   *Purpose: For admin views of booking requests, filtered by status and sorted by start time.*
            *   `resourceId (Ascending), status (Ascending), createdAt (Ascending)`
                *   *Purpose: For processing waitlists in FIFO order for a specific resource.*
            *   `resourceId (Ascending), userId (Ascending), startTime (Descending)`
                *   *Purpose: For `src/app/resources/[resourceId]/page.tsx` to fetch user's past bookings for a specific resource.*
            *   `userId (Ascending), endTime (Ascending)` (*Adjusted, startTime Desc might be better depending on final upcoming booking query*)
                *   *Purpose: For dashboard query of user's upcoming bookings (`where('userId', '==', ...).where('endTime', '>=', ...).orderBy('startTime', 'asc')`). Original was (`userId ASC, startTime ASC, endTime ASC`) but query is now on `endTime`.*

        *   **`maintenanceRequests` collection:**
            *   `resourceId (Ascending), dateReported (Descending)`
                *   *Purpose: For viewing maintenance requests associated with a specific resource, sorted by report date.*
            *   `status (Ascending), dateReported (Descending)`
                *   *Purpose: For filtering maintenance requests by status and sorting them by report date.*
            *   `assignedTechnicianId (Ascending), dateReported (Descending)`
                *   *Purpose: For viewing maintenance requests assigned to a specific technician, sorted by report date.*

        *   **`notifications` collection:**
            *   `userId (Ascending), createdAt (Descending)`
                *   *Purpose: For users to view their notifications, sorted by creation time.*
        
        *   **`labMemberships` collection (NEW):**
            *   `userId (Ascending), status (Ascending)`
                *   *Purpose: For users to see their active lab memberships and pending requests on their dashboard.*
            *   `labId (Ascending), status (Ascending)`
                *   *Purpose: For admins to list members or pending requests for a specific lab.*
            *   `status (Ascending), requestedAt (Ascending)`
                *   *Purpose: For admins to view a system-wide list of pending lab access requests, ordered by when they were requested.*
            *   `userId (Ascending), labId (Ascending)`
                *   *Purpose: To quickly check if a specific user has any type of membership (active, pending, etc.) for a specific lab.*

        *   **A Note on Index Creation Links:** If Firestore errors with "The query requires an index" and provides a link, **use that link**. It will pre-configure the index exactly as Firestore's query planner needs it.

7.  **Run the Development Server:**
    ```bash
    # Important: Restart your server after setting/changing environment variables!
    npm run dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:9002`.

## Deployment

This application is configured to be easily deployable on platforms like [Vercel](https://vercel.com/) (which is recommended for Next.js projects). Connect your Git repository (GitHub, GitLab, Bitbucket) to Vercel, and it will typically auto-detect the Next.js settings. Remember to configure your Firebase environment variables (from your `.env.local` file, including the Admin SDK credentials) in Vercel's project settings.


    
