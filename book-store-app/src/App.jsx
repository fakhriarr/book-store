import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import InventoryPage from './pages/InventoryPage';
import TransactionPage from './pages/TransactionPage';
import ReportPage from './pages/ReportPage';
import Dashboard from './pages/Dashboard';
import BundlePage from './pages/BundlePage';
import TodaySalesPage from './pages/TodaySalesPage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import { House, Package2, ReceiptText, BarChart2, PackageOpen, CalendarCheck, Users, LogOut } from "lucide-react";

// Komponen untuk menyorot link aktif di sidebar
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  const baseClasses = "flex items-center space-x-2 p-2 rounded-lg transition-colors duration-150";
  const activeClasses = "text-primary-crm hover:bg-base-200-crm";
  const inactiveClasses = `
      text-base-content-crm/80 
      focus:outline-none 
      focus:bg-white
      hover:bg-base-200-crm
      active:text-primary-crm
  `;

  return (
      <li>
          <Link to={to} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
              {children}
          </Link>
      </li>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role/access
  if (requiredRole && !canAccess(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Main App Layout with Sidebar
const AppLayout = () => {
  const { user, logout, isOwner } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
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
          
          {/* User Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="border border-green-600 bg-green-50 text-green-700 rounded-lg p-2 ">
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium">{user?.full_name || user?.username}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
              </div>
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
            <Route path="/bundles" element={<BundlePage />} />
            {/* Owner Only Routes */}
            <Route path="/reports" element={
              <ProtectedRoute requiredRole="reports">
                <ReportPage />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute requiredRole="users">
                <UserManagementPage />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
      
      {/* Sidebar / Drawer Content */}
      <div className="drawer-side z-40 p-4">
        <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label> 
        <div className="flex flex-col min-h-full w-64 bg-base rounded-2xl">
          <ul className="menu pl-8 pr-8 pt-4 gap-6 text-text-secondary-crm font-semibold text-base flex-1">
            <li className="menu-title text-base-content-crm text-xs uppercase tracking-wider text-base-content/60 mb-12">Toko Buku Solo</li>
            <NavLink to="/"><House className="w-5 h-5"/>Dashboard</NavLink>
            <NavLink to="/inventory"><Package2 className="w-5 h-5"/>Inventaris</NavLink>
            <NavLink to="/bundles"><PackageOpen className="w-5 h-5"/>Bundle</NavLink>
            <NavLink to="/transaction"><ReceiptText className="w-5 h-5"/>Transaksi</NavLink>
            <NavLink to="/today-sales"><CalendarCheck className="w-5 h-5"/>Penjualan Hari Ini</NavLink>
            {/* Owner Only Menu */}
            {isOwner() && (
              <>
                <NavLink to="/reports"><BarChart2 className="w-5 h-5"/>Laporan</NavLink>
                <NavLink to="/users"><Users className="w-5 h-5"/>Manajemen User</NavLink>
              </>
            )}
          </ul>
          
          {/* Logout Button */}
          <div className="p-4 border-t border-base-200">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 w-full p-2 rounded-lg text-red-600 bg-red-50 border border-red-600 transition-colors duration-150 font-semibold"
            >
              <LogOut className="w-5 h-5"/>
              Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Jika belum login, tampilkan halaman login
  if (!user) {
    return <LoginPage />;
  }

  // Jika sudah login, tampilkan layout utama
  return <AppLayout />;
}

// Wrapper component dengan Router dan AuthProvider
const AppWrapper = () => {
  return (
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  );
};

export default AppWrapper;