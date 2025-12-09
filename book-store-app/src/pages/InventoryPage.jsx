// src/pages/InventoryPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AddBookForm from '../components/AddBookForm';
import CategoryCombobox from '../components/CategoryCombobox';
import StockUpdateModal from '../components/StockUpdateModal';
import { History, SquarePen, Trash } from 'lucide-react';

const API_URL = 'http://localhost:5000/api/books';

const InventoryPage = () => {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStockFilter, setSelectedStockFilter] = useState('');
  const [_isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [operationType, setOperationType] = useState(null);
  const [bookToEdit, setBookToEdit] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fungsi untuk mengambil data buku dari API
  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL);
      setBooks(response.data);
      setError(null);
    } catch (err) {
      console.error("Gagal mengambil data buku:", err);
      setError('Gagal memuat data inventaris dari server.');
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk mengambil kategori
  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  // Filter dan search
  useEffect(() => {
    let filtered = [...books];

    // Filter berdasarkan search term (nama atau ISBN)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(book => 
        book.title.toLowerCase().includes(term) || 
        book.isbn.toLowerCase().includes(term)
      );
    }

    // Filter berdasarkan kategori
    if (selectedCategory) {
      filtered = filtered.filter(book => book.category === selectedCategory);
    }

    // Filter berdasarkan stok
    if (selectedStockFilter) {
      switch(selectedStockFilter) {
        case 'tersedia':
          filtered = filtered.filter(book => book.stock_qty > 5);
          break;
        case 'menipis':
          filtered = filtered.filter(book => book.stock_qty > 0 && book.stock_qty <= 5);
          break;
        case 'habis':
          filtered = filtered.filter(book => book.stock_qty === 0);
          break;
        default:
          break;
      }
    }

    setFilteredBooks(filtered);
  }, [books, searchTerm, selectedCategory, selectedStockFilter]);

  // Fungsi untuk mendapatkan warna indicator stok
  const getStockIndicatorColor = (stock) => {
    if (stock === 0) return 'bg-red-500';
    if (stock <= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const openStockModal = (book, type) => {
    setSelectedBook(book);
    setOperationType(type);
    setIsStockModalOpen(true);
    document.getElementById('stock_modal').showModal();
  };

  const closeStockModal = () => {
    setIsStockModalOpen(false);
    setSelectedBook(null);
    setOperationType(null);
    document.getElementById('stock_modal').close();
  };

  const handleEdit = (book) => {
    setBookToEdit(book);
    document.getElementById('edit_modal').showModal();
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus buku ini?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/${bookId}`);
      fetchBooks();
    } catch (err) {
      console.error('Error deleting book:', err);
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (status === 409 && code === 'BOOK_IN_USE') {
        const confirmForce = window.confirm('Buku ini sudah dipakai dalam transaksi. Hapus paksa beserta relasinya? Tindakan ini tidak dapat dibatalkan.');
        if (confirmForce) {
          try {
            await axios.delete(`${API_URL}/${bookId}?force=true`);
            fetchBooks();
          } catch (forceErr) {
            console.error('Force delete failed:', forceErr);
            alert('Hapus paksa gagal. Cek log server.');
          }
        }
      } else {
        alert('Gagal menghapus buku');
      }
    }
  };

  const handleHistory = async (book) => {
    setSelectedBook(book);
    setHistoryLoading(true);
    document.getElementById('history_modal').showModal();

    try {
      const response = await axios.get(`${API_URL}/${book.book_id}/stock-history`);
      setStockHistory(response.data);
    } catch (err) {
      console.error('Error fetching stock history:', err);
      setStockHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setSelectedBook(null);
    setStockHistory([]);
    document.getElementById('history_modal').close();
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="text-center p-8"><span className="loading loading-spinner loading-lg"></span> Memuat data...</div>;
  if (error) return <div className="alert alert-error shadow-lg"><div><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{error}</span></div></div>;

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-4xl font-bold">Inventaris</h2>
        </div>
        <button className="btn btn-sm bg-primary-crm text-white text-xs font-bold px-2 border-none rounded-lg" onClick={() => document.getElementById('add_modal').showModal()}>
          + Tambah Buku
        </button>
      </div>

      {/* Search Bar dan Filter */}
      <div className="bg-base-100 p-4 rounded-xl border border-base-200 mb-4">
        <div className="flex flex-wrap gap-4">
        {/* Filter Kategori */}
          <div className="min-w-[150px]">
            <label className="form-control w-full">
            <div className="label"><span className="label-text text-sm font-bold">Kategori</span></div>
              <select 
                className="select select-bordered w-full text-sm border px-2 rounded-lg"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Filter Stok */}
          <div className="min-w-[150px]">
            <label className="form-control w-full">
            <div className="label"><span className="label-text text-sm font-bold">Status</span></div>
              <select 
                className="select select-bordered w-full text-sm border px-2 rounded-lg"
                value={selectedStockFilter}
                onChange={(e) => setSelectedStockFilter(e.target.value)}
              >
                <option value="">Semua Status</option>
                <option value="tersedia">Tersedia</option>
                <option value="menipis">Menipis</option>
                <option value="habis">Habis</option>
              </select>
            </label>
          </div>

          {/* Search Bar */}
          <div className="flex-1 min-w-[200px]">
            <label className="form-control w-full">
            <div className="label"><span className="label-text text-sm font-bold">Pencarian</span></div>
              <input 
                type="text" 
                placeholder="Cari berdasarkan nama atau ISBN..." 
                className="input input-bordered w-full text-sm border px-2 rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto bg-base-100 p-4 rounded-xl border border-base-200">
      <div className="overflow-x-auto max-h-[55vh] bg-base-100 rounded-lg border border-base-200">
        <table className="table table-zebra w-full table-pin-rows max-h-64">
          <thead>
            <tr className='bg-gray-50'>
              <th>ID</th>
              <th>ISBN</th>
              <th>Judul</th>
              <th>Stok</th>
              <th>Harga Beli</th>
              <th>Harga Jual</th>
              <th>Kategori</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.slice() // salin array agar data aslinya tidak berubah
              .sort((a, b) => a.title.localeCompare(b.title)) // urutkan berdasarkan judul A-Z
              .map((book, index) => (
              <tr key={book.book_id}>
                <td>{index + 1}</td>
                <td>{book.isbn}</td>
                <td>{book.title}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${getStockIndicatorColor(book.stock_qty)}`}></span>
                    <span>
                      {book.stock_qty}
                    </span>
                  </div>
                </td>
                <td>Rp {book.purchase_price?.toLocaleString('id-ID') || '0'}</td>
                <td>Rp {book.selling_price.toLocaleString('id-ID')}</td>
                <td>{book.category}</td>
                <td>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      className="btn btn-sm text-sm border rounded-lg px-2 mt-1" 
                      onClick={() => openStockModal(book, 'IN')}
                    >
                      Tambah Stok
                    </button>
                    <button 
                      className="btn btn-md"
                      onClick={() => handleEdit(book)}
                    >
                      <SquarePen className="w-5 h-5 text-warning" />
                    </button>
                    <button 
                      className="btn btn-md"
                      onClick={() => handleDelete(book.book_id)}
                    >
                      <Trash className="w-5 h-5 text-error" />
                    </button>
                    <button 
                      className="btn btn-md" 
                      onClick={() => handleHistory(book)}
                      title="Riwayat Stock"
                    >
                      <History className="w-5 h-5 text-primary-crm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBooks.length === 0 && (
          <div className="text-center p-8 text-base-content/60">
            Tidak ada buku yang ditemukan
          </div>
        )}
      </div>
      </div>

      {/* Modal Tambah Buku */}
      <dialog id="add_modal" className="modal">
        <div className="modal-box w-11/12 max-w-3xl p-6">
          <h3 className="font-bold text-2xl mb-4">Tambah Buku Baru</h3>
          <AddBookForm onBookAdded={() => { fetchBooks(); fetchCategories(); }} /> 
        </div>
      </dialog>

      {/* Modal Edit Buku */}
      <dialog id="edit_modal" className="modal">
        {bookToEdit && (
          <div className="modal-box w-11/12 max-w-3xl p-6">
            <h3 className="font-bold text-2xl mb-4">Edit Buku</h3>
            <EditBookForm 
              book={bookToEdit} 
              categories={categories}
              onBookUpdated={() => {
                fetchBooks();
                setBookToEdit(null);
                document.getElementById('edit_modal').close();
              }} 
            />
          </div>
        )}
      </dialog>

      {/* Modal Stock Update */}
      <dialog id="stock_modal" className="modal">
        {selectedBook && (
          <StockUpdateModal
            book={selectedBook}
            operationType={operationType}
            onClose={closeStockModal}
            onStockUpdated={fetchBooks}
          />
        )}
      </dialog>

      {/* Modal Stock History */}
      <dialog id="history_modal" className="modal">
        {selectedBook && (
          <div className="modal-box w-11/12 max-w-3xl p-6">
            {/* Header */}
            <div className="mb-2">
              <h3 className="font-bold text-2xl">Riwayat Stock</h3>
            </div>

            {/* Info Buku */}
            <div className="mb-4 p-4 rounded-lg border border-base-200 bg-base-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-base font-semibold mb-4">{selectedBook.title}</div>
                  <div className="text-base-content/70">Penulis: {selectedBook.author || '-'}</div>
                  <div className="text-base-content/70">Kategori: {selectedBook.category || '-'}</div>
                </div>
                <div>
                  <div className="text-base font-semibold mb-4 border w-40 px-4 bg-black/5 rounded-md">{selectedBook.isbn}</div>
                  <div className="text-base-content/70">Harga Beli: <span className="font-medium">Rp {selectedBook.purchase_price?.toLocaleString('id-ID') || '0'}</span></div>
                  <div className="text-base-content/70">Harga Jual: <span className="font-medium">Rp {selectedBook.selling_price?.toLocaleString('id-ID') || '0'}</span></div>
                </div>
              </div>
            </div>

            {/* Tabel Riwayat (scroll only table) */}
            {historyLoading ? (
              <div className="text-center p-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : stockHistory.length === 0 ? (
              <div className="text-center p-8 text-base-content/60">
                Belum ada riwayat perubahan stok
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-80 overflow-y-auto rounded-lg border border-base-200">
                  <table className="table table-zebra w-full">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="w-1/3">Tanggal & Waktu</th>
                        <th className="w-1/3">Perubahan Stok</th>
                        <th className="w-1/3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockHistory.map((history, index) => (
                        <tr key={index}>
                          <td>{formatDateTime(history.transaction_date)}</td>
                          <td>
                            <span className={`badge ${history.quantity_change > 0 ? 'badge-success' : 'badge-error'}`}>
                              {history.quantity_change > 0 ? '+' : ''}{history.quantity_change}
                            </span>
                          </td>
                          <td>{history.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button className="btn border rounded-xl px-3" onClick={closeHistoryModal}>Tutup</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};

// Komponen Edit Book Form
const EditBookForm = ({ book, categories, onBookUpdated }) => {
  const [formData, setFormData] = useState({
    isbn: book.isbn || '',
    title: book.title || '',
    author: book.author || '',
    category: book.category || '',
    purchase_price: book.purchase_price || '',
    selling_price: book.selling_price || '',
    stock_qty: book.stock_qty || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const dataToSend = {
      ...formData,
      // kategori bisa dari input bebas atau pilihan datalist
      purchase_price: parseFloat(formData.purchase_price),
      selling_price: parseFloat(formData.selling_price),
      stock_qty: parseInt(formData.stock_qty),
    };

    try {
      await axios.put(`${API_URL}/${book.book_id}`, dataToSend);
      onBookUpdated();
      document.getElementById('edit_modal').close();
    } catch (err) {
      console.error('Error updating book:', err.response ? err.response.data : err);
      setError('Gagal memperbarui buku. Pastikan data lengkap dan valid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}
      
      <div className="flex space-x-4 mb-4">
        <label className="form-control w-full">
          <div className="label"><span className="label-text text-sm font-bold">ISBN</span></div>
          <input type="text" name="isbn" value={formData.isbn} onChange={handleChange} className="input input-bordered w-full border text-sm rounded-lg px-2" required />
        </label>
        <label className="form-control w-full">
          <div className="label"><span className="label-text text-sm font-bold">Judul</span></div>
          <input type="text" name="title" value={formData.title} onChange={handleChange} className="input input-bordered w-full border text-sm rounded-lg px-2" required />
        </label>
      </div>

      <div className="flex space-x-4 mb-4">
        <label className="form-control w-full">
          <div className="label"><span className="label-text text-sm font-bold">Penulis</span></div>
          <input type="text" name="author" value={formData.author} onChange={handleChange} className="input input-bordered w-full border text-sm rounded-lg px-2" required />
        </label>
        <CategoryCombobox 
          label="Kategori"
          value={formData.category}
          onChange={handleChange}
          options={categories}
          placeholder="Ketik atau pilih kategori"
        />
      </div>
      
      <div className="flex space-x-4 mb-6">
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Harga Beli (Rp)</span></div>
          <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleChange} className="input input-bordered w-full text-sm px-2 border rounded-lg" step="1000" required />
        </label>  
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Harga Jual (Rp)</span></div>
          <input type="number" name="selling_price" value={formData.selling_price} onChange={handleChange} className="input input-bordered w-full text-sm px-2 border rounded-lg" step="1000" required />
        </label>
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Stok</span></div>
          <input type="number" name="stock_qty" value={formData.stock_qty} onChange={handleChange} className="input input-bordered w-full text-sm px-2 border rounded-lg" min="0" required />
        </label>
      </div>

      <div className="modal-action">
        <button type="button" className="btn border rounded-lg px-3 text-sm font-bold" onClick={() => document.getElementById('edit_modal').close()} disabled={isSubmitting}>
          Batal
        </button>
        <button type="submit" className="btn bg-primary-crm text-white text-sm font-bold px-3 border-none rounded-lg" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  );
};

export default InventoryPage;
