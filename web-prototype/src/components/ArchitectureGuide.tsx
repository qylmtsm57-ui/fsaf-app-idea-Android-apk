import React from 'react';
import { 
  Database, 
  Camera, 
  BellRing, 
  Layers, 
  ShieldCheck, 
  Clock, 
  CheckCircle2,
  Lock,
  Cloud,
  Share2,
  RefreshCw,
  Cpu,
  Smartphone
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6 text-slate-800 max-w-5xl mx-auto p-4 md:p-6" dir="rtl">
      
      {/* Hero Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-800">
            <ShieldCheck size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                هندسة نظام المصادقة وإدارة الخدمات السحابية (Android MVVM)
              </h1>
              <span className="text-[11px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Kotlin & Compose
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              مبني بنسبة 100% وفق أحدث إرشادات Modern Android Architecture باستخدام Jetpack Compose و StateFlow و Firebase Auth و OAuth
            </p>
          </div>
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Pillar 1: AuthViewModel & StateFlow */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <Cpu size={22} />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">1. نمط MVVM & تدفق الحالة (StateFlow)</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            يعتمد <code className="text-blue-700 dark:text-blue-300 mx-1 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">AuthViewModel</code> على تدفقات StateFlow أحادية الاتجاه (UDF) لفصل منطق الأعمال والتحقق من المدخلات تماماً عن واجهة Compose:
          </p>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1" dir="ltr">
            <div>val authState: StateFlow&lt;AuthState&gt; = _authState.asStateFlow()</div>
            <div className="text-cyan-400">val cloudServicesState: StateFlow&lt;CloudServicesState&gt;</div>
            <div className="text-amber-400">val loginFormState: StateFlow&lt;LoginFormState&gt;</div>
          </div>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>فصل الحالات: <code className="text-blue-600 dark:text-blue-400">Idle, Loading, Success(AuthUser), Error(msg)</code>.</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>تحقق فوري من البريد وكلمة المرور دون إعادة بناء الشاشة بالكامل.</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2: Firebase Auth & OAuth Direct Sign-In */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <Lock size={22} />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">2. المصادقة السحابية و OAuth (Google / Facebook / Apple)</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            يدعم النظام التسجيل بالبريد وكلمة المرور مع إمكانية إظهار/إخفاء كلمة المرور، بالإضافة لبطاقات OAuth السريعة:
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-100 font-bold">
              <span>المزوّدات المدعومة (OAuth Providers):</span>
            </div>
            <div className="text-slate-600 dark:text-slate-300 text-[11px] space-y-1">
              <div>🔹 <strong>Google Sign-In:</strong> عبر GoogleAuthProvider و ID Token.</div>
              <div>🔹 <strong>Facebook Login:</strong> عبر FacebookAuthProvider و AccessToken.</div>
              <div>🔹 <strong>Apple ID:</strong> عبر OAuthProvider.newBuilder("apple.com") و RawNonce.</div>
            </div>
          </div>
        </div>

        {/* Pillar 3: Cloud Services Control Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <Cloud size={22} />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">3. لوحة التحكم بالخدمات والمزامنة السحابية</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            مفاتيح تحكم تفاعلية (Switches) في واجهة Compose تمكن التاجر من إدارة الخدمات السحابية بشكل مستقل:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-2.5 rounded-xl text-blue-800 dark:text-blue-300">
              <div>Google Drive Sync</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">نسخ احتياطي لقاعدة البيانات</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl text-emerald-800 dark:text-emerald-300">
              <div>Google Calendar</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">جدولة منبهات الصلاحية</div>
            </div>
            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-2.5 rounded-xl text-sky-800 dark:text-sky-300">
              <div>iCloud Backup</div>
              <div className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">مزامنة للأجهزة المتعددة</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-2.5 rounded-xl text-indigo-800 dark:text-indigo-300">
              <div>Facebook Catalog</div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">تصدير كتالوج المتجر</div>
            </div>
          </div>
        </div>

        {/* Pillar 4: Jetpack Compose & Background Sync */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <RefreshCw size={22} />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">4. واجهة Jetpack Compose & المزامنة بالخلفية</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            تم بناء <code className="text-blue-700 dark:text-blue-300 mx-1 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">AuthAndCloudScreen</code> بـ Material 3 مع دعم كامل للمزامنة في الخلفية عبر <code className="text-blue-700 dark:text-blue-300">WorkManager</code>:
          </p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <span>مؤشرات تقدم حية (CircularProgressIndicator) وحالات الخطأ.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <span>لوحة معلومات المستخدم (User Dashboard) مع عرض الاسم والبريد والمزوّد.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <span>زر مزامنة فورية لكل خدمة سحابية على حدة.</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Dependencies & Gradle Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Layers size={18} className="text-blue-600" />
          <span>المكتبات والتبعيات المعتمدة في build.gradle.kts:</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-slate-900 dark:text-white font-bold">Firebase Auth BOM</div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">firebase-bom:33.1.2, firebase-auth-ktx</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-slate-900 dark:text-white font-bold">OAuth & Play Services</div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">play-services-auth, facebook-android-sdk</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-slate-900 dark:text-white font-bold">Jetpack Compose Material 3</div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">lifecycle-viewmodel-compose, material3, icons</div>
          </div>
        </div>
      </div>

    </div>
  );
};
