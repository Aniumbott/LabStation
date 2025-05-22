
# LabStation - Advanced Lab Resource Management

LabStation is a comprehensive web application designed to streamline the management and booking of laboratory resources. It provides a user-friendly interface for researchers, technicians, and lab managers to efficiently discover, reserve, and track the usage of lab equipment and facilities. The system incorporates role-based access control, detailed resource cataloging, an intelligent booking engine, and administrative tools for robust lab operations.

## Core Features

*   **Resource Catalog & Management:**
    *   Add, edit, and view detailed information for lab resources (e.g., oscilloscopes, power supplies, soldering stations).
    *   Categorize resources using customizable **Resource Types**.
    *   Store manufacturer, model, serial number, purchase date, and general notes.
    *   Manage **Remote Host Integration** details (IP/DNS, protocol, credentials) for remotely accessible equipment.
*   **Advanced Booking Engine:**
    *   Users can create, view, modify, and cancel bookings for available resources.
    *   **Conflict Detection:** Prevents double-bookings by checking against:
        *   Other existing bookings.
        *   Resource-specific daily availability slots.
        *   Resource-specific one-off unavailability periods.
        *   Lab-wide specific blackout dates.
        *   Lab-wide weekly recurring unavailability rules.
    *   **Availability Scheduling:**
        *   Admins can define resource-specific daily availability slots.
        *   Set up resource-specific unavailability periods (e.g., for maintenance).
        *   Manage lab-wide **Blackout Dates** (specific holidays or closure days).
        *   Define lab-wide **Recurring Unavailability Rules** (e.g., lab closed on weekends).
    *   **Queue Management:**
        *   Resources can be configured to allow waitlisting.
        *   If a slot is full, users can join a waitlist.
        *   Bookings are automatically promoted from the waitlist (to 'Pending' status) when a conflicting confirmed booking is cancelled or rejected.
        *   Users can see their position in the waitlist.
    *   **Booking Approval Workflow:** New booking requests enter a 'Pending' state and require approval from an Admin or Lab Manager before being confirmed.
*   **User Management & Authentication:**
    *   Secure **Email/Password Authentication** powered by Firebase.
    *   User **Signup** with an admin approval workflow.
    *   User **Login** and persistent sessions using Firebase Auth state persistence.
    *   **User Profiles:** Users can view and manage their basic profile information (e.g., update name) and a mock password change UI.
    *   **Role-Based Access Control (RBAC):** Predefined roles (Admin, Lab Manager, Technician, Researcher) with UI elements and actions conditionally rendered based on user role.
*   **Maintenance Requests:**
    *   Log service issues for specific resources.
    *   Admins/Technicians can assign requests, update status (Open, In Progress, Resolved, Closed), and add resolution notes.
*   **Notifications:**
    *   In-app **Notification Center** to alert users about:
        *   Booking confirmations, rejections, and pending approvals.
        *   Promotion from a waitlist.
        *   New maintenance requests or status updates.
        *   Signup approvals.
*   **Usage Logging:**
    *   After a booking is completed, users can log usage details: actual start/end times, outcome (Success, Failure, Interrupted), data storage location, and comments.
*   **Reporting & Analytics (Admin):**
    *   Visual dashboard with charts for:
        *   Bookings per resource.
        *   Maintenance request status distribution.
        *   Resource utilization (conceptual, based on booked days).
        *   Peak booking hours.
        *   Current waitlist sizes.
*   **Audit Logging (Admin):**
    *   Tracks key system events and actions (e.g., user creation/updates, booking approvals, resource updates, maintenance request changes, blackout date management) for administrative review.
*   **Admin Panel:**
    *   Centralized sections for managing Users (including signup requests), Resources, Resource Types, Booking Requests, Lab Blackout Dates & Recurring Rules, Maintenance Requests, Reports, and Audit Logs.

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
*   **Database:** Firebase Firestore (for user profiles and data persistence)

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
    npm install
    # or
    yarn install
    ```

3.  **Set up Firebase:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
    *   **Enable Authentication:** In your Firebase project, go to "Authentication" -> "Sign-in method" and enable the "Email/Password" provider.
    *   **Enable Firestore:** In your Firebase project, go to "Firestore Database" -> "Create database". Start in **Test Mode** for development (remember to secure rules for production). Choose a location.
    *   **Register your Web App:** In Project Overview, click the Web icon (`</>`) to add your app. Get the `firebaseConfig` object.

4.  **Configure Environment Variables:**
    *   Create a `.env.local` file in the root of your project by copying `.env.local.example`.
    *   Fill in your Firebase project's configuration values from the `firebaseConfig` object you obtained in the previous step.
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id # Optional
    ```

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
    *   **Security Rules:** Update your Firestore security rules for basic access during development. Sample rules are provided in the project's setup documentation (you might need to adjust based on your specific collections and access patterns). **Remember to secure these properly before production.**
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{userId} {
              allow read: if request.auth != null && request.auth.uid == userId;
              allow create: if request.auth != null && request.auth.uid == userId;
              allow update: if request.auth != null && request.auth.uid == userId && 
                              request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'avatarUrl']);
              // Admins can manage any user document
              allow list, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
            }
            // Add rules for other collections (bookings, resources, etc.)
            // Example: Allow authenticated users to read resources
            match /resources/{docId} {
              allow read: if request.auth != null;
              // Allow Admins/Lab Managers to write resources
              allow write: if request.auth != null && 
                             (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin' ||
                              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Lab Manager');
            }
            // Be sure to add rules for all your collections
          }
        }
        ```

6.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:9002`.

## Deployment

This application is configured to be easily deployable on platforms like [Vercel](https://vercel.com/) (which is recommended for Next.js projects). Connect your Git repository (GitHub, GitLab, Bitbucket) to Vercel, and it will typically auto-detect the Next.js settings. Remember to configure your Firebase environment variables in Vercel's project settings.
