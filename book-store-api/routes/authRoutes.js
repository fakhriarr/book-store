const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Secret key untuk JWT (dalam production, gunakan environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'book-store-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

// Middleware untuk verifikasi token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
    }
};

// Middleware untuk verifikasi role owner
const verifyOwner = (req, res, next) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Akses ditolak. Hanya owner yang dapat melakukan aksi ini.' });
    }
    next();
};

// Inisialisasi default users saat pertama kali
const initDefaultUsers = async () => {
    try {
        // Cek apakah sudah ada user
        const [existingUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
        
        if (existingUsers[0].count === 0) {
            console.log('Membuat default users...');
            
            // Hash password
            const ownerPassword = await bcrypt.hash('owner', 10);
            const adminPassword = await bcrypt.hash('admin', 10);
            
            // Insert default owner
            await pool.query(
                'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
                ['owner', ownerPassword, 'Owner Toko', 'owner']
            );
            
            // Insert default admin
            await pool.query(
                'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
                ['admin', adminPassword, 'Admin Toko', 'admin']
            );
            
            console.log('Default users berhasil dibuat!');
            console.log('- Owner: username "owner", password "owner"');
            console.log('- Admin: username "admin", password "admin"');
        }
    } catch (error) {
        // Tabel mungkin belum ada
        console.log('Tabel users belum ada. Silakan jalankan create_users_table.sql terlebih dahulu.');
    }
};

// Jalankan inisialisasi
initDefaultUsers();

// ==================== AUTH ROUTES ====================

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password harus diisi' });
        }
        
        // Cari user berdasarkan username
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Username atau password salah' });
        }
        
        const user = users[0];
        
        // Verifikasi password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Username atau password salah' });
        }
        
        // Update last_login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
            [user.user_id]
        );
        
        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            message: 'Login berhasil',
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Error login:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', verifyToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT user_id, username, full_name, role, last_login, created_at FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        
        res.json(users[0]);
        
    } catch (error) {
        console.error('Error get user info:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== USER MANAGEMENT (OWNER ONLY) ====================

// GET /api/auth/users - Get all users (owner only)
router.get('/users', verifyToken, verifyOwner, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT user_id, username, full_name, role, is_active, last_login, created_at, updated_at 
             FROM users 
             ORDER BY role ASC, created_at DESC`
        );
        
        res.json(users);
        
    } catch (error) {
        console.error('Error get users:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/users - Create new user (owner only)
router.post('/users', verifyToken, verifyOwner, async (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password harus diisi' });
        }
        
        // Validasi role
        if (role && !['owner', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role harus owner atau admin' });
        }
        
        // Cek apakah username sudah ada
        const [existing] = await pool.query(
            'SELECT user_id FROM users WHERE username = ?',
            [username]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user baru
        const [result] = await pool.query(
            'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, full_name || null, role || 'admin']
        );
        
        res.status(201).json({
            message: 'User berhasil ditambahkan',
            user_id: result.insertId
        });
        
    } catch (error) {
        console.error('Error create user:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/auth/users/:id - Update user (owner only)
router.put('/users/:id', verifyToken, verifyOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, full_name, role, is_active } = req.body;
        
        // Cek apakah user ada
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        
        // Jangan biarkan owner menonaktifkan dirinya sendiri
        if (users[0].role === 'owner' && is_active === false && req.user.user_id === parseInt(id)) {
            return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri' });
        }
        
        // Cek username duplikat
        if (username) {
            const [existing] = await pool.query(
                'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
                [username, id]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Username sudah digunakan' });
            }
        }
        
        // Update user
        const updateFields = [];
        const updateValues = [];
        
        if (username !== undefined) {
            updateFields.push('username = ?');
            updateValues.push(username);
        }
        if (full_name !== undefined) {
            updateFields.push('full_name = ?');
            updateValues.push(full_name);
        }
        if (role !== undefined && ['owner', 'admin'].includes(role)) {
            updateFields.push('role = ?');
            updateValues.push(role);
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            updateValues.push(is_active);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
        }
        
        updateValues.push(id);
        
        await pool.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
            updateValues
        );
        
        res.json({ message: 'User berhasil diupdate' });
        
    } catch (error) {
        console.error('Error update user:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/auth/users/:id/reset-password - Reset password (owner only)
router.put('/users/:id/reset-password', verifyToken, verifyOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;
        
        if (!new_password) {
            return res.status(400).json({ error: 'Password baru harus diisi' });
        }
        
        if (new_password.length < 4) {
            return res.status(400).json({ error: 'Password minimal 4 karakter' });
        }
        
        // Cek apakah user ada
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        
        // Hash password baru
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // Update password
        await pool.query(
            'UPDATE users SET password = ? WHERE user_id = ?',
            [hashedPassword, id]
        );
        
        res.json({ message: 'Password berhasil direset' });
        
    } catch (error) {
        console.error('Error reset password:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/auth/users/:id - Delete user (owner only)
router.delete('/users/:id', verifyToken, verifyOwner, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Cek apakah user ada
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        
        // Jangan biarkan owner menghapus dirinya sendiri
        if (req.user.user_id === parseInt(id)) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
        }
        
        // Jangan hapus owner terakhir
        if (users[0].role === 'owner') {
            const [ownerCount] = await pool.query(
                'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = TRUE',
                ['owner']
            );
            
            if (ownerCount[0].count <= 1) {
                return res.status(400).json({ error: 'Tidak dapat menghapus owner terakhir' });
            }
        }
        
        // Soft delete - nonaktifkan user
        await pool.query('UPDATE users SET is_active = FALSE WHERE user_id = ?', [id]);
        
        res.json({ message: 'User berhasil dihapus' });
        
    } catch (error) {
        console.error('Error delete user:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/auth/change-password - Change own password (any authenticated user)
router.put('/change-password', verifyToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Password lama dan baru harus diisi' });
        }
        
        if (new_password.length < 4) {
            return res.status(400).json({ error: 'Password baru minimal 4 karakter' });
        }
        
        // Get current user
        const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.user.user_id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }
        
        // Verifikasi password lama
        const isValidPassword = await bcrypt.compare(current_password, users[0].password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Password lama salah' });
        }
        
        // Hash password baru
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // Update password
        await pool.query(
            'UPDATE users SET password = ? WHERE user_id = ?',
            [hashedPassword, req.user.user_id]
        );
        
        res.json({ message: 'Password berhasil diubah' });
        
    } catch (error) {
        console.error('Error change password:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export middleware untuk digunakan di routes lain
module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.verifyOwner = verifyOwner;
