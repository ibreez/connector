import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Target provisioned Firestore database ID
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth: Auth = getAuth(app);

/**
 * Ensure the local restaurant staff session is authenticated in Firebase Auth
 * to satisfy firestore.rules without storing or sending banking credentials.
 */
export async function ensureStaffAuthenticated(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn('Firebase anonymous sign-in warning:', err);
    return 'local_staff_session';
  }
}
