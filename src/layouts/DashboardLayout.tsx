import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Globe,
  Brain,
  Search,
  FileText,
  CalendarDays,
  Timer,
  BarChart3,
  Bell,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  ChevronsUpDown,
} from 'lucide-react';
import { useLanguage } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import DarkModeSwitch from '../components/DarkModeSwitch';
import { sitesActions } from '../stores/sitesStore';

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarCtx = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });
export const useDashboardSidebar = () => useContext(SidebarCtx);

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'overview' as const, end: true },
  { path: '/dashboard/sites', icon: Globe, labelKey: 'sites' as const },
  { path: '/dashboard/analysis', icon: Brain, labelKey: 'analysis' as const },
  { path: '/dashboard/research', icon: Search, labelKey: 'research' as const },
  { path: '/dashboard/articles', icon: FileText, labelKey: 'articles' as const },
  { path: '/dashboard/scheduler', icon: CalendarDays, labelKey: 'scheduler' as const },
  { path: '/dashboard/cron-scheduler', icon: Timer, labelKey: 'cronScheduler' as const },
  { path: '/dashboard/analytics', icon: BarChart3, labelKey: 'analytics' as const },
  { path: '/dashboard/notifications', icon: Bell, labelKey: 'notifications' as const },
  { path: '/dashboard/settings', icon: Settings, labelKey: 'settings' as const },
  { path: '/dashboard/docs', icon: BookOpen, labelKey: 'docs' as const },
];

const dashboardLabels: Record<string, { en: string; ja: string }> = {
  overview: { en: 'Overview', ja: '概要' },
  sites: { en: 'Sites', ja: 'サイト' },
  analysis: { en: 'Analysis', ja: '分析' },
  research: { en: 'Research', ja: 'リサーチ' },
  articles: { en: 'Articles', ja: '記事' },
  scheduler: { en: 'Scheduler', ja: 'スケジューラー' },
  cronScheduler: { en: 'Cron Jobs', ja: 'Cronジョブ' },
  analytics: { en: 'Analytics', ja: 'アナリティクス' },
  notifications: { en: 'Notifications', ja: '通知' },
  settings: { en: 'Settings', ja: '設定' },
  docs: { en: 'Documentation', ja: 'ドキュメント' },
};

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  // Pre-load sites as soon as the dashboard mounts
  useEffect(() => {
    if (!sitesActions.isLoaded() && !sitesActions.isLoading()) {
      sitesActions.loadSites(getToken);
    }
  }, [getToken]);

  // Get current page title
  const currentItem = navItems.find(item => {
    if (item.end) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });
  const pageTitle = currentItem
    ? dashboardLabels[currentItem.labelKey][language]
    : dashboardLabels.overview[language];

  const displayName = user?.firstName || user?.username || 'User';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initials = (user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase();
  const avatarUrl = user?.imageUrl;

  const handleSignOut = () => {
    signOut().then(() => navigate('/'));
  };

  return (
    <SidebarCtx.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-screen bg-rakubun-bg overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${collapsed ? 'w-[68px]' : 'w-[260px]'}
            flex flex-col border-r border-rakubun-border bg-rakubun-surface
            transition-all duration-300 ease-in-out shrink-0
          `}
        >
          {/* Sidebar Header */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-rakubun-border`}>
            {!collapsed && (
              <button onClick={() => navigate('/')} className="flex items-center gap-2 group">
                <span className="font-heading text-xl font-bold text-rakubun-text group-hover:text-rakubun-accent transition-colors">
                  RakuBun
                </span>
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
              title={collapsed ? (language === 'en' ? 'Expand sidebar' : 'サイドバーを展開') : (language === 'en' ? 'Collapse sidebar' : 'サイドバーを折りたたむ')}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Action */}
          <div className={`px-3 pt-4 pb-2 ${collapsed ? 'px-2' : ''}`}>
            <button
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-xl
                bg-rakubun-accent text-white text-sm font-medium
                hover:bg-rakubun-accent/90 transition-all duration-200
                shadow-sm hover:shadow-md
                ${collapsed ? 'justify-center px-0' : ''}
              `}
              onClick={() => navigate('/dashboard/articles?new=true')}
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{language === 'en' ? 'New Article' : '新しい記事'}</span>}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const label = dashboardLabels[item.labelKey][language];
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200 group relative
                    ${isActive
                      ? 'bg-rakubun-accent/8 text-rakubun-accent'
                      : 'text-rakubun-text-secondary hover:bg-rakubun-bg-secondary hover:text-rakubun-text'
                    }
                    ${collapsed ? 'justify-center px-0' : ''}
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-rakubun-accent' : ''}`} />
                      {!collapsed && <span>{label}</span>}
                      {item.labelKey === 'notifications' && (
                        <span className={`
                          ${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'}
                          bg-red-500 text-white text-[10px] font-bold
                          w-5 h-5 flex items-center justify-center rounded-full
                        `}>
                          3
                        </span>
                      )}
                      {collapsed && (
                        <div className="
                          absolute left-full ml-2 px-2.5 py-1 rounded-lg
                          bg-rakubun-text text-white text-xs font-medium
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible
                          transition-all duration-200 whitespace-nowrap z-50
                          pointer-events-none
                        ">
                          {label}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className={`border-t border-rakubun-border p-3 space-y-2 ${collapsed ? 'px-2' : ''}`}>
            {/* Dark mode toggle */}
            <DarkModeSwitch collapsed={collapsed} showLabel />

            {/* Language */}
            {!collapsed && (
              <div className="px-3 py-1">
                <LanguageSwitcher />
              </div>
            )}

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  hover:bg-rakubun-bg-secondary transition-colors cursor-pointer
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rakubun-accent to-blue-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials}
                  </div>
                )}
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-rakubun-text truncate">{displayName}</p>
                      <p className="text-xs text-rakubun-text-secondary truncate">{email}</p>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                  </>
                )}
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-0 right-0'} bottom-full mb-2 bg-rakubun-surface border border-rakubun-border rounded-xl shadow-lg py-1 z-50`}>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {language === 'en' ? 'Sign Out' : 'サインアウト'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar */}
          <header className="h-16 border-b border-rakubun-border bg-rakubun-surface/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-heading font-semibold text-rakubun-text">
                {pageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-rakubun-bg rounded-lg border border-rakubun-border">
                <Search className="w-4 h-4 text-rakubun-text-secondary" />
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Search...' : '検索...'}
                  className="bg-transparent text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 outline-none w-48"
                />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-rakubun-text-secondary bg-rakubun-surface rounded border border-rakubun-border">
                  ⌘K
                </kbd>
              </div>

              {/* Notifications */}
              <button
                onClick={() => navigate('/dashboard/notifications')}
                className="relative p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Avatar */}
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full cursor-pointer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rakubun-accent to-blue-400 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
                  {initials}
                </div>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarCtx.Provider>
  );
}
