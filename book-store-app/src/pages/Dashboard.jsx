import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { PackageOpen, CircleAlert, ShoppingBag, BanknoteArrowDown, TrendingUp } from "lucide-react";

const API_DASHBOARD_URL = 'http://localhost:5000/api/dashboard/metrics';
const API_REPORT_URL = 'http://localhost:5000/api/reports';

// Utility function untuk format Rupiah
const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Tentukan apakah ini Pie Chart (payload tidak memiliki label tanggal)
        const isPieChart = !label; 
        
        return (
            // Gunakan class Tailwind kustom untuk styling Tooltip
            <div className="bg-base-100-crm/90 p-3 border border-base-300-crm shadow-soft-lg rounded-lg text-sm backdrop-blur-sm">
                
                {/* Judul: Tanggal (untuk Line Chart) atau Kategori (untuk Pie Chart) */}
                {isPieChart ? (
                    <p className="text-base-content-crm font-semibold mb-1">
                        Kategori: {payload[0].name}
                    </p>
                ) : (
                    <p className="text-base-content-crm font-semibold mb-1">
                        Tanggal: {new Date(label).toLocaleDateString('id-ID')}
                    </p>
                )}
                
                {/* Nilai */}
                {payload.map((entry, index) => (
                    <p key={`item-${index}`} className="text-primary-crm">
                        {isPieChart ? 'Omzet' : 'Pendapatan'}: <span className="font-bold">{formatRupiah(entry.value)}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const StatCard = ({ title, value, unit, isWarning = false, icon: Icon, linkTo, buttonText }) => (
    <div className="relative card bg-base-100 border rounded-2xl border-base-200 p-5 hover:shadow-lg transition-all duration-300">
      {/* Ikon di kanan atas */}
      {Icon && (
        <div className="absolute top-4 right-4 bg-primary/10 p-3 rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      )}
  
      {/* Isi teks utama */}
      <div className="flex flex-col justify-end h-full p-2">
        <span className="text-sm text-base-content/60 mb-2">{title}</span>
        <div
          className={`text-2xl font-bold mt-2 ${
            isWarning && value > 0 ? "text-error" : "text-primary"
          }`}
        >
          {unit === "Rp" ? formatRupiah(value) : value.toLocaleString("id-ID")}
        </div>
        {linkTo && buttonText && (
            <Link to={linkTo} className="btn absolute btn-sm top-5 right-6 rounded-lg bg-error text-white hover:bg-red-600 border-none">
                {buttonText}
            </Link>
        )}
      </div>
    </div>
  );
  

// Komponen Line Chart Tren Penjualan
const SalesTrendChart = ({ data }) => {
    // Hanya tampilkan 7 data terakhir di sumbu X jika terlalu banyak
    const formatXAxis = (tickItem) => {
        const date = new Date(tickItem);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="card bg-base-100 rounded-2xl p-6">
            <h3 className="text-md font-bold mb-4">Tren Penjualan 7 Hari Terakhir</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEFF7" />
                    <XAxis dataKey="sale_date" tickFormatter={formatXAxis} stroke="#7D7E8D" tick={{ fontSize: 12, fill: '#6B46C1' }} />
                    <YAxis tickFormatter={(v) => formatRupiah(v)} stroke="#7D7E8D" tick={{ fontSize: 12, fill: '#6B46C1' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="daily_revenue"
                        stroke="#6C63FF"
                        strokeWidth={3}
                        dot={false}
                        fill="url(#colorRevenue)"
                    />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// Komponen Pie Chart Kategori Omzet
const CategoryPieChart = ({ data }) => {
    const COLORS = ['#FFC371', '#FF5F6D', '#7B68EE', '#00C49F', '#FFBB28', '#FF8042'];
    const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0);
    
    // Siapkan data untuk pie chart
    const pieData = data.map((item, index) => ({
        name: item.category,
        value: parseFloat(item.total_revenue),
        percent: (parseFloat(item.total_revenue) / totalRevenue) * 100,
        color: COLORS[index % COLORS.length]
    }));

    return (
        <div className="card bg-base-100 rounded-2xl p-6">
            <h3 className="text-md font-bold mb-4">Distribusi Omzet</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            label={false}>
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip isPie={true} />} /> 
                        <Legend 
                            align="center" 
                            verticalAlign="bottom" 
                            layout="horizontal" 
                            wrapperStyle={{ fontSize: '12px', color: '#2D3748', marginTop: '10px' }}
                            formatter={(value) => <span className="text-base-content-crm">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


const Dashboard = () => {
    const [metrics, setMetrics] = useState({
        revenueToday: 0,
        transactionsToday: 0,
        totalSKU: 0,
        lowStockCount: 0,
        latestSales: [],
    });
    const [salesTrend, setSalesTrend] = useState([]);
    const [categoryRevenue, setCategoryRevenue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Fetch Metrik Utama
                const metricsRes = await axios.get(API_DASHBOARD_URL);
                setMetrics(metricsRes.data);
                
                // 2. Fetch Tren Penjualan 30 Hari
                const trendRes = await axios.get(`${API_REPORT_URL}/sales-trend`);
                setSalesTrend(trendRes.data);
                
                // 3. Fetch Omzet Kategori
                const categoryRes = await axios.get(`${API_REPORT_URL}/categories-by-revenue`);
                setCategoryRevenue(categoryRes.data);

            } catch (err) {
                console.error('Gagal mengambil data dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        
        // Panggil route baru di backend (pastikan Anda sudah membuat dan mengintegrasikannya)
        fetchDashboardData();
    }, []);

    if (loading) return <div className="max-w-7xl mx-auto w-full text-center p-10"><span className="loading loading-spinner loading-lg text-primary"></span> Memuat Dashboard Analisis...</div>;

    return (
        <div className="max-w-7xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight">Dashboard Analisis</h1>
            </div>

            {/* Grid Metrik Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 text-text-secondary-crm">
                <StatCard title="Penjualan Hari Ini" value={metrics.revenueToday} unit="Rp" icon={ShoppingBag}/>
                <StatCard title="Transaksi Hari Ini" value={metrics.transactionsToday} icon={BanknoteArrowDown}/>
                <StatCard title="Jumlah SKU" value={metrics.totalSKU} icon={PackageOpen}/>
                <StatCard title="Stok Rendah" value={metrics.lowStockCount} isWarning={true} icon={CircleAlert} linkTo="/inventory" buttonText="Lihat Produk"/>
            </div>
            
            {/* Analisis Visual - Line Chart & Pie Chart */}
            <div className="grid grid-cols-3 gap-4 lg:gap-6 mt-6">
                <div className="lg:col-span">
                    {salesTrend.length > 0 ? (
                        <SalesTrendChart data={salesTrend} />
                    ) : (
                        <div className="card bg-base-100 text-sm text-center text-gray-500 h-72 p-8">Belum ada data transaksi 7 hari terakhir.</div>
                    )}
                </div>
                {categoryRevenue.length > 0 && (
                    <CategoryPieChart data={categoryRevenue} />
                )}
                <div className="card bg-base-100 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-md font-bold">5 Transaksi Terbaru</h3>
                        <Link to="/reports" className="btn bg-primary-crm text-white py-4 rounded-lg btn-sm">Lihat Semua</Link>
                    </div>
                    <div className="overflow-hidden border rounded-lg max-h-72 overflow-y-auto">
                        <table className="table table-pin-rows table-sm table-zebra">
                            <thead>
                            <tr>
                                <th></th>
                                <td>Tanggal</td>
                                <td>Nominal</td>
                            </tr>
                            </thead>
                            <tbody>
                            {metrics.latestSales && metrics.latestSales.length > 0 ? (
                                metrics.latestSales.map((sale, index) => (
                            <tr key={index}>
                                <th>{index + 1}</th>
                                <td>{new Date(sale.transaction_date).toLocaleString('id-ID', {
                                    dateStyle: 'short',
                                    })}</td>
                                <td>{formatRupiah(sale.total_amount)}</td>
                            </tr>
                                  ))
                                ) : (
                            <tr>
                                <td colSpan="4" className="text-center text-gray-500 py-4 border border-dashed rounded">
                                Belum ada data transaksi.
                                </td>
                            </tr>
                            )}
                            </tbody>  
                        </table>
                    </div>
                    
                </div>
            </div>
        </div>
    );
};

export default Dashboard;