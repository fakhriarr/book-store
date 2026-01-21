import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Set default axios header jika ada token
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Cek validitas token saat aplikasi dimuat
    useEffect(() => {
        const validateToken = async () => {
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
                try {
                    const response = await axios.get(`${API_URL}/auth/me`);
                    setUser(response.data);
                } catch (error) {
                    console.error('Token tidak valid:', error);
                    logout();
                }
            }
            setLoading(false);
        };

        validateToken();
    }, []);

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                username,
                password
            });

            const { token: newToken, user: userData } = response.data;

            // Simpan token ke localStorage
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(userData);

            // Set axios default header
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Login gagal'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    const changePassword = async (currentPassword, newPassword) => {
        try {
            await axios.put(`${API_URL}/auth/change-password`, {
                current_password: currentPassword,
                new_password: newPassword
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Gagal mengubah password'
            };
        }
    };

    // Helper untuk cek role
    const isOwner = () => user?.role === 'owner';
    const isAdmin = () => user?.role === 'admin';
    const isAuthenticated = () => !!user;

    // Helper untuk cek akses halaman
    const canAccess = (page) => {
        if (!user) return false;

        // Owner bisa akses semua
        if (user.role === 'owner') return true;

        // Admin tidak bisa akses laporan dan manajemen user
        const restrictedForAdmin = ['reports', 'users'];
        return !restrictedForAdmin.includes(page);
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        changePassword,
        isOwner,
        isAdmin,
        isAuthenticated,
        canAccess
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
