// src/pages/ReportPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { FileText, Table2 } from 'lucide-react';

const API_REPORT_URL = 'http://localhost:5000/api/reports';

// Util
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

// Komponen untuk menampilkan Chart Kinerja Harga
const ProfitChart = ({ data }) => {
  const chartData = data.map(item => ({
    name: item.title.substring(0, 20) + '...', // Persingkat judul
    Keuntungan: parseFloat(item.total_profit),
    total_sold: Number(item.total_sold || 0)
  }));

  return (
    <div className="bg-base-100 p-6 rounded-xl border border-base-200">
      <h3 className="text-xl font-semibold mb-1">Top 10 Buku Berdasarkan Keuntungan Kotor</h3>
      <p className="text-xs text-base-content/60 mb-4">Fokus pada judul dengan margin tertinggi.</p>
      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{right: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" textAnchor="end" interval={1} tick={{ fontSize: 10}}/>
            <YAxis tickFormatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} tick={{ fontSize: 10}}/>
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Keuntungan') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Keuntungan Total'];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const p = payload && payload[0] ? payload[0].payload : null;
                return `${label} | Terjual: ${p?.total_sold || 0} pcs`;
              }}
            />
            <Legend verticalAlign="bottom" height={36} />
            <Bar dataKey="Keuntungan" fill="#10B981" /> {/* Warna Hijau */}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Komponen untuk menampilkan Chart Kategori
const CategoryChart = ({ data, totalRevenue }) => {
  const chartData = data.map(item => ({
    category: item.category,
    Omzet: parseFloat(item.total_revenue),
    percent: totalRevenue > 0 ? (Number(item.total_revenue) / totalRevenue) * 100 : 0,
  }));

  return (
    <div className="bg-base-100 p-6 rounded-xl border border-base-200">
      <h3 className="text-xl font-semibold mb-1">Omzet Berdasarkan Kategori Buku</h3>
      <p className="text-xs text-base-content/60 mb-4">Bandingkan performa antar kategori.</p>
      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" tick={{ fontSize: 10}}/>
            <YAxis tickFormatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} tick={{ fontSize: 10}}/>
            <Tooltip formatter={(value, name) => {
              if (name === 'Omzet') return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Omzet Total'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              const p = payload && payload[0] ? payload[0].payload : null;
              const pct = p ? p.percent.toFixed(1) : '0.0';
              return `${label} · ${pct}% kontribusi`;
            }} />
            <Legend verticalAlign="bottom" />
            <Bar dataKey="Omzet" fill="#3B82F6" /> {/* Warna Biru */}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316'];

const ReportPage = () => {
  const [profitData, setProfitData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [topDeclines, setTopDeclines] = useState([]);
  const [purchaseFrequency, setPurchaseFrequency] = useState([]);
  const [txMetrics, setTxMetrics] = useState({ avg_items: 0, busiest_hour: null, busiest_day: null });
  const [summary, setSummary] = useState({ total_transactions: 0, total_revenue: 0, bestselling_book: null, dominant_category: null, avg_tx_value: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const [profitRes, categoryRes, monthlyRes, declineRes, freqRes, metricsRes] = await Promise.all([
          axios.get(`${API_REPORT_URL}/performance`),
          axios.get(`${API_REPORT_URL}/categories-by-revenue`),
          axios.get(`${API_REPORT_URL}/monthly-revenue`, { params: { year } }),
          axios.get(`${API_REPORT_URL}/top-decline-books`, { params: { year, month: new Date().getMonth() + 1 } }),
          axios.get(`${API_REPORT_URL}/purchase-frequency`),
          axios.get(`${API_REPORT_URL}/tx-metrics`),
        ]);
        setProfitData(profitRes.data || []);
        setCategoryData(categoryRes.data || []);
        setMonthlyRevenue(monthlyRes.data || []);
        setTopDeclines(declineRes.data || []);
        setPurchaseFrequency(freqRes.data || []);
        setTxMetrics(metricsRes.data || { avg_items: 0 });

        const summaryRes = await axios.get(`${API_REPORT_URL}/summary`, { params: { startDate, endDate } });
        setSummary(summaryRes.data || { total_transactions: 0, total_revenue: 0 });

        setLoading(false);
      } catch (err) {
        console.error('Gagal memuat laporan:', err);
        setError('Gagal memuat data analisis. Pastikan server API berjalan dan ada data transaksi.');
        setLoading(false);
      }
    };
    fetchReports();
  }, [year, startDate, endDate]);

  const totalRevenue = useMemo(() => categoryData.reduce((s, c) => s + Number(c.total_revenue || 0), 0), [categoryData]);
  const monthlyChartData = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }));
    monthlyRevenue.forEach(r => {
      const idx = Math.max(1, Math.min(12, Number(r.month))) - 1;
      arr[idx].revenue = Number(r.revenue || 0);
    });
    return arr.map(x => ({ name: x.month, Omzet: x.revenue }));
  }, [monthlyRevenue]);

  const insights = useMemo(() => {
    const tips = [];
    // Insight omzet turun >= 20% dibanding bulan lalu
    if (monthlyChartData.length >= 2) {
      const nonZero = monthlyChartData.filter(m => m.Omzet >= 0);
      if (nonZero.length >= 2) {
        const last = nonZero[nonZero.length - 1].Omzet;
        const prev = nonZero[nonZero.length - 2].Omzet;
        if (prev > 0 && (last < prev * 0.8)) {
          tips.push('Omzet bulan ini turun ≥ 20% dibanding bulan lalu. Pertimbangkan promo bundling atau diskon terbatas.');
        }
      }
    }
    // Kategori meningkat ≥ 30% tidak dihitung detail waktu, tampilkan saran stok saat total kategori dominan besar
    if (summary?.dominant_category && totalRevenue > 0) {
      tips.push(`Kategori ${summary.dominant_category} menunjukkan kontribusi tinggi. Pertimbangkan penambahan stok dan display khusus.`);
    }
    // Pelanggan loyal berkurang — proxy: tidak ada implementasi historical; beri saran umum jika sedikit pelanggan punya >1 transaksi
    const loyal = purchaseFrequency.filter(p => Number(p.tx_count || 0) >= 2).length;
    const totalCustomers = purchaseFrequency.length;
    if (totalCustomers > 0 && loyal / totalCustomers < 0.2) {
      tips.push('Pelanggan loyal rendah. Pertimbangkan program loyalti: poin, voucher, atau membership.');
    }
    if (tips.length === 0) tips.push('Data stabil. Lanjutkan konsistensi stok, pelayanan, dan promosi mingguan.');
    return tips;
  }, [monthlyChartData, summary, totalRevenue, purchaseFrequency]);

  if (loading) return <div className="text-center p-8"><span className="loading loading-spinner loading-lg"></span> Memuat Laporan Analisis...</div>;
  if (error) return <div className="alert alert-error shadow-lg"><span>{error}</span></div>;
  
  if (profitData.length === 0 && categoryData.length === 0) {
      return <div className="alert alert-warning shadow-lg"><span>Belum ada data transaksi yang cukup untuk membuat laporan.</span></div>;
  }

  const handleExportCSV = () => {
    const rows = [];
    rows.push(['Ringkasan']);
    rows.push(['Total Omzet', summary.total_revenue]);
    rows.push(['Total Transaksi', summary.total_transactions]);
    rows.push(['Buku Terlaris (profit)', summary.bestselling_book || '-']);
    rows.push(['Kategori Dominan', summary.dominant_category || '-']);
    rows.push(['Rata-rata Nilai Transaksi', summary.avg_tx_value]);
    rows.push([]);
    rows.push(['Omzet Bulanan']);
    rows.push(['Bulan','Omzet']);
    monthlyChartData.forEach(m => rows.push([m.name, m.Omzet]));
    rows.push([]);
    rows.push(['Kategori','Omzet']);
    categoryData.forEach(c => rows.push([c.category, c.total_revenue]));

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-bold">Laporan & Analisis</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn border rounded-lg text-sm px-3 bg-red-600 text-white" onClick={handlePrint}><FileText className="w-4 h-4" />Export PDF</button>
          <button className="btn border rounded-lg text-sm px-3 bg-green-600 text-white" onClick={handleExportCSV}><Table2 className="w-4 h-4" />Export Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className='grid grid-cols grid-cols-4 gap-4'>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200 mb-4 col-span-2">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="form-control">
                <div className="label"><span className="label-text text-sm font-semibold">Tahun</span></div>
                <select className="select select-bordered border rounded-lg px-2" value={year} onChange={(e) => setYear(e.target.value)}>
                  {Array.from({length: 6},(_,i)=>String(new Date().getFullYear()-i)).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label className="form-control">
                <div className="label"><span className="label-text text-sm font-semibold">Dari</span></div>
                <input type="date" className="input input-bordered border rounded-lg px-2" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
              </label>
            </div>
            <div>
              <label className="form-control">
                <div className="label"><span className="label-text text-sm font-semibold">Sampai</span></div>
                <input type="date" className="input input-bordered border rounded-lg px-2" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
              </label>
            </div>
          </div>
        </div>
        <div className="stat bg-base-100 rounded-xl border border-base-200 mb-4">
          <div className="stat-title">Omzet Bulan Ini</div>
          <div className="stat-value text-primary">{formatRupiah(monthlyChartData[new Date().getMonth()]?.Omzet || 0)}</div>
        </div>
        <div className="stat bg-base-100 rounded-xl border border-base-200 mb-4">
          <div className="stat-title">Rata-rata Nilai Tx</div>
          <div className="stat-value">{formatRupiah(summary.avg_tx_value || 0)}</div>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className='grid grid-cols-3 gap-4'>
          <div className="stat bg-base-100 rounded-xl border border-base-200">
            <div className="stat-title">Total Transaksi</div>
            <div className="stat-value">{summary.total_transactions}</div>
          </div>
          <div className="stat bg-base-100 rounded-xl border border-base-200">
            <div className="stat-title">Rata-rata Item/Transaksi</div>
            <div className="stat-value text-3xl font-bold text-primary">{(txMetrics?.avg_items || 0).toFixed(2)}</div>
          </div>
          <div className="stat bg-base-100 rounded-xl border border-base-200">
            <div className="stat-title">Kategori Dominan</div>
            <div className="stat-value text-sm">{summary.dominant_category || '-'}</div>
          </div>
        </div>
        <div className="stat bg-base-100 rounded-xl border border-base-200">
          <div className="stat-title">Buku Terlaris</div>
          <div className="stat-value block whitespace-normal text-sm break-words max-w-full">{summary.bestselling_book || '-'}</div>
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-6 lg:space-y-8">
          {/* Line Chart Monthly Revenue */}
          <div className="bg-base-100 p-6 rounded-xl border border-base-200">
            <h3 className="text-xl font-semibold mb-1">Tren Omzet Bulanan</h3>
            <p className="text-xs text-base-content/60 mb-4">Omzet per bulan dalam tahun {year}.</p>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10}}/>
                  <YAxis tickFormatter={(v)=>`Rp ${v.toLocaleString('id-ID')}`} tick={{ fontSize: 10}}/>
                  <Tooltip formatter={(v)=>[`Rp ${Number(v).toLocaleString('id-ID')}`, 'Omzet']} />
                  <Legend verticalAlign="bottom" />
                  <Line type="monotone" dataKey="Omzet" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="space-y-6 lg:space-y-8">
          <div className="bg-base-100 p-6 rounded-xl border border-base-200">
            <h3 className="text-lg font-semibold mb-2">Frekuensi Pembelian</h3>
            <p className="text-xs text-base-content/60 mb-3">Berapa kali pelanggan bertransaksi.</p>
            <div style={{ width: '100%', height: 350, marginTop: '8px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={purchaseFrequency.map(p => ({ name: p.name, Tx: Number(p.tx_count || 0) })).slice(0, 10)}
                  margin={{ top: 8, right: 12, left: 8, bottom: 18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={40} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {/* Hapus Legend bawaan supaya Recharts tidak mengalokasikan ruang ekstra */}
                  <Bar dataKey="Tx" fill="#8B5CF6" radius={[4, 4, 0, 0]} barCategoryGap="20%" />
                </BarChart>
              </ResponsiveContainer>
              {/* Legend overlay sebagai HTML (tidak memengaruhi layout SVG) */}
              <div
                style={{
                  position: 'absolute',
                  left: 256,
                  bottom: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 12,
                  background: 'rgba(255,255,255,0.9)',
                  padding: '6px 8px',
                  borderRadius: 6,
                  zIndex: 20,
                }}
              >
                <span style={{ width: 12, height: 12, background: '#8B5CF6', display: 'inline-block', borderRadius: 2 }} />
                <span className="text-sm">Tx</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Profit Top 10 */}
        {profitData.length > 0 && (
          <div className="transition rounded-xl">
            <ProfitChart data={profitData} />
          </div>
        )}

        {/* Negative Trend Books */}
        {topDeclines.length > 0 && (
          <div className="bg-base-100 p-6 rounded-xl border border-base-200">
            <h3 className="text-xl font-semibold mb-1">Buku dengan Penurunan Penjualan Terbesar (MoM)</h3>
            <p className="text-xs text-base-content/60 mb-4">Bandingkan jumlah terjual bulan ini vs bulan lalu.</p>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={topDeclines.map(b => ({ name: b.title.substring(0,20)+'...', Delta: Number(b.delta_qty||0) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10}}/>
                  <YAxis tick={{ fontSize: 10}}/>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                  <Bar dataKey="Delta" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        {/* Category Revenue Pie + Bar */}
        {categoryData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-base-100 p-6 rounded-xl border border-base-200">
              <h3 className="text-xl font-semibold mb-1">Distribusi Omzet per Kategori</h3>
              <p className="text-xs text-base-content/60 mb-4">Persentase kontribusi kategori.</p>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categoryData.map(c => ({ name: c.category, value: Number(c.total_revenue||0) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[`Rp ${Number(v).toLocaleString('id-ID')}`, n]} />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <CategoryChart data={categoryData} totalRevenue={totalRevenue} />
          </div>
        )}
      </div>

        {/* Insights */}
        <div className="bg-base-100 p-6 rounded-xl border border-base-200">
          <h3 className="text-xl font-semibold mb-3">💡 Insight Otomatis</h3>
          <div className="space-y-2">
            {insights.map((t, i) => (
              <div key={i} className="p-3 rounded-lg border border-base-200 bg-gray-50 flex items-start gap-2">
                <span>💡</span>
                <span className="text-sm">{t}</span>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
};

export default ReportPage;