// ==========================================
// Global Variables
// ==========================================
const API_URL = window.location.origin;
let accessToken = null;
let refreshToken = null;
let currentUser = null;
let allUsers = [];
let loadingStates = {};

// Monitoring Variables
let socket = null;
let machines = [];
let subscribedMachines = new Set();
let latestSensorData = new Map();
let simulatorType = null; // 'normal' or 'anomaly'
let isFetchingMachines = false;
let anomalyInterval = null;

// ==========================================
// Loading Management
// ==========================================

function showLoading(key, message = 'Loading...') {
    loadingStates[key] = true;
    const loadingDiv = document.getElementById('globalLoading');
    if (loadingDiv) {
        loadingDiv.classList.remove('hidden');
        loadingDiv.querySelector('.loading-message').textContent = message;
    }
    
    setTimeout(() => {
        if (loadingStates[key]) {
            console.warn(`Loading timeout for: ${key}`);
            hideLoading(key);
        }
    }, 30000);
}

function hideLoading(key) {
    delete loadingStates[key];
    if (Object.keys(loadingStates).length === 0) {
        const loadingDiv = document.getElementById('globalLoading');
        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }
    }
}

// ==========================================
// Authentication
// ==========================================

function initializeApp() {
    const savedAccessToken = localStorage.getItem('adminAccessToken');
    const savedRefreshToken = localStorage.getItem('adminRefreshToken');
    
    if (savedAccessToken && savedRefreshToken) {
        accessToken = savedAccessToken;
        refreshToken = savedRefreshToken;
        verifyAndAutoLogin();
    }
}

async function verifyAndAutoLogin() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            
            if (user.role !== 'admin') {
                showStatus('loginStatus', 'Access denied. Admin role required.', 'error');
                clearTokens();
                return;
            }
            
            currentUser = user;
            showMainSection();
        } else if (response.status === 401) {
            await refreshAccessToken();
        } else {
            throw new Error('Token verification failed');
        }
    } catch (error) {
        console.error('Auto-login failed:', error);
        clearTokens();
    }
}

async function refreshAccessToken() {
    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) throw new Error('Token refresh failed');
        
        const data = await response.json();
        accessToken = data.accessToken;
        localStorage.setItem('adminAccessToken', accessToken);
        
        await verifyAndAutoLogin();
    } catch (error) {
        console.error('Token refresh failed:', error);
        clearTokens();
    }
}

function clearTokens() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRefreshToken');
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showStatus('loginStatus', 'Please enter email and password', 'error');
        return;
    }
    
    showLoading('login', 'Logging in...');
    
    try {
        const response = await fetch(`${API_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }
        
        const data = await response.json();
        
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });
        
        if (!userResponse.ok) throw new Error('Failed to verify user');
        
        const user = await userResponse.json();
        
        if (user.role !== 'admin') {
            showStatus('loginStatus', 'Access denied. Only administrators can access this panel.', 'error');
            return;
        }
        
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        currentUser = user;
        
        localStorage.setItem('adminAccessToken', accessToken);
        localStorage.setItem('adminRefreshToken', refreshToken);
        
        showMainSection();
    } catch (error) {
        showStatus('loginStatus', error.message, 'error');
    } finally {
        hideLoading('login');
    }
}

function showMainSection() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userName').textContent = currentUser.email;
    
    // Share token with app.js for monitoring tab
    window.adminAccessToken = accessToken;
    
    fetchUsers();
    
    setInterval(() => {
        if (accessToken) {
            fetchUsers();
        }
    }, 60000);
}

function logout() {
    clearTokens();
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('loginStatus').textContent = '';
    allUsers = [];
}

// ==========================================
// User Management
// ==========================================

async function fetchUsers() {
    showLoading('users', 'Loading users...');
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return fetchUsers();
        }
        
        if (!response.ok) throw new Error('Failed to fetch users');
        
        allUsers = await response.json();
        updateStats();
        filterUsers();
    } catch (error) {
        console.error('Error fetching users:', error);
        showNotification('Failed to load users: ' + error.message, 'error');
    } finally {
        hideLoading('users');
    }
}

function updateStats() {
    const stats = {
        total: allUsers.length,
        active: allUsers.filter(u => u.isActive).length,
        inactive: allUsers.filter(u => !u.isActive).length,
        admin: allUsers.filter(u => u.role === 'admin').length
    };
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statActive').textContent = stats.active;
    document.getElementById('statInactive').textContent = stats.inactive;
    document.getElementById('statAdmin').textContent = stats.admin;
}

function filterUsers() {
    const filterRole = document.getElementById('filterRole').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    let filteredUsers = allUsers;
    
    if (filterRole !== 'all') {
        filteredUsers = filteredUsers.filter(u => u.role === filterRole);
    }
    
    if (filterStatus !== 'all') {
        const isActive = filterStatus === 'active';
        filteredUsers = filteredUsers.filter(u => u.isActive === isActive);
    }
    
    renderUsers(filteredUsers);
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    document.getElementById('userCount').textContent = `(${users.length})`;
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <i class="bi bi-inbox text-4xl mb-2"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const roleColors = {
            admin: 'bg-purple-100 text-purple-800 border-purple-200',
            operator: 'bg-blue-100 text-blue-800 border-blue-200',
            technician: 'bg-amber-100 text-amber-800 border-amber-200',
            viewer: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        
        const roleIcons = {
            admin: 'shield-check',
            operator: 'person-gear',
            technician: 'tools',
            viewer: 'eye'
        };
        
        const statusColor = user.isActive 
            ? 'bg-green-100 text-green-800 border-green-200'
            : 'bg-red-100 text-red-800 border-red-200';
        
        return `
            <tr class="user-row border-b border-gray-100">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <i class="bi bi-envelope text-gray-400 mr-2"></i>
                        <span class="font-medium text-gray-800">${user.email}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-600">${user.fullName || '-'}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold border ${roleColors[user.role]}">
                        <i class="bi bi-${roleIcons[user.role]} mr-1"></i>
                        ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}">
                        <i class="bi bi-${user.isActive ? 'check-circle' : 'x-circle'} mr-1"></i>
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="openEditUserModal('${user.id}')" 
                                class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm font-semibold transition">
                            <i class="bi bi-pencil mr-1"></i>Edit
                        </button>
                        <button onclick="openEditRoleModal('${user.id}')" 
                                class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm font-semibold transition">
                            <i class="bi bi-shield mr-1"></i>Role
                        </button>
                        ${user.isActive ? `
                            <button onclick="toggleUserStatus('${user.id}', false)" 
                                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold transition">
                                <i class="bi bi-x-circle mr-1"></i>Deactivate
                            </button>
                        ` : `
                            <button onclick="toggleUserStatus('${user.id}', true)" 
                                    class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold transition">
                                <i class="bi bi-check-circle mr-1"></i>Activate
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// Edit User Modal
// ==========================================

function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const roles = ['admin', 'operator', 'technician', 'viewer'];
    
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
            <p class="text-sm text-gray-600 mb-1">User ID</p>
            <p class="font-mono text-xs text-gray-500">${user.id}</p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="bi bi-envelope mr-2"></i>Email
            </label>
            <input type="email" id="editEmail" value="${user.email}" 
                   class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="bi bi-person mr-2"></i>Full Name
            </label>
            <input type="text" id="editFullName" value="${user.fullName || ''}" 
                   placeholder="Enter full name"
                   class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="bi bi-shield-check mr-2"></i>Role
            </label>
            <select id="editRole" class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500">
                ${roles.map(role => `
                    <option value="${role}" ${role === user.role ? 'selected' : ''}>
                        ${role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                `).join('')}
            </select>
        </div>
        
        <div id="modalStatus" class="mb-4 hidden"></div>
        
        <div class="flex gap-3">
            <button onclick="updateUser('${userId}')" 
                    class="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-lg font-semibold transition">
                <i class="bi bi-check-circle mr-2"></i>Update User
            </button>
            <button onclick="closeEditModal()" 
                    class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition">
                <i class="bi bi-x-circle mr-2"></i>Cancel
            </button>
        </div>
    `;
    
    document.getElementById('editRoleModal').classList.remove('hidden');
}

async function updateUser(userId) {
    const email = document.getElementById('editEmail').value.trim();
    const fullName = document.getElementById('editFullName').value.trim();
    const role = document.getElementById('editRole').value;
    
    if (!email) {
        showModalStatus('Email is required', 'error');
        return;
    }
    
    showLoading('updateUser', 'Updating user...');
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email,
                fullName: fullName || null,
                role 
            })
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return updateUser(userId);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Update failed');
        }
        
        closeEditModal();
        await fetchUsers();
        showNotification('User updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating user:', error);
        showModalStatus('Failed to update: ' + error.message, 'error');
    } finally {
        hideLoading('updateUser');
    }
}

// ==========================================
// Edit Role Modal
// ==========================================

function openEditRoleModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const roles = ['admin', 'operator', 'technician', 'viewer'];
    
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
            <p class="text-sm text-gray-600 mb-1">User</p>
            <p class="font-semibold text-gray-800">${user.email}</p>
            <p class="text-sm text-gray-600 mt-2">Current Role: 
                <span class="font-semibold text-purple-600">${user.role}</span>
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="bi bi-shield-check mr-2"></i>New Role
            </label>
            <select id="newRole" class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500">
                ${roles.map(role => `
                    <option value="${role}" ${role === user.role ? 'selected' : ''}>
                        ${role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                `).join('')}
            </select>
        </div>
        
        <div id="modalStatus" class="mb-4 hidden"></div>
        
        <div class="flex gap-3">
            <button onclick="updateUserRole('${userId}')" 
                    class="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-semibold transition">
                <i class="bi bi-check-circle mr-2"></i>Update Role
            </button>
            <button onclick="closeEditModal()" 
                    class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition">
                <i class="bi bi-x-circle mr-2"></i>Cancel
            </button>
        </div>
    `;
    
    document.getElementById('editRoleModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editRoleModal').classList.add('hidden');
}

async function updateUserRole(userId) {
    const newRole = document.getElementById('newRole').value;
    
    showLoading('updateRole', 'Updating role...');
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return updateUserRole(userId);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Update failed');
        }
        
        closeEditModal();
        await fetchUsers();
        showNotification('User role updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating role:', error);
        showModalStatus('Failed to update: ' + error.message, 'error');
    } finally {
        hideLoading('updateRole');
    }
}

async function toggleUserStatus(userId, activate) {
    const action = activate ? 'activate' : 'deactivate';
    showLoading('toggleStatus', `${activate ? 'Activating' : 'Deactivating'} user...`);
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}/${action}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return toggleUserStatus(userId, activate);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Status update failed');
        }
        
        await fetchUsers();
        showNotification(`User ${activate ? 'activated' : 'deactivated'} successfully!`, 'success');
    } catch (error) {
        console.error('Error toggling status:', error);
        showNotification('Failed to update status: ' + error.message, 'error');
    } finally {
        hideLoading('toggleStatus');
    }
}

// ==========================================
// UI Helpers
// ==========================================

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    const colors = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200'
    };
    element.className = `mt-4 p-3 rounded-lg ${colors[type] || 'bg-gray-100 text-gray-800'}`;
    element.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>${message}`;
}

function showModalStatus(message, type) {
    const statusDiv = document.getElementById('modalStatus');
    const colors = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200'
    };
    statusDiv.className = `p-3 rounded-lg ${colors[type]}`;
    statusDiv.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>${message}`;
    statusDiv.classList.remove('hidden');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500'
    };
    
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl z-50 slide-up`;
    notification.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==========================================
// Tab Management
// ==========================================

let currentTab = 'users';
let machinesLoaded = false; // Flag to track if machines have been loaded

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.getElementById('tabUsers').className = tabName === 'users'
        ? 'flex-1 px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105 bg-purple-500 text-white'
        : 'flex-1 px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105 bg-gray-200 text-gray-700 hover:bg-gray-300';
    
    document.getElementById('tabMonitoring').className = tabName === 'monitoring'
        ? 'flex-1 px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105 bg-purple-500 text-white'
        : 'flex-1 px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105 bg-gray-200 text-gray-700 hover:bg-gray-300';
    
    // Show/hide content
    document.getElementById('usersContent').classList.toggle('hidden', tabName !== 'users');
    document.getElementById('monitoringContent').classList.toggle('hidden', tabName !== 'monitoring');
    
    // Initialize monitoring tab if switched to it
    if (tabName === 'monitoring') {
        console.log('Switching to monitoring tab');
        
        // Only fetch machines if not already loaded
        if (!machinesLoaded || machines.length === 0) {
            fetchMachines();
        } else {
            // Just re-render existing machines
            renderMachines();
            log('📦 Using cached machines data');
        }
        
        checkSimulatorStatus();
    }
}

// ==========================================
// Machine Management
// ==========================================

async function fetchMachines(forceRefresh = false) {
    if (!accessToken) {
        return;
    }
    
    // If machines already loaded and not forcing refresh, skip
    if (machinesLoaded && !forceRefresh && machines.length > 0) {
        renderMachines();
        return;
    }
    
    if (isFetchingMachines) {
        return;
    }
    
    isFetchingMachines = true;
    showLoading('machines', 'Loading machines...');
    
    try {
        const response = await fetch(`${API_URL}/machines?limit=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            isFetchingMachines = false;
            return fetchMachines(forceRefresh);
        }
        
        if (response.status === 403) {
            console.debug('User does not have permission to view machines');
            machines = [];
            machinesLoaded = true;
            renderMachines();
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        machines = result.data || result;
        machinesLoaded = true; // Mark as loaded
        renderMachines();
        log(`📦 Loaded ${machines.length} machines`);
    } catch (error) {
        console.error('Fetch machines error:', error);
        log('❌ Failed to fetch machines: ' + error.message, 'error');
    } finally {
        hideLoading('machines');
        isFetchingMachines = false;
    }
}

function renderMachines() {
    const grid = document.getElementById('machinesGrid');
    if (!grid) return;
    
    document.getElementById('machineCount').textContent = `(${machines.length})`;
    
    if (machines.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8"><i class="bi bi-inbox text-4xl mb-2"></i><p>No machines found</p></div>';
        return;
    }
    
    grid.innerHTML = machines.map(machine => {
        const isActive = subscribedMachines.has(machine.id);
        const sensorData = latestSensorData.get(machine.id);
        
        const statusColors = {
            operational: 'bg-green-100 text-green-800 border-green-200',
            maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            offline: 'bg-red-100 text-red-800 border-red-200'
        };
        
        const statusColor = statusColors[machine.status] || 'bg-gray-100 text-gray-800 border-gray-200';
        
        return `
            <div class="machine-card bg-white border-2 ${isActive ? 'border-green-500 glow-effect' : 'border-gray-200'} rounded-xl p-4 cursor-pointer hover:shadow-2xl" 
                 onclick="toggleMachine('${machine.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 flex items-center">
                            <i class="bi bi-cpu text-purple-600 mr-2"></i>
                            ${machine.name || machine.productId}
                        </h4>
                        <p class="text-xs text-gray-500 mt-1">ID: ${machine.productId}</p>
                    </div>
                    ${isActive ? '<i class="bi bi-wifi text-green-500 text-2xl pulse-dot"></i>' : '<i class="bi bi-wifi-off text-gray-400 text-2xl"></i>'}
                </div>
                
                <div class="flex gap-2 mb-3 text-xs">
                    <span class="px-2 py-1 ${statusColor} rounded-full font-semibold border">
                        ${machine.status}
                    </span>
                    ${isActive ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full font-semibold border border-green-200"><i class="bi bi-check-circle mr-1"></i>Subscribed</span>' : ''}
                    ${sensorData ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold border border-blue-200"><i class="bi bi-activity mr-1"></i>Live</span>' : ''}
                </div>
                
                <div class="text-xs text-gray-600 mb-3">
                    <i class="bi bi-building mr-1"></i>Type: ${machine.type} | 
                    <i class="bi bi-geo-alt ml-2 mr-1"></i>Location: ${machine.location || '-'}
                </div>
                
                ${sensorData ? `
                    <div class="gradient-card border border-purple-200 rounded-lg p-3 mt-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-purple-700 uppercase">
                                <i class="bi bi-graph-up mr-1"></i>Real-time Sensor Data
                            </span>
                            <span class="text-xs text-gray-500">UDI: ${sensorData.udi}</span>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-2 mb-2">
                            <div class="bg-white rounded p-2 text-center border border-gray-200">
                                <div class="text-[10px] text-gray-500 mb-1">AIR TEMP</div>
                                <div class="text-sm font-bold text-gray-800">${sensorData.airTemp.toFixed(1)}<span class="text-[10px] text-gray-500 ml-1">K</span></div>
                            </div>
                            <div class="bg-white rounded p-2 text-center border border-gray-200">
                                <div class="text-[10px] text-gray-500 mb-1">PROCESS</div>
                                <div class="text-sm font-bold text-gray-800">${sensorData.processTemp.toFixed(1)}<span class="text-[10px] text-gray-500 ml-1">K</span></div>
                            </div>
                            <div class="bg-white rounded p-2 text-center border border-gray-200">
                                <div class="text-[10px] text-gray-500 mb-1">SPEED</div>
                                <div class="text-sm font-bold text-gray-800">${sensorData.rotationalSpeed}<span class="text-[10px] text-gray-500 ml-1">RPM</span></div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-white rounded p-2 text-center border border-gray-200">
                                <div class="text-[10px] text-gray-500 mb-1">TORQUE</div>
                                <div class="text-sm font-bold text-gray-800">${sensorData.torque.toFixed(1)}<span class="text-[10px] text-gray-500 ml-1">Nm</span></div>
                            </div>
                            <div class="bg-white rounded p-2 text-center border border-gray-200">
                                <div class="text-[10px] text-gray-500 mb-1">TOOL WEAR</div>
                                <div class="text-sm font-bold text-gray-800">${sensorData.toolWear}<span class="text-[10px] text-gray-500 ml-1">min</span></div>
                            </div>
                        </div>
                        
                        <div class="text-[10px] text-gray-500 text-center mt-2 pt-2 border-t border-purple-200">
                            <i class="bi bi-clock mr-1"></i>${new Date(sensorData.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                ` : `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3 text-center">
                        <i class="bi bi-dash-circle text-gray-400 text-2xl mb-1"></i>
                        <p class="text-xs text-gray-500">No sensor data available</p>
                        <p class="text-[10px] text-gray-400 mt-1">Click to subscribe</p>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function toggleMachine(machineId) {
    if (!socket || !socket.connected) {
        alert('Please connect to WebSocket first!');
        return;
    }
    
    if (subscribedMachines.has(machineId)) {
        socket.emit('unsubscribe', { machineId });
        subscribedMachines.delete(machineId);
        log(`Unsubscribed from machine ${machineId}`);
    } else {
        socket.emit('subscribe:sensor', { machineId });
        subscribedMachines.add(machineId);
        log(`Subscribed to machine ${machineId}`);
    }
    
    renderMachines();
}

// ==========================================
// WebSocket Management
// ==========================================

function connectWebSocket() {
    if (!accessToken) {
        alert('Please login first!');
        return;
    }
    
    socket = io(`${API_URL}/sensors`, {
        auth: { token: accessToken }
    });
    
    socket.on('connect', () => {
        updateConnectionStatus(true);
        log('🟢 Connected to WebSocket');
    });
    
    socket.on('disconnect', () => {
        updateConnectionStatus(false);
        log('🔴 Disconnected from WebSocket');
    });
    
    socket.on('sensor:update', (data) => {
        const sensorData = transformSensorData(data);
        log(`📊 Sensor update: Machine ${sensorData.productId || sensorData.machineId}`, sensorData);
        latestSensorData.set(sensorData.machineId, sensorData);
        renderMachines();
    });
    
    socket.on('sensors:update', (data) => {
        const sensorData = transformSensorData(data);
        log(`📊 Sensor update (all): Machine ${sensorData.productId || sensorData.machineId}`, sensorData);
        latestSensorData.set(sensorData.machineId, sensorData);
        renderMachines();
    });
    
    socket.on('subscribed', (data) => {
        log('✅ Subscribed successfully', data);
    });
}

function transformSensorData(data) {
    return {
        udi: data.udi,
        machineId: data.machine_id,
        productId: data.product_id,
        timestamp: data.timestamp,
        airTemp: data.air_temp,
        processTemp: data.process_temp,
        rotationalSpeed: data.rotational_speed,
        torque: data.torque,
        toolWear: data.tool_wear
    };
}

function disconnectWebSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
        subscribedMachines.clear();
        renderMachines();
    }
}

function subscribeAll() {
    if (!socket || !socket.connected) {
        alert('Please connect to WebSocket first!');
        return;
    }
    
    socket.emit('subscribe:all-sensors');
    log('📡 Subscribed to all sensors');
}

function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (status) {
        if (connected) {
            status.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700';
            status.innerHTML = '<span class="pulse-dot inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>Connected';
        } else {
            status.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-700';
            status.innerHTML = '<span class="pulse-dot inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>Disconnected';
        }
    }
}

// ==========================================
// Simulator Management
// ==========================================

async function startNormalSimulator() {
    if (!accessToken) {
        alert('Please login first!');
        return;
    }
    
    showLoading('normalSimulator', 'Starting normal simulator...');
    
    if (simulatorType === 'anomaly') {
        await stopAnomalySimulator();
    }
    
    try {
        const response = await fetch(`${API_URL}/sensors/simulator/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return startNormalSimulator();
        }
        
        if (!response.ok) throw new Error('Failed to start normal simulator');
        
        const data = await response.json();
        simulatorType = 'normal';
        log(`✅ Normal simulator started: ${data.message}`, data);
        updateSimulatorStatus('normal', 'Running ✅');
        
        setTimeout(checkSimulatorStatus, 2000);
    } catch (error) {
        log(`❌ Failed to start normal simulator: ${error.message}`, null);
        alert('Failed to start normal simulator: ' + error.message);
    } finally {
        hideLoading('normalSimulator');
    }
}

async function startAnomalySimulator() {
    if (!accessToken) {
        alert('Please login first!');
        return;
    }
    
    if (machines.length === 0) {
        alert('No machines available. Please wait for machines to load.');
        return;
    }
    
    showLoading('anomalySimulator', 'Starting anomaly simulator...');
    
    if (simulatorType === 'normal') {
        await stopSimulator();
    }
    
    try {
        const machineId = machines[0].id;
        
        const response = await fetch(`${API_URL}/sensors/simulator/anomaly/${machineId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return startAnomalySimulator();
        }
        
        if (!response.ok) throw new Error('Failed to start anomaly simulator');
        
        const data = await response.json();
        simulatorType = 'anomaly';
        log(`⚠️ Anomaly simulator started for machine: ${machineId}`, data);
        updateSimulatorStatus('anomaly', 'Running ⚠️');
        
        startAnomalyLoop();
    } catch (error) {
        log(`❌ Failed to start anomaly simulator: ${error.message}`, null);
        alert('Failed to start anomaly simulator: ' + error.message);
    } finally {
        hideLoading('anomalySimulator');
    }
}

function startAnomalyLoop() {
    if (anomalyInterval) clearInterval(anomalyInterval);
    
    anomalyInterval = setInterval(async () => {
        if (simulatorType !== 'anomaly' || machines.length === 0) {
            clearInterval(anomalyInterval);
            return;
        }
        
        try {
            const randomMachine = machines[Math.floor(Math.random() * machines.length)];
            await fetch(`${API_URL}/sensors/simulator/anomaly/${randomMachine.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        } catch (error) {
            console.error('Anomaly generation error:', error);
        }
    }, 5000);
}

async function stopSimulator() {
    if (!accessToken) {
        alert('Please login first!');
        return;
    }
    
    showLoading('stopSimulator', 'Stopping simulator...');
    
    try {
        const response = await fetch(`${API_URL}/sensors/simulator/stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return stopSimulator();
        }
        
        if (!response.ok) throw new Error('Failed to stop simulator');
        
        const data = await response.json();
        simulatorType = null;
        log(`⏹️ Simulator stopped: ${data.message}`, data);
        updateSimulatorStatus('normal', 'Stopped ⏹️');
        updateSimulatorStatus('anomaly', 'Stopped ⏹️');
    } catch (error) {
        log(`❌ Failed to stop simulator: ${error.message}`, null);
        alert('Failed to stop simulator: ' + error.message);
    } finally {
        hideLoading('stopSimulator');
    }
}

async function stopAnomalySimulator() {
    if (anomalyInterval) {
        clearInterval(anomalyInterval);
        anomalyInterval = null;
    }
    simulatorType = null;
    updateSimulatorStatus('anomaly', 'Stopped ⏹️');
    log('⏹️ Anomaly simulator stopped');
}

async function checkSimulatorStatus() {
    if (!accessToken) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/sensors/simulator/status`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return;
        }
        
        if (response.status === 403) {
            return;
        }
        
        if (!response.ok) throw new Error('Failed to check status');
        
        const data = await response.json();
        const status = data.isRunning ? 'Running ✅' : 'Stopped ⏹️';
        
        if (data.isRunning && !simulatorType) {
            simulatorType = 'normal';
        }
        
        updateSimulatorStatus('normal', status);
        log(`📊 Simulator status: ${status}`, data);
    } catch (error) {
        console.debug('Simulator status check skipped:', error.message);
    }
}

function updateSimulatorStatus(type, status) {
    const statusElement = document.getElementById(`simulator${type.charAt(0).toUpperCase() + type.slice(1)}Status`);
    if (statusElement) {
        const isRunning = status.includes('Running');
        const isStopped = status.includes('Stopped');
        const colorClass = isRunning ? 'bg-green-100 text-green-700' : 
                           isStopped ? 'bg-orange-100 text-orange-700' : 
                           'bg-gray-100 text-gray-700';
        statusElement.className = `px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`;
        statusElement.innerHTML = `<i class="bi bi-${isRunning ? 'check-circle' : isStopped ? 'stop-circle' : 'question-circle'} mr-1"></i>${status}`;
    }
}

// ==========================================
// Logging Function
// ==========================================

function log(message, data) {
    const logs = document.getElementById('logs');
    if (!logs) return;
    
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry pl-3 py-2 mb-1 text-sm';
    entry.innerHTML = `
        <span class="text-gray-400 text-xs">[${time}]</span> <span class="text-gray-200">${message}</span>
        ${data ? `<pre class="text-cyan-300 text-xs mt-1 overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>` : ''}
    `;
    logs.insertBefore(entry, logs.firstChild);
    
    while (logs.children.length > 50) {
        logs.removeChild(logs.lastChild);
    }
}

// ==========================================
// Initialize on page load
// ==========================================
window.addEventListener('DOMContentLoaded', initializeApp);
