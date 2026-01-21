import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Plus, Edit, Trash2, Key, 
    UserCheck, UserX, Shield, User, X, Save,
    AlertCircle, CheckCircle
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    
    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    // Form states
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'admin'
    });
    const [newPassword, setNewPassword] = useState('');
    
    // Alert state
    const [alert, setAlert] = useState({ show: false, type: '', message: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/auth/users`);
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
            showAlert('error', 'Gagal mengambil data user');
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (type, message) => {
        setAlert({ show: true, type, message });
        setTimeout(() => setAlert({ show: false, type: '', message: '' }), 3000);
    };

    const resetForm = () => {
        setFormData({
            username: '',
            password: '',
            full_name: '',
            role: 'admin'
        });
        setNewPassword('');
        setSelectedUser(null);
    };

    // Filter users berdasarkan search, role, dan status
    const filteredUsers = users.filter(user => {
        // Filter berdasarkan search term
        const matchesSearch = searchTerm === '' || 
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filter berdasarkan role
        const matchesRole = selectedRole === '' || user.role === selectedRole;
        
        // Filter berdasarkan status
        const matchesStatus = selectedStatus === '' || 
            (selectedStatus === 'active' && user.is_active) ||
            (selectedStatus === 'inactive' && !user.is_active);
        
        return matchesSearch && matchesRole && matchesStatus;
    });

    // ==================== HANDLERS ====================

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/auth/users`, formData);
            showAlert('success', 'User berhasil ditambahkan');
            setIsAddModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            showAlert('error', error.response?.data?.error || 'Gagal menambahkan user');
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/auth/users/${selectedUser.user_id}`, {
                username: formData.username,
                full_name: formData.full_name,
                role: formData.role,
                is_active: formData.is_active
            });
            showAlert('success', 'User berhasil diupdate');
            setIsEditModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            showAlert('error', error.response?.data?.error || 'Gagal mengupdate user');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/auth/users/${selectedUser.user_id}/reset-password`, {
                new_password: newPassword
            });
            showAlert('success', 'Password berhasil direset');
            setIsResetPasswordModalOpen(false);
            resetForm();
        } catch (error) {
            showAlert('error', error.response?.data?.error || 'Gagal mereset password');
        }
    };

    const handleDeleteUser = async () => {
        try {
            await axios.delete(`${API_URL}/auth/users/${selectedUser.user_id}`);
            showAlert('success', 'User berhasil dihapus');
            setIsDeleteModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            showAlert('error', error.response?.data?.error || 'Gagal menghapus user');
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            full_name: user.full_name || '',
            role: user.role,
            is_active: user.is_active
        });
        setIsEditModalOpen(true);
    };

    const openResetPasswordModal = (user) => {
        setSelectedUser(user);
        setNewPassword('');
        setIsResetPasswordModalOpen(true);
    };

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-0">
            {/* Alert */}
            {alert.show && (
                <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
                    {alert.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span>{alert.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-4xl font-bold">
                        Manajemen User
                    </h1>
                </div>

                <button 
                    className="btn btn-sm bg-primary-crm text-white text-xs font-bold px-2 border-none rounded-lg"
                    onClick={() => {
                        resetForm();
                        setIsAddModalOpen(true);
                    }}
                >
                    + Tambah User
                </button>
            </div>

            {/* Search Bar dan Filter */}
            <div className="bg-base-100 p-4 rounded-xl border border-base-200 mb-4">
                <div className="flex flex-wrap gap-4">
                    {/* Filter Role */}
                    <div className="min-w-[150px]">
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text text-sm font-bold">Role</span></div>
                            <select 
                                className="select select-bordered w-full text-sm border px-2 rounded-lg"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                            >
                                <option value="">Semua Role</option>
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                    </div>

                    {/* Filter Status */}
                    <div className="min-w-[150px]">
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text text-sm font-bold">Status</span></div>
                            <select 
                                className="select select-bordered w-full text-sm border px-2 rounded-lg"
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                <option value="">Semua Status</option>
                                <option value="active">Aktif</option>
                                <option value="inactive">Tidak Aktif</option>
                            </select>
                        </label>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text text-sm font-bold">Pencarian</span></div>
                            <input 
                                type="text" 
                                placeholder="Cari berdasarkan username atau nama..." 
                                className="input input-bordered w-full text-sm border px-2 rounded-lg"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto bg-base-100 p-4 rounded-xl border border-base-200">
                <div className="overflow-x-auto max-h-[55vh] bg-base-100 rounded-lg border border-base-200">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : (
                    <table className="table table-zebra w-full table-pin-rows border border-base-200">
                        <thead className='border'>
                            <tr className='bg-gray-50'>
                                <th>No</th>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Login Terakhir</th>
                                <th>Dibuat</th>
                                <th className="text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-8 text-gray-500">
                                        Tidak ada user ditemukan
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => (
                                    <tr key={user.user_id} className="hover">
                                        <td>
                                            {index + 1}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <div className="font-medium">{user.username}</div>
                                                    <div className="text-sm text-gray-500">{user.full_name || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge border ${
                                                user.role === 'owner' 
                                                    ? 'bg-orange-50 border-orange-600 text-orange-600' 
                                                    : 'bg-blue-50 border-blue-600 text-blue-600'
                                            }`}>
                                                {user.role === 'owner' ? 'Owner' : 'Admin'}
                                            </span>
                                        </td>
                                        <td>
                                            {user.is_active ? (
                                                <span className="badge border bg-green-50 border-green-600 text-green-600 gap-1">
                                                    <UserCheck className="w-3 h-3" />
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="badge border bg-red-50 border-red-600 text-red-600 gap-1">
                                                        <UserX className="w-3 h-3" />
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-sm">{formatDate(user.last_login)}</td>
                                            <td className="text-sm">{formatDate(user.created_at)}</td>
                                            <td>
                                                <div className="flex justify-center gap-4">
                                                    <button 
                                                        className=""
                                                        onClick={() => openEditModal(user)}
                                                        title="Edit User"
                                                    >
                                                        <Edit className="w-4 h-4 text-yellow-500" />
                                                    </button>
                                                    <button 
                                                        className=""
                                                        onClick={() => openResetPasswordModal(user)}
                                                        title="Reset Password"
                                                    >
                                                        <Key className="w-4 h-4 text-blue-600" />
                                                    </button>
                                                    <button 
                                                        className="btn btn-ghost btn-sm text-error"
                                                        onClick={() => openDeleteModal(user)}
                                                        title="Hapus User"
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
                )}
                </div>
            </div>

            {/* ==================== MODALS ==================== */}

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <button 
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => setIsAddModalOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg mb-4">Tambah User Baru</h3>
                        
                        <form onSubmit={handleAddUser}>
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Username <span className='text-red-600'>*</span></span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered border rounded-lg flex px-2"
                                    value={formData.username}
                                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Password <span className='text-red-600'>*</span></span>
                                </label>
                                <input
                                    type="password"
                                    className="input input-bordered border rounded-lg flex px-2"
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    required
                                    minLength={4}
                                />
                            </div>
                            
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Nama Lengkap</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered border rounded-lg flex px-2"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-control mb-4">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Role <span className='text-red-600'>*</span></span>
                                </label>
                                <select
                                    className="select select-bordered border rounded-lg flex px-2"
                                    value={formData.role}
                                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="owner">Owner</option>
                                </select>
                            </div>
                            
                            <div className="modal-action gap-2">
                                <button type="button" className="border rounded-lg px-4 py-2" onClick={() => setIsAddModalOpen(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="border rounded-lg bg-primary-crm text-white flex items-center gap-2 px-4 py-2">
                                    <Save className="w-4 h-4" />
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsAddModalOpen(false)}></div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && selectedUser && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <button 
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => setIsEditModalOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg mb-4">Edit User</h3>
                        
                        <form onSubmit={handleEditUser}>
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Username <span className='text-red-600'>*</span></span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered border px-2 rounded-lg flex"
                                    value={formData.username}
                                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Nama Lengkap</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered border px-2 rounded-lg flex"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Role <span className='text-red-600'>*</span></span>
                                </label>
                                <select
                                    className="select select-bordered border px-2 rounded-lg flex"
                                    value={formData.role}
                                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="owner">Owner</option>
                                </select>
                            </div>
                            
                            <div className="form-control mb-4">
                                <label className="label cursor-pointer justify-start gap-3">
                                    <input
                                        type="checkbox"
                                        className={`toggle border ${formData.is_active ? 'bg-green-300 border-green-500 hover:bg-green-400' : ''}`}
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                                    />
                                    <span className="label-text text-sm text-gray-700 mb-1">User Aktif</span>
                                </label>
                            </div>
                            
                            <div className="modal-action gap-2">
                                <button type="button" className="border rounded-lg px-4 py-2" onClick={() => setIsEditModalOpen(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="border rounded-lg bg-primary-crm text-white flex items-center gap-2 px-4 py-2">
                                    <Save className="w-4 h-4" />
                                    Update
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}></div>
                </div>
            )}

            {/* Reset Password Modal */}
            {isResetPasswordModalOpen && selectedUser && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <button 
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => setIsResetPasswordModalOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg mb-4">Reset Password</h3>
                        
                        <p className="text-gray-600 text-sm mb-4">
                            Reset password untuk user <strong>{selectedUser.username}</strong>
                        </p>
                        
                        <form onSubmit={handleResetPassword}>
                            <div className="form-control mb-4">
                                <label className="label">
                                    <span className="label-text text-sm text-gray-700 mb-1">Password Baru <span className='text-red-600'>*</span></span>
                                </label>
                                <input
                                    type="password"
                                    className="input input-bordered border rounded-lg flex px-2"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={4}
                                    placeholder="Minimal 4 karakter"
                                />
                            </div>
                            
                            <div className="modal-action gap-2">
                                <button type="button" className="border rounded-lg px-4 py-2" onClick={() => setIsResetPasswordModalOpen(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="border rounded-lg bg-primary-crm text-white flex items-center gap-2 px-4 py-2">
                                    <Key className="w-4 h-4" />
                                    Reset Password
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsResetPasswordModalOpen(false)}></div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedUser && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Konfirmasi Hapus</h3>
                        <div className='border border-red-600 bg-red-50 rounded-lg p-2'>
                            <p className="text-red-800 mb-4">
                                Apakah Anda yakin ingin menghapus user <strong>{selectedUser.username}</strong>?
                            </p>
                            <p className="text-sm text-red-800 mb-2">
                                User akan dinonaktifkan dan tidak bisa login lagi.
                            </p>
                        </div>                        
                        <div className="modal-action gap-2">
                            <button className="border rounded-lg px-4 py-2" onClick={() => setIsDeleteModalOpen(false)}>
                                Batal
                            </button>
                            <button className="border rounded-lg bg-red-600 text-white flex items-center gap-2 px-4 py-2" onClick={handleDeleteUser}>
                                <Trash2 className="w-4 h-4" />
                                Hapus
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}></div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;
