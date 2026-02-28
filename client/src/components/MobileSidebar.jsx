import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function MobileSidebar({ isOpen, onClose }) {
  const loc = useLocation();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const active = (path) => loc.pathname === path;

  const getColorClasses = (color) => {
    const colorMap = {
      indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400',
      green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
      red: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
      orange: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400',
      teal: 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400',
      pink: 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400',
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
      purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
    };
    return colorMap[color] || 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400';
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', color: 'indigo' },
    { path: '/income', label: 'Income', icon: '💰', color: 'green' },
    { path: '/fixed-expenses', label: 'Fixed Expenses', icon: '✅', color: 'red' },
    { path: '/expenses', label: 'Expenses', icon: '🛒', color: 'orange' },
    { path: '/goals', label: 'Goals', icon: '🎯', color: 'teal' },
    { path: '/credit-cards', label: 'Credit Cards', icon: '💳', color: 'pink' },
    { path: '/card-statements', label: 'Statements', icon: '📄', color: 'pink' },
    { path: '/debt-payments', label: 'Debt Payments', icon: '💳', color: 'pink' },
    { path: '/monthly-overview', label: 'Overview', icon: '📈', color: 'blue' },
    { path: '/finance-report', label: 'Finance Meeting', icon: '📑', color: 'indigo' },
    { path: '/members', label: 'Members', icon: '👥', color: 'purple' },
    { path: '/linked-accounts', label: 'Linked Accounts', icon: '🏦', color: 'blue' },
    { path: '/transactions/review', label: 'Review Transactions', icon: '📋', color: 'blue' },
    { path: '/insights', label: 'AI Insights', icon: '🧠', color: 'purple' },
    { path: '/subscription', label: 'Subscription', icon: '⭐', color: 'purple' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black opacity-50 z-40 sm:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">H</div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                active(item.path)
                  ? `${getColorClasses(item.color)} font-medium`
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
          {/* Language Selector */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2 rounded text-sm transition-all ${
                language === 'en'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              🇺🇸
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`flex-1 py-2 rounded text-sm transition-all ${
                language === 'es'
                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              🇪🇸
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full py-2 px-3 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </aside>
    </>
  );
}
