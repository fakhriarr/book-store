// src/components/AddBookForm.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CategoryCombobox from './CategoryCombobox';

const API_URL = 'http://localhost:5000/api/books';

const AddBookForm = ({ onBookAdded }) => {
  const [formData, setFormData] = useState({
    isbn: '',
    title: '',
    author: '',
    category: '',
    purchase_price: '',
    selling_price: '',
    stock_qty: '',
  });
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Ambil daftar kategori
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API_URL}/categories`);
        setCategories(response.data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setError(null); // Clear error on change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Konversi harga dan stok ke tipe number
    const dataToSend = {
      ...formData,
      // Jika user mengetik kategori baru yang tidak ada di daftar, tetap kirim apa adanya.
      // Kategori baru akan otomatis tercatat karena sumber kategori adalah DISTINCT(category) dari tabel books.
      purchase_price: parseFloat(formData.purchase_price),
      selling_price: parseFloat(formData.selling_price),
      stock_qty: parseInt(formData.stock_qty),
    };

    try {
      await axios.post(API_URL, dataToSend);
      
      // Reset form dan panggil fungsi callback
      setFormData({
        isbn: '', title: '', author: '', category: '',
        purchase_price: '', selling_price: '', stock_qty: '',
      });
      
      // Tambahkan kategori baru ke daftar lokal (tanpa reload)
      if (dataToSend.category && !categories.includes(dataToSend.category)) {
        setCategories([...categories, dataToSend.category].sort());
      }

      onBookAdded(); // Memuat ulang data di InventoryPage
      
      // Tutup modal secara manual (trik daisyUI)
      document.getElementById('add_modal').close();

    } catch (err) {
      console.error('Error adding book:', err.response ? err.response.data : err);
      setError('Gagal menambah buku. Pastikan ISBN unik dan data lengkap.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Error Alert */}
      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}
      
      {/* Field ISBN dan Judul */}
      <div className="flex space-x-4 mb-4">
        <label className="form-control w-full">
          <div className="label text-sm font-bold"><span className="label-text">ISBN</span></div>
          <input type="text" name="isbn" value={formData.isbn} onChange={handleChange} className="input input-bordered w-full border rounded-lg px-2" required />
        </label>
        <label className="form-control w-full">
          <div className="label text-sm font-bold"><span className="label-text">Judul</span></div>
          <input type="text" name="title" value={formData.title} onChange={handleChange} className="input input-bordered w-full border rounded-lg px-2" required />
        </label>
      </div>

      {/* Field Penulis dan Kategori */}
      <div className="flex space-x-4 mb-4">
        <label className="form-control w-full">
          <div className="label text-sm font-bold"><span className="label-text">Penulis</span></div>
          <input type="text" name="author" value={formData.author} onChange={handleChange} className="input input-bordered w-full border rounded-lg px-2" required />
        </label>
        <CategoryCombobox 
          label="Kategori"
          value={formData.category}
          onChange={handleChange}
          options={categories}
          placeholder="Ketik atau pilih kategori"
        />
      </div>
      
      {/* Field Harga Beli, Harga Jual, dan Stok */}
      <div className="flex space-x-4 mb-6">
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Harga Beli (Rp)</span></div>
          <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleChange} className="input input-bordered w-full border rounded-lg" step="1000" required />
        </label>
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Harga Jual (Rp)</span></div>
          <input type="number" name="selling_price" value={formData.selling_price} onChange={handleChange} className="input input-bordered w-full border rounded-lg" step="1000" required />
        </label>
        <label className="form-control w-1/3">
          <div className="label"><span className="label-text text-sm font-bold">Stok Awal</span></div>
          <input type="number" name="stock_qty" value={formData.stock_qty} onChange={handleChange} className="input input-bordered w-full border rounded-lg" min="0" required />
        </label>
      </div>

      <div className="modal-action">
        {/* Tombol Close Modal */}
        <button type="button" className="btn border rounded-lg px-3 text-sm font-bold" onClick={() => document.getElementById('add_modal').close()} disabled={isSubmitting}>
          Tutup
        </button>
        {/* Tombol Submit */}
        <button type="submit" className="btn bg-primary-crm text-white text-sm font-bold px-3 border-none rounded-lg" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Buku'}
        </button>
      </div>
    </form>
  );
};

export default AddBookForm;