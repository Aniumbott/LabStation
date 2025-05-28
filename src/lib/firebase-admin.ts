// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

/**
 * IMPORTANT SETUP FOR FIREBASE ADMIN SDK:
 *
 * 1. Service Account JSON:
 *    - Go to your Firebase project console: Project Settings > Service accounts.
 *    - Click "Generate new private key" and download the JSON file.
 *
 * 2. Environment Variable:
 *    - Option A (Recommended for local development & many hosting environments):
 *      Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the *absolute path*
 *      of the downloaded service account JSON file.
 *      Example for .env.local:
 *      GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
 *
 *    - Option B (For environments that support multi-line env vars or if you prefer storing JSON content directly):
 *      Copy the entire content of the downloaded JSON file.
 *      Set the `FIREBASE_SERVICE_ACCOUNT_KEY_JSON` environment variable to this JSON content.
 *      Example for .env.local (ensure your environment handles multi-line correctly or use a tool to format it):
 *      FIREBASE_SERVICE_ACCOUNT_KEY_JSON='{ "type": "service_account", "project_id": "...", ... }'
 *
 *    - Make sure NEXT_PUBLIC_FIREBASE_PROJECT_ID is also set in your .env.local for the databaseURL.
 *
 * If both GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_SERVICE_ACCOUNT_KEY_JSON are set,
 * FIREBASE_SERVICE_ACCOUNT_KEY_JSON will be preferred by this initialization logic.
 * If neither is set, an error will be thrown.
 */

let app: admin.app.App;

if (!admin.apps.length) {
  const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Firebase Admin SDK initialization failed: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
  }

  const databaseURL = `https://${projectId}.firebaseio.com`;

  let credential;

  if (serviceAccountKeyJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKeyJson);
      credential = admin.credential.cert(serviceAccount);
      console.log("Firebase Admin SDK: Using FIREBASE_SERVICE_ACCOUNT_KEY_JSON for credentials.");
    } catch (e) {
      console.error("Firebase Admin SDK: Error parsing FIREBASE_SERVICE_ACCOUNT_KEY_JSON:", e);
      throw new Error("Firebase Admin SDK initialization failed: Invalid service account JSON from FIREBASE_SERVICE_ACCOUNT_KEY_JSON.");
    }
  } else if (googleAppCreds) {
    // When GOOGLE_APPLICATION_CREDENTIALS is set, Firebase Admin SDK can often pick it up automatically
    // by calling admin.initializeApp() without arguments or with admin.credential.applicationDefault().
    // We'll use applicationDefault() for clarity if GOOGLE_APPLICATION_CREDENTIALS is the chosen method.
    try {
      credential = admin.credential.applicationDefault();
      console.log("Firebase Admin SDK: Using GOOGLE_APPLICATION_CREDENTIALS for credentials.");
    } catch(e) {
        console.error("Firebase Admin SDK: Error initializing with GOOGLE_APPLICATION_CREDENTIALS. Ensure the path is correct and the file is valid.", e);
        throw new Error("Firebase Admin SDK initialization failed: Could not use GOOGLE_APPLICATION_CREDENTIALS.");
    }
  } else {
    console.error(
      "Firebase Admin SDK: Not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS environment variable."
    );
    throw new Error("Firebase Admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  }

  app = admin.initializeApp({
    credential,
    databaseURL,
  });
  console.log(`Firebase Admin SDK initialized for project ${projectId}.`);

} else {
  app = admin.app();
  console.log("Firebase Admin SDK: Already initialized.");
}

const adminDb = admin.firestore(app);
const adminAuth = admin.auth(app);

export { adminDb, adminAuth, app as adminApp };
