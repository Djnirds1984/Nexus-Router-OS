
import React, { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'interfaces', label: 'Interfaces', icon: '🕸️' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'devices', label: 'Devices', icon: '💻' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'updates', label: 'Updates', icon: '🐙' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 z-40 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-bold text-xl tracking-tight">Nexus OS</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Toggle (Floating) */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden fixed top-4 left-4 z-[100] p-3 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}

      {isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed top-4 right-4 z-[100] p-3 rounded-full bg-slate-800 text-white border border-slate-700 shadow-lg active:scale-95"
          aria-label="Close menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-[60] bg-slate-900 border-r border-slate-800 ${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col
          transform transition-all duration-300 ease-in-out
          md:translate-x-0 md:static md:inset-auto
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
          ${isDesktopExpanded ? 'md:w-64' : 'md:w-16'}
        `}
        onMouseEnter={() => setIsDesktopExpanded(true)}
        onMouseLeave={() => setIsDesktopExpanded(false)}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              N
            </div>
            {(isMobileMenuOpen || isDesktopExpanded) && (
              <span className="font-bold text-xl tracking-tight">Nexus OS</span>
            )}
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center ${isMobileMenuOpen || isDesktopExpanded ? 'gap-3 px-4' : 'justify-center px-3'} py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              {(isMobileMenuOpen || isDesktopExpanded) && (
                <span className="font-medium">{tab.label}</span>
              )}
            </button>
          ))}
        </nav>
        
        {(isMobileMenuOpen || isDesktopExpanded) && (
          <div className="p-4 mt-auto">
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Status</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-400 uppercase tracking-tight">System Online</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#0B0F1A] pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
