import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import InventoryPage from './pages/InventoryPage';
import TransactionPage from './pages/TransactionPage';
import ReportPage from './pages/ReportPage';
import Dashboard from './pages/Dashboard';
import BundlePage from './pages/BundlePage';
import TodaySalesPage from './pages/TodaySalesPage';
import { House, Package2, ReceiptText, BarChart2, PackageOpen, CalendarCheck } from "lucide-react";

// Komponen untuk mengganti tema (Opsional, tergantung konfigurasi daisyUI)
const ThemeController = () => {
    const defaultTheme = "light"; // Atur tema default

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') || defaultTheme;
        document.documentElement.setAttribute('data-theme', storedTheme);
    }, []);

    const handleThemeChange = (e) => {
        const newTheme = e.target.value;
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return (
        <select 
            className="select select-sm select-neutral pl-4 pr-10 border" 
            defaultValue={defaultTheme}
            onChange={handleThemeChange}
        >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    );
};

// Komponen untuk menyorot link aktif di sidebar
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  // Class dasar yang diterapkan ke semua tautan (untuk padding dan transisi)
  const baseClasses = "flex items-center space-x-2 p-2 rounded-lg transition-colors duration-150";
  
  // Class Aktif (Ungu Solid)
  const activeClasses = "text-primary-crm hover:bg-base-200-crm";
  
  // Class Non-Aktif: Mengatur warna normal, hover, dan menimpa warna hitam pada :active
  const inactiveClasses = `
      text-base-content-crm/80 
      focus:outline-none 
      focus:bg-white
      hover:bg-base-200-crm
      active:text-primary-crm
  `;

  return (
      <li>
          {/* Terapkan baseClasses + (activeClasses ATAU inactiveClasses) */}
          <Link to={to} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
              {children}
          </Link>
      </li>
  );
};

function App() {
  return (
    <Router>
      <div className="drawer bg-base-100-crm lg:drawer-open">
        <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
        
        {/* Konten Halaman Utama (Main Content) */}
        <div className="drawer-content flex flex-col min-h-screen">
          {/* Navbar */}
          <div className="navbar bg-base-100 sticky top-0 z-30">
            <div className="flex-none lg:hidden">
              <label htmlFor="my-drawer-2" className="btn btn-ghost btn-square">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
              </label>
            </div>
            <div className="flex-1">
              <Link to="/" className="font-extrabold tracking-tight text-xl text-primary"></Link>
            </div>
            {/* <div className="flex-none gap-2 p-2 cursor-pointer">
              <ThemeController />
            </div>   */}
            <div className="avatar placeholder p-2">
              <div className="bg-neutral text-neutral-content rounded-full w-8">
                <span>BS</span>
              </div>
            </div>
          </div>

          {/* Konten Halaman yang Berubah */}
          <main className="flex-grow border border-base-300-crm w-full rounded-tl-3xl px-4 py-6 lg:px-8 bg-base-200-crm">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/transaction" element={<TransactionPage />} />
              <Route path="/today-sales" element={<TodaySalesPage />} />
              <Route path="/reports" element={<ReportPage />} />
              <Route path="/bundles" element={<BundlePage />} />
            </Routes>
          </main>
        </div>
        
        {/* Sidebar / Drawer Content */}
        <div className="drawer-side z-40 p-4">
          <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label> 
          <ul className="menu pl-8 pr-8 pt-4 w-64 min-h-full bg-base rounded-2xl gap-6 text-text-secondary-crm font-semibold text-base">
            <li className="menu-title text-base-content-crm text-xs uppercase tracking-wider text-base-content/60 mb-12">Toko Buku Solo</li>
            <NavLink to="/"><House className="w-5 h-5"/>Dashboard</NavLink>
            <NavLink to="/inventory"><Package2 className="w-5 h-5"/>Inventaris</NavLink>
            <NavLink to="/bundles"><PackageOpen className="w-5 h-5"/>Bundle</NavLink>
            <NavLink to="/transaction"><ReceiptText className="w-5 h-5"/>Transaksi</NavLink>
            <NavLink to="/today-sales"><CalendarCheck className="w-5 h-5"/>Penjualan Hari Ini</NavLink>
            <NavLink to="/reports"><BarChart2 className="w-5 h-5"/>Laporan</NavLink>
          </ul>
        </div>
      </div>
    </Router>
  );
}

export default App;