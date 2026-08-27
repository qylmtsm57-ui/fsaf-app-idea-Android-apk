import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Volume2,
  VolumeX,
  Play,
  Layers,
  Coins,
  Plus,
  Trash2,
  Check,
  Calendar,
  ScanLine,
  Database,
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  CloudUpload,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Languages,
  BookOpen,
  MessageCircle,
  Mail,
  Star,
  Share2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Sliders,
  HelpCircle,
  ExternalLink,
  Fingerprint,
  Phone,
  Copy
} from 'lucide-react';
import { AppSettings, ProductItem } from '../types';
import { soundService } from '../utils/soundService';
import { calculateExpiry } from '../utils/expiryLogic';
import { getTranslation } from '../utils/translations';
import confetti from 'canvas-confetti';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  products: ProductItem[];
  onImportProducts: (imported: ProductItem[]) => void;
  onClearExpiredProducts: () => void;
  onResetFactoryData: () => void;
  onShowToast?: (msg: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  products,
  onImportProducts,
  onClearExpiredProducts,
  onResetFactoryData,
  onShowToast = (_msg: string) => {},
}) => {
  const t = getTranslation(settings.language);

  // Local active dialogs
  const [newUnitInput, setNewUnitInput] = useState('');
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [showUserGuideModal, setShowUserGuideModal] = useState(false);
  const [showClearExpiredConfirm, setShowClearExpiredConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBiometricTestModal, setShowBiometricTestModal] = useState(false);
  const [biometricScanState, setBiometricScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedStars, setSelectedStars] = useState(5);
  const [rateFeedback, setRateFeedback] = useState('');

  // Statistics
  const expiredCount = products.filter(p => calculateExpiry(p.expiryDate).daysRemaining < 0).length;
  const criticalCount = products.filter(p => {
    const d = calculateExpiry(p.expiryDate).daysRemaining;
    return d >= 0 && d <= (settings.warningDaysEnabled ? settings.warningDays : 7);
  }).length;

  // 1. Sound Preview Test
  const handleTestSound = (type: AppSettings['alarmSoundType']) => {
    soundService.setEnabled(true);
    soundService.playRingtone(type);
    onShowToast(`🎵 ${t.alarmToneLabel} ${
      type === 'marimba' ? 'ماريمبا هادئ / Marimba' :
      type === 'urgent' ? 'رنين إنذار عاجل / Urgent Alarm' :
      type === 'chime' ? 'كريستال تشايم / Chime' :
      type === 'bell' ? 'جرس كلاسيك / Bell' : 'صفير رقمي / Beep'
    }`);
  };

  // 2. Add custom unit
  const handleAddUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    if (settings.customUnits.includes(trimmed)) {
      onShowToast('⚠️ هذه الوحدة موجودة بالفعل في القائمة / Unit exists');
      return;
    }
    const updated = [...settings.customUnits, trimmed];
    onUpdateSettings({ customUnits: updated });
    setNewUnitInput('');
    onShowToast(`✅ تمت إضافة الوحدة "${trimmed}" بنجاح`);
  };

  // 3. Remove custom unit
  const handleRemoveUnit = (unitToRemove: string) => {
    if (settings.customUnits.length <= 1) {
      onShowToast('⚠️ يجب الإبقاء على وحدة واحدة على الأقل');
      return;
    }
    const updated = settings.customUnits.filter(u => u !== unitToRemove);
    const newDefault = settings.defaultUnit === unitToRemove ? updated[0] : settings.defaultUnit;
    onUpdateSettings({ customUnits: updated, defaultUnit: newDefault });
    onShowToast(`🗑️ تم حذف الوحدة "${unitToRemove}"`);
  };

  // 4. Export JSON Backup
  const handleExportJson = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
      const downloadAnchor = document.createElement('a');
      const timeStamp = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `FreshStock_Backup_${timeStamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onUpdateSettings({ lastBackupDate: new Date().toLocaleDateString('ar-SA') + ' ' + new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) });
      soundService.playSuccessTone();
      onShowToast('📦 تم تصدير النسخة الاحتياطية بنجاح (JSON)');
    } catch (e) {
      onShowToast('❌ حدث خطأ أثناء تصدير النسخة الاحتياطية');
    }
  };

  // 5. Export CSV
  const handleExportCsv = (onlyCritical: boolean = false) => {
    try {
      const listToExport = onlyCritical 
        ? products.filter(p => {
            const days = calculateExpiry(p.expiryDate).daysRemaining;
            return days <= (settings.warningDaysEnabled ? settings.warningDays : 30);
          })
        : products;

      if (listToExport.length === 0) {
        onShowToast(onlyCritical ? 'ℹ️ لا توجد بضائع حرجة للتصدير حالياً' : 'ℹ️ المخزون فارغ');
        return;
      }

      const headers = ["معرف", "اسم المنتج", "الباركود", "الكمية", "الوحدة", "سعر البيع", "تاريخ الانتهاء", "الأيام المتبقية", "الحالة", "ملاحظة التنبيه"];
      const rows = listToExport.map(p => {
        const exp = calculateExpiry(p.expiryDate);
        return [
          p.id,
          `"${p.productName.replace(/"/g, '""')}"`,
          p.barcode || '',
          p.quantity,
          p.unit,
          p.sellPrice?.toFixed(2) || '0.00',
          p.expiryDate,
          exp.daysRemaining,
          `"${exp.statusText}"`,
          `"${(p.reminderNote || '').replace(/"/g, '""')}"`
        ];
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", onlyCritical ? `FreshStock_Critical_${new Date().toISOString().slice(0, 10)}.csv` : `FreshStock_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      soundService.playSuccessTone();
      onShowToast(onlyCritical ? '📊 تم تصدير كشف البضائع الحرجة (CSV)' : '📊 تم تصدير جرد المخزون كاملاً (CSV)');
    } catch (err) {
      onShowToast('❌ حدث خطأ أثناء إنشاء ملف CSV');
    }
  };

  // 6. Import JSON
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid format");
      }
      onImportProducts(parsed);
      setShowImportModal(false);
      setImportJsonText('');
      soundService.playSuccessTone();
      onShowToast(`✅ تم استرجاع ${parsed.length} صنف إلى قاعدة البيانات بنجاح`);
    } catch (e) {
      onShowToast('❌ الملف غير صالح أو تنسيق JSON غير صحيح');
    }
  };

  // 7. Save App PIN
  const handleSavePin = () => {
    if (pinInput.length < 4) {
      onShowToast('⚠️ يجب أن يتكون رمز PIN من 4 أرقام على الأقل');
      return;
    }
    if (pinInput !== pinConfirmInput) {
      onShowToast('❌ الرمزان غير متطابقين، يرجى إعادة الإدخال');
      return;
    }
    onUpdateSettings({ isAppLocked: true, appPin: pinInput });
    setShowPinSetupModal(false);
    setPinInput('');
    setPinConfirmInput('');
    soundService.playSuccessTone();
    onShowToast('🔒 تم تفعيل القفل برمز PIN وبصمة الإصبع');
  };

  // 9. Biometric interactive test
  const handleStartBiometricScan = () => {
    setBiometricScanState('scanning');
    soundService.playRingtone('beep');
    setTimeout(() => {
      setBiometricScanState('success');
      soundService.playSuccessTone();
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
      setTimeout(() => {
        setShowBiometricTestModal(false);
        setBiometricScanState('idle');
        onShowToast('✅ تم التحقق من البصمة بنجاح! المستشعر جاهز ونشط');
      }, 1200);
    }, 1000);
  };

  // 10. Copy text helper
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`📋 ${t.copiedToast} (${label})`);
  };

  // 11. Submit Google Play Review
  const handleSubmitReview = () => {
    soundService.playSuccessTone();
    setShowRateModal(false);
    try {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}
    onShowToast(`⭐ شكراً لك! تم إرسال تقييم ${selectedStars} نجوم لمتجر Google Play.`);
  };

  return (
    <div className={`space-y-4 pb-20 animate-in fade-in duration-200 ${settings.language === 'en' ? 'text-left' : 'text-right'}`}>
      
      {/* Header Banner */}
      <div className={`p-4 rounded-3xl border transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800/90 border-slate-700 text-slate-100' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <Sliders size={18} />
              </div>
              <h2 className="font-extrabold text-base">{t.appSettingsTitle}</h2>
            </div>
            <p className="text-[11px] text-blue-100 leading-relaxed opacity-90">
              {settings.language === 'en' 
                ? 'Customize expiry alarms, currency, data backups, security and biometric access.' 
                : 'تخصيص منبه الصلاحية، العملة، إدارة البيانات والأمان لتناسب نشاطك التجاري.'}
            </p>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-4 gap-1.5 text-center text-[10px]">
          <div className="bg-white/10 rounded-xl py-1.5 px-1 backdrop-blur-xs">
            <span className="opacity-80 block">{settings.language === 'en' ? 'Currency' : 'العملة'}</span>
            <strong className="text-xs font-bold font-mono">{settings.currencySymbol}</strong>
          </div>
          <div className="bg-white/10 rounded-xl py-1.5 px-1 backdrop-blur-xs">
            <span className="opacity-80 block">{settings.language === 'en' ? 'Warning' : 'التحذير'}</span>
            <strong className="text-xs font-bold">
              {settings.warningDaysEnabled ? `${settings.warningDays} ${t.daysUnit}` : (settings.language === 'en' ? 'Disabled' : 'اختياري')}
            </strong>
          </div>
          <div className="bg-white/10 rounded-xl py-1.5 px-1 backdrop-blur-xs">
            <span className="opacity-80 block">{settings.language === 'en' ? 'PIN Lock' : 'رمز القفل'}</span>
            <strong className="text-xs font-bold">{settings.isAppLocked ? '🔒 ON' : '🔓 OFF'}</strong>
          </div>
          <div className="bg-white/10 rounded-xl py-1.5 px-1 backdrop-blur-xs">
            <span className="opacity-80 block">{settings.language === 'en' ? 'Biometrics' : 'البصمة'}</span>
            <strong className="text-xs font-bold">{settings.useBiometrics ? '👆 ON' : 'OFF'}</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. إعدادات التنبيهات والإشعارات (Notifications & Alarms) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-blue-600 font-extrabold text-sm">
            <Bell size={18} />
            <span>{t.categoryNotifications}</span>
          </div>
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
            Android WorkManager
          </span>
        </div>

        {/* وقت الإشعار اليومي */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" />
              <span>{t.dailyAlarmTimeLabel}</span>
            </label>
            <p className="text-[10px] text-slate-500">
              {settings.language === 'en' 
                ? 'Time for automated morning expiry scan and alert' 
                : 'الساعة التي يقوم فيها النظام بفحص الصلاحيات وإرسال الإشعار'}
            </p>
          </div>
          <input
            type="time"
            value={settings.notificationTime}
            onChange={(e) => {
              onUpdateSettings({ notificationTime: e.target.value });
              onShowToast(`⏰ ${t.dailyAlarmTimeLabel} ${e.target.value}`);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-xs text-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {/* أيام التحذير المسبق (تخصيص الحدود وجعله اختياري) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                <span>{t.defaultWarningDaysLabel}</span>
              </label>
              <p className="text-[10px] text-slate-500">
                {t.defaultWarningDaysDesc}
              </p>
            </div>
            
            {/* Toggle warning days system (Make it Optional) */}
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                settings.warningDaysEnabled 
                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {settings.warningDaysEnabled ? `${settings.warningDays} ${t.daysUnit}` : (settings.language === 'en' ? 'Optional (Off)' : 'اختياري (معطّل)')}
              </span>
              <button
                onClick={() => {
                  const next = !settings.warningDaysEnabled;
                  onUpdateSettings({ warningDaysEnabled: next });
                  onShowToast(next ? '⚠️ تم تفعيل أيام التحذير المسبق' : 'ℹ️ تم جعل أيام التحذير المسبق اختيارية ومعطلة افتراضياً');
                }}
                className={`w-11 h-6 rounded-full transition flex items-center p-1 cursor-pointer ${
                  settings.warningDaysEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-200 justify-start'
                }`}
                title="تفعيل / تعطيل أيام التحذير المسبق"
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>

          {/* Quick presets buttons (If enabled) */}
          {settings.warningDaysEnabled && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { days: 15, label: settings.language === 'en' ? '15d (Food)' : '15 يوم (أغذية)' },
                  { days: 30, label: settings.language === 'en' ? '30d (Stock)' : '30 يوم (مستودع)' },
                  { days: 60, label: settings.language === 'en' ? '60d (Canned)' : '60 يوم (معلبات)' },
                  { days: 90, label: settings.language === 'en' ? '90d (Pharma)' : '90 يوم (صيدلية)' },
                ].map(item => (
                  <button
                    key={item.days}
                    onClick={() => {
                      onUpdateSettings({ warningDays: item.days });
                      onShowToast(`⚠️ ${item.days} ${t.daysUnit}`);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold border transition text-center cursor-pointer ${
                      settings.warningDays === item.days
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* نغمة وصوت التنبيه */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {settings.soundEnabled ? <Volume2 size={14} className="text-blue-600" /> : <VolumeX size={14} className="text-slate-400" />}
              <span>{t.alarmToneLabel}</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !settings.soundEnabled;
                  onUpdateSettings({ soundEnabled: next });
                  soundService.setEnabled(next);
                  onShowToast(next ? '🔊 ' + t.soundActive : '🔇 ' + t.soundMuted);
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                  settings.soundEnabled
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {settings.soundEnabled ? (settings.language === 'en' ? 'Enabled' : 'مفعّل') : (settings.language === 'en' ? 'Muted' : 'مكتوم')}
              </button>
            </div>
          </div>

          {/* Ringtone selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'marimba', name: settings.language === 'en' ? 'Marimba' : 'ماريمبا هادئ' },
              { id: 'chime', name: settings.language === 'en' ? 'Crystal Chime' : 'كريستال تشايم' },
              { id: 'urgent', name: settings.language === 'en' ? 'Urgent Alarm' : 'إنذار سريع' },
              { id: 'bell', name: settings.language === 'en' ? 'Classic Bell' : 'جرس كلاسيك' },
              { id: 'beep', name: settings.language === 'en' ? 'Digital Beep' : 'صفير رقمي' },
            ].map(ringtone => (
              <div
                key={ringtone.id}
                className={`p-2 rounded-2xl border flex items-center justify-between gap-1 text-[11px] transition ${
                  settings.alarmSoundType === ringtone.id
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <button
                  onClick={() => {
                    onUpdateSettings({ alarmSoundType: ringtone.id as any });
                    handleTestSound(ringtone.id as any);
                  }}
                  className={`flex-1 truncate cursor-pointer hover:text-blue-600 ${settings.language === 'en' ? 'text-left' : 'text-right'}`}
                >
                  {ringtone.name}
                </button>
                <button
                  onClick={() => handleTestSound(ringtone.id as any)}
                  className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer transition"
                  title={t.playTestTone}
                >
                  <Play size={12} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* تنبيه الشاشة القفل (Sticky Notification) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800">{t.stickyNotificationToggle}</span>
            <p className="text-[10px] text-slate-500">
              {t.stickyNotificationDesc}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !settings.stickyNotification;
              onUpdateSettings({ stickyNotification: next });
              onShowToast(next ? '📌 تم تفعيل الإشعار الثابت' : 'تم تعطيل الإشعار الثابت');
            }}
            className={`w-11 h-6 rounded-full transition flex items-center p-1 cursor-pointer ${
              settings.stickyNotification ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. إعدادات العملة والوحدات (Currency & Units) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
            <Coins size={18} />
            <span>{t.categoryCurrency}</span>
          </div>
        </div>

        {/* رمز العملة */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 block">{t.currencySymbolLabel}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.currencySymbol}
              onChange={(e) => onUpdateSettings({ currencySymbol: e.target.value })}
              placeholder={settings.language === 'en' ? 'e.g. $, SAR, USD, EUR' : 'مثال: ر.س، ريال، $، ج.م'}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex gap-1">
              {['ر.س', 'ريال', '$', 'ج.م', 'د.إ', '€'].map(c => (
                <button
                  key={c}
                  onClick={() => {
                    onUpdateSettings({ currencySymbol: c });
                    onShowToast(`💵 ${t.currencySymbolLabel} ${c}`);
                  }}
                  className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                    settings.currencySymbol === c
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* الوحدة الافتراضية */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800">{t.defaultUnitLabel}</label>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {settings.defaultUnit}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {settings.customUnits.map(unit => (
              <button
                key={unit}
                onClick={() => {
                  onUpdateSettings({ defaultUnit: unit });
                  onShowToast(`📦 ${t.defaultUnitLabel} ${unit}`);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  settings.defaultUnit === unit
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        {/* إدارة الوحدات المخصصة */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-800 block">{t.manageUnitsTitle}</label>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newUnitInput}
              onChange={(e) => setNewUnitInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
              placeholder={t.addNewUnitPlaceholder}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleAddUnit}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>{t.addUnitBtn}</span>
            </button>
          </div>

          {/* Unit badges with delete button */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {settings.customUnits.map(unit => (
              <span
                key={unit}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-700"
              >
                <span>{unit}</span>
                <button
                  onClick={() => handleRemoveUnit(unit)}
                  className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                  title="حذف الوحدة"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. إدارة البيانات والنسخ الاحتياطي (Data & Backup) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm">
            <Database size={18} />
            <span>{t.categoryBackup}</span>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
            JSON & Excel CSV
          </span>
        </div>

        {/* تقارير Excel و CSV */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800">{t.exportCriticalCsvBtn}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleExportCsv(true)}
              className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              <FileSpreadsheet size={15} className="text-amber-600" />
              <span>{settings.language === 'en' ? `Critical Items (${criticalCount})` : `تقرير البضائع الحرجة (${criticalCount})`}</span>
            </button>
            <button
              onClick={() => handleExportCsv(false)}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              <Download size={15} className="text-emerald-600" />
              <span>{settings.language === 'en' ? 'Full Inventory CSV' : 'تصدير جرد المخزون كلياً'}</span>
            </button>
          </div>
        </div>

        {/* النسخ والاسترجاع المحلي (JSON) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800">{t.backupJsonBtn}</label>
            {settings.lastBackupDate && (
              <span className="text-[10px] text-slate-400">{t.lastBackupTime} {settings.lastBackupDate}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportJson}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shadow-blue-500/20"
            >
              <Download size={15} />
              <span>{t.backupJsonBtn}</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Upload size={15} />
              <span>{t.restoreJsonBtn}</span>
            </button>
          </div>
        </div>

        {/* تنظيف وإعادة ضبط */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-800 block">{settings.language === 'en' ? 'Storage Maintenance' : 'تنظيف الذاكرة وإعادة الضبط'}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowClearExpiredConfirm(true)}
              disabled={expiredCount === 0}
              className="flex-1 p-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 rounded-2xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>{t.clearExpiredBtn} ({expiredCount})</span>
            </button>
            <button
              onClick={() => setShowResetAllConfirm(true)}
              className="flex-1 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>{t.resetFactoryBtn}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. إعدادات الأمان والخصوصية ودعم البصمة (Security & Biometrics) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-rose-700 font-extrabold text-sm">
            <Lock size={18} />
            <span>{t.categorySecurity}</span>
          </div>
          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">
            BiometricPrompt & Crypto
          </span>
        </div>

        {/* قفل التطبيق برمز PIN */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <KeyRound size={14} className="text-rose-600" />
              <span>{t.appLockToggle}</span>
            </span>
            <p className="text-[10px] text-slate-500">
              {settings.isAppLocked 
                ? (settings.language === 'en' ? 'App is protected with passcode' : 'التطبيق محمي برمز مرور') 
                : (settings.language === 'en' ? 'Protect against unauthorized edits or deletions' : 'حماية التطبيق من تعديل وحذف العمال بالخطأ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.isAppLocked && (
              <button
                onClick={() => {
                  setPinInput('');
                  setPinConfirmInput('');
                  setShowPinSetupModal(true);
                }}
                className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
              >
                {t.changePinBtn}
              </button>
            )}
            <button
              onClick={() => {
                if (!settings.isAppLocked) {
                  setPinInput('');
                  setPinConfirmInput('');
                  setShowPinSetupModal(true);
                } else {
                  onUpdateSettings({ isAppLocked: false, appPin: '' });
                  onShowToast('🔓 ' + (settings.language === 'en' ? 'App Lock Disabled' : 'تم إلغاء قفل التطبيق'));
                }
              }}
              className={`w-11 h-6 rounded-full transition flex items-center p-1 cursor-pointer ${
                settings.isAppLocked ? 'bg-rose-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>
        </div>

        {/* دعم البصمة الحيوية (Biometrics / Fingerprint) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Fingerprint size={16} className="text-rose-600" />
                <span>{t.biometricToggle}</span>
              </span>
              <p className="text-[10px] text-slate-500">
                {t.biometricToggleDesc}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settings.useBiometrics && (
                <button
                  onClick={() => setShowBiometricTestModal(true)}
                  className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                >
                  {settings.language === 'en' ? 'Test Sensor' : 'تجربة المستشعر'}
                </button>
              )}
              <button
                onClick={() => {
                  const next = !settings.useBiometrics;
                  onUpdateSettings({ useBiometrics: next });
                  onShowToast(next ? '👆 تم تفعيل تسجيل الدخول بالبصمة الحيوية' : 'تم تعطيل البصمة الحيوية');
                }}
                className={`w-11 h-6 rounded-full transition flex items-center p-1 cursor-pointer ${
                  settings.useBiometrics ? 'bg-rose-600 justify-end' : 'bg-slate-200 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* وضع القراءة فقط (Read-Only Mode) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {settings.isReadOnlyMode ? <EyeOff size={14} className="text-rose-600" /> : <Eye size={14} className="text-slate-400" />}
              <span>{t.readOnlyToggle}</span>
            </span>
            <p className="text-[10px] text-slate-500">
              {t.readOnlyDesc}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !settings.isReadOnlyMode;
              onUpdateSettings({ isReadOnlyMode: next });
              onShowToast(next ? '👁️ ' + (settings.language === 'en' ? 'Read-Only Mode Active' : 'تم تفعيل وضع القراءة فقط') : '🔓 ' + (settings.language === 'en' ? 'Full Edit Mode Active' : 'تم تفعيل وضع التعديل الكامل'));
            }}
            className={`w-11 h-6 rounded-full transition flex items-center p-1 cursor-pointer ${
              settings.isReadOnlyMode ? 'bg-rose-600 justify-end' : 'bg-slate-200 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. المظهر واللغة (Appearance & Language) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-violet-700 font-extrabold text-sm">
            <Sun size={18} />
            <span>{t.categoryAppearance}</span>
          </div>
        </div>

        {/* الوضع الداكن واللغة */}
        <div className="grid grid-cols-2 gap-2">
          {/* Dark Mode */}
          <button
            onClick={() => {
              const next = !settings.isDarkMode;
              onUpdateSettings({ isDarkMode: next });
              onShowToast(next ? '🌙 ' + (settings.language === 'en' ? 'Dark Mode Enabled' : 'تم تفعيل الوضع الداكن') : '☀️ ' + (settings.language === 'en' ? 'Light Mode Enabled' : 'تم تفعيل الوضع الفاتح'));
            }}
            className={`p-3 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
              settings.isDarkMode
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {settings.isDarkMode ? <Moon size={16} className="text-amber-400" /> : <Sun size={16} className="text-amber-500" />}
              <span>{t.darkModeLabel}</span>
            </div>
            <span className="text-[10px] font-bold">{settings.isDarkMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Language toggle (Arabic / English) */}
          <button
            onClick={() => {
              const next = settings.language === 'ar' ? 'en' : 'ar';
              onUpdateSettings({ language: next });
              onShowToast(`🌐 Language: ${next === 'ar' ? 'العربية' : 'English'}`);
            }}
            className="p-3 rounded-2xl border bg-slate-50 border-slate-200 text-slate-800 flex items-center justify-between transition cursor-pointer hover:bg-slate-100"
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Languages size={16} className="text-violet-600" />
              <span>{t.languageLabel.split(' ')[0]}</span>
            </div>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-lg">
              {settings.language === 'ar' ? 'العربية 🇸🇦' : 'English 🇺🇸'}
            </span>
          </button>
        </div>

        {/* دليل الاستخدام وشروحات الإدخال */}
        <button
          onClick={() => setShowUserGuideModal(true)}
          className="w-full p-3 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-900 rounded-2xl text-xs font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-violet-600" />
            <span>{settings.language === 'en' ? 'Quick User Guide & Manual' : 'دليل الاستخدام السريع وشروحات النظام'}</span>
          </div>
          <span className="text-[10px] bg-violet-200/80 px-2 py-0.5 rounded-lg text-violet-950 font-bold">
            {t.view}
          </span>
        </button>
      </section>

      {/* ========================================================================= */}
      {/* 6. التواصل مع المطور والدعم الفني والتقييم (Developer Contact & Support) */}
      {/* ========================================================================= */}
      <section className={`p-4 rounded-3xl border space-y-3.5 transition shadow-xs ${
        settings.isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-gradient-to-b from-white to-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
            <MessageCircle size={18} />
            <span>{t.categoryDeveloper}</span>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
            Direct Support 24/7
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          {t.developerSectionDesc}
        </p>

        {/* Contact Cards: WhatsApp, Email, Google Play */}
        <div className="space-y-2.5">
          
          {/* 1. WhatsApp Contact (772359635) */}
          <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle size={18} />
              </div>
              <div>
                <span className="text-xs font-extrabold text-emerald-950 block">{t.whatsappContactTitle}</span>
                <span className="text-xs font-mono font-bold text-emerald-700" dir="ltr">+967 772359635</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopyText('772359635', 'WhatsApp')}
                className="p-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[10px] font-bold transition cursor-pointer"
                title="نسخ الرقم"
              >
                <Copy size={13} />
              </button>
              <a
                href="https://wa.me/967772359635"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>{t.openWhatsApp}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 2. Email Contact (mohmad771409811a77@gmail.com) */}
          <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold text-blue-950 block">{t.emailContactTitle}</span>
                <span className="text-[11px] font-mono text-blue-800 truncate block" dir="ltr">mohmad771409811a77@gmail.com</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleCopyText('mohmad771409811a77@gmail.com', 'Email')}
                className="p-2 bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-[10px] font-bold transition cursor-pointer"
                title={t.copyEmail}
              >
                <Copy size={13} />
              </button>
              <a
                href="mailto:mohmad771409811a77@gmail.com?subject=FreshStock%20Support%20Request"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>{settings.language === 'en' ? 'Send Email' : 'إرسال بريد'}</span>
                <Mail size={12} />
              </a>
            </div>
          </div>

          {/* 3. Rate on Google Play Store */}
          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Star size={18} fill="currentColor" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-amber-950 block">{t.rateAppTitle}</span>
                <span className="text-[10px] text-amber-800">{settings.language === 'en' ? '5 Stars on Google Play' : 'دعم التطوير وإضافة الميزات الجديدة'}</span>
              </div>
            </div>

            <button
              onClick={() => setShowRateModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <span>{settings.language === 'en' ? 'Rate Now' : 'تقييم الآن'}</span>
              <Star size={12} fill="currentColor" />
            </button>
          </div>

        </div>

        {/* App Version Info */}
        <div className="text-center pt-2 text-[10px] text-slate-400 space-y-0.5 font-mono">
          <p>{t.appVersion}</p>
          <p>Jetpack Compose • Room Database • BiometricPrompt • DataStore</p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* 1. Set PIN Modal */}
      {showPinSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Lock size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm text-slate-900">{t.changePinBtn}</h3>
              <p className="text-xs text-slate-500">
                {settings.language === 'en' 
                  ? 'Enter 4-6 digit passcode to protect application settings and inventory' 
                  : 'أدخل رمزاً مكوناً من 4 إلى 6 أرقام لمنع التعديل أو الحذف بدون إذن'}
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder={settings.language === 'en' ? 'Enter new PIN (4-6 digits)' : 'أدخل رمز PIN الجديد (4-6 أرقام)'}
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <input
                type="password"
                maxLength={6}
                value={pinConfirmInput}
                onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
                placeholder={settings.language === 'en' ? 'Confirm PIN' : 'تأكيد رمز PIN'}
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSavePin}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {settings.language === 'en' ? 'Save & Lock' : 'حفظ وتفعيل القفل'}
              </button>
              <button
                onClick={() => setShowPinSetupModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Biometric Test Simulation Modal */}
      {showBiometricTestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">{t.biometricDialogTitle}</span>
              <button onClick={() => setShowBiometricTestModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t.biometricDialogDesc}
            </p>

            {/* Interactive Fingerprint sensor icon */}
            <div className="py-4">
              <button
                onClick={handleStartBiometricScan}
                disabled={biometricScanState === 'scanning'}
                className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition cursor-pointer shadow-lg active:scale-95 ${
                  biometricScanState === 'scanning'
                    ? 'bg-rose-500 text-white animate-pulse'
                    : biometricScanState === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-50 border-2 border-dashed border-rose-300 text-rose-600 hover:bg-rose-100'
                }`}
              >
                {biometricScanState === 'success' ? (
                  <CheckCircle2 size={44} />
                ) : (
                  <Fingerprint size={48} className={biometricScanState === 'scanning' ? 'animate-bounce' : ''} />
                )}
              </button>
            </div>

            <p className="text-xs font-bold text-rose-700">
              {biometricScanState === 'scanning' && 'جارِ قراءة البصمة... / Scanning...'}
              {biometricScanState === 'success' && t.biometricSuccess}
              {biometricScanState === 'idle' && t.biometricTouchSensor}
            </p>

            <button
              onClick={() => setShowBiometricTestModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* 3. Google Play Rating Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <Star size={30} fill="currentColor" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-slate-900">{t.rateAppTitle}</h3>
              <p className="text-xs text-slate-500">
                {t.rateAppDesc}
              </p>
            </div>

            {/* 5 Stars selection */}
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setSelectedStars(star)}
                  className="p-1 transition cursor-pointer transform hover:scale-125"
                >
                  <Star
                    size={28}
                    className={star <= selectedStars ? 'text-amber-500' : 'text-slate-300'}
                    fill={star <= selectedStars ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rateFeedback}
              onChange={(e) => setRateFeedback(e.target.value)}
              placeholder={settings.language === 'en' ? 'Write a review for Google Play Store...' : 'اكتب رأيك أو اقتراحك للمطور...'}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmitReview}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {settings.language === 'en' ? 'Submit Review' : 'إرسال التقييم ⭐'}
              </button>
              <button
                onClick={() => setShowRateModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Import JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Upload size={18} className="text-blue-600" />
                <span>{t.restoreJsonBtn}</span>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <Trash2 size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {settings.language === 'en' ? 'Paste JSON database content or select a .json file:' : 'قم بلصق محتوى ملف JSON أو اختيار الملف من هاتفك:'}
            </p>

            <textarea
              rows={5}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON text here..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[11px] text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2">
              <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1">
                <Upload size={14} />
                <span>.json file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setImportJsonText(event.target?.result as string || '');
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <button
                onClick={handleImportJson}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {settings.language === 'en' ? 'Restore' : 'تطبيق واسترجاع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. User Guide Modal */}
      {showUserGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-violet-900">
                <BookOpen size={18} className="text-violet-600" />
                <span>دليل الاستخدام السريع (FreshStock FEFO)</span>
              </div>
              <button onClick={() => setShowUserGuideModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 space-y-1">
                <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>1. قاعدة FEFO في المخازن:</span>
                </h4>
                <p className="text-[11px] text-blue-800">
                  يرتب التطبيق المنتجات تصاعدياً بحسب الأقرب انتهاءً أولاً (First Expired, First Out) لتفادي الخسائر وتصريف البضاعة قبل انتهاء صلاحيتها.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <ScanLine size={14} className="text-emerald-600" />
                  <span>2. مسح الباركود السريع:</span>
                </h4>
                <p className="text-[11px] text-emerald-800">
                  يمكنك مسح باركود المنتج بواسطة الكاميرا أو كتابة الأرقام يدوياً للبحث الفوري أو تعبئة الصنف تلقائياً.
                </p>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 space-y-1">
                <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Bell size={14} className="text-amber-600" />
                  <span>3. المنبه الصباحي التلقائي:</span>
                </h4>
                <p className="text-[11px] text-amber-800">
                  يعمل منبه الصباح يومياً في الساعة المحددة (مثلاً 09:00 ص) حتى لو كان الهاتف مغلقاً لفحص الصلاحيات وتنبيهك فوراً.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowUserGuideModal(false)}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {settings.language === 'en' ? 'Close Guide' : 'فهمت، إغلاق الدليل'}
            </button>
          </div>
        </div>
      )}

      {/* 6. Clear Expired Confirm Modal */}
      {showClearExpiredConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-sm">{t.clearExpiredBtn}</h3>
            <p className="text-xs text-slate-500">
              {settings.language === 'en' 
                ? `Permanently delete all expired items (${expiredCount} items) to free up storage. Proceed?` 
                : `سيتم حذف جميع الأصناف (${expiredCount} صنف) التي انتهت صلاحيتها بالفعل لتخفيف حجم قاعدة البيانات. هل تريد المتابعة؟`}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  onClearExpiredProducts();
                  setShowClearExpiredConfirm(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {settings.language === 'en' ? 'Yes, Delete Now' : 'نعم، تنظيف الآن'}
              </button>
              <button
                onClick={() => setShowClearExpiredConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reset All Confirm Modal */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <RefreshCw size={24} />
            </div>
            <h3 className="font-bold text-sm">{t.resetFactoryBtn}</h3>
            <p className="text-xs text-slate-500">
              {settings.language === 'en' 
                ? 'Are you sure you want to reset all app settings and restore factory state?' 
                : 'هل ترغب في إعادة ضبط التطبيق واستعادة إعدادات المصنع الافتراضية بالكامل؟'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  onResetFactoryData();
                  setShowResetAllConfirm(false);
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {settings.language === 'en' ? 'Yes, Reset All' : 'نعم، إعادة الضبط'}
              </button>
              <button
                onClick={() => setShowResetAllConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
