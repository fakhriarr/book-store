import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

const LoginPage = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);

        if (!result.success) {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo dan Judul */}
                <div className="flex flex-rowitems-center justify-center gap-3 mb-6">
                    <LogIn className="mb-4 w-12 h-12 text-primary-crm" />
                    <h1 className="text-3xl font-bold mt-2 text-gray-800">Masuk ke Akun Anda</h1>
                </div>

                {/* Form Login */}
                <div className="bg-white rounded-2xl">
                    <form onSubmit={handleSubmit}>
                        {/* Error Alert */}
                        {error && (
                            <div className="alert alert-error mb-4">
                                <AlertCircle className="w-5 h-5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Username */}
                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text text-sm text-gray-700 mb-2">Username</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Masukkan username"
                                className="input input-bordered w-full border border-gray-700 rounded-lg px-2"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div className="form-control mb-6">
                            <label className="label">
                                <span className="label-text text-sm text-gray-700 mb-2">Password</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Masukkan password"
                                    className="input input-bordered w-full border border-gray-700 rounded-lg px-2 pr-12"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className={`border rounded-lg bg-primary-crm text-white flex items-center justify-center py-2 w-full ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {!loading && <LogIn className="w-5 h-5 mr-2" />}
                            {loading ? 'Memproses...' : 'Login'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-500 text-sm mt-6">
                    © 2025 Toko Buku Solo
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
