// src/components/StockUpdateModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Info } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api/books';

const StockUpdateModal = ({ book, operationType, onClose, onStockUpdated }) => {
  const [quantity, setQuantity] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]); // Default hari ini
  const [priceAtSale, setPriceAtSale] = useState(book.selling_price || ''); // Default harga jual buku
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset form saat book atau operationType berubah
  useEffect(() => {
    setQuantity('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setPriceAtSale(book.selling_price || '');
    setError(null);
  }, [book, operationType]);

  // Tentukan judul dan URL berdasarkan jenis operasi
  const isStockIn = operationType === 'IN';
  const title = isStockIn ? `Tambah Stok (${book.title})` : `Kurangi Stok (${book.title})`;
  const endpoint = `${API_BASE_URL}/${book.book_id}/${isStockIn ? 'stock-in' : 'stock-out'}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const qtyNumber = parseInt(quantity);

    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setError('Masukkan jumlah stok yang valid (> 0)');
      setIsSubmitting(false);
      return;
    }

    // Validasi tambahan untuk Stok Keluar
    if (!isStockIn) {
      if (qtyNumber > book.stock_qty) {
        setError(`Stok keluar melebihi stok tersedia (${book.stock_qty}).`);
        setIsSubmitting(false);
        return;
      }
      if (!priceAtSale || parseFloat(priceAtSale) <= 0) {
        setError('Masukkan harga jual yang valid (> 0)');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Kirim permintaan PUT ke API
      const payload = { quantity: qtyNumber };
      // Untuk stok keluar, tambahkan data transaksi
      if (!isStockIn) {
        payload.transaction_date = transactionDate;
        payload.price_at_sale = parseFloat(priceAtSale);
        payload.create_transaction = true; // Flag untuk membuat transaksi
      }
      await axios.put(endpoint, payload);
      
      // Reset state, panggil callback, dan tutup modal
      setQuantity('');
      if (!isStockIn) {
        setPriceAtSale(book.selling_price || '');
      }
      onStockUpdated(); 
      onClose();

    } catch (err) {
      console.error('Error updating stock:', err.response ? err.response.data : err);
      setError('Gagal memperbarui stok. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-box">
      <h3 className="font-bold text-lg mb-4">{title}</h3>
      
      {/* Tampilkan Stok Saat Ini */}
      <div className="p-2 border mb-4 rounded-lg bg-black/5">
        <div className='flex items-center gap-2'>
          <Info className='w-4 h-4'/>
          <span className='text-sm text-base-content-crm'>Stok saat ini: <span className="font-bold">{book.stock_qty}</span> unit</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Error Alert */}
        {error && (
          <div role="alert" className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <label className="form-control w-full mb-4">
          <div className="label">
            <span className="label-text text-sm font-bold">Jumlah Stok {isStockIn ? 'Masuk' : 'Keluar'}</span>
          </div>
          <input 
            type="number" 
            placeholder="Masukkan jumlah" 
            className="input input-bordered w-full border rounded-lg px-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            required
          />
        </label>

        {!isStockIn && (
          <>
            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="mt-2 label-text text-sm"><span className='font-bold'>Harga Jual </span>(<span className="label-text-alt text-base-content/60 text-sm">Harga default: Rp {book.selling_price?.toLocaleString('id-ID') || '0'}</span>)</span>
              </div>
              <input 
                type="number" 
                className="input input-bordered w-full border rounded-lg px-2 text-sm"
                value={priceAtSale}
                onChange={(e) => setPriceAtSale(e.target.value)}
                step="1000"
                min="0"
                required
              />
            </label>
            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="label-text text-sm font-bold mt-2">Tanggal Transaksi</span>
              </div>
              <input 
                type="date" 
                className="input input-bordered w-full text-sm px-2 border rounded-lg"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </label>
          </>
        )}
        
        <div className="modal-action mt-6">
          <button type="button" className="btn border rounded-lg px-2 text-sm font-bold" onClick={onClose} disabled={isSubmitting}>
            Batal
          </button>
          <button type="submit" className={`btn ${isStockIn ? 'btn rounded-lg bg-primary-crm text-white text-sm font-semibold px-3' : 'btn rounded-lg bg-primary-crm text-white text-sm font-semibold px-3'}`} disabled={isSubmitting}>
            {isSubmitting ? <span className="loading loading-spinner"></span> : `Konfirmasi ${isStockIn ? 'Masuk' : 'Keluar'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockUpdateModal;