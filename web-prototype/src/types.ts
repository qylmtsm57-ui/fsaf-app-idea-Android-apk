export interface ProductItem {
  id: number;
  barcode?: string;
  productName: string;
  category?: string; // القسم / التصنيف (ألبان، معلبات، مجمدات، أدوية...)
  quantity: number;
  unit: string;
  costPrice: number;
  sellPrice: number;
  productionDate?: string;
  expiryDate: string; // ISO date string YYYY-MM-DD
  batchNumber?: string;
  reminderDays?: number; // أيام التنبيه قبل الانتهاء (افتراضي 7 أو 15 أو 30)
  reminderNote?: string; // نص منبه الصلاحية المخصص (اختياري)
  createdAt?: number;
}

export interface ExpiryNotification {
  id: string;
  productId: number;
  productName: string;
  category?: string;
  daysRemaining: number;
  expiryDate: string;
  reminderNote?: string;
  timestamp: number;
  isRead: boolean;
  priority: 'urgent' | 'warning' | 'info' | 'high' | 'medium' | 'low';
  title?: string;
  message?: string;
  time?: string;
  isDailyReport?: boolean;
  itemsList?: string[];
}

export type ExpiryStatus = 'safe' | 'warning' | 'critical' | 'expired';

export interface ExpiryCalculation {
  daysRemaining: number;
  status: ExpiryStatus;
  statusText: string;
  colorHex: string;
  bgHex: string;
  textColor: string;
  percentRemaining: number;
}

export interface KotlinFile {
  id: string;
  fileName: string;
  filePath: string;
  category: 'Room Database' | 'Jetpack Compose UI' | 'CameraX & ML Kit' | 'WorkManager & Logic' | 'Gradle & Manifest' | 'Auth & Cloud Services';
  description: string;
  code: string;
}

export type AuthProviderType = 'password' | 'google' | 'facebook' | 'apple';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  provider: AuthProviderType;
  isEmailVerified: boolean;
  createdAt: number;
  lastSignInTime: number;
}

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CloudServiceConfig {
  id: 'google_drive' | 'google_calendar' | 'icloud_backup' | 'facebook_catalog';
  name: string;
  provider: 'Google' | 'Apple' | 'Meta / Facebook';
  description: string;
  icon: string;
  enabled: boolean;
  lastSync?: string;
  status: 'idle' | 'syncing' | 'synced' | 'error';
  itemCount?: number;
}

export interface AppSettings {
  // 1. Notifications & Alarms
  notificationTime: string; // e.g. "09:00"
  warningDaysEnabled: boolean; // Enable/disable pre-warning days (Optional warning days)
  warningDays: number; // e.g. 30 (Customizable or 0 if disabled)
  alarmSoundType: 'marimba' | 'urgent' | 'chime' | 'bell' | 'beep';
  soundEnabled: boolean;
  stickyNotification: boolean; // Sticky top status banner for critical items

  // 2. Currency & Units
  currencySymbol: string; // e.g. "ر.س" or "$"
  customUnits: string[]; // e.g. ['حبة', 'علبة', 'كرتون', 'كيس', 'كيلو', 'لتر', 'شريط', 'درزن', 'باكت', 'طرد']

  // 3. Quick Entry Defaults
  defaultUnit: string; // e.g. "حبة"
  autoTodayProductionDate: boolean;
  continuousBarcodeScan: boolean;

  // 4. Data & Backup
  googleDriveSync: boolean;
  lastBackupDate: string | null;

  // 5. Security & Privacy
  isAppLocked: boolean;
  useBiometrics: boolean; // Fingerprint / Biometric unlock support
  appPin: string;
  isReadOnlyMode: boolean;

  // 6. Appearance, Language & Support
  isDarkMode: boolean;
  language: 'ar' | 'en';
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  notificationTime: '09:00',
  warningDaysEnabled: true,
  warningDays: 30,
  alarmSoundType: 'marimba',
  soundEnabled: true,
  stickyNotification: true,
  currencySymbol: 'ر.س',
  customUnits: ['حبة', 'علبة', 'كرتون', 'كيس', 'كيلو', 'لتر', 'شريط', 'درزن', 'باكت', 'طرد', 'قطعة'],
  defaultUnit: 'حبة',
  autoTodayProductionDate: true,
  continuousBarcodeScan: false,
  googleDriveSync: false,
  lastBackupDate: null,
  isAppLocked: false,
  useBiometrics: true,
  appPin: '',
  isReadOnlyMode: false,
  isDarkMode: false,
  language: 'ar',
};
