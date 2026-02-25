import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar(){
  const loc = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const active = (path) => loc.pathname === path;

  return (
    <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden sm:flex flex-col items-center py-6 space-y-6 transition-colors">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">H</div>

      <nav className="flex-1 flex flex-col items-center text-gray-400 dark:text-gray-500 space-y-3">
        <Link to="/dashboard" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all ${active('/dashboard') ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' : ''}`} title="Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>
        </Link>

        <Link to="/income" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-green-600 dark:hover:text-green-400 transition-all ${active('/income') ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : ''}`} title="Income">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </Link>

        <Link to="/fixed-expenses" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-all ${active('/fixed-expenses') ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' : ''}`} title="Fixed Expenses">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </Link>

        <Link to="/expenses" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-orange-600 dark:hover:text-orange-400 transition-all ${active('/expenses') ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400' : ''}`} title="Variable Expenses">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </Link>

        <Link to="/goals" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-teal-600 dark:hover:text-teal-400 transition-all ${active('/goals') ? 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400' : ''}`} title="Goals & Funds">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </Link>

        <Link to="/credit-cards" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-pink-600 dark:hover:text-pink-400 transition-all ${active('/credit-cards') ? 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400' : ''}`} title="Credit Cards">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
        </Link>

        <Link to="/card-statements" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-pink-600 dark:hover:text-pink-400 transition-all ${active('/card-statements') ? 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400' : ''}`} title="Card Statements">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </Link>

        <Link to="/debt-payments" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-pink-600 dark:hover:text-pink-400 transition-all ${active('/debt-payments') ? 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400' : ''}`} title="Debt Payments">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </Link>

        <Link to="/monthly-overview" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all ${active('/monthly-overview') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Monthly Overview">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </Link>

        <Link to="/members" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400 transition-all ${active('/members') ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400' : ''}`} title="Members">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </Link>

        <Link to="/linked-accounts" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all ${active('/linked-accounts') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Linked Accounts">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
        </Link>

        <Link to="/transactions/review" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all ${active('/transactions/review') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Review Transactions">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        </Link>

        <Link to="/insights" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400 transition-all ${active('/insights') ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400' : ''}`} title="AI Insights">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        </Link>

        <Link to="/subscription" className={`p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-600 dark:hover:text-yellow-400 transition-all ${active('/subscription') || active('/pricing') ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400' : ''}`} title="Subscription">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
        </Link>
      </nav>

      <div className="w-full flex flex-col items-center justify-center gap-3">
        {/* Language Selector */}
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setLanguage('en')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
              language === 'en'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="English"
          >
            🇺🇸
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
              language === 'es'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="Español"
          >
            🇪🇸
          </button>
        </div>

        {/* Settings / Profile */}
        <Link
          to="/settings/profile"
          className={`w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center justify-center ${active('/settings/profile') ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
          title="Account Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all flex items-center justify-center cursor-pointer"
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

        {/* Logout Button */}
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition-all flex items-center justify-center cursor-pointer"
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
