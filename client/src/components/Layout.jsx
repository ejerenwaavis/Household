import { useState } from 'react';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors">
      <Sidebar />
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col">
        <Topbar onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
