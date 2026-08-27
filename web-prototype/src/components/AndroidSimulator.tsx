import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Calendar, 
  Clock, 
  Bell, 
  X, 
  Package, 
  Send, 
  BellRing, 
  Layers, 
  Volume2, 
  VolumeX, 
  Music, 
  Settings, 
  ShieldAlert, 
  Lock, 
  Fingerprint,
  Eye,
  Check,
  User,
  LogOut,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { ProductItem, ExpiryNotification, AppSettings, DEFAULT_APP_SETTINGS, AuthUser } from '../types';
import { INITIAL_SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { calculateExpiry, addDays, formatDuration } from '../utils/expiryLogic';
import { soundService } from '../utils/soundService';
import { getTranslation } from '../utils/translations';
import { SettingsTab } from './SettingsTab';
import { AndroidLoginScreen } from './AndroidLoginScreen';
import { 
  signOutGoogle, 
  initGoogleAuth 
} from '../utils/googleAuthService';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'offline_goods_expiry_products_db';
const NOTIFS_STORAGE_KEY = 'offline_goods_expiry_notifications_db';
const SETTINGS_STORAGE_KEY = 'freshstock_app_settings_db';

export const AndroidSimulator: React.FC = () => {
  // App Settings State (Central Source of Truth)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_APP_SETTINGS;
      }
    }
    return DEFAULT_APP_SETTINGS;
  });

  // Dynamic Translation helper
  const t = getTranslation(settings.language);

  // App Lock Pin State
  const [isDeviceLocked, setIsDeviceLocked] = useState<boolean>(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.isAppLocked && Boolean(parsed.appPin);
      } catch (e) {}
    }
    return false;
  });
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Database state
  const [products, setProducts] = useState<ProductItem[]>(() => {
    const isCleared = localStorage.getItem('freshstock_empty_init_v3');
    if (!isCleared) {
      localStorage.setItem('freshstock_empty_init_v3', 'true');
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Expiry Notifications state
  const [notifications, setNotifications] = useState<ExpiryNotification[]>(() => {
    const saved = localStorage.getItem(NOTIFS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // Android Navigation (Tabs: 'home' | 'inventory' | 'add' | 'alarm' | 'settings')
  const [activeTab, setActiveTab] = useState<'home' | 'inventory' | 'add' | 'alarm' | 'settings'>('home');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<ProductItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // User Authentication State (Android Login Screen Gate)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('freshstock_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [showAccountSheet, setShowAccountSheet] = useState<boolean>(false);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('freshstock_auth_user', JSON.stringify(user));
    setIsGuestMode(false);
    showToast(settings.language === 'en' ? `🎉 Welcome, ${user.displayName}!` : `🎉 مرحباً بك، ${user.displayName}!`);
  };

  const handleSignOut = async () => {
    soundService.playRingtone('chime');
    try {
      await signOutGoogle();
    } catch (e) {}
    setCurrentUser(null);
    localStorage.removeItem('freshstock_auth_user');
    setIsGuestMode(false);
    setShowAccountSheet(false);
    showToast(settings.language === 'en' ? '👋 Signed out successfully' : '👋 تم تسجيل الخروج بنجاح');
  };

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'expired' | 'safe'>('all');
  const [inventorySort, setInventorySort] = useState<'fefo' | 'qty' | 'name'>('fefo');

  // Daily Alarm Automation States
  const [dailyAlarmEnabled, setDailyAlarmEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('freshstock_daily_alarm_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Notification simulation banner
  const [simulatedNotification, setSimulatedNotification] = useState<{
    title: string;
    body: string;
    time: string;
    criticalList: string[];
  } | null>(null);

  // Form states for Add / Edit (6 Core Fields)
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState(settings.defaultUnit || (settings.language === 'en' ? 'Piece' : 'حبة'));
  const [formSellPrice, setFormSellPrice] = useState('0.00');
  const [formReminderDays, setFormReminderDays] = useState(String(settings.warningDaysEnabled ? settings.warningDays : 7));
  const [formReminderNote, setFormReminderNote] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState(addDays(new Date(), 14));

  // Dialog States
  const [productToDelete, setProductToDelete] = useState<{ id: number; productName: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync settings sound with soundService
  useEffect(() => {
    soundService.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormQuantity('1');
    setFormUnit(settings.defaultUnit || (settings.language === 'en' ? 'Piece' : 'حبة'));
    setFormSellPrice('0.00');
    setFormReminderDays(String(settings.warningDaysEnabled ? settings.warningDays : 7));
    setFormReminderNote('');
    setFormExpiryDate(addDays(new Date(), 14));
    setEditingProduct(null);
  };

  const handleOpenAdd = () => {
    if (settings.isReadOnlyMode) {
      showToast(settings.language === 'en' ? '🔒 Read-Only Mode is active' : '🔒 وضع القراءة فقط مفعّل - الإضافة معطلة');
      return;
    }
    resetForm();
    setEditingProduct(null);
    setActiveTab('add');
  };

  const handleOpenEdit = (product: ProductItem) => {
    if (settings.isReadOnlyMode) {
      showToast(settings.language === 'en' ? '🔒 Read-Only Mode is active' : '🔒 وضع القراءة فقط مفعّل - التعديل معطل');
      return;
    }
    setEditingProduct(product);
    setFormName(product.productName);
    setFormQuantity(product.quantity.toString());
    setFormUnit(product.unit || settings.defaultUnit || (settings.language === 'en' ? 'Piece' : 'حبة'));
    setFormSellPrice(product.sellPrice?.toString() || '0.00');
    setFormReminderDays(product.reminderDays?.toString() || String(settings.warningDaysEnabled ? settings.warningDays : 7));
    setFormReminderNote(product.reminderNote || '');
    setFormExpiryDate(product.expiryDate);
    setSelectedDetailProduct(null);
    setActiveTab('add');
    showToast(settings.language === 'en' ? `📝 Edit: ${product.productName}` : `📝 تعديل: ${product.productName}`);
  };

  const handleOpenDetail = (product: ProductItem) => {
    setSelectedDetailProduct(product);
  };

  // Central Settings Handler
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    if (newSettings.soundEnabled !== undefined) {
      soundService.setEnabled(newSettings.soundEnabled);
    }
    if (newSettings.isAppLocked !== undefined) {
      setIsDeviceLocked(Boolean(newSettings.isAppLocked && (newSettings.appPin || settings.appPin)));
    }
  };

  const handleClearExpiredProducts = () => {
    if (settings.isReadOnlyMode) {
      showToast(settings.language === 'en' ? '🔒 Read-Only Mode active' : '🔒 وضع القراءة فقط مفعّل');
      return;
    }
    const warningThreshold = settings.warningDaysEnabled ? settings.warningDays : 30;
    const activeOnly = products.filter(p => calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold).daysRemaining >= 0);
    const count = products.length - activeOnly.length;
    setProducts(activeOnly);
    showToast(settings.language === 'en' ? `🗑️ Discarded & deleted ${count} expired items` : `🗑️ تم إتلاف وحذف ${count} منتجات منتهية الصلاحية`);
  };

  const handleImportProducts = (imported: ProductItem[]) => {
    setProducts(imported);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
    showToast(settings.language === 'en' ? `📥 Restored & imported ${imported.length} products successfully` : `📥 تم استرجاع واستيراد ${imported.length} منتج بنجاح`);
  };

  const handleResetFactoryData = () => {
    setProducts(INITIAL_SAMPLE_PRODUCTS);
    setSettings(DEFAULT_APP_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_PRODUCTS));
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
    setIsDeviceLocked(false);
    showToast(settings.language === 'en' ? '🔄 Factory reset complete, default settings restored' : '🔄 تم ضبط المصنع واستعادة كافة البيانات الافتراضية');
  };

  // Save product (Add or Edit)
  const handleSave = () => {
    if (settings.isReadOnlyMode) {
      showToast(settings.language === 'en' ? '🔒 Read-Only Mode active' : '🔒 وضع القراءة فقط مفعّل');
      return;
    }
    if (!formName.trim()) {
      showToast(settings.language === 'en' ? '⚠️ Please enter product name' : '⚠️ يرجى إدخال اسم المنتج');
      return;
    }
    if (!formExpiryDate.trim()) {
      showToast(settings.language === 'en' ? '⚠️ Please specify expiry date' : '⚠️ يرجى تحديد تاريخ الانتهاء');
      return;
    }

    const qty = parseFloat(formQuantity) || 1;
    const price = parseFloat(formSellPrice) || 0;
    const unit = formUnit.trim() || settings.defaultUnit || (settings.language === 'en' ? 'Piece' : 'حبة');
    const remDays = parseInt(formReminderDays) || (settings.warningDaysEnabled ? settings.warningDays : 7);

    if (editingProduct) {
      const updated: ProductItem = {
        ...editingProduct,
        productName: formName.trim(),
        quantity: qty,
        unit: unit,
        sellPrice: price,
        costPrice: price,
        expiryDate: formExpiryDate.trim(),
        reminderDays: remDays,
        reminderNote: formReminderNote.trim() || undefined,
      };

      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      soundService.playSuccessTone();
      showToast(t.toastProductUpdated);
      setEditingProduct(null);
      setActiveTab('home');
    } else {
      const newProduct: ProductItem = {
        id: Date.now(),
        productName: formName.trim(),
        category: 'General',
        quantity: qty,
        unit: unit,
        sellPrice: price,
        costPrice: price,
        expiryDate: formExpiryDate.trim(),
        reminderDays: remDays,
        reminderNote: formReminderNote.trim() || undefined,
        createdAt: Date.now()
      };

      setProducts(prev => [newProduct, ...prev]);
      soundService.playSuccessTone();
      showToast(t.toastProductAdded);
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } catch (e) {}
      resetForm();
      setActiveTab('home');
    }
  };

  // Test notification for a product
  const handleSendTestNotification = (prodName: string, remDays?: number, note?: string) => {
    const days = remDays || (settings.warningDaysEnabled ? settings.warningDays : 7);
    const durationFormatted = formatDuration(days, settings.language);
    const nowTime = new Date().toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'ar-SA', { hour: '2-digit', minute: '2-digit' });
    
    // Play the user-chosen ringtone from settings
    soundService.playRingtone(settings.alarmSoundType || 'chime');

    const notifTitle = settings.language === 'en' ? `🔔 Expiry Alarm: ${prodName}` : `🔔 منبه الصلاحية: ${prodName}`;
    const notifBody = settings.language === 'en' 
      ? `Pre-warning alert ${durationFormatted} before expiry. ${note ? `Note: "${note}"` : ''}`
      : `تنبيه مسبق قبل ${durationFormatted} من تاريخ الانتهاء. ${note ? `الملاحظة: "${note}"` : ''}`;

    setSimulatedNotification({
      title: notifTitle,
      body: notifBody,
      time: nowTime,
      criticalList: [settings.language === 'en' ? `Item: ${prodName} | Pre-warning: ${durationFormatted} before` : `الصنف: ${prodName} | تنبيه مسبق قبل ${durationFormatted}`]
    });

    const testNotif: ExpiryNotification = {
      id: `test-notif-${Date.now()}`,
      productId: Date.now(),
      productName: prodName,
      daysRemaining: days,
      expiryDate: formExpiryDate || addDays(new Date(), days),
      reminderNote: note || (settings.language === 'en' ? 'Test reminder' : 'تنبيه تجريبي'),
      timestamp: Date.now(),
      isRead: false,
      priority: 'warning',
      title: notifTitle,
      message: notifBody,
      time: settings.language === 'en' ? 'Now' : 'الآن'
    };

    setNotifications(prev => [testNotif, ...prev]);
    showToast(settings.language === 'en' ? `🔔 Alarm sounded (${settings.alarmSoundType}) for "${prodName}"` : `🔔 تم تشغيل رنين (${settings.alarmSoundType}) لـ "${prodName}"`);
  };

  // Trigger morning scan
  const triggerDailyMorningScan = () => {
    const expiredItems: ProductItem[] = [];
    const criticalItems: ProductItem[] = [];
    const warningThreshold = settings.warningDaysEnabled ? settings.warningDays : 30;

    products.forEach(p => {
      const calc = calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold);
      const threshold = p.reminderDays || (settings.warningDaysEnabled ? settings.warningDays : 7);
      if (calc.daysRemaining < 0) {
        expiredItems.push(p);
      } else if (calc.daysRemaining <= threshold) {
        criticalItems.push(p);
      }
    });

    const totalUrgent = expiredItems.length + criticalItems.length;
    const nowTime = new Date().toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'ar-SA', { hour: '2-digit', minute: '2-digit' });

    if (totalUrgent > 0) {
      soundService.playRingtone(settings.alarmSoundType || 'urgent');

      const list = [
        ...expiredItems.map(i => {
          const calc = calculateExpiry(i.expiryDate, undefined, settings.language, warningThreshold);
          return `🔴 ${i.productName} (${calc.statusText})`;
        }),
        ...criticalItems.map(i => {
          const calc = calculateExpiry(i.expiryDate, undefined, settings.language, warningThreshold);
          return `🟠 ${i.productName} (${formatDuration(calc.daysRemaining, settings.language)} left)`;
        })
      ];

      const title = settings.language === 'en'
        ? (expiredItems.length > 0 ? `🚨 Expiry Alarm: ${expiredItems.length} Expired Goods!` : `⏰ Expiry Alarm: ${criticalItems.length} Critical Items`)
        : (expiredItems.length > 0 ? `🚨 منبه الصلاحيات: ${expiredItems.length} بضائع منتهية!` : `⏰ منبه الصلاحيات: ${criticalItems.length} بضائع حرجة`);
      
      const body = settings.language === 'en'
        ? `Daily morning scan (${settings.notificationTime}): Found ${totalUrgent} items requiring attention.`
        : `فحص الصباح اليومي (${settings.notificationTime}): تم رصد ${totalUrgent} أصناف تتطلب اتخاذ إجراء.`;

      setSimulatedNotification({
        title,
        body,
        time: nowTime,
        criticalList: list.slice(0, 4)
      });

      const reportNotif: ExpiryNotification = {
        id: `daily-${Date.now()}`,
        productId: 0,
        productName: settings.language === 'en' ? 'Morning Expiry Check Report' : 'تقرير فحص الصباح اليومي',
        daysRemaining: expiredItems.length > 0 ? -1 : 3,
        expiryDate: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        isRead: false,
        priority: 'urgent',
        title,
        message: body,
        time: settings.language === 'en' ? 'Now' : 'الآن',
        itemsList: list
      };

      setNotifications(prev => [reportNotif, ...prev]);
      showToast(`⚠️ ${totalUrgent} ` + (settings.language === 'en' ? 'urgent goods detected' : 'بضائع حرجة أو منتهية'));
    } else {
      soundService.playSuccessTone();
      showToast(settings.language === 'en' ? '✅ All items are fresh and safe!' : '✅ جميع البضائع في المخزون سليمة');
    }
  };

  const handleConfirmDelete = () => {
    if (settings.isReadOnlyMode) {
      showToast(settings.language === 'en' ? '🔒 Read-Only Mode active' : '🔒 وضع القراءة فقط مفعّل');
      setProductToDelete(null);
      return;
    }
    if (productToDelete) {
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      showToast(t.toastProductDeleted);
      setProductToDelete(null);
    }
  };

  const warningThreshold = settings.warningDaysEnabled ? settings.warningDays : 30;

  // Filter & Sort Products (Strict FEFO Default)
  const filteredProducts = products.filter(p => {
    const calc = calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold);
    const matchesSearch = 
      p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'critical') return calc.daysRemaining >= 0 && calc.daysRemaining <= (p.reminderDays || 7);
    if (statusFilter === 'expired') return calc.daysRemaining < 0;
    if (statusFilter === 'safe') return calc.daysRemaining > warningThreshold;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (inventorySort === 'fefo') {
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    }
    if (inventorySort === 'qty') {
      return b.quantity - a.quantity;
    }
    if (inventorySort === 'name') {
      return a.productName.localeCompare(b.productName);
    }
    return 0;
  });

  // Calculate summary counts using settings warning thresholds
  const totalCount = products.length;
  const expiredCount = products.filter(p => calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold).daysRemaining < 0).length;
  const criticalCount = products.filter(p => {
    const s = calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold);
    return s.daysRemaining >= 0 && s.daysRemaining <= (p.reminderDays || (settings.warningDaysEnabled ? settings.warningDays : 7));
  }).length;
  const safeCount = products.filter(p => calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold).daysRemaining > warningThreshold).length;

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  // Biometric Unlock simulation
  const handleBiometricUnlock = () => {
    soundService.playRingtone('beep');
    setTimeout(() => {
      soundService.playSuccessTone();
      setIsDeviceLocked(false);
      setEnteredPin('');
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
      showToast(t.biometricSuccess);
    }, 400);
  };

  const isDark = settings.isDarkMode;

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[100dvh] sm:min-h-[92vh] py-0 sm:py-4 md:py-6" dir={settings.language === 'en' ? 'ltr' : 'rtl'}>
      
      {/* 📱 PURE ANDROID SMARTPHONE CHASSIS */}
      <div className={`w-full max-w-full sm:max-w-[430px] h-[100dvh] sm:h-[860px] sm:max-h-[96vh] rounded-none sm:rounded-[44px] p-0 sm:p-3 shadow-2xl border-0 sm:border-8 flex flex-col relative overflow-hidden ring-0 sm:ring-1 ${
        isDark ? 'bg-slate-950 sm:border-slate-900 ring-slate-800' : 'bg-slate-900 sm:border-slate-800 ring-slate-700/40'
      }`}>
        
        {/* Android Display Screen */}
        <div className={`flex-1 rounded-none sm:rounded-[34px] overflow-hidden flex flex-col relative shadow-inner ${
          isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}>

          {/* 🚪 1. FULL ANDROID LOGIN SCREEN (GATEWAY WHEN LOGGED OUT) */}
          {!currentUser && !isGuestMode ? (
            <AndroidLoginScreen
              language={settings.language}
              isDark={isDark}
              onLoginSuccess={handleLoginSuccess}
              onContinueAsGuest={() => {
                soundService.playRingtone('beep');
                setIsGuestMode(true);
                showToast(settings.language === 'en' ? '🛡️ Continuing in Offline Mode' : '🛡️ المتابعة في وضع عدم الاتصال');
              }}
            />
          ) : (
            /* 📱 2. MAIN ANDROID APPLICATION (WHEN AUTHENTICATED OR GUEST) */
            <>
          {/* Top App Bar */}
          <div className={`px-4 py-3 flex items-center justify-between shadow-xs z-20 border-b ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
                <Package size={17} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-sm leading-tight">{t.appName}</h1>
                  <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">Android FEFO</span>
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  <Clock size={10} />
                  <span>{settings.language === 'en' ? 'Alarm: ' : 'منبه الصباح: '}<strong>{settings.notificationTime}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions in Top Bar */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const next = !settings.soundEnabled;
                  handleUpdateSettings({ soundEnabled: next });
                  if (next) {
                    soundService.playNotificationChime();
                  }
                  showToast(next ? t.toastSoundOn : t.toastSoundOff);
                }}
                className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 ${
                  settings.soundEnabled 
                    ? (isDark ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200')
                    : (isDark ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-100 text-slate-400 border-slate-200')
                }`}
                title={settings.soundEnabled ? t.soundActive : t.soundMuted}
              >
                {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* User Account Profile Button */}
              <button
                onClick={() => setShowAccountSheet(true)}
                className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                }`}
                title={settings.language === 'en' ? 'User Profile' : 'حساب المستخدم'}
              >
                {currentUser ? (
                  <div className="flex items-center gap-1">
                    <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-[9px] font-bold flex items-center justify-center relative">
                      {currentUser.displayName.charAt(0).toUpperCase()}
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                    </div>
                    <span className="text-[10px] font-bold hidden xs:inline text-blue-600 dark:text-blue-400 truncate max-w-[55px]">
                      {currentUser.displayName.split(' ')[0]}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-500">
                    <User size={14} />
                    <span className="text-[10px] font-bold">{settings.language === 'en' ? 'Guest' : 'دخول'}</span>
                  </div>
                )}
              </button>

              <button
                onClick={triggerDailyMorningScan}
                className={`p-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition active:scale-95 ${
                  isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800 hover:bg-amber-900/50' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                }`}
                title={t.instantCheck}
              >
                <Clock size={12} />
                <span className="hidden xs:inline text-[10px]">{t.instantCheckToday}</span>
              </button>

              <button
                onClick={() => setActiveTab('alarm')}
                className={`p-2 rounded-xl relative cursor-pointer transition ${
                  isDark ? 'text-slate-300 hover:text-blue-400 hover:bg-slate-700' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
                }`}
                title={t.notificationsTitle}
              >
                <Bell size={18} />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 ${
                  activeTab === 'settings' 
                    ? (isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200')
                    : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200')
                }`}
                title={t.appSettingsTitle}
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* Read-Only Mode Global Indicator (from Settings) */}
          {settings.isReadOnlyMode && (
            <div className="bg-rose-900 text-rose-100 px-3 py-1 text-[10px] font-bold flex items-center justify-between border-b border-rose-800 z-30">
              <div className="flex items-center gap-1.5">
                <Eye size={12} className="text-rose-300 animate-pulse" />
                <span>{settings.language === 'en' ? '🔒 Read-Only Mode Active (Protection ON)' : '🔒 وضع القراءة فقط مفعّل (الحماية نشطة)'}</span>
              </div>
              <button onClick={() => setActiveTab('settings')} className="underline text-[9px] cursor-pointer">
                {settings.language === 'en' ? 'Settings' : 'الإعدادات'}
              </button>
            </div>
          )}

          {/* Sticky Notification Banner (Controlled by Settings & Expiry state) */}
          {settings.stickyNotification && (expiredCount > 0 || criticalCount > 0) && (
            <div 
              onClick={() => setActiveTab('alarm')}
              className="bg-amber-600 text-white px-3 py-1.5 flex items-center justify-between text-[11px] font-bold cursor-pointer hover:bg-amber-700 transition shadow-xs z-30 select-none"
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-amber-200 shrink-0 animate-pulse" />
                <span className="truncate">
                  {expiredCount > 0 
                    ? t.stickyBannerExpired.replace('{count}', String(expiredCount))
                    : t.stickyBannerCritical.replace('{count}', String(criticalCount))}
                </span>
              </div>
              <span className="text-[9px] bg-amber-800/80 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                {t.view}
              </span>
            </div>
          )}

          {/* Simulated Android Heads-Up Notification Banner */}
          {simulatedNotification && (
            <div className="absolute top-12 left-2 right-2 z-40 bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl border border-slate-700 backdrop-blur-md animate-in slide-in-from-top duration-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center mt-0.5 shrink-0">
                    <BellRing size={15} />
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold">
                      <span>{t.androidNotificationHeader}</span>
                      <span className="text-slate-400 font-normal">{simulatedNotification.time}</span>
                    </div>
                    <h4 className="font-bold text-xs text-white leading-tight">{simulatedNotification.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-snug">{simulatedNotification.body}</p>
                    
                    {simulatedNotification.criticalList.length > 0 && (
                      <div className="mt-1.5 bg-slate-800/80 p-2 rounded-lg text-[10px] space-y-1 text-slate-200">
                        {simulatedNotification.criticalList.map((item, i) => (
                          <div key={i} className="truncate">{item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSimulatedNotification(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Screen Content Area */}
          <div className={`flex-1 overflow-y-auto relative ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            
            {/* ----------------- TAB 1: HOME SCREEN ----------------- */}
            {activeTab === 'home' && (
              <div className="p-3.5 space-y-3 pb-20">
                
                {/* Daily Alarm Summary Banner */}
                <div className={`border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs ${
                  isDark 
                    ? 'bg-amber-950/20 border-amber-800/60 text-amber-100' 
                    : 'bg-gradient-to-r from-amber-500/15 via-amber-50 to-orange-500/10 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">{t.dailyAlarmBannerTitle}</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                          {dailyAlarmEnabled ? t.statusActive : t.statusDisabled}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                        {t.dailyAlarmBannerDesc.replace('{time}', settings.notificationTime)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={triggerDailyMorningScan}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shrink-0 cursor-pointer shadow-xs active:scale-95 transition"
                  >
                    {t.checkNow}
                  </button>
                </div>

                {/* Quick Expiry Filter Stats */}
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center ${
                      statusFilter === 'all' 
                        ? (isDark ? 'bg-slate-800 border-blue-500 shadow-xs ring-2 ring-blue-900' : 'bg-white border-blue-500 shadow-xs ring-2 ring-blue-100')
                        : (isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200')
                    }`}
                  >
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.filterAll}</span>
                    <span className="text-base font-bold">{totalCount}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
                    className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center ${
                      statusFilter === 'critical' 
                        ? (isDark ? 'bg-red-950/40 border-red-500 shadow-xs ring-2 ring-red-900' : 'bg-red-50 border-red-500 shadow-xs ring-2 ring-red-100')
                        : (isDark ? 'bg-slate-800/80 border-red-900/60' : 'bg-white border-red-200')
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-red-500">{t.filterCritical}</span>
                    <span className="text-base font-bold text-red-500">{criticalCount}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
                    className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center ${
                      statusFilter === 'expired' 
                        ? (isDark ? 'bg-orange-950/40 border-orange-500 shadow-xs ring-2 ring-orange-900' : 'bg-orange-50 border-orange-500 shadow-xs ring-2 ring-orange-100')
                        : (isDark ? 'bg-slate-800/80 border-orange-900/60' : 'bg-white border-orange-200')
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-orange-500">{t.filterExpired}</span>
                    <span className="text-base font-bold text-orange-500">{expiredCount}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'safe' ? 'all' : 'safe')}
                    className={`p-2 rounded-xl border transition cursor-pointer flex flex-col items-center ${
                      statusFilter === 'safe' 
                        ? (isDark ? 'bg-emerald-950/40 border-emerald-500 shadow-xs ring-2 ring-emerald-900' : 'bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-100')
                        : (isDark ? 'bg-slate-800/80 border-emerald-900/60' : 'bg-white border-emerald-200')
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-emerald-500">{t.filterSafe}</span>
                    <span className="text-base font-bold text-emerald-500">{safeCount}</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className={`w-full pl-8 pr-8 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                  <Search size={14} className={`absolute ${settings.language === 'en' ? 'right-2.5' : 'right-2.5'} top-2.5 text-slate-400`} />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute ${settings.language === 'en' ? 'left-2.5' : 'left-2.5'} top-2 text-slate-400 hover:text-slate-200`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* FEFO Product List */}
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-[11px] font-bold px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>{t.fefoListTitle}</span>
                    <span>{t.itemCount.replace('{count}', String(sortedProducts.length))}</span>
                  </div>

                  {sortedProducts.length === 0 ? (
                    <div className={`rounded-2xl p-6 text-center border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white rounded-2xl border-slate-200 text-slate-400'
                    }`}>
                      <Package size={32} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-semibold">{t.noMatchingProducts}</p>
                      {!settings.isReadOnlyMode && (
                        <button
                          onClick={handleOpenAdd}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <Plus size={13} />
                          <span>{t.addFirstProduct}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    sortedProducts.map(product => {
                      const expiry = calculateExpiry(product.expiryDate, undefined, settings.language, warningThreshold);
                      let badgeStyle = isDark ? "bg-emerald-950/60 text-emerald-300 border-emerald-800" : "bg-emerald-50 text-emerald-700 border-emerald-200";
                      if (expiry.daysRemaining < 0) {
                        badgeStyle = isDark ? "bg-red-950/70 text-red-300 border-red-800" : "bg-red-100 text-red-700 border-red-200";
                      } else if (expiry.daysRemaining <= 7) {
                        badgeStyle = isDark ? "bg-red-950/50 text-red-400 border-red-800" : "bg-red-50 text-red-600 border-red-200";
                      } else if (expiry.daysRemaining <= warningThreshold) {
                        badgeStyle = isDark ? "bg-orange-950/60 text-orange-300 border-orange-800" : "bg-orange-50 text-orange-700 border-orange-200";
                      }

                      return (
                        <div
                          key={product.id}
                          className={`p-3 rounded-2xl border shadow-xs transition flex flex-col gap-2 ${
                            isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div 
                              onClick={() => handleOpenDetail(product)}
                              className="flex-1 cursor-pointer"
                            >
                              <h3 className={`font-bold text-xs leading-snug ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{product.productName}</h3>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                                <span>{t.quantityLabel} <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{product.quantity}</strong> {product.unit}</span>
                                <span>•</span>
                                <span>{t.priceLabel} <strong className="text-emerald-500 font-mono">{product.sellPrice?.toFixed(2) || '0.00'}</strong> {settings.currencySymbol}</span>
                              </div>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                              {expiry.statusText}
                            </span>
                          </div>

                          <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                            isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-100 text-slate-400'
                          }`}>
                            <span className="font-mono flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              <span>{t.expiresOn} {product.expiryDate}</span>
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenDetail(product)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                  isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                }`}
                              >
                                {t.detailsBtn}
                              </button>
                              {!settings.isReadOnlyMode && (
                                <>
                                  <button
                                    onClick={() => handleOpenEdit(product)}
                                    className="p-1 rounded-lg text-blue-400 hover:bg-blue-900/30 transition cursor-pointer"
                                    title={t.editBtn}
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => setProductToDelete({ id: product.id, productName: product.productName })}
                                    className="p-1 rounded-lg text-red-400 hover:bg-red-900/30 transition cursor-pointer"
                                    title={t.deleteBtn}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

            {/* ----------------- TAB 2: INVENTORY SCREEN ----------------- */}
            {activeTab === 'inventory' && (
              <div className="p-3.5 space-y-3 pb-20">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-sm">{t.inventoryTitle}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-mono font-bold ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {t.itemCount.replace('{count}', String(sortedProducts.length))}
                  </span>
                </div>

                {/* Sort selector */}
                <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[11px] font-medium opacity-80">{t.sortBy}</span>
                  <div className="flex gap-1 text-[10px] font-bold">
                    <button
                      onClick={() => setInventorySort('fefo')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        inventorySort === 'fefo' ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                      }`}
                    >
                      {t.sortFefo}
                    </button>
                    <button
                      onClick={() => setInventorySort('qty')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        inventorySort === 'qty' ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                      }`}
                    >
                      {t.sortQty}
                    </button>
                    <button
                      onClick={() => setInventorySort('name')}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                        inventorySort === 'name' ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                      }`}
                    >
                      {t.sortName}
                    </button>
                  </div>
                </div>

                {/* Inventory List */}
                <div className="space-y-2">
                  {sortedProducts.map(product => {
                    const expiry = calculateExpiry(product.expiryDate, undefined, settings.language, warningThreshold);
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleOpenDetail(product)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        <div>
                          <h4 className="font-bold text-xs">{product.productName}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t.quantityLabel} <strong>{product.quantity} {product.unit}</strong> • {t.priceLabel} <strong>{product.sellPrice?.toFixed(2)} {settings.currencySymbol}</strong>
                          </p>
                        </div>
                        <div className={settings.language === 'en' ? 'text-right' : 'text-left'}>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border block mb-1 ${
                            expiry.daysRemaining <= 7 ? 'bg-red-950/60 text-red-400 border-red-800' :
                            expiry.daysRemaining <= warningThreshold ? 'bg-orange-950/60 text-orange-400 border-orange-800' :
                            'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          }`}>
                            {expiry.statusText}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{product.expiryDate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------- TAB 3: ADD / EDIT PRODUCT (CLEAN DIRECT FORM) ----------------- */}
            {activeTab === 'add' && (
              <div className={`p-4 space-y-3.5 pb-20 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
                
                {/* Top Header & Cancel Button */}
                <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm">
                      {editingProduct ? t.editProductTitle : t.addNewProductTitle}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      {t.basicFieldsBadge}
                    </span>
                  </div>
                  {editingProduct && (
                    <button
                      onClick={resetForm}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* 1. اسم المنتج */}
                  <div>
                    <label className="text-[11px] font-bold block mb-1 opacity-90">{t.productNameLabel}</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={t.productNamePlaceholder}
                      className={`w-full p-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                    {/* 2 & 3. الكمية + الوحدة */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-90">{t.quantityFieldLabel}</label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={formQuantity}
                          onChange={(e) => setFormQuantity(e.target.value)}
                          placeholder="1"
                          className={`w-full p-2.5 border rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-90">{t.unitFieldLabel}</label>
                        <input
                          type="text"
                          value={formUnit}
                          onChange={(e) => setFormUnit(e.target.value)}
                          placeholder={t.unitPlaceholder}
                          className={`w-full p-2.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Units Chips from Settings */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-400">{t.suggestedUnits}</span>
                      {(settings.customUnits || ['حبة', 'كرتون', 'علبة', 'كجم', 'لتر']).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setFormUnit(u)}
                          className={`text-[10px] px-2 py-0.5 rounded-md transition cursor-pointer ${
                            formUnit === u 
                              ? 'bg-blue-600 text-white font-bold' 
                              : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>

                    {/* 4. سعر الوحدة */}
                    <div>
                      <label className="text-[11px] font-bold block mb-1 opacity-90">{t.unitPriceLabel.replace('{currency}', settings.currencySymbol)}</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={formSellPrice}
                          onChange={(e) => setFormSellPrice(e.target.value)}
                          placeholder="0.00"
                          className={`w-full p-2.5 border rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        />
                        <span className={`absolute ${settings.language === 'en' ? 'right-3' : 'left-3'} top-2.5 text-xs font-bold text-slate-400`}>{settings.currencySymbol}</span>
                      </div>
                    </div>

                    {/* 5. منبه الصلاحية */}
                    <div className={`p-3 rounded-2xl border space-y-2.5 ${
                      isDark ? 'bg-amber-950/20 border-amber-800 text-amber-100' : 'bg-amber-50/90 border-amber-200 text-amber-950'
                    }`}>
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <BellRing size={13} className="text-amber-500" />
                          <span>{t.expiryReminderSectionTitle}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendTestNotification(formName || (settings.language === 'en' ? 'Test Product' : 'منتج تجريبي'), parseInt(formReminderDays) || 7, formReminderNote)}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <Send size={10} />
                          <span>{t.testAlarmBtn}</span>
                        </button>
                      </div>

                      {/* Live Duration Preview Badge */}
                      <div className={`px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs border ${
                        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-amber-100/70 border-amber-300/60'
                      }`}>
                        <span className="text-[10px] font-semibold opacity-90">{t.warningDurationLabel}</span>
                        <span className={`font-extrabold text-[11px] px-2 py-0.5 rounded-md shadow-2xs border ${
                          isDark ? 'bg-slate-900 border-amber-700 text-amber-300' : 'bg-white border-amber-200 text-amber-950'
                        }`}>
                          {settings.language === 'en' 
                            ? `${formatDuration(parseInt(formReminderDays) || 7, settings.language)} ${t.warningBeforePrefix}`
                            : `قبل ${formatDuration(parseInt(formReminderDays) || 7, settings.language)}`}
                        </span>
                      </div>

                      {/* Preset quick buttons */}
                      <div>
                        <span className="text-[10px] font-semibold block mb-1 opacity-90">{t.quickWarningOptions}</span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: t.preset3Days, val: '3' },
                            { label: t.preset7Days, val: '7' },
                            { label: t.preset15Days, val: '15' },
                            { label: t.preset1Month, val: '30' },
                            { label: t.preset2Months, val: '60' },
                            { label: t.preset3Months, val: '90' },
                            { label: t.preset6Months, val: '180' },
                            { label: t.preset1Year, val: '365' },
                          ].map(item => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setFormReminderDays(item.val)}
                              className={`text-[10px] py-1 rounded-lg border font-bold cursor-pointer transition ${
                                formReminderDays === item.val
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : (isDark ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50')
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Months & Days */}
                      <div className={`p-2 rounded-xl border space-y-1.5 ${
                        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-amber-200/80'
                      }`}>
                        <span className="text-[10px] font-bold block opacity-90">{t.customMonthsDaysTitle}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold block mb-0.5 opacity-80">{t.monthsCountLabel}</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="36"
                                value={Math.floor((parseInt(formReminderDays) || 0) / 30)}
                                onChange={(e) => {
                                  const months = Math.max(0, parseInt(e.target.value) || 0);
                                  const remDays = (parseInt(formReminderDays) || 0) % 30;
                                  const total = (months * 30) + remDays;
                                  setFormReminderDays(String(Math.max(1, total)));
                                }}
                                className={`w-full p-1.5 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-amber-500 text-center ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                              <span className={`absolute ${settings.language === 'en' ? 'right-2' : 'left-2'} top-1.5 text-[9px] font-bold text-slate-400`}>{t.monthsUnit}</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold block mb-0.5 opacity-80">{t.additionalDaysLabel}</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="29"
                                value={(parseInt(formReminderDays) || 0) % 30}
                                onChange={(e) => {
                                  const days = Math.max(0, Math.min(29, parseInt(e.target.value) || 0));
                                  const months = Math.floor((parseInt(formReminderDays) || 0) / 30);
                                  const total = (months * 30) + days;
                                  setFormReminderDays(String(Math.max(1, total)));
                                }}
                                className={`w-full p-1.5 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-amber-500 text-center ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                              <span className={`absolute ${settings.language === 'en' ? 'right-2' : 'left-2'} top-1.5 text-[9px] font-bold text-slate-400`}>{t.daysUnit}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold block mb-0.5 opacity-90">{t.reminderNoteLabel}</label>
                        <input
                          type="text"
                          value={formReminderNote}
                          onChange={(e) => setFormReminderNote(e.target.value)}
                          placeholder={t.reminderNotePlaceholder}
                          className={`w-full p-2 border rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-amber-200 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 6. تاريخ الانتهاء */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-red-500 flex items-center justify-between">
                        <span>{t.expiryDateLabel}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{t.fefoSystemBadge}</span>
                      </label>
                      <input
                        type="date"
                        value={formExpiryDate}
                        onChange={(e) => setFormExpiryDate(e.target.value)}
                        className={`w-full p-2.5 border-2 border-red-400/80 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-red-500 ${
                          isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'
                        }`}
                      />

                      {/* Quick Shortcuts */}
                      <div className="grid grid-cols-6 gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 3))}
                          className="p-1 rounded-lg bg-red-950/40 text-red-400 border border-red-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.preset3Days}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 7))}
                          className="p-1 rounded-lg bg-orange-950/40 text-orange-400 border border-orange-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.shortcutWeek}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 30))}
                          className="p-1 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.shortcutMonth}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 60))}
                          className="p-1 rounded-lg bg-yellow-950/40 text-yellow-400 border border-yellow-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.shortcut2Months}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 90))}
                          className="p-1 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.shortcut3Months}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormExpiryDate(addDays(new Date(), 180))}
                          className="p-1 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-900 text-[10px] font-bold text-center transition cursor-pointer"
                        >
                          {t.shortcut6Months}
                        </button>
                      </div>
                    </div>

                    {/* Primary Submit Button */}
                    <button
                      onClick={handleSave}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold mt-3 shadow-md cursor-pointer transition text-xs active:scale-98"
                    >
                      {editingProduct ? t.updateProduct : t.saveProduct}
                    </button>
                  </div>
              </div>
            )}

            {/* ----------------- TAB 4: DAILY ALARM & NOTIFICATIONS ----------------- */}
            {activeTab === 'alarm' && (
              <div className="p-3.5 space-y-3 pb-20">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-sm">{t.alarmCenterTitle}</h2>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    WorkManager 24h
                  </span>
                </div>

                {/* Daily Automation Card */}
                <div className={`p-3.5 rounded-2xl border shadow-xs space-y-3 ${
                  isDark ? 'bg-slate-800 border-amber-800/80' : 'bg-white border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                        <Clock size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs">{t.alarmScheduleCardTitle}</h4>
                        <p className="text-[10px] text-slate-400">{t.alarmScheduleCardDesc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const next = !dailyAlarmEnabled;
                        setDailyAlarmEnabled(next);
                        localStorage.setItem('freshstock_daily_alarm_enabled', JSON.stringify(next));
                        showToast(next ? t.toastAlarmEnabled : t.toastAlarmDisabled);
                      }}
                      className={`w-11 h-6 rounded-full transition cursor-pointer p-0.5 ${
                        dailyAlarmEnabled ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition transform ${
                        dailyAlarmEnabled ? (settings.language === 'en' ? 'translate-x-5' : 'translate-x-0') : (settings.language === 'en' ? 'translate-x-0' : '-translate-x-5')
                      }`} />
                    </button>
                  </div>

                  {/* Time picker & trigger */}
                  <div className={`flex items-center justify-between p-2.5 rounded-xl text-xs ${
                    isDark ? 'bg-slate-900' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">{t.alarmTimeLabel}</span>
                      <select
                        value={settings.notificationTime}
                        onChange={(e) => {
                          handleUpdateSettings({ notificationTime: e.target.value });
                          showToast(`⏰ ${t.alarmTimeLabel} ${e.target.value}`);
                        }}
                        className={`font-bold border px-2 py-1 rounded-lg text-xs outline-none ${
                          isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-amber-950'
                        }`}
                      >
                        <option value="08:00 AM">{t.time8AM}</option>
                        <option value="09:00 AM">{t.time9AM}</option>
                        <option value="10:00 AM">{t.time10AM}</option>
                        <option value="12:00 PM">{t.time12PM}</option>
                        <option value="05:00 PM">{t.time5PM}</option>
                      </select>
                    </div>

                    <button
                      onClick={triggerDailyMorningScan}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition active:scale-95"
                    >
                      {t.triggerNowBtn}
                    </button>
                  </div>
                </div>

                {/* Sound & Ringtone Settings Card */}
                <div className={`p-3.5 rounded-2xl border shadow-xs space-y-2.5 ${
                  isDark ? 'bg-slate-800 border-blue-800/80' : 'bg-white border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                        <Volume2 size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs">{t.soundCardTitle}</h4>
                        <p className="text-[10px] text-slate-400">{t.soundCardDesc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const next = !settings.soundEnabled;
                        handleUpdateSettings({ soundEnabled: next });
                        if (next) {
                          soundService.playNotificationChime();
                        }
                        showToast(next ? t.toastSoundOn : t.toastSoundOff);
                      }}
                      className={`w-11 h-6 rounded-full transition cursor-pointer p-0.5 ${
                        settings.soundEnabled ? 'bg-blue-600' : 'bg-slate-500'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition transform ${
                        settings.soundEnabled ? (settings.language === 'en' ? 'translate-x-5' : 'translate-x-0') : (settings.language === 'en' ? 'translate-x-0' : '-translate-x-5')
                      }`} />
                    </button>
                  </div>

                  {/* Sound preview buttons */}
                  <div className={`grid grid-cols-2 gap-2 pt-1 border-t text-xs ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playRingtone(settings.alarmSoundType || 'chime');
                        showToast(`🎵 ${t.playTestTone}: ${settings.alarmSoundType}`);
                      }}
                      className={`p-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Music size={13} className="text-blue-500" />
                      <span className="text-[10px] font-bold">{t.testStandardChime}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundService.playUrgentAlarm();
                        showToast(settings.language === 'en' ? '🚨 Urgent alarm siren' : '🚨 رنين الإنذار العاجل');
                      }}
                      className={`p-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 ${
                        isDark ? 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/60' : 'bg-red-50/60 hover:bg-red-100/80 border-red-200 text-red-700'
                      }`}
                    >
                      <BellRing size={13} className="text-red-500" />
                      <span className="text-[10px] font-bold">{t.testUrgentAlarm}</span>
                    </button>
                  </div>
                </div>

                {/* Notifications History List */}
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-[11px] font-bold px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>{t.notificationsHistoryTitle}</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          setNotifications([]);
                          showToast(t.toastNotificationsCleared);
                        }}
                        className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        {t.clearAll}
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className={`rounded-2xl p-6 text-center border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                    }`}>
                      <Bell size={28} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-semibold">{t.noNotifications}</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-3 rounded-2xl border shadow-xs space-y-1 ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span className={`w-2 h-2 rounded-full ${
                              notif.priority === 'urgent' || notif.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <span>{notif.title || notif.productName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.time || (settings.language === 'en' ? 'Today' : 'اليوم')}</span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {notif.message || notif.reminderNote || t.sampleAlertNotice}
                        </p>

                        {notif.itemsList && notif.itemsList.length > 0 && (
                          <div className={`p-2 rounded-lg text-[10px] space-y-0.5 font-medium ${
                            isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-700'
                          }`}>
                            {notif.itemsList.map((item, idx) => (
                              <div key={idx}>{item}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ----------------- TAB 5: SETTINGS SCREEN ----------------- */}
            {activeTab === 'settings' && (
              <div className="p-3.5">
                <SettingsTab
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  products={products}
                  onClearExpiredProducts={handleClearExpiredProducts}
                  onImportProducts={handleImportProducts}
                  onResetFactoryData={handleResetFactoryData}
                  onShowToast={showToast}
                />
              </div>
            )}

          </div>

          {/* Floating Action Button (FAB) on Home & Inventory */}
          {(activeTab === 'home' || activeTab === 'inventory') && !settings.isReadOnlyMode && (
            <div className={`absolute bottom-16 ${settings.language === 'en' ? 'right-4' : 'left-4'} z-30`}>
              <button
                onClick={handleOpenAdd}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl flex items-center justify-center cursor-pointer transition active:scale-95 shadow-blue-500/30"
                title={t.addNewProductTitle}
              >
                <Plus size={24} />
              </button>
            </div>
          )}

          {/* Android Material 3 Bottom Navigation Bar */}
          <div className={`border-t px-2 py-1.5 flex items-center justify-around z-30 select-none ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'home' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${activeTab === 'home' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-50') : ''}`}>
                <Package size={17} />
              </div>
              <span className="text-[10px]">{t.tabHome}</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition cursor-pointer ${
                activeTab === 'inventory' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${activeTab === 'inventory' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-50') : ''}`}>
                <Layers size={17} />
              </div>
              <span className="text-[10px]">{t.tabInventory}</span>
            </button>

            {!settings.isReadOnlyMode && (
              <button
                onClick={() => setActiveTab('add')}
                className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition cursor-pointer ${
                  activeTab === 'add' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-xl transition ${activeTab === 'add' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-50') : ''}`}>
                  <Plus size={17} />
                </div>
                <span className="text-[10px]">{t.tabAdd}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('alarm')}
              className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer relative ${
                activeTab === 'alarm' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${activeTab === 'alarm' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-50') : ''}`}>
                <BellRing size={17} />
              </div>
              <span className="text-[9px] truncate max-w-[48px]">{t.tabAlarm}</span>
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'settings' ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${activeTab === 'settings' ? (isDark ? 'bg-blue-900/50' : 'bg-blue-50') : ''}`}>
                <Settings size={17} />
              </div>
              <span className="text-[9px] truncate max-w-[48px]">{t.tabSettings}</span>
            </button>
          </div>

          {/* Android Bottom Navigation Pill */}
          <div className="w-full py-1 flex justify-center bg-inherit">
            <div className="w-24 h-1 rounded-full bg-slate-400/40 dark:bg-slate-600/60" />
          </div>

          </>
          )}

          {/* 👤 USER ACCOUNT PROFILE BOTTOM SHEET MODAL */}
          {showAccountSheet && (
            <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end select-none animate-in fade-in" dir={settings.language === 'en' ? 'ltr' : 'rtl'}>
              <div className={`w-full max-h-[85%] rounded-t-[32px] p-5 shadow-2xl space-y-4 border-t overflow-y-auto ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                {/* Drag Handle */}
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />

                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <User size={20} className="text-blue-500" />
                    <h3 className="font-extrabold text-sm">
                      {settings.language === 'en' ? 'User Account' : 'حساب المستخدم'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAccountSheet(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* User Info */}
                {currentUser ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                          {currentUser.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm">{currentUser.displayName}</span>
                            <ShieldCheck size={15} className="text-emerald-500" />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentUser.email}</p>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-md inline-block mt-1">
                            {currentUser.provider}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSignOut}
                      className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <LogOut size={15} />
                      <span>{settings.language === 'en' ? 'Sign Out from App' : 'تسجيل الخروج من التطبيق'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-xs">{settings.language === 'en' ? 'Guest Mode (Offline)' : 'وضع الضيف (أوفلاين)'}</div>
                        <p className="text-[11px] text-slate-400">{settings.language === 'en' ? 'Data is saved locally on this device' : 'البيانات محفوظة محلياً على هذا الهاتف'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowAccountSheet(false);
                        setIsGuestMode(false);
                        setCurrentUser(null);
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer hover:bg-blue-700 transition"
                    >
                      {settings.language === 'en' ? 'Sign In / Switch Account' : 'تسجيل الدخول / تبديل الحساب'}
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Android PIN & Biometric Lock Screen Overlay */}
          {isDeviceLocked && (
            <div className="absolute inset-0 z-50 bg-slate-900/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white select-none animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 shadow-lg">
                <Lock size={28} />
              </div>
              
              <h2 className="text-sm font-bold text-white mb-0.5">
                {t.appLockedTitle}
              </h2>
              <p className="text-[11px] text-slate-400 mb-4 text-center px-4">
                {t.enterPinDesc}
              </p>

              {/* PIN Dots */}
              <div className="flex items-center gap-3 mb-5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                      enteredPin.length > idx
                        ? pinError
                          ? 'bg-red-500 border-red-500 scale-110'
                          : 'bg-blue-500 border-blue-500 scale-110'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-[11px] text-red-400 font-bold mb-3 animate-bounce">
                  {t.pinErrorMsg}
                </p>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => {
                      if (enteredPin.length < 4) {
                        const next = enteredPin + digit;
                        setEnteredPin(next);
                        setPinError(false);
                        if (next.length === 4) {
                          if (!settings.appPin || next === settings.appPin) {
                            soundService.playSuccessTone();
                            setIsDeviceLocked(false);
                            setEnteredPin('');
                          } else {
                            soundService.playUrgentAlarm();
                            setPinError(true);
                            setTimeout(() => {
                              setEnteredPin('');
                              setPinError(false);
                            }, 800);
                          }
                        }
                      }
                    }}
                    className="w-14 h-14 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-blue-600 border border-slate-700 text-base font-bold flex items-center justify-center transition cursor-pointer mx-auto shadow-xs active:scale-95"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  onClick={() => {
                    soundService.playSuccessTone();
                    setIsDeviceLocked(false);
                    setEnteredPin('');
                  }}
                  className="w-14 h-14 rounded-full text-[11px] text-slate-400 hover:text-white flex items-center justify-center mx-auto cursor-pointer"
                  title="Demo Unlock"
                >
                  {t.skipDemo}
                </button>

                <button
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      const next = enteredPin + '0';
                      setEnteredPin(next);
                      setPinError(false);
                      if (next.length === 4) {
                        if (!settings.appPin || next === settings.appPin) {
                          soundService.playSuccessTone();
                          setIsDeviceLocked(false);
                          setEnteredPin('');
                        } else {
                          soundService.playUrgentAlarm();
                          setPinError(true);
                          setTimeout(() => {
                            setEnteredPin('');
                            setPinError(false);
                          }, 800);
                        }
                      }
                    }
                  }}
                  className="w-14 h-14 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-blue-600 border border-slate-700 text-base font-bold flex items-center justify-center transition cursor-pointer mx-auto shadow-xs active:scale-95"
                >
                  0
                </button>

                <button
                  onClick={() => {
                    setEnteredPin(prev => prev.slice(0, -1));
                    setPinError(false);
                  }}
                  className="w-14 h-14 rounded-full text-slate-400 hover:text-white flex items-center justify-center mx-auto cursor-pointer text-sm"
                  title={t.clearKey}
                >
                  {t.clearKey}
                </button>
              </div>

              {/* Biometric Fingerprint Sensor (Respects settings.useBiometrics) */}
              {settings.useBiometrics && (
                <div className="pt-2 border-t border-slate-800 w-full flex flex-col items-center gap-2">
                  <button
                    onClick={handleBiometricUnlock}
                    className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-md"
                    title={t.touchFingerprintUnlock}
                  >
                    <Fingerprint size={18} className="text-rose-400 animate-pulse" />
                    <span>{t.touchFingerprintUnlock}</span>
                  </button>

                  <div className="text-center text-[10px] text-slate-500">
                    <span>{t.registeredPinInfo}</span>
                    <strong className="text-slate-300 font-mono">{settings.appPin || t.noPinSet}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Product Detail Modal */}
      {selectedDetailProduct && (() => {
        const p = selectedDetailProduct;
        const expiry = calculateExpiry(p.expiryDate, undefined, settings.language, warningThreshold);
        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" dir={settings.language === 'en' ? 'ltr' : 'rtl'}>
            <div className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 space-y-4 border ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className={`flex items-start justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <h3 className="font-bold text-sm">{p.productName}</h3>
                  <span className="text-[11px] text-slate-400 font-mono">{t.productRecordNumber.replace('{id}', String(p.id))}</span>
                </div>
                <button
                  onClick={() => setSelectedDetailProduct(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Banner */}
              <div className={`p-3 rounded-2xl space-y-2 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{t.expiryStatusFEFO}</span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] ${
                    expiry.daysRemaining <= 7 ? 'bg-red-950/60 text-red-300 border-red-800' :
                    expiry.daysRemaining <= warningThreshold ? 'bg-orange-950/60 text-orange-300 border-orange-800' :
                    'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}>
                    {expiry.statusText}
                  </span>
                </div>

                <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      expiry.daysRemaining <= 7 ? 'bg-red-500' :
                      expiry.daysRemaining <= warningThreshold ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(15, (expiry.daysRemaining / (warningThreshold || 60)) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>{t.actualRemaining} <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{formatDuration(expiry.daysRemaining, settings.language)}</strong></span>
                  <span>{t.actualExpiryDate} <strong className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{p.expiryDate}</strong></span>
                </div>
              </div>

              {/* Details List */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className="text-[10px] text-slate-400 block">{t.registeredQuantity}</span>
                  <span className="font-bold">{p.quantity} {p.unit}</span>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className="text-[10px] text-slate-400 block">{t.unitPrice}</span>
                  <span className="font-bold text-emerald-500 font-mono">{p.sellPrice?.toFixed(2)} {settings.currencySymbol}</span>
                </div>
              </div>

              {/* Expiry Alarm & Notes */}
              <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                isDark ? 'bg-amber-950/30 border-amber-900/60 text-amber-200' : 'bg-amber-50/80 border-amber-200/80 text-amber-950'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <BellRing size={12} className="text-amber-500" />
                    <span>{t.preExpiryAlarm}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border ${
                    isDark ? 'bg-slate-900 border-amber-800 text-amber-300' : 'bg-white border-amber-200 text-amber-900'
                  }`}>
                    {settings.language === 'en'
                      ? `${formatDuration(p.reminderDays || warningThreshold, settings.language)} ${t.warningBeforePrefix}`
                      : `قبل ${formatDuration(p.reminderDays || warningThreshold, settings.language)}`}
                  </span>
                </div>
                {p.reminderNote && (
                  <p className="text-[10px] opacity-80 pt-1 border-t border-amber-800/40">
                    <strong>{t.alertNote}</strong> "{p.reminderNote}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              {!settings.isReadOnlyMode && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      handleOpenEdit(p);
                      setSelectedDetailProduct(null);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={14} />
                    <span>{t.editProductBtn}</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductToDelete({ id: p.id, productName: p.productName });
                      setSelectedDetailProduct(null);
                    }}
                    className="p-2.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800 rounded-xl transition cursor-pointer"
                    title={t.deleteBtn}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4" dir={settings.language === 'en' ? 'ltr' : 'rtl'}>
          <div className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 border ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={22} />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm">{t.deleteConfirmTitle}</h3>
              <p className="text-xs text-slate-400">
                {t.deleteConfirmDesc.replace('{name}', productToDelete.productName)}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t.confirmDeleteBtn}
              </button>
              <button
                onClick={() => setProductToDelete(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-2.5 rounded-2xl shadow-xl text-xs font-semibold backdrop-blur transition transform animate-in fade-in slide-in-from-bottom-2 border border-slate-700">
          {toastMessage}
        </div>
      )}

    </div>
  );
};
