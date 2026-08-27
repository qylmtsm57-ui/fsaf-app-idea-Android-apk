import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  User as FirebaseUser 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AuthUser, AuthProviderType } from '../types';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events'
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 1. Google Auth Provider
const googleProvider = new GoogleAuthProvider();
SCOPES.forEach(scope => googleProvider.addScope(scope));
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// 2. Facebook Auth Provider
const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');
facebookProvider.setCustomParameters({
  display: 'popup'
});

// 3. Apple Auth Provider
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
appleProvider.setCustomParameters({
  locale: 'ar'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      let provider: AuthProviderType = 'google';
      const providerId = firebaseUser.providerData?.[0]?.providerId;
      if (providerId?.includes('facebook')) provider = 'facebook';
      else if (providerId?.includes('apple')) provider = 'apple';
      else if (providerId?.includes('password')) provider = 'password';

      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || `${provider.toUpperCase()} User`,
        photoUrl: firebaseUser.photoURL || undefined,
        provider: provider,
        isEmailVerified: firebaseUser.emailVerified,
        createdAt: Date.now(),
        lastSignInTime: Date.now()
      };
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(authUser, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(authUser, '');
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * 🌟 1. Sign In With Google Direct
 */
export const signInWithGoogleDirect = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    cachedAccessToken = accessToken;

    const firebaseUser = result.user;
    const user: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Google User',
      photoUrl: firebaseUser.photoURL || undefined,
      provider: 'google',
      isEmailVerified: firebaseUser.emailVerified,
      createdAt: Date.now(),
      lastSignInTime: Date.now()
    };

    return { user, accessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * 🌟 2. Sign In With Facebook Direct
 */
export const signInWithFacebookDirect = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, facebookProvider);
    const credential = FacebookAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    cachedAccessToken = accessToken;

    const firebaseUser = result.user;
    const user: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || `facebook_${firebaseUser.uid.slice(0, 8)}@facebook.com`,
      displayName: firebaseUser.displayName || 'Facebook User',
      photoUrl: firebaseUser.photoURL || undefined,
      provider: 'facebook',
      isEmailVerified: true,
      createdAt: Date.now(),
      lastSignInTime: Date.now()
    };

    return { user, accessToken };
  } catch (error: any) {
    console.warn('Facebook OAuth not enabled in Firebase console, falling back to manual sheet:', error?.code);
    return null;
  } finally {
    isSigningIn = false;
  }
};

/**
 * 🌟 3. Sign In With Apple Direct
 */
export const signInWithAppleDirect = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, appleProvider);
    const credential = OAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    cachedAccessToken = accessToken;

    const firebaseUser = result.user;
    const user: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || `apple_${firebaseUser.uid.slice(0, 8)}@icloud.com`,
      displayName: firebaseUser.displayName || 'Apple ID User',
      photoUrl: firebaseUser.photoURL || undefined,
      provider: 'apple',
      isEmailVerified: true,
      createdAt: Date.now(),
      lastSignInTime: Date.now()
    };

    return { user, accessToken };
  } catch (error: any) {
    console.warn('Apple OAuth not enabled in Firebase console, falling back to manual sheet:', error?.code);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogle = async (): Promise<void> => {
  await firebaseSignOut(auth);
  cachedAccessToken = null;
};

/**
 * Backup inventory database to Google Drive as a JSON file
 */
export const backupToGoogleDrive = async (products: any[]): Promise<{ fileId: string; name: string }> => {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('OAuth token not found. Please sign in with Google.');
  }

  const fileName = `FreshStock_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  const fileContent = JSON.stringify({
    appName: 'FreshStock Expiry Manager',
    exportedAt: new Date().toISOString(),
    itemCount: products.length,
    products: products
  }, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'FreshStock goods expiry management database backup'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload backup to Google Drive');
  }

  const data = await res.json();
  return { fileId: data.id, name: fileName };
};

/**
 * Create Google Calendar Expiry Alert Events
 */
export const syncExpiryEventsToGoogleCalendar = async (
  products: { productName: string; expiryDate: string; quantity: number; unit?: string }[]
): Promise<number> => {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('OAuth token not found. Please sign in with Google.');
  }

  let createdCount = 0;
  for (const item of products.slice(0, 10)) {
    const expiryDateStr = item.expiryDate;
    const eventBody = {
      summary: `🚨 انتهاء صلاحية: ${item.productName} (${item.quantity} ${item.unit || 'حبة'})`,
      description: `تنبيه من تطبيق FreshStock: ينتهي تاريخ صلاحية المنتج ${item.productName} في هذا اليوم.`,
      start: {
        date: expiryDateStr
      },
      end: {
        date: expiryDateStr
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 * 9 }
        ]
      }
    };

    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      });
      if (res.ok) {
        createdCount++;
      }
    } catch (e) {
      console.warn('Failed to add calendar event for:', item.productName, e);
    }
  }

  return createdCount;
};
