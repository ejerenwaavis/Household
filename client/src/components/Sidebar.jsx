import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const Divider = () => (
  <div className="w-8 border-t border-gray-200 dark:border-gray-600/60 my-0.5 flex-shrink-0" />
);

export default function Sidebar(){
  const loc = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const active = (path) => loc.pathname === path;

  const navRef = useRef(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    check();
    el.addEventListener('scroll', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, []);

  const navLink = (to, title, color, icon) => (
    <Link
      to={to}
      title={title}
      className={`p-2.5 rounded-lg transition-all flex-shrink-0
        hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-${color}-600 dark:hover:text-${color}-400
        ${active(to) ? `bg-${color}-100 dark:bg-${color}-900 text-${color}-600 dark:text-${color}-400` : 'text-gray-400 dark:text-gray-500'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icon}
      </svg>
    </Link>
  );

  return (
    <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden sm:flex flex-col items-center h-screen sticky top-0 pt-6 pb-4 transition-colors">

      {/* Logo */}
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mb-4">H</div>

      {/* Nav — scrollable, fills remaining space */}
      <div className="relative flex-1 w-full min-h-0">
      <nav ref={navRef} className="h-full w-full flex flex-col items-center overflow-y-auto overflow-x-hidden px-0 gap-1
        [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >

        {/* Overview */}
        {navLink('/dashboard', 'Dashboard', 'indigo',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/>
        )}

        <Divider />

        {/* Finances */}
        {navLink('/income', 'Income', 'green',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        )}
        {navLink('/fixed-expenses', 'Fixed Expenses', 'red',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        )}
        {navLink('/expenses', 'Variable Expenses', 'orange',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        )}
        {navLink('/goals', 'Goals & Funds', 'teal',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        )}

        <Divider />

        {/* Credit & Debt */}
        {navLink('/credit-cards', 'Credit Cards', 'pink',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        )}
        {navLink('/card-statements', 'Card Statements', 'pink',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        )}
        {navLink('/debt-payments', 'Debt Payments', 'pink',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
        )}
        {navLink('/monthly-overview', 'Monthly Overview', 'blue',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        )}
        {navLink('/finance-report', 'Finance Meeting Report', 'indigo',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        )}

        <Divider />

        {/* Connections & Data */}
        {navLink('/members', 'Members', 'purple',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        )}
        {navLink('/linked-accounts', 'Linked Accounts', 'blue',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/>
        )}
        {navLink('/transactions/review', 'Review Transactions', 'blue',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
        )}

        <Divider />

        {/* Tools */}
        {navLink('/insights', 'AI Insights', 'purple',
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        )}
        <Link
          to="/subscription"
          title="Subscription"
          className={`p-2.5 rounded-lg transition-all flex-shrink-0
            hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-600 dark:hover:text-yellow-400
            ${active('/subscription') || active('/pricing') ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
          </svg>
        </Link>

      </nav>

      {/* Scroll-down hint arrow */}
      {canScrollDown && (
        <button
          onClick={() => navRef.current?.scrollBy({ top: 80, behavior: 'smooth' })}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow text-gray-400 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 transition-all z-10"
          title="More items below"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      </div>

      {/* Bottom controls — always pinned to bottom */}
      <div className="flex-shrink-0 w-full flex flex-col items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">

        {/* Single language toggle: shows the OTHER language to switch to */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          title={language === 'en' ? 'Switch to Español' : 'Switch to English'}
        >
          {language === 'en' ? '🇪🇸' : '🇺🇸'}
        </button>

        {/* Settings */}
        <Link
          to="/settings/profile"
          className={`w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center
            ${active('/settings/profile') ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
          title="Account Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all flex items-center justify-center"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition-all flex items-center justify-center"
          title="Logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>

      </div>
    </aside>
  );
}

