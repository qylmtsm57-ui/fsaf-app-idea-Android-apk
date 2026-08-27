# بناء APK من الهاتف باستخدام GitHub Actions

1. ارفع محتويات هذا المشروع إلى مستودع GitHub.
2. افتح تبويب **Actions**.
3. اختر **Build Android APK**.
4. اضغط **Run workflow**.
5. بعد انتهاء البناء افتح التشغيل ثم **Artifacts**.
6. نزّل `Arttgr-alarm-debug-apk` ثم فك الضغط للحصول على `app-debug.apk`.

لا تحتاج إلى كمبيوتر للبناء؛ GitHub Actions يقوم بالبناء على خادمه.

هذه نسخة Debug للتجربة. قبل النشر التجاري يجب إعداد توقيع Release واختبار التطبيق على أجهزة Android فعلية.
