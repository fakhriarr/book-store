// src/pages/BundlePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Pencil, Trash2, Sparkles, BookOpen, AlertCircle, Loader2, ChevronDown, Check, X, CircleCheck } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Util
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

// ========== KOMPONEN: Modal Tambah/Edit Bundle ==========
const BundleModal = ({ isOpen, onClose, onSave, bundle, books }) => {
  const [formData, setFormData] = useState({
    bundle_name: '',
    selling_price: '',
    stock: '',
    items: [] // [{book_id, quantity}]
  });
  const [searchBook, setSearchBook] = useState('');
  const [showBookDropdown, setShowBookDropdown] = useState(false);

  useEffect(() => {
    if (bundle) {
      setFormData({
        bundle_name: bundle.bundle_name || '',
        selling_price: bundle.selling_price || '',
        stock: bundle.stock || '',
        items: bundle.items || []
      });
    } else {
      setFormData({
        bundle_name: '',
        selling_price: '',
        stock: '',
        items: []
      });
    }
  }, [bundle, isOpen]);

  const handleAddBook = (book) => {
    const exists = formData.items.find(item => item.book_id === book.book_id);
    if (!exists) {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { book_id: book.book_id, title: book.title, quantity: 1 }]
      }));
    }
    setSearchBook('');
    setShowBookDropdown(false);
  };

  const handleRemoveBook = (bookId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.book_id !== bookId)
    }));
  };

  const handleQuantityChange = (bookId, quantity) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.book_id === bookId ? { ...item, quantity: Math.max(1, parseInt(quantity) || 1) } : item
      )
    }));
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchBook.toLowerCase()) &&
    !formData.items.find(item => item.book_id === book.book_id)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.bundle_name || !formData.selling_price || formData.items.length === 0) {
      alert('Mohon lengkapi semua field dan tambahkan minimal 1 buku');
      return;
    }
    onSave(formData);
  };

  // Hitung total harga buku dalam bundle
  const totalBookPrice = formData.items.reduce((sum, item) => {
    const book = books.find(b => b.book_id === item.book_id);
    return sum + (book ? book.selling_price * item.quantity : 0);
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{bundle ? 'Edit Bundle' : 'Tambah Bundle Baru'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Bundle */}
          <div>
            <label className="block text-sm font-medium mb-1">Nama Bundle</label>
            <input
              type="text"
              value={formData.bundle_name}
              onChange={(e) => setFormData(prev => ({ ...prev, bundle_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Contoh: Paket Hemat Kamus"
              required
            />
          </div>

          {/* Pilih Buku */}
          <div>
            <label className="block text-sm font-medium mb-1">Buku dalam Bundle</label>
            <div className="relative">
              <input
                type="text"
                value={searchBook}
                onChange={(e) => {
                  setSearchBook(e.target.value);
                  setShowBookDropdown(true);
                }}
                onFocus={() => setShowBookDropdown(true)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Cari dan tambah buku..."
              />
              {showBookDropdown && searchBook && filteredBooks.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredBooks.slice(0, 10).map(book => (
                    <div
                      key={book.book_id}
                      onClick={() => handleAddBook(book)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                    >
                      <span className="text-sm">{book.title}</span>
                      <span className="text-xs text-gray-500">{formatRupiah(book.selling_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List Buku yang Dipilih */}
            {formData.items.length > 0 && (
              <div className="mt-2 space-y-2">
                {formData.items.map(item => {
                  const book = books.find(b => b.book_id === item.book_id);
                  return (
                    <div key={item.book_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <BookOpen className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-sm flex-1 truncate">{item.title || book?.title}</span>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.book_id, e.target.value)}
                        className="w-16 border rounded px-2 py-1 text-sm text-center"
                        min="1"
                      />
                      <span className="text-xs text-gray-500">pcs</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBook(item.book_id)}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <div className="text-xs text-gray-500 text-right">
                  Total harga satuan: {formatRupiah(totalBookPrice)}
                </div>
              </div>
            )}
          </div>

          {/* Harga Jual Bundle */}
          <div>
            <label className="block text-sm font-medium mb-1">Harga Jual Bundle</label>
            <input
              type="number"
              value={formData.selling_price}
              onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Contoh: 150000"
              required
            />
            {totalBookPrice > 0 && formData.selling_price && (
              <p className="text-xs mt-1 text-green-600">
                Hemat {formatRupiah(totalBookPrice - formData.selling_price)} ({((1 - formData.selling_price / totalBookPrice) * 100).toFixed(0)}% diskon)
              </p>
            )}
          </div>

          {/* Stok Bundle */}
          <div>
            <label className="block text-sm font-medium mb-1">Stok Bundle</label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Contoh: 10"
              required
              min="0"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {bundle ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========== KOMPONEN: Modal Quick Add dari Rekomendasi ==========
const QuickAddBundleModal = ({ isOpen, onClose, onSave, recommendation }) => {
  const [formData, setFormData] = useState({
    bundle_name: '',
    selling_price: '',
    stock: ''
  });

  useEffect(() => {
    if (recommendation) {
      const items = [...recommendation.antecedent, ...recommendation.consequent];
      setFormData({
        bundle_name: `Bundling ${items.join(' & ')}`,
        selling_price: '',
        stock: ''
      });
    }
  }, [recommendation, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.bundle_name || !formData.selling_price || !formData.stock) {
      alert('Mohon lengkapi semua field');
      return;
    }
    onSave({
      ...formData,
      items: recommendation.items || [...recommendation.antecedent, ...recommendation.consequent]
    });
  };

  if (!isOpen || !recommendation) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Tambah Bundle dari Rekomendasi</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-800">{recommendation.insight}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Bundle</label>
            <input
              type="text"
              value={formData.bundle_name}
              onChange={(e) => setFormData(prev => ({ ...prev, bundle_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Harga Jual Bundle</label>
            <input
              type="number"
              value={formData.selling_price}
              onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Masukkan harga bundle"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Stok Bundle</label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Masukkan jumlah stok"
              required
              min="0"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Buat Bundle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========== KOMPONEN: Accordion Rekomendasi (sama seperti di ReportPage) ==========
const RecommendationAccordionItem = ({ bundle, type, isMarked, onToggleMark, onAddBundle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, bundle]);
  
  const items = [...bundle.antecedent, ...bundle.consequent];
  const title = type === 'book' 
    ? `Bundling ${items.join(' dan ')}`
    : `Bundling Kategori ${items.join(' dan ')}`;
  
  const getLiftBadge = (lift) => {
    if (lift > 1) {
      return { text: 'Bundling Direkomendasikan', className: 'bg-green-100 text-green-700 border-green-200' };
    } else if (lift === 1) {
      return { text: 'Bundling Opsional', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    } else {
      return { text: 'Tidak Perlu Bundling', className: 'bg-red-100 text-red-700 border-red-200' };
    }
  };
  
  const liftBadge = getLiftBadge(bundle.lift);
  
  const bgColor = isMarked 
    ? 'bg-white' 
    : type === 'book' 
      ? 'bg-green-50' 
      : 'bg-blue-50';
  
  const borderColor = isMarked
    ? 'border-gray-200'
    : type === 'book'
      ? 'border-green-200'
      : 'border-blue-200';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden transition-all duration-300`}>
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-80 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Package className={`w-4 h-4 ${type === 'book' ? 'text-green-600' : 'text-blue-600'} transition-transform duration-300 ${isExpanded ? 'rotate-12' : ''}`} />
          <span className={`text-sm font-medium ${type === 'book' ? 'text-green-800' : 'text-blue-800'}`}>
            {title}
          </span>
          {isMarked && (
            <span>
              <CircleCheck className="ml-2 w-4 h-4 text-green-600" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>
      
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div ref={contentRef} className="px-3 pb-3 pt-1 border-t border-gray-100">
          <p className="text-sm text-gray-700 mb-2">
            📊 Sering dibeli bersamaan dalam <strong>{(bundle.support * 100).toFixed(1)}%</strong> transaksi.
          </p>
          
          <p className="text-sm text-gray-700 mb-3">
            👥 <strong>{(bundle.confidence * 100).toFixed(0)}%</strong> Pelanggan membeli "{bundle.consequent.join(', ')}" jika membeli "{bundle.antecedent.join(', ')}".
          </p>
          
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs px-3 py-1 rounded-full border ${liftBadge.className}`}>
              {liftBadge.text}
            </span>
            
            <div className="flex gap-2">
              {/* Tombol Sudah Bundling */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMark();
                }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                  isMarked 
                    ? 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200' 
                    : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                }`}
              >
                <Check className={`w-3.5 h-3.5 transition-transform duration-200 ${isMarked ? 'scale-110' : ''}`} />
                {isMarked ? 'Batalkan' : 'Sudah Bundling'}
              </button>

              {/* Tombol Tambah Bundle (hanya untuk buku, bukan kategori) */}
              {type === 'book' && !isMarked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBundle(bundle);
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-green-100 text-green-700 border-green-300 hover:bg-green-200 transition-all duration-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Bundle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== KOMPONEN UTAMA ==========
const BundlePage = () => {
  const [activeTab, setActiveTab] = useState('bundles'); // 'bundles' | 'recommendations'
  const [bundles, setBundles] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  // Apriori insights
  const [aprioriInsights, setAprioriInsights] = useState(null);
  const [aprioriLoading, setAprioriLoading] = useState(false);

  // Marked bundles (localStorage)
  const [markedBundles, setMarkedBundles] = useState(() => {
    const saved = localStorage.getItem('markedBundles');
    return saved ? JSON.parse(saved) : { books: [], categories: [] };
  });

  useEffect(() => {
    localStorage.setItem('markedBundles', JSON.stringify(markedBundles));
  }, [markedBundles]);

  // Fetch bundles
  const fetchBundles = async () => {
    try {
      const res = await axios.get(`${API_URL}/bundles`);
      setBundles(res.data || []);
    } catch (err) {
      console.error('Error fetching bundles:', err);
    }
  };

  // Fetch books
  const fetchBooks = async () => {
    try {
      const res = await axios.get(`${API_URL}/books`);
      setBooks(res.data || []);
    } catch (err) {
      console.error('Error fetching books:', err);
    }
  };

  // Fetch Apriori insights
  const fetchAprioriInsights = async () => {
    setAprioriLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/apriori-insights`);
      setAprioriInsights(res.data);
    } catch (err) {
      console.error('Error fetching Apriori insights:', err);
    } finally {
      setAprioriLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBundles(), fetchBooks(), fetchAprioriInsights()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Handle save bundle
  const handleSaveBundle = async (formData) => {
    try {
      if (editingBundle) {
        await axios.put(`${API_URL}/bundles/${editingBundle.bundle_id}`, formData);
      } else {
        await axios.post(`${API_URL}/bundles`, formData);
      }
      fetchBundles();
      setShowBundleModal(false);
      setEditingBundle(null);
    } catch (err) {
      console.error('Error saving bundle:', err);
      alert('Gagal menyimpan bundle');
    }
  };

  // Handle quick add from recommendation
  const handleQuickAddBundle = async (formData) => {
    try {
      // Cari book_id berdasarkan title dari rekomendasi
      const bookItems = formData.items.map(title => {
        const book = books.find(b => b.title === title);
        return book ? { book_id: book.book_id, quantity: 1 } : null;
      }).filter(Boolean);

      if (bookItems.length === 0) {
        alert('Buku tidak ditemukan di inventaris');
        return;
      }

      await axios.post(`${API_URL}/bundles`, {
        bundle_name: formData.bundle_name,
        selling_price: formData.selling_price,
        stock: formData.stock,
        items: bookItems
      });

      // Mark as bundled
      const bundleKey = formData.items.sort().join('|');
      setMarkedBundles(prev => ({
        ...prev,
        books: [...prev.books, bundleKey]
      }));

      fetchBundles();
      setShowQuickAddModal(false);
      setSelectedRecommendation(null);
    } catch (err) {
      console.error('Error creating bundle from recommendation:', err);
      alert('Gagal membuat bundle');
    }
  };

  // Handle delete bundle
  const handleDeleteBundle = async (bundleId) => {
    if (!confirm('Yakin ingin menghapus bundle ini?')) return;
    try {
      await axios.delete(`${API_URL}/bundles/${bundleId}`);
      fetchBundles();
    } catch (err) {
      console.error('Error deleting bundle:', err);
      alert('Gagal menghapus bundle');
    }
  };

  // Handle edit bundle
  const handleEditBundle = (bundle) => {
    setEditingBundle(bundle);
    setShowBundleModal(true);
  };

  // Toggle mark recommendation
  const toggleMarkBundle = (bundleKey, type) => {
    setMarkedBundles(prev => {
      const key = type === 'book' ? 'books' : 'categories';
      const current = prev[key];
      const isMarked = current.includes(bundleKey);
      return {
        ...prev,
        [key]: isMarked ? current.filter(k => k !== bundleKey) : [...current, bundleKey]
      };
    });
  };

  const getBundleKey = (bundle) => {
    return [...bundle.antecedent, ...bundle.consequent].sort().join('|');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <span className="ml-3">Memuat data...</span>
      </div>
    );
  }

  const sortedBookBundles = aprioriInsights?.recommendations?.book_bundles?.sort((a, b) => b.confidence - a.confidence) || [];
  const sortedCategoryBundles = aprioriInsights?.recommendations?.category_bundles?.sort((a, b) => b.confidence - a.confidence) || [];

  const markedBookCount = sortedBookBundles.filter(bundle => 
    markedBundles.books.includes(getBundleKey(bundle))
  ).length;
  const markedCategoryCount = sortedCategoryBundles.filter(bundle => 
    markedBundles.categories.includes(getBundleKey(bundle))
  ).length;

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-bold">Bundle</h2>
        </div>
        <button
          onClick={() => {
            setEditingBundle(null);
            setShowBundleModal(true);
          }}
          className="btn btn-sm bg-primary-crm text-white text-xs font-bold px-2 border-none rounded-lg flex items-center"
        >
          + Tambah Bundle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('bundles')}
          className={`px-4 py-1 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'bundles'
              ? 'bg-primary-crm text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2 mb-1" />
          Bundle
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-1 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'recommendations'
              ? 'bg-primary-crm text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2 mb-1" />
          Rekomendasi
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'bundles' && (
        <div className="bg-base-100 rounded-xl border border-base-200 overflow-hidden">
          <table className="table table-zebra w-full">
            <thead className="bg-gray-50">
              <tr>
                <th>No</th>
                <th>Nama Bundle</th>
                <th>Isi Bundle</th>
                <th>Harga Jual</th>
                <th>Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bundles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-base-content/60">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Belum ada bundle</p>
                    <p className="text-sm">Klik "Tambah Bundle" untuk membuat bundle baru</p>
                  </td>
                </tr>
              ) : (
                bundles.map((bundle, idx) => (
                  <tr key={bundle.bundle_id}>
                    <td>{idx + 1}</td>
                    <td className="font-medium">{bundle.bundle_name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {bundle.items?.map((item, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {item.title} (x{item.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatRupiah(bundle.selling_price)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded text-sm ${
                        bundle.stock <= 5 ? 'bg-red-100 text-red-700 border border-red-600' : 'bg-green-100 text-green-700 border border-green-600'
                      }`}>
                        {bundle.stock}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditBundle(bundle)}
                          className="p-2 hover:bg-blue-100 rounded text-blue-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBundle(bundle.bundle_id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="bg-base-100 p-6 rounded-xl border border-base-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="text-xl font-semibold">Rekomendasi Bundling</h3>
            </div>
            {aprioriInsights?.total_transactions && (
              <div className="text-xs text-base-content/60 bg-purple-50 px-2 py-1 rounded">
                {aprioriInsights.total_transactions} transaksi dianalisis
              </div>
            )}
          </div>
          
          <p className="text-xs text-base-content/60 mb-4">
            Rekomendasi bundling berdasarkan pola pembelian pelanggan. Klik "Tambah Bundle" untuk langsung membuat bundle.
          </p>

          {aprioriLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-3 text-base-content/60">Menganalisis pola pembelian...</span>
            </div>
          ) : !aprioriInsights?.success ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm text-amber-700 font-medium">{aprioriInsights?.message || 'Data belum tersedia'}</p>
                {aprioriInsights?.total_transactions !== undefined && (
                  <p className="text-xs text-amber-600 mt-1">
                    Transaksi saat ini: {aprioriInsights.total_transactions} / {aprioriInsights.min_required || 30} minimal
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Book Bundles */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-green-500" />
                  <h4 className="font-semibold text-sm">Bundling Judul Buku</h4>
                  <span className="text-xs text-gray-500">
                    ({markedBookCount}/{sortedBookBundles.length} selesai)
                  </span>
                </div>
                
                {sortedBookBundles.length > 0 ? (
                  <div className="space-y-2">
                    {sortedBookBundles.map((bundle, idx) => {
                      const bundleKey = getBundleKey(bundle);
                      const isMarked = markedBundles.books.includes(bundleKey);
                      return (
                        <RecommendationAccordionItem
                          key={idx}
                          bundle={bundle}
                          type="book"
                          isMarked={isMarked}
                          onToggleMark={() => toggleMarkBundle(bundleKey, 'book')}
                          onAddBundle={(b) => {
                            setSelectedRecommendation(b);
                            setShowQuickAddModal(true);
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-base-content/60">
                      Belum cukup data untuk rekomendasi bundling buku.
                    </p>
                  </div>
                )}
              </div>

              {/* Category Bundles */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-blue-500" />
                  <h4 className="font-semibold text-sm">Bundling Kategori</h4>
                  <span className="text-xs text-gray-500">
                    ({markedCategoryCount}/{sortedCategoryBundles.length} selesai)
                  </span>
                </div>
                
                {sortedCategoryBundles.length > 0 ? (
                  <div className="space-y-2">
                    {sortedCategoryBundles.map((bundle, idx) => {
                      const bundleKey = getBundleKey(bundle);
                      const isMarked = markedBundles.categories.includes(bundleKey);
                      return (
                        <RecommendationAccordionItem
                          key={idx}
                          bundle={bundle}
                          type="category"
                          isMarked={isMarked}
                          onToggleMark={() => toggleMarkBundle(bundleKey, 'category')}
                          onAddBundle={() => {}}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-base-content/60">
                      Belum cukup data untuk rekomendasi bundling kategori.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <BundleModal
        isOpen={showBundleModal}
        onClose={() => {
          setShowBundleModal(false);
          setEditingBundle(null);
        }}
        onSave={handleSaveBundle}
        bundle={editingBundle}
        books={books}
      />

      <QuickAddBundleModal
        isOpen={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false);
          setSelectedRecommendation(null);
        }}
        onSave={handleQuickAddBundle}
        recommendation={selectedRecommendation}
      />
    </div>
  );
};

export default BundlePage;
