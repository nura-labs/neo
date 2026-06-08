import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

export const adminAuth = getAuth(app);
