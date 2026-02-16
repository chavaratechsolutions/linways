import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard initialization for SSR/Prerendering
const isConfigValid = !!firebaseConfig.apiKey;

// Initialize Firebase (Only if config is valid)
let app;
if (getApps().length > 0) {
    app = getApp();
} else if (isConfigValid) {
    app = initializeApp(firebaseConfig);
}

// Initialize Secondary Instance for Admin Staff Registration
let secondaryApp;
if (getApps().length > 1) {
    secondaryApp = getApp("secondary");
} else if (isConfigValid) {
    secondaryApp = initializeApp(firebaseConfig, "secondary");
}

const auth = app ? getAuth(app) : (null as any);
const secondaryAuth = secondaryApp ? getAuth(secondaryApp) : (null as any);
const db = app ? getFirestore(app) : (null as any);

export { app, auth, db, secondaryAuth };
