import { Link, useLocation } from 'react-router-dom';

export default function Sidebar(){
  const loc = useLocation();
  const active = (path) => loc.pathname === path;

  return (
    <aside className="w-20 bg-white border-r hidden sm:flex flex-col items-center py-6 space-y-6">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full" />

      <nav className="flex-1 flex flex-col items-center text-gray-500 space-y-4">
        <Link to="/dashboard" className={`p-2 rounded-lg hover:bg-gray-100 ${active('/dashboard') ? 'bg-gray-100' : ''}`} title="Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6h18M3 18h18"/></svg>
        </Link>

        <Link to="/dashboard/income" className={`p-2 rounded-lg hover:bg-gray-100 ${active('/dashboard/income') ? 'bg-gray-100' : ''}`} title="Income">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2z"/></svg>
        </Link>

        <Link to="/dashboard/expenses" className={`p-2 rounded-lg hover:bg-gray-100 ${active('/dashboard/expenses') ? 'bg-gray-100' : ''}`} title="Expenses">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 00-2-2H5l7-7 7 7h-2a2 2 0 00-2 2v6"/></svg>
        </Link>
      </nav>

      <div className="w-full flex items-center justify-center">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-600">v1</div>
      </div>
    </aside>
  );
}
