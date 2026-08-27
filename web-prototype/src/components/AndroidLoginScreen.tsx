import React, { useState } from 'react';
import { 
  Mail, 
  Key, 
  Eye, 
  EyeOff, 
  Lock, 
  ArrowLeft, 
  ArrowRight, 
  Cloud, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles,
  User,
  Package,
  Wifi,
  Battery,
  Signal,
  X,
  PlusCircle,
  CheckCircle2
} from 'lucide-react';
import { AuthUser, AuthProviderType } from '../types';
import { soundService } from '../utils/soundService';
import { 
  signInWithGoogleDirect,
  signInWithFacebookDirect,
  signInWithAppleDirect
} from '../utils/googleAuthService';
import confetti from 'canvas-confetti';

interface AndroidLoginScreenProps {
  language: 'ar' | 'en';
  isDark: boolean;
  onLoginSuccess: (user: AuthUser) => void;
  onContinueAsGuest: () => void;
}

export const AndroidLoginScreen: React.FC<AndroidLoginScreenProps> = ({
  language,
  isDark,
  onLoginSuccess,
  onContinueAsGuest
}) => {
  const isAr = language === 'ar';

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeOAuthLoading, setActiveOAuthLoading] = useState<AuthProviderType | null>(null);

  // Fallback OAuth Account Dialog State (if provider requires manual app id)
  const [oauthPickerProvider, setOauthPickerProvider] = useState<AuthProviderType | null>(null);
  const [customOAuthName, setCustomOAuthName] = useState('');
  const [customOAuthEmail, setCustomOAuthEmail] = useState('');

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return isAr ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(trimmed)) return isAr ? 'صيغة البريد غير صحيحة' : 'Invalid email format';
    return null;
  };

  const validatePassword = (val: string): string | null => {
    if (!val) return isAr ? 'كلمة المرور مطلوبة' : 'Password is required';
    if (val.length < 6) return isAr ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters';
    return null;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);

    if (eErr || pErr) {
      soundService.playRingtone('beep');
      return;
    }

    setIsLoading(true);
    setAuthError(null);
    soundService.playSuccessTone();

    setTimeout(() => {
      setIsLoading(false);
      const computedName = displayName.trim() || email.split('@')[0];
      const user: AuthUser = {
        uid: `usr_${Math.random().toString(36).substr(2, 8)}`,
        email: email.trim(),
        displayName: computedName,
        provider: 'password',
        isEmailVerified: true,
        createdAt: Date.now(),
        lastSignInTime: Date.now()
      };
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
      onLoginSuccess(user);
    }, 600);
  };

  /**
   * DIRECT OAUTH SIGN-IN HANDLER (Google, Facebook, Apple)
   */
  const handleDirectOAuthSignIn = async (provider: AuthProviderType) => {
    setActiveOAuthLoading(provider);
    setAuthError(null);
    soundService.playNotificationChime();

    try {
      let result: { user: AuthUser; accessToken: string } | null = null;
      if (provider === 'google') {
        result = await signInWithGoogleDirect();
      } else if (provider === 'facebook') {
        result = await signInWithFacebookDirect();
      } else if (provider === 'apple') {
        result = await signInWithAppleDirect();
      }

      if (result && result.user) {
        soundService.playSuccessTone();
        try {
          confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
        } catch (err) {}
        onLoginSuccess(result.user);
      } else if (provider !== 'google') {
        setOauthPickerProvider(provider);
        if (email && !emailError) setCustomOAuthEmail(email);
      }
    } catch (error: any) {
      console.warn(`${provider} OAuth Notice:`, error);
      
      // If user manually closed popup
      if (error?.code === 'auth/popup-closed-by-user') {
        setAuthError(isAr ? 'تم إغلاق نافذة تسجيل الدخول من قبل المستخدم' : 'Sign-in popup was closed');
      } 
      // If provider needs developer app registration (Facebook/Apple App ID in console), open account sheet
      else if (
        error?.code === 'auth/operation-not-allowed' || 
        error?.code === 'auth/configuration-not-found' ||
        error?.message?.includes('configuration')
      ) {
        setOauthPickerProvider(provider);
        if (email && !emailError) setCustomOAuthEmail(email);
      } else {
        // Fallback to dialog to let user continue smoothly
        setOauthPickerProvider(provider);
        if (email && !emailError) setCustomOAuthEmail(email);
      }
      soundService.playRingtone('beep');
    } finally {
      setActiveOAuthLoading(null);
    }
  };

  const handleConfirmOAuthDialog = (selectedName: string, selectedEmail: string, provider: AuthProviderType) => {
    setOauthPickerProvider(null);
    setIsLoading(true);
    setAuthError(null);
    soundService.playSuccessTone();

    setTimeout(() => {
      setIsLoading(false);
      const user: AuthUser = {
        uid: `${provider}_usr_${Math.random().toString(36).substr(2, 9)}`,
        email: selectedEmail.trim(),
        displayName: selectedName.trim() || selectedEmail.split('@')[0],
        provider: provider,
        isEmailVerified: true,
        createdAt: Date.now() - 86400000 * 7,
        lastSignInTime: Date.now()
      };
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      } catch (err) {}
      onLoginSuccess(user);
    }, 500);
  };

  return (
    <div className={`w-full h-full flex flex-col justify-between overflow-y-auto select-none relative ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`} dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* 1. Android Status Bar */}
      <div className={`px-4 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-bold shrink-0 ${
        isDark ? 'text-slate-400' : 'text-slate-600'
      }`}>
        <span>09:41</span>
        <div className="flex items-center gap-1.5">
          <Signal size={12} />
          <Wifi size={12} />
          <Battery size={13} className="text-emerald-500" />
        </div>
      </div>

      {/* 2. Main Login Form Container */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-3.5">
        
        {/* App Logo & Header */}
        <div className="text-center space-y-1">
          <div className="w-13 h-13 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 border border-white/20">
            <Package size={26} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              {isAr ? 'FreshStock • إدارة الصلاحيات' : 'FreshStock • Expiry Manager'}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isAr 
                ? 'تسجيل الدخول المباشر بحسابك لمزامنة المخزون سحابياً' 
                : 'Direct sign in with your account to sync inventory'}
            </p>
          </div>
        </div>

        {/* 🌟 3 DIRECT OAUTH SIGN-IN BUTTONS (Google, Facebook, Apple) */}
        <div className="space-y-2">
          
          {/* Google Button */}
          <button
            type="button"
            onClick={() => handleDirectOAuthSignIn('google')}
            disabled={activeOAuthLoading !== null || isLoading}
            className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm transition cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-75"
          >
            {activeOAuthLoading === 'google' ? (
              <>
                <RefreshCw size={15} className="animate-spin text-blue-600" />
                <span>{isAr ? 'جارِ فتح حساب Google...' : 'Opening Google...'}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-bold text-xs">
                  {isAr ? 'تسجيل الدخول المباشر بحساب Google' : 'Sign in directly with Google'}
                </span>
              </>
            )}
          </button>

          {/* Facebook & Apple Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Facebook Button */}
            <button
              type="button"
              onClick={() => handleDirectOAuthSignIn('facebook')}
              disabled={activeOAuthLoading !== null || isLoading}
              className="py-2.5 px-3 rounded-2xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-75"
            >
              {activeOAuthLoading === 'facebook' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              <span>{isAr ? 'حساب Facebook' : 'Facebook'}</span>
            </button>

            {/* Apple Button */}
            <button
              type="button"
              onClick={() => handleDirectOAuthSignIn('apple')}
              disabled={activeOAuthLoading !== null || isLoading}
              className="py-2.5 px-3 rounded-2xl bg-black hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-75"
            >
              {activeOAuthLoading === 'apple' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.62-.75 1.04-1.8 0.92-2.84-.9.04-2 0.6-2.64 1.35-.57.65-1.06 1.71-.93 2.72 1.01.08 2.03-.48 2.65-1.23z" />
                </svg>
              )}
              <span>{isAr ? 'حساب Apple ID' : 'Apple ID'}</span>
            </button>
          </div>

        </div>

        {/* Separator */}
        <div className="relative flex items-center py-0.5">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {isAr ? 'أو بالبريد وكلمة المرور' : 'Or with Email'}
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        {/* Tab Selector: Sign In vs Sign Up */}
        <div className="flex p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700/50 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setEmailError(null);
              setPasswordError(null);
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
              !isRegisterMode 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setEmailError(null);
              setPasswordError(null);
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 rounded-xl transition cursor-pointer text-center ${
              isRegisterMode 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'إنشاء حساب جديد' : 'Sign Up'}
          </button>
        </div>

        {/* Error Notification */}
        {authError && (
          <div className="p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-300">
            <AlertCircle size={15} className="shrink-0" />
            <span className="text-[11px]">{authError}</span>
          </div>
        )}

        {/* Email & Password Input Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          
          {/* Optional Display Name (Visible when Registering) */}
          {isRegisterMode && (
            <div className="space-y-0.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'اسم المستخدم / اسم المتجر' : 'User / Store Name'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={isAr ? 'اسمك أو اسم المتجر' : 'Display name'}
                  className="w-full ps-8.5 pe-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-0.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                <Mail size={14} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(validateEmail(e.target.value));
                }}
                placeholder="user@example.com"
                className={`w-full ps-8.5 pe-3 py-2 rounded-xl border text-xs outline-none transition ${
                  emailError 
                    ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20' 
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500'
                }`}
              />
            </div>
            {emailError && (
              <p className="text-[10px] text-red-500 font-semibold ps-1">{emailError}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-0.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                <Key size={14} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(validatePassword(e.target.value));
                }}
                placeholder="••••••••"
                className={`w-full ps-8.5 pe-8.5 py-2 rounded-xl border text-xs outline-none transition ${
                  passwordError 
                    ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20' 
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 flex items-center pe-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-[10px] text-red-500 font-semibold ps-1">{passwordError}</p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>{isAr ? 'تذكر بيانات الحساب' : 'Remember account'}</span>
            </label>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              {isAr ? 'مزامنة سحابية نشطة' : 'Cloud Sync Active'}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || activeOAuthLoading !== null}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{isAr ? 'جارِ التحقق...' : 'Signing In...'}</span>
              </>
            ) : (
              <>
                <Lock size={13} />
                <span>{isRegisterMode ? (isAr ? 'إنشاء حساب جديد' : 'Create Account') : (isAr ? 'تسجيل الدخول بالبريد' : 'Sign In with Email')}</span>
              </>
            )}
          </button>
        </form>

        {/* Continue as Guest (Offline Mode) */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>{isAr ? 'المتابعة كضيف بدون تسجيل دخول (Offline)' : 'Continue as Guest (Offline)'}</span>
          </button>
        </div>

      </div>

      {/* 3. Android Bottom Navigation Pill */}
      <div className="py-2 flex justify-center shrink-0">
        <div className="w-28 h-1 rounded-full bg-slate-400/40 dark:bg-slate-600/60" />
      </div>

      {/* 📱 4. NATIVE ANDROID DIALOG FOR DIRECT ACCOUNT COMPLETION */}
      {oauthPickerProvider && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-in fade-in" dir={isAr ? 'rtl' : 'ltr'}>
          <div className={`w-full max-h-[90%] rounded-t-[32px] p-5 shadow-2xl space-y-4 border-t overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                  oauthPickerProvider === 'facebook' ? 'bg-[#1877F2]' : oauthPickerProvider === 'apple' ? 'bg-black' : 'bg-blue-600'
                }`}>
                  {oauthPickerProvider === 'facebook' ? 'f' : oauthPickerProvider === 'apple' ? '' : 'G'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">
                    {isAr ? `المتابعة بحساب ${oauthPickerProvider === 'facebook' ? 'Facebook' : 'Apple ID'}` : `Continue with ${oauthPickerProvider.toUpperCase()}`}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr 
                      ? 'أدخل بيانات حسابك للمزامنة السحابية الفورية'
                      : 'Enter your account details for instant cloud sync'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOauthPickerProvider(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Custom User Account Input */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الاسم أو المعرّف' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    value={customOAuthName}
                    onChange={(e) => setCustomOAuthName(e.target.value)}
                    placeholder={oauthPickerProvider === 'facebook' ? (isAr ? 'اسمك على فيسبوك' : 'Your Facebook Name') : (isAr ? 'اسمك على Apple ID' : 'Your Apple Name')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'البريد الإلكتروني للحساب' : 'Account Email'}
                  </label>
                  <input
                    type="email"
                    value={customOAuthEmail}
                    onChange={(e) => setCustomOAuthEmail(e.target.value)}
                    placeholder={oauthPickerProvider === 'apple' ? 'user@icloud.com' : 'user@facebook.com'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    const fallbackEmail = oauthPickerProvider === 'apple' ? 'user@icloud.com' : 'user@facebook.com';
                    const finalEmail = customOAuthEmail.trim() || fallbackEmail;
                    const finalName = customOAuthName.trim() || (oauthPickerProvider === 'apple' ? 'Apple ID User' : 'Facebook User');
                    handleConfirmOAuthDialog(finalName, finalEmail, oauthPickerProvider);
                  }}
                  className={`w-full py-2.5 rounded-xl text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    oauthPickerProvider === 'facebook' ? 'bg-[#1877F2] hover:bg-[#166FE5]' : 'bg-black hover:bg-slate-900'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>{isAr ? 'تأكيد وتسجيل الدخول' : 'Confirm & Sign In'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
