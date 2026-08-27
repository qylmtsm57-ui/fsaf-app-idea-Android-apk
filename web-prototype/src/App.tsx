import React, { useState } from 'react';
import { AndroidSimulator } from './components/AndroidSimulator';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { 
  Smartphone, 
  Code2, 
  Layers, 
  Package
} from 'lucide-react';

type AppTab = 'simulator' | 'code' | 'architecture';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('simulator');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Desktop/Tablet Top Header */}
      <header className="hidden sm:block border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          
          {/* App Title & Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Package size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm text-white tracking-tight">
                  تطبيق أندرويد • FreshStock
                </h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono font-bold px-2 py-0.2 rounded-full border border-blue-500/30">
                  Jetpack Compose & Kotlin
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setCurrentTab('simulator')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'simulator'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Smartphone size={14} />
              <span>شاشة هاتف أندرويد (App)</span>
            </button>

            <button
              onClick={() => setCurrentTab('code')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'code'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 size={14} />
              <span>كود Kotlin</span>
            </button>

            <button
              onClick={() => setCurrentTab('architecture')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'architecture'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers size={14} />
              <span>الهندسة المعمارية (MVVM)</span>
            </button>
          </nav>

        </div>
      </header>

      {/* Main Container - Edge-to-Edge on Mobile Phones */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-0 sm:p-4">
        {currentTab === 'simulator' && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <AndroidSimulator />
          </div>
        )}

        {currentTab === 'code' && (
          <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
            <CodeViewer />
          </div>
        )}

        {currentTab === 'architecture' && (
          <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
            <ArchitectureGuide />
          </div>
        )}
      </main>

      {/* Floating Mode Switcher Button on Mobile if needed */}
      <div className="sm:hidden fixed top-2 right-2 z-50">
        {currentTab !== 'simulator' ? (
          <button
            onClick={() => setCurrentTab('simulator')}
            className="p-2 bg-blue-600 text-white rounded-full shadow-xl text-xs font-bold flex items-center gap-1 border border-blue-400 cursor-pointer"
          >
            <Smartphone size={14} />
            <span>الهاتف</span>
          </button>
        ) : null}
      </div>

    </div>
  );
}
