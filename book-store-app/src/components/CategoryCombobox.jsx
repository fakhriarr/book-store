// src/components/CategoryCombobox.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

const CategoryCombobox = ({ value, onChange, options = [], placeholder = 'Ketik atau pilih kategori', label, panelMaxHeightClass = 'max-h-40' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase();
    if (!q) return options;
    return options.filter((opt) => (opt || '').toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (opt) => {
    onChange({ target: { name: 'category', value: opt } });
    setQuery(opt);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    onChange({ target: { name: 'category', value: e.target.value } });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown') setOpen(true);
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <div className="label text-sm font-bold"><span className="label-text">{label}</span></div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="input input-bordered w-full text-sm border rounded-lg pr-10 px-2"
          placeholder={placeholder}
          required
          name="category"
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle options"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
        </button>

        {open && (
          <div className={`absolute z-50 mt-1 w-full ${panelMaxHeightClass} overflow-auto rounded-lg border border-base-300 bg-base-100 shadow`}>
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-base-content/60">Tidak ada opsi. Tekan Enter untuk menggunakan input saat ini.</div>
            ) : (
              <ul className="menu menu-sm p-3">
                {filtered.map((opt) => (
                  <li key={opt}>
                    <button type="button" className="justify-start py-2" onClick={() => handleSelect(opt)}>
                      {opt}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="label"><span className="label-text-alt text-xs text-base-content/60">Pilih dari daftar atau ketik kategori baru.</span></div>
    </div>
  );
};

export default CategoryCombobox;


