# Arttgr / FreshStock Alarm — Android Native Edition

هذه النسخة تضيف مشروع Android Native حقيقي إلى جانب المشروع الأصلي.

## ما تم تجهيزه

- Kotlin + Jetpack Compose + Material 3
- MVVM-friendly structure
- Room database للمنبهات
- AlarmManager مع `setExactAndAllowWhileIdle`
- دعم Exact Alarm permission
- AlarmReceiver
- BootReceiver لإعادة الجدولة بعد إعادة التشغيل
- Full-screen alarm notification
- شاشة رنين مع إيقاف وغفوة
- صوت منبه النظام + اهتزاز
- إشعارات Android 13+
- العربية RTL
- حفظ المنبهات محليًا بدون إنترنت

## بناء APK

افتح مجلد `android` في Android Studio حديث يدعم AGP 8.7.x وKotlin 2.0.x، ثم نفّذ:

`Build > Make Project`

ولـ APK:

`Build > Build Bundle(s) / APK(s) > Build APK(s)`

أو من الطرفية بعد توفر Gradle Wrapper/Gradle:

`gradle :app:assembleDebug`

## ملاحظة مهمة

هذه النسخة هي **نسخة Android Native أولية قابلة للتطوير** وليست شهادة أن APK تم بناؤه واختباره على كل أجهزة الشركات المصنعة.

ينبغي اختبار:
- Android 13 / 14 / 15
- قفل الشاشة
- Doze
- إعادة تشغيل الجهاز
- Exact Alarm permission
- سياسات البطارية الخاصة بالشركة المصنعة
- Full-screen intent
- الصوت في وضع الصامت/عدم الإزعاج

المشروع الأصلي React/Vite محفوظ في المجلد:
`web-prototype/`
