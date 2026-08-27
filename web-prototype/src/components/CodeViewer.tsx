import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  FolderTree, 
  Layers, 
  Code, 
  ExternalLink,
  Sparkles,
  Search
} from 'lucide-react';
import { KOTLIN_FILES } from '../data/kotlinCode';
import { KotlinFile } from '../types';
import JSZip from 'jszip';

export const CodeViewer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>(KOTLIN_FILES[0].id);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isZipping, setIsZipping] = useState(false);

  const selectedFile = KOTLIN_FILES.find(f => f.id === selectedFileId) || KOTLIN_FILES[0];

  const categories = ['All', 'Auth & Cloud Services', 'Jetpack Compose UI', 'Room Database', 'WorkManager & Logic', 'CameraX & ML Kit', 'Gradle & Manifest'];

  const filteredFiles = KOTLIN_FILES.filter(f => {
    const matchesCat = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      // Add all files
      KOTLIN_FILES.forEach(file => {
        zip.file(file.filePath, file.code);
      });

      // Add a README.md explaining the setup
      zip.file('README.md', `# نظام إدارة صلاحية البضائع (FEFO) - Android Kotlin & Jetpack Compose

## المميزات الرئيسية
1. **Room Database (Offline 100%)**:
   - كيان \`Product\` مع فهرسة الباركود وتاريخ الصلاحية.
   - \`ProductDao\` مع Flow واستعلامات FEFO (First Expired, First Out).
   - \`AppDatabase\` بنمط Singleton وقاعدة بيانات محلية سريعة.

2. **CameraX & Google ML Kit**:
   - مسح الباركود بالكاميرا بدقة عالية.
   - منطق التعبئة التلقائية للبيانات الأساسية (الاسم، الوحدة، الأسعار) عند مسح كود مسجل مسبقاً.

3. **Jetpack Compose UI**:
   - \`HomeScreen\`: بطاقات إحصائيات، بحث مباشر بالاسم والباركود، شريط تنازلي ملون.
   - \`AddProductScreen\`: نموذج إدخال متكامل، DatePicker للتواريخ، أزرار "حفظ" و "حفظ وإضافة منتج آخر".

4. **Expiry Logic & Daily WorkManager Notifications**:
   - حساب الأيام المتبقية وتلوين البطاقات:
     - > 30 يوماً ◄ Color.Green
     - بين 8 و 30 يوماً ◄ Color(0xFFFFA000) (أصفر/برتقالي)
     - < 7 أيام أو منتهي ◄ Color.Red
   - \`ExpiryNotificationWorker\`: فحص يومي وإرسال إشعار للمنتجات الحرجة المتبقي لها أقل من 7 أيام.
`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GoodsExpiryManager_Android_Kotlin.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to create ZIP', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" dir="rtl">
      
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
            <FileCode size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">أكواد Kotlin و Jetpack Compose الجاهزة</h2>
            <p className="text-xs text-slate-500">ملفات معمارية نقية 100% جاهزة للنسخ أو التضمين المباشر في Android Studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="download-zip-btn"
            onClick={handleDownloadAllZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isZipping ? 'جاري التحزيم...' : 'تحميل المشروع بالكامل (ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Main split view */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar: File List */}
        <div className="w-full md:w-80 bg-slate-50 border-l border-slate-200 flex flex-col overflow-hidden">
          
          {/* Search and Category Filter */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو الفئة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
              <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer font-medium ${
                    selectedCategory === cat 
                      ? 'bg-slate-800 text-white font-bold' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'All' ? 'الكل' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* File list items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFiles.map((file) => {
              const isSelected = file.id === selectedFileId;
              return (
                <button
                  key={file.id}
                  id={`file-tab-${file.id}`}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-right p-2.5 rounded-xl transition flex flex-col gap-1 cursor-pointer border ${
                    isSelected 
                      ? 'bg-white border-blue-500 text-slate-900 shadow-sm ring-1 ring-blue-500/20' 
                      : 'bg-transparent border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs font-mono text-blue-700">{file.fileName}</span>
                    <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                      {file.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{file.description}</p>
                </button>
              );
            })}
          </div>

        </div>

        {/* Code Content View */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          
          {/* File header bar */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-blue-400">{selectedFile.fileName}</span>
                <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-md font-semibold">
                  {selectedFile.category}
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 block mt-0.5" dir="ltr">
                {selectedFile.filePath}
              </span>
            </div>

            <button
              id="copy-code-btn"
              onClick={handleCopyCode}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                copied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>

          {/* Description banner */}
          <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400 shrink-0" />
            <span>{selectedFile.description}</span>
          </div>

          {/* Code display with line numbers */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-200 bg-slate-950 leading-relaxed" dir="ltr">
            <pre className="whitespace-pre">
              <code>{selectedFile.code}</code>
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
};
