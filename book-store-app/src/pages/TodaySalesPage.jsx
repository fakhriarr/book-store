// src/pages/TodaySalesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingCart, TrendingUp, Package, DollarSign, Clock, Users, RotateCw } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Util
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const TodaySalesPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [bundleTransactions, setBundleTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get today's date in YYYY-MM-DD format
  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's transactions
  const fetchTodayTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookRes, bundleRes] = await Promise.all([
        axios.get(`${API_URL}/transactions`, { 
          params: { type: 'OUT', startDate: today, endDate: today } 
        }),
        axios.get(`${API_URL}/transactions/bundles/list`, { 
          params: { startDate: today, endDate: today } 
        })
      ]);
      setTransactions(bookRes.data || []);
      setBundleTransactions(bundleRes.data || []);
    } catch (err) {
      console.error('Error fetching today transactions:', err);
      setError('Gagal memuat data penjualan hari ini.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayTransactions();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchTodayTransactions, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const bookTotal = transactions.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const bundleTotal = bundleTransactions.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const totalRevenue = bookTotal + bundleTotal;
    
    const bookCount = transactions.length;
    const bundleCount = bundleTransactions.length;
    const totalTransactions = bookCount + bundleCount;

    const bookQty = transactions.reduce((sum, t) => {
      const qty = String(t.quantity || '0');
      if (qty.includes(',')) {
        return sum + qty.split(',').reduce((s, q) => s + Number(q.trim()), 0);
      }
      return sum + Number(qty);
    }, 0);
    const bundleQty = bundleTransactions.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const totalItems = bookQty + bundleQty;

    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Get unique customers
    const customers = new Set([
      ...transactions.filter(t => t.customerName).map(t => t.customerName),
      ...bundleTransactions.filter(t => t.customerName).map(t => t.customerName)
    ]);

    return {
      totalRevenue,
      bookTotal,
      bundleTotal,
      totalTransactions,
      bookCount,
      bundleCount,
      totalItems,
      avgTransaction,
      uniqueCustomers: customers.size
    };
  }, [transactions, bundleTransactions]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const methods = {};
    const allTransactions = [...transactions, ...bundleTransactions];
    
    allTransactions.forEach(t => {
      const method = t.payment_method || 'cash';
      const methodLabel = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' }[method] || method;
      if (!methods[methodLabel]) {
        methods[methodLabel] = { count: 0, revenue: 0 };
      }
      methods[methodLabel].count += 1;
      methods[methodLabel].revenue += Number(t.total || 0);
    });
    
    return Object.entries(methods).map(([name, data]) => ({
      name,
      value: data.revenue,
      count: data.count
    }));
  }, [transactions, bundleTransactions]);

  // Hourly sales breakdown
  const hourlySales = useMemo(() => {
    const hours = {};
    const allTransactions = [...transactions, ...bundleTransactions];
    
    allTransactions.forEach(t => {
      const hour = new Date(t.date).getHours();
      if (!hours[hour]) {
        hours[hour] = { count: 0, revenue: 0 };
      }
      hours[hour].count += 1;
      hours[hour].revenue += Number(t.total || 0);
    });

    // Create array for all hours (7-22)
    return Array.from({ length: 16 }, (_, i) => {
      const hour = i + 7;
      const data = hours[hour] || { count: 0, revenue: 0 };
      return {
        hour: `${hour}:00`,
        Transaksi: data.count,
        Omzet: data.revenue
      };
    });
  }, [transactions, bundleTransactions]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-2">Memuat data penjualan hari ini...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto w-full">
        <div className="alert alert-error shadow-lg">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={fetchTodayTransactions}>Coba Lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-bold">Penjualan Hari Ini</h2>
          <p className="text-black mt-4 border rounded-lg px-3 py-1 bg-white">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold text-primary">
            {currentTime.toLocaleTimeString('id-ID')}
          </div>
          <button 
            className="btn btn-sm btn-ghost mt-4 border rounded-lg px-4 py-1 bg-white"
            onClick={fetchTodayTransactions}
          >
            <RotateCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
          <div className="stat-figure text-primary">
            <DollarSign className="w-8 h-8" />
          </div>
          <div className="stat-title">Total Omzet</div>
          <div className="stat-value text-primary text-2xl">{formatRupiah(summary.totalRevenue)}</div>
          <div className="stat-desc">Hari ini</div>
        </div>
        
        <div className="stat bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20">
          <div className="stat-figure text-green-600">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div className="stat-title">Total Transaksi</div>
          <div className="stat-value text-green-600 text-2xl">{summary.totalTransactions}</div>
          <div className="stat-desc">{summary.bookCount} buku, {summary.bundleCount} bundle</div>
        </div>
        
        <div className="stat bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-500/20">
          <div className="stat-figure text-purple-600">
            <Package className="w-8 h-8" />
          </div>
          <div className="stat-title">Total Item Terjual</div>
          <div className="stat-value text-purple-600 text-2xl">{summary.totalItems}</div>
          <div className="stat-desc">item</div>
        </div>
        
        <div className="stat bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border border-orange-500/20">
          <div className="stat-figure text-orange-600">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div className="stat-title">Rata-rata Transaksi</div>
          <div className="stat-value text-orange-600 text-2xl">{formatRupiah(summary.avgTransaction)}</div>
          <div className="stat-desc">per transaksi</div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="stat bg-blue-50 rounded-xl border border-blue-200">
          <div className="stat-title text-blue-700">Penjualan Buku</div>
          <div className="stat-value text-blue-600">{formatRupiah(summary.bookTotal)}</div>
          <div className="stat-desc text-blue-600">{summary.bookCount} transaksi</div>
        </div>
        <div className="stat bg-purple-50 rounded-xl border border-purple-200">
          <div className="stat-title text-purple-700">Penjualan Bundle</div>
          <div className="stat-value text-purple-600">{formatRupiah(summary.bundleTotal)}</div>
          <div className="stat-desc text-purple-600">{summary.bundleCount} transaksi</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Hourly Sales Chart */}
        <div className="bg-base-100 p-6 rounded-xl border border-base-200">
          <h3 className="text-xl font-semibold mb-1">Penjualan per Jam</h3>
          <p className="text-xs text-base-content/60 mb-4">Jumlah transaksi dan omzet per jam hari ini</p>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={hourlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Omzet') return [formatRupiah(value), 'Omzet'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Transaksi" fill="#3B82F6" />
                <Bar yAxisId="right" dataKey="Omzet" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-base-100 p-6 rounded-xl border border-base-200">
          <h3 className="text-xl font-semibold mb-1">Metode Pembayaran</h3>
          <p className="text-xs text-base-content/60 mb-4">Distribusi omzet berdasarkan metode pembayaran</p>
          <div style={{ width: '100%', height: 300 }}>
            {paymentBreakdown.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie 
                    data={paymentBreakdown} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100} 
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {paymentBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatRupiah(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-base-content/60">
                Belum ada transaksi hari ini
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Book Transactions */}
        <div className="bg-base-100 p-6 rounded-xl border border-base-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Transaksi Buku Terbaru</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {transactions.length} transaksi
            </span>
          </div>
          <div className="overflow-x-auto max-h-80">
            {transactions.length > 0 ? (
              <table className="table table-zebra table-sm w-full">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th>Waktu</th>
                    <th>Judul</th>
                    <th>Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((t, idx) => (
                    <tr key={idx}>
                      <td className="text-xs">{new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="max-w-[150px] truncate text-sm" title={t.title}>{t.title}</td>
                      <td>{t.quantity}</td>
                      <td className="text-right font-medium">{formatRupiah(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                Belum ada transaksi buku hari ini
              </div>
            )}
          </div>
        </div>

        {/* Bundle Transactions */}
        <div className="bg-base-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Transaksi Bundle Terbaru</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              {bundleTransactions.length} transaksi
            </span>
          </div>
          <div className="overflow-x-auto max-h-80">
            {bundleTransactions.length > 0 ? (
              <table className="table table-zebra table-sm w-full">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th>Waktu</th>
                    <th>Bundle</th>
                    <th>Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleTransactions.slice(0, 10).map((t, idx) => (
                    <tr key={idx} className="bg-purple-50/50">
                      <td className="text-xs">{new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="max-w-[150px] truncate text-sm" title={t.bundle_name}>{t.bundle_name}</td>
                      <td>{t.quantity}</td>
                      <td className="text-right font-medium text-purple-700">{formatRupiah(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                Belum ada transaksi bundle hari ini
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodaySalesPage;
