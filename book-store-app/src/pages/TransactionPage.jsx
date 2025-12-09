// src/pages/TransactionPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_BOOK_URL = 'http://localhost:5000/api/books';
const API_TRANS_URL = 'http://localhost:5000/api/transactions';

// Utility function untuk format Rupiah
const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number || 0);
};

const TransactionPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  // Tampilkan hanya transaksi keluar (OUT)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  // Modal selalu transaksi keluar (OUT)
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookSearch, setBookSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [draftItems, setDraftItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [SELECTED_TRANSACTION, setSelectedTransaction] = useState(null);
  const [transactionDetail, setTransactionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const draftTotal = useMemo(() => {
    return draftItems.reduce((sum, it) => sum + it.total, 0);
  }, [draftItems]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_BOOK_URL}/categories`);
      setCategories(res.data);
    } catch {
      // ignore
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await axios.get(API_BOOK_URL);
      setBooks(res.data || []);
    } catch {
      // ignore
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (q) params.q = q;
      if (category) params.category = category;
      params.type = 'OUT';
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await axios.get(API_TRANS_URL, { params });
      setTransactions(res.data || []);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBooks();
  }, []);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, startDate, endDate]);

  const filteredBookOptions = useMemo(() => {
    const term = bookSearch.toLowerCase();
    return books.filter(b =>
      b.title.toLowerCase().includes(term) || (b.isbn || '').toLowerCase().includes(term)
    ).slice(0, 10);
  }, [books, bookSearch]);

  const resetModal = () => {
    setSelectedBook(null);
    setBookSearch('');
    setQuantity('1');
    setDraftItems([]);
    setPaymentMethod('cash');
    setCustomerName('');
    // always OUT
  };

  const openModal = () => {
    setModalOpen(true);
    setSuccessMessage(null);
    setError(null);
    setTimeout(() => {
      const el = document.getElementById('transaction_modal');
      if (el) el.showModal();
    }, 0);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetModal();
    const el = document.getElementById('transaction_modal');
    if (el) el.close();
  };

  const addItemToDraft = () => {
    if (!selectedBook) return;
    const price = selectedBook.selling_price;
    const qSafe = Math.max(1, parseInt(quantity || '1', 10));
    const maxOut = (selectedBook.stock_qty || 0);
    if (qSafe > maxOut) {
      setError(`Stok ${selectedBook.title} tidak mencukupi.`);
      return;
    }
    const existsIndex = draftItems.findIndex(it => it.book_id === selectedBook.book_id);
    const newItem = {
      book_id: selectedBook.book_id,
      isbn: selectedBook.isbn,
      title: selectedBook.title,
      author: selectedBook.author,
      unit_price: price,
      quantity: qSafe,
      total: qSafe * price,
    };
    if (existsIndex >= 0) {
      const items = [...draftItems];
      const mergedQty = items[existsIndex].quantity + qSafe;
      if (mergedQty > maxOut) {
        setError(`Stok ${selectedBook.title} tidak mencukupi.`);
        return;
      }
      items[existsIndex] = {
        ...items[existsIndex],
        quantity: mergedQty,
        total: mergedQty * price,
      };
      setDraftItems(items);
    } else {
      setDraftItems([...draftItems, newItem]);
    }
    // reset per item
    setSelectedBook(null);
    setBookSearch('');
    setQuantity('1');
    setError(null);
  };

  const removeDraftItem = (bookId) => {
    setDraftItems(draftItems.filter(it => it.book_id !== bookId));
  };

  const submitDraft = async () => {
    if (draftItems.length === 0) {
      setError('Daftar item kosong.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const items = draftItems.map(it => ({
        book_id: it.book_id,
        quantity: it.quantity,
        price_at_sale: it.unit_price,
      }));
      await axios.post(API_TRANS_URL, { items, payment_method: paymentMethod, customer_name: customerName });
      setSuccessMessage(`Transaksi berhasil. Total: ${formatRupiah(draftTotal)}`);
      closeModal();
      await fetchTransactions();
    } catch (e) {
      console.error(e);
      setError('Gagal menyimpan transaksi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Fungsi untuk membuka modal detail
  const openDetailModal = async (transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalOpen(true);
    setDetailLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_TRANS_URL}/${transaction.id}`);
      setTransactionDetail(response.data);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat detail transaksi.');
    } finally {
      setDetailLoading(false);
    }
    
    setTimeout(() => {
      const el = document.getElementById('detail_modal');
      if (el) el.showModal();
    }, 0);
  };

  // Fungsi untuk menutup modal detail
  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedTransaction(null);
    setTransactionDetail(null);
    const el = document.getElementById('detail_modal');
    if (el) el.close();
  };

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-4xl font-bold">Transaksi</h2>
        </div>
        <button className="btn btn-sm bg-primary-crm text-white text-xs font-bold px-2 border-none rounded-lg" onClick={openModal}>
          + Tambah Transaksi
        </button>
      </div>

      {error && <div role="alert" className="alert alert-error shadow-lg mb-4"><span>{error}</span></div>}
      {successMessage && <div role="alert" className="alert alert-success shadow-lg mb-4"><span>{successMessage}</span></div>}

      {/* Search & Filters */}
      <div className="bg-base-100 p-4 rounded-xl border border-base-200 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-[20vh]">
            <label className="form-control w-full">
              <div className="label"><span className="label-text text-sm font-bold">Kategori</span></div>
              <select 
                className="select select-bordered w-full text-sm border px-2 rounded-lg"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Semua</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className='max-w-[20vh]'>
            <label className="form-control">
              <div className="label"><span className="label-text text-sm font-bold">Dari Tanggal</span></div>
              <input type="date" className="input input-bordered text-sm border rounded-lg px-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
          </div>
          <div className='max-w-[20vh]'>
            <label className="form-control">
              <div className="label"><span className="label-text text-sm font-bold">Sampai Tanggal</span></div>
              <input type="date" className="input input-bordered text-sm rounded-lg border px-2" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="form-control w-full">
              <div className="label"><span className="label-text text-sm font-bold">Pencarian</span></div>
              <input 
                type="text" 
                placeholder="Cari judul atau ISBN..." 
                className="input input-bordered w-full text-sm border px-2 rounded-lg"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-base-100 p-4 rounded-xl border border-base-200">
        {loading ? (
          <div className="text-center p-8"><span className="loading loading-spinner loading-lg"></span> Memuat data...</div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-base-200">
            <table className="table table-zebra w-full">
              <thead className="sticky top-0 bg-gray-50">
                  <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>ISBN</th>
                  <th>Judul</th>
                  <th>Customer</th>
                  <th>Metode</th>
                  <th>Harga Satuan</th>
                  <th>Jumlah</th>
                  <th>Total</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center p-6 text-base-content/60">Tidak ada data</td>
                  </tr>
                ) : (
                  transactions.map((row, idx) => (
                    <tr key={`${row.id || 'in'}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{new Date(row.date).toLocaleString('id-ID')}</td>
                      <td>{row.isbn}</td>
                      <td>{row.title}</td>
                      <td>{row.customerName}</td>
                      <td>{
                        row.payment_method
                          ? ({ cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' }[row.payment_method] || row.payment_method)
                          : 'Tunai'
                      }</td>
                      <td>{row.selling_price && row.selling_price.includes(',') ? row.selling_price.split(',').map(price => formatRupiah(price)).join(', ') : formatRupiah(row.selling_price)}</td>
                      <td>{row.quantity && row.quantity.includes(',') ? row.quantity.split(',').join(', ') : row.quantity}</td>
                      <td>{formatRupiah(row.total)}</td>
                      <td>
                        {row.id && (
                          <button 
                            className="btn btn-sm btn-ghost btn-primary text-xs"
                            onClick={() => openDetailModal(row)}
                          >
                            Detail
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Transaksi */}
      <dialog id="transaction_modal" className="modal">
        {modalOpen && (
          <div className="modal-box w-11/12 max-w-4xl p-6 h-[80vh] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-4 shrink-0">
              <div className="font-bold text-lg">Tambah Transaksi</div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="md:col-span-3 relative">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-sm font-bold">Cari Judul / ISBN</span></div>
                  <input 
                    type="text" 
                    className="input input-bordered w-full text-sm border rounded-lg px-2" 
                    placeholder="Ketik judul atau ISBN..."
                    value={bookSearch}
                    onChange={(e) => { setBookSearch(e.target.value); setSelectedBook(null); }}
                  />
                </label>
                {bookSearch && !selectedBook && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto border rounded-lg bg-base-100 shadow">
                    {filteredBookOptions.map(b => (
                      <button key={b.book_id} className="w-full text-left px-3 py-2 hover:bg-base-200" onClick={() => setSelectedBook(b)}>
                        <div className="font-medium text-sm">{b.title}</div>
                        <div className="text-xs text-base-content/60">{b.isbn} · Stok: {b.stock_qty}</div>
                      </button>
                    ))}
                    {filteredBookOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-base-content/60">Tidak ada hasil</div>
                    )}
                  </div>
                )}
              </div>
              <div className="md:col-span-1">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-sm font-bold">Jumlah</span></div>
                  <input 
                    type="number" 
                    min={1} 
                    className="input input-bordered w-full text-sm border rounded-lg px-2" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(quantity || '1', 10);
                      setQuantity(String(Math.max(1, isNaN(v) ? 1 : v)));
                    }}
                  />
                </label>
              </div>
            </div>

            {selectedBook && (
              <div className="mb-4 p-3 rounded-lg border border-base-200 bg-gray-50 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-base-content/70 mb-2 text-sm font-bold">Judul</div>
                    <div className="text-sm line-clamp-2">{selectedBook.title}</div>
                  </div>
                  <div>
                    <div className="text-base-content/70 mb-2 text-sm font-bold">ISBN</div>
                    <div className="text-base-content/70 text-sm">{selectedBook.isbn}</div>
                  </div>
                  <div>
                    <div className="text-base-content/70 mb-2 text-sm font-bold">Harga Satuan</div>
                    <div className="font-medium">{formatRupiah(selectedBook.selling_price)}</div>
                  </div>
                  <div>
                    <div className="text-base-content/70 mb-2 text-sm font-bold">Subtotal</div>
                    <div className="font-bold text-primary">{formatRupiah(selectedBook.selling_price * Math.max(1, parseInt(quantity || '1', 10)))}</div>
                  </div>
                </div>
                <div className="mt-6">
                  <button className="btn btn-sm bg-primary-crm text-white font-medium px-3 rounded-lg" onClick={addItemToDraft}>Tambah ke Daftar</button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-bold mb-3">Daftar Item</div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="form-control">
                    <div className="label"><span className="label-text text-xs">Nama Pelanggan (opsional)</span></div>
                    <input type="text" className="input input-bordered input-sm border rounded-lg px-2" placeholder="cth. Andi" value={customerName} onChange={(e)=>setCustomerName(e.target.value)} />
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/60 whitespace-nowrap">Metode Pembayaran:</span>
                    <select className="select select-bordered select-sm px-2 w-[15vh] text-sm border rounded-lg" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="cash">Tunai</option>
                      <option value="qris">QRIS</option>
                      <option value="transfer">Transfer</option>
                      <option value="debit">Debit</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-base-200">
                <table className="table table-zebra w-full text-sm">
                  <thead className="sticky top-0 bg-black-gray-50">
                    <tr>
                      <th>No</th>
                      <th>ISBN</th>
                      <th>Judul</th>
                      <th>Qty</th>
                      <th>Harga</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-4 text-base-content/60">Belum ada item</td>
                      </tr>
                    ) : (
                      draftItems.map((it, i) => (
                        <tr key={it.book_id}>
                          <td>{i + 1}</td>
                          <td>{it.isbn}</td>
                          <td className="max-w-[260px] truncate" title={it.title}>{it.title}</td>
                          <td>{it.quantity}</td>
                          <td>{formatRupiah(it.unit_price)}</td>
                          <td className="font-semibold">{formatRupiah(it.total)}</td>
                          <td>
                            <button className="btn btn-sm border rounded-lg px-2" onClick={() => removeDraftItem(it.book_id)}>Hapus</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center gap-4 mt-3 bg-gray-50 rounded-lg py-2 px-3">
                <div className="text-sm">Total</div>
                <div className="text-2xl font-bold text-primary">{formatRupiah(draftTotal)}</div>
              </div>
            </div>

            </div>
            <div className="modal-action shrink-0">
              <button className="btn border rounded-lg px-3" onClick={closeModal} disabled={submitting}>Batal</button>
              <button className="btn bg-primary-crm rounded-lg px-3 text-sm text-white font-medium" onClick={submitDraft} disabled={submitting || draftItems.length === 0}>
                {submitting ? <span className="loading loading-spinner"></span> : 'Simpan Transaksi'}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Modal Detail Transaksi */}
      <dialog id="detail_modal" className="modal">
        {detailModalOpen && (
          <div className="modal-box w-11/12 max-w-4xl p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-4 shrink-0">
              <div className="font-bold text-lg">Detail Transaksi</div>
              <button className="btn btn-sm btn-ghost" onClick={closeDetailModal}>✕</button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center items-center flex-1">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : transactionDetail ? (
              <div className="flex-1 overflow-y-auto pr-1">
                {/* Informasi Header Transaksi */}
                <div className="bg-base-200 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-base-content/70">ID Transaksi</div>
                      <div className="font-medium">{transactionDetail.transaction_id}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-base-content/70">Tanggal</div>
                      <div className="font-medium">{new Date(transactionDetail.transaction_date).toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-base-content/70">Customer</div>
                      <div className="font-medium">{transactionDetail.customer_name || '-'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-base-content/70">Metode Pembayaran</div>
                      <div className="font-medium">
                        {transactionDetail.payment_method 
                          ? ({ cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' }[transactionDetail.payment_method] || transactionDetail.payment_method)
                          : 'Tunai'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-base-300">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-base-content/70">Total Item</div>
                      <div className="font-bold text-lg text-primary">
                        {transactionDetail.items.reduce((sum, item) => sum + item.quantity, 0)} item
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="font-semibold text-base-content/70">Total Harga</div>
                      <div className="font-bold text-xl text-primary">{formatRupiah(transactionDetail.total_amount)}</div>
                    </div>
                  </div>
                </div>

                {/* Tabel Item */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-3">Daftar Item</div>
                  <div className="overflow-x-auto rounded-lg border border-base-200">
                    <table className="table table-zebra w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th>No</th>
                          <th>Judul Buku</th>
                          <th>ISBN</th>
                          <th>Penulis</th>
                          <th className="text-right">Jumlah</th>
                          <th className="text-right">Harga Satuan</th>
                          <th className="text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionDetail.items.map((item, index) => (
                          <tr key={item.book_id}>
                            <td>{index + 1}</td>
                            <td className="max-w-xs truncate" title={item.title}>{item.title}</td>
                            <td>{item.isbn}</td>
                            <td className="max-w-xs truncate" title={item.author}>{item.author}</td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right">{formatRupiah(item.unit_price)}</td>
                            <td className="text-right font-semibold">{formatRupiah(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-base-200">
                          <td colSpan={6} className="text-right font-bold">Total Harga</td>
                          <td className="text-right font-bold text-lg text-primary">{formatRupiah(transactionDetail.total_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-base-content/60 flex-1 flex items-center justify-center">
                Tidak ada data detail transaksi
              </div>
            )}

            <div className="modal-action shrink-0">
              <button className="btn border rounded-lg px-3" onClick={closeDetailModal}>Tutup</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};

export default TransactionPage;