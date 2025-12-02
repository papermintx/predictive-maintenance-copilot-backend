// ==========================================
// Global Variables
// ==========================================
const API_URL = window.location.origin;
let socket = null;
let accessToken = null;
let refreshToken = null;
let machines = [];
let subscribedMachines = new Set();
let latestSensorData = new Map();
let simulatorType = null; // 'normal' or 'anomaly'
let loadingStates = {}; // Track loading states for different operations
let isFetchingMachines = false; // Prevent concurrent machine fetches
let isRefreshingToken = false; // Prevent concurrent token refreshes

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
    // Only hide if no other operations are loading
    if (Object.keys(loadingStates).length === 0) {
        const loadingDiv = document.getElementById('globalLoading');
        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }
    }
}

function setButtonLoading(buttonElement, isLoading) {
    if (isLoading) {
        buttonElement.disabled = true;
        buttonElement.dataset.originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="bi bi-arrow-clockwise animate-spin mr-2"></i>Loading...';
    } else {
        buttonElement.disabled = false;
        buttonElement.innerHTML = buttonElement.dataset.originalText || buttonElement.innerHTML;
    }
}

// ==========================================
// Authentication & Token Management
// ==========================================

// Initialize app - check for saved tokens
function initializeApp() {
    const savedAccessToken = localStorage.getItem('accessToken');
    const savedRefreshToken = localStorage.getItem('refreshToken');
    
    if (savedAccessToken && savedRefreshToken) {
        accessToken = savedAccessToken;
        refreshToken = savedRefreshToken;
        
        // Verify token is still valid
        verifyAndAutoLogin();
    }
}

async function verifyAndAutoLogin() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            // Token valid, auto login
            log('🔐 Auto-login successful');
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('mainSection').classList.remove('hidden');
            await fetchMachines();
            await checkSimulatorStatus();
        } else if (response.status === 401) {
            // Token expired, try refresh
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
    // Prevent concurrent refresh attempts
    if (isRefreshingToken) {
        return false;
    }
    
    isRefreshingToken = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) throw new Error('Token refresh failed');
        
        const data = await response.json();
        accessToken = data.accessToken;
        
        // Save new access token
        localStorage.setItem('accessToken', accessToken);
        
        log('🔄 Access token refreshed');
        isRefreshingToken = false;
        return true;
    } catch (error) {
        console.error('Token refresh failed:', error);
        clearTokens();
        isRefreshingToken = false;
        return false;
    }
}

function clearTokens() {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading('login', 'Logging in...');
    
    try {
        const response = await fetch(`${API_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) throw new Error('Login failed');
        
        const data = await response.json();
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        
        // Save tokens to localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        showStatus('loginStatus', 'Login successful!', 'success');
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('mainSection').classList.remove('hidden');
        
        await fetchMachines();
        await checkSimulatorStatus();
    } catch (error) {
        showStatus('loginStatus', 'Login failed: ' + error.message, 'error');
    } finally {
        hideLoading('login');
    }
}

function logout() {
    if (socket) socket.disconnect();
    clearTokens();
    machines = [];
    subscribedMachines.clear();
    latestSensorData.clear();
    simulatorType = null;
    document.getElementById('mainSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('loginStatus').textContent = '';
    log('👋 Logged out');
}

// ==========================================
// Machine Management
// ==========================================

async function fetchMachines() {
    // Check if user is logged in
    if (!accessToken) {
        return;
    }
    
    // Prevent concurrent fetches
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
            // Try to refresh token
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry once after successful refresh
                isFetchingMachines = false;
                return fetchMachines();
            } else {
                throw new Error('Authentication failed');
            }
        }
        
        if (response.status === 403) {
            // User doesn't have permission
            console.debug('User does not have permission to view machines');
            machines = [];
            renderMachines();
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        machines = result.data || result;
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
                <!-- Header -->
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 flex items-center">
                            <i class="bi bi-cpu text-indigo-600 mr-2"></i>
                            ${machine.name || machine.productId}
                        </h4>
                        <p class="text-xs text-gray-500 mt-1">ID: ${machine.productId}</p>
                    </div>
                    ${isActive ? '<i class="bi bi-wifi text-green-500 text-2xl pulse-dot"></i>' : '<i class="bi bi-wifi-off text-gray-400 text-2xl"></i>'}
                </div>
                
                <!-- Info -->
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
                
                <!-- Sensor Data Embedded -->
                ${sensorData ? `
                    <div class="gradient-card border border-indigo-200 rounded-lg p-3 mt-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-indigo-700 uppercase">
                                <i class="bi bi-graph-up mr-1"></i>Real-time Sensor Data
                            </span>
                            <span class="text-xs text-gray-500">UDI: ${sensorData.udi}</span>
                        </div>
                        
                        <!-- Sensor Grid -->
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
                        
                        <div class="text-[10px] text-gray-500 text-center mt-2 pt-2 border-t border-indigo-200">
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
    if (connected) {
        status.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700';
        status.innerHTML = '<span class="pulse-dot inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>Connected';
    } else {
        status.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-700';
        status.innerHTML = '<span class="pulse-dot inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>Disconnected';
    }
}

// ==========================================
// Simulator Management (Normal & Anomaly)
// ==========================================

async function startNormalSimulator() {
    if (!accessToken) {
        alert('Please login first!');
        return;
    }
    
    showLoading('normalSimulator', 'Starting normal simulator...');
    
    // Stop anomaly simulator if running
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
    
    // Stop normal simulator if running
    if (simulatorType === 'normal') {
        await stopSimulator();
    }
    
    try {
        // Generate anomaly for first machine
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
        
        // Continue generating anomalies every 5 seconds
        startAnomalyLoop();
    } catch (error) {
        log(`❌ Failed to start anomaly simulator: ${error.message}`, null);
        alert('Failed to start anomaly simulator: ' + error.message);
    } finally {
        hideLoading('anomalySimulator');
    }
}

let anomalyInterval = null;

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
            // User doesn't have permission, silently return
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
        // Silent fail - don't spam console
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
        statusElement.className = `px-4 py-2 rounded-full text-sm font-semibold ${colorClass}`;
        statusElement.innerHTML = `<i class="bi bi-${isRunning ? 'check-circle' : isStopped ? 'stop-circle' : 'question-circle'} mr-1"></i>${status}`;
    }
}

// ==========================================
// UI Utility Functions
// ==========================================

function log(message, data) {
    const logs = document.getElementById('logs');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry pl-3 py-2 mb-1 text-sm';
    entry.innerHTML = `
        <span class="text-gray-400 text-xs">[${time}]</span> <span class="text-gray-200">${message}</span>
        ${data ? `<pre class="text-cyan-300 text-xs mt-1 overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>` : ''}
    `;
    logs.insertBefore(entry, logs.firstChild);
    
    // Limit to 50 entries
    while (logs.children.length > 50) {
        logs.removeChild(logs.lastChild);
    }
}

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    const colors = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200'
    };
    element.className = `mt-4 p-3 rounded-lg ${colors[type] || 'bg-gray-100 text-gray-800'}`;
    element.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>${message}`;
}

// ==========================================
// Auto Intervals
// ==========================================

// Auto-refresh machines every 30 seconds
setInterval(() => {
    if (accessToken && !document.getElementById('mainSection').classList.contains('hidden') && !isFetchingMachines) {
        fetchMachines();
    }
}, 30000);

// Auto-check simulator status every 10 seconds
setInterval(() => {
    if (accessToken && !document.getElementById('mainSection').classList.contains('hidden')) {
        checkSimulatorStatus();
    }
}, 10000);

// ==========================================
// Initialize Monitoring (for admin panel integration)
// ==========================================
window.initializeMonitoring = function() {
    // Always use token from admin panel if available
    if (typeof window.adminAccessToken !== 'undefined' && window.adminAccessToken) {
        accessToken = window.adminAccessToken;
        console.log('Using admin token for monitoring');
    }
    
    if (accessToken) {
        console.log('Initializing monitoring with token');
        fetchMachines();
        checkSimulatorStatus();
    } else {
        console.warn('No access token available for monitoring');
    }
};

// ==========================================
// Initialize on page load
// ==========================================
window.addEventListener('DOMContentLoaded', initializeApp);
