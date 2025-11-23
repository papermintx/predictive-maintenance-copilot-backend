// ==========================================
// Global Variables
// ==========================================
const API_URL = window.location.origin;
let accessToken = null;
let refreshToken = null;
let currentUser = null;
let allTickets = [];
let loadingStates = {};

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
    
    // Safety timeout: auto-hide after 30 seconds
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
    const savedAccessToken = localStorage.getItem('technicianAccessToken');
    const savedRefreshToken = localStorage.getItem('technicianRefreshToken');
    
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
            
            // Check if user is technician
            if (user.role !== 'technician') {
                showStatus('loginStatus', 'Access denied. Technician role required.', 'error');
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
        localStorage.setItem('technicianAccessToken', accessToken);
        
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
    localStorage.removeItem('technicianAccessToken');
    localStorage.removeItem('technicianRefreshToken');
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
        
        // Verify user role
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });
        
        if (!userResponse.ok) throw new Error('Failed to verify user');
        
        const user = await userResponse.json();
        
        if (user.role !== 'technician') {
            showStatus('loginStatus', 'Access denied. Only technicians can access this portal.', 'error');
            return;
        }
        
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        currentUser = user;
        
        localStorage.setItem('technicianAccessToken', accessToken);
        localStorage.setItem('technicianRefreshToken', refreshToken);
        
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
    
    fetchTickets();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (accessToken) {
            fetchTickets();
        }
    }, 30000);
}

function logout() {
    clearTokens();
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('loginStatus').textContent = '';
    allTickets = [];
}

// ==========================================
// Tickets Management
// ==========================================

async function fetchTickets() {
    showLoading('tickets', 'Loading tickets...');
    
    try {
        const response = await fetch(`${API_URL}/maintenance-tickets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return fetchTickets();
        }
        
        if (!response.ok) throw new Error('Failed to fetch tickets');
        
        allTickets = await response.json();
        updateStats();
        filterTickets();
    } catch (error) {
        console.error('Error fetching tickets:', error);
        showError('Failed to load tickets: ' + error.message);
    } finally {
        hideLoading('tickets');
    }
}

function updateStats() {
    const stats = {
        open: 0,
        in_progress: 0,
        closed: 0,
        canceled: 0
    };
    
    allTickets.forEach(ticket => {
        stats[ticket.status]++;
    });
    
    document.getElementById('statOpen').textContent = stats.open;
    document.getElementById('statInProgress').textContent = stats.in_progress;
    document.getElementById('statClosed').textContent = stats.closed;
    document.getElementById('statCanceled').textContent = stats.canceled;
}

function filterTickets() {
    const filterStatus = document.getElementById('filterStatus').value;
    
    let filteredTickets = allTickets;
    if (filterStatus !== 'all') {
        filteredTickets = allTickets.filter(t => t.status === filterStatus);
    }
    
    renderTickets(filteredTickets);
}

function renderTickets(tickets) {
    const container = document.getElementById('ticketsContainer');
    document.getElementById('ticketCount').textContent = `(${tickets.length})`;
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="bi bi-inbox text-4xl mb-2"></i>
                <p>No tickets found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => {
        const statusColors = {
            open: 'bg-red-100 text-red-800 border-red-200',
            in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
            closed: 'bg-green-100 text-green-800 border-green-200',
            canceled: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        
        const statusIcons = {
            open: 'inbox',
            in_progress: 'gear',
            closed: 'check-circle',
            canceled: 'x-circle'
        };
        
        const statusLabels = {
            open: 'Open',
            in_progress: 'In Progress',
            closed: 'Closed',
            canceled: 'Canceled'
        };
        
        return `
            <div class="ticket-card border-2 border-gray-200 rounded-lg p-6 hover:border-amber-300">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="status-badge px-3 py-1 rounded-full text-sm font-semibold border ${statusColors[ticket.status]}">
                                <i class="bi bi-${statusIcons[ticket.status]} mr-1"></i>
                                ${statusLabels[ticket.status]}
                            </span>
                            <span class="text-xs text-gray-500">
                                <i class="bi bi-clock mr-1"></i>
                                ${new Date(ticket.createdAt).toLocaleString()}
                            </span>
                        </div>
                        
                        <h4 class="text-lg font-bold text-gray-800 mb-2">
                            <i class="bi bi-gear-wide-connected mr-2 text-amber-600"></i>
                            Machine: ${ticket.machine?.name || ticket.machine?.productId || 'Unknown'}
                        </h4>
                        
                        <p class="text-gray-600 mb-3">${ticket.description}</p>
                        
                        <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>
                                <i class="bi bi-person mr-1"></i>
                                <span class="font-semibold">Requested by:</span> ${ticket.requestedBy?.email || 'Unknown'}
                            </div>
                            <div>
                                <i class="bi bi-geo-alt mr-1"></i>
                                <span class="font-semibold">Location:</span> ${ticket.machine?.location || 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="ml-4 flex flex-col gap-2">
                        ${ticket.status !== 'closed' && ticket.status !== 'canceled' ? `
                            <button onclick="openUpdateModal('${ticket.id}')" 
                                    class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition text-sm whitespace-nowrap">
                                <i class="bi bi-pencil mr-1"></i>Update
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// Update Modal
// ==========================================

function openUpdateModal(ticketId) {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const statusOptions = {
        open: ['in_progress'],
        in_progress: ['closed', 'open'],
        closed: [],
        canceled: []
    };
    
    const availableStatuses = statusOptions[ticket.status] || [];
    
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
            <h4 class="font-bold text-gray-800 mb-2">Ticket Information</h4>
            <div class="space-y-2 text-sm">
                <p><span class="font-semibold">Machine:</span> ${ticket.machine?.name || ticket.machine?.productId}</p>
                <p><span class="font-semibold">Description:</span> ${ticket.description}</p>
                <p><span class="font-semibold">Current Status:</span> 
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">${ticket.status.replace('_', ' ').toUpperCase()}</span>
                </p>
            </div>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="bi bi-list-check mr-2"></i>Update Status
            </label>
            <select id="updateStatus" class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500">
                <option value="">-- Select New Status --</option>
                ${availableStatuses.map(status => `
                    <option value="${status}">${status.replace('_', ' ').toUpperCase()}</option>
                `).join('')}
            </select>
        </div>
        
        <div id="updateStatus" class="mb-4 hidden"></div>
        
        <div class="flex gap-3">
            <button onclick="updateTicket('${ticketId}')" 
                    class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold transition">
                <i class="bi bi-check-circle mr-2"></i>Update Ticket
            </button>
            <button onclick="closeModal()" 
                    class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition">
                <i class="bi bi-x-circle mr-2"></i>Cancel
            </button>
        </div>
    `;
    
    document.getElementById('updateModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('updateModal').classList.add('hidden');
}

async function updateTicket(ticketId) {
    const newStatus = document.getElementById('updateStatus').value;
    
    if (!newStatus) {
        showModalStatus('Please select a status', 'error');
        return;
    }
    
    showLoading('update', 'Updating ticket...');
    
    try {
        const response = await fetch(`${API_URL}/maintenance-tickets/${ticketId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.status === 401) {
            await refreshAccessToken();
            return updateTicket(ticketId);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Update failed');
        }
        
        closeModal();
        await fetchTickets();
        showNotification('Ticket updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating ticket:', error);
        showModalStatus('Failed to update: ' + error.message, 'error');
    } finally {
        hideLoading('update');
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
    const statusDiv = document.getElementById('updateStatus');
    const colors = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200'
    };
    statusDiv.className = `p-3 rounded-lg ${colors[type]} mb-4`;
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

function showError(message) {
    showNotification(message, 'error');
}

// ==========================================
// Initialize on page load
// ==========================================
window.addEventListener('DOMContentLoaded', initializeApp);
