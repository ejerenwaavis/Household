import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar(){
  const loc = useLocation();
  const { language, setLanguage } = useLanguage();
  const active = (path) => loc.pathname === path;

  return (
    <aside className="w-20 bg-white border-r hidden sm:flex flex-col items-center py-6 space-y-6">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">H</div>

      <nav className="flex-1 flex flex-col items-center text-gray-400 space-y-3">
        <Link to="/dashboard" className={`p-2.5 rounded-lg hover:bg-gray-100 hover:text-indigo-600 transition-all ${active('/dashboard') ? 'bg-indigo-100 text-indigo-600' : ''}`} title="Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>
        </Link>

        <Link to="/income" className={`p-2.5 rounded-lg hover:bg-gray-100 hover:text-green-600 transition-all ${active('/income') ? 'bg-green-100 text-green-600' : ''}`} title="Income">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </Link>

        <Link to="/fixed-expenses" className={`p-2.5 rounded-lg hover:bg-gray-100 hover:text-red-600 transition-all ${active('/fixed-expenses') ? 'bg-red-100 text-red-600' : ''}`} title="Fixed Expenses">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </Link>

        <Link to="/expenses" className={`p-2.5 rounded-lg hover:bg-gray-100 hover:text-orange-600 transition-all ${active('/expenses') ? 'bg-orange-100 text-orange-600' : ''}`} title="Variable Expenses">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </Link>
      </nav>

      <div className="w-full flex items-center justify-center gap-1">
        <button
          onClick={() => setLanguage('en')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
            language === 'en'
              ? 'bg-indigo-100 text-indigo-600 font-bold'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="English"
        >
          🇺🇸
        </button>
        <button
          onClick={() => setLanguage('es')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
            language === 'es'
              ? 'bg-indigo-100 text-indigo-600 font-bold'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Español"
        >
          🇪🇸
        </button>
      </div>
    </aside>
  );
}
