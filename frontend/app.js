// Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`;

const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:3000'
    : `ws://${window.location.hostname}:3000`;

// State
let ws = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let latestReadings = { household: [], ice_rink: [], other: [] };
let recentActivity = [];
const maxRecentActivity = 20;

// Utility functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatPower(watts) {
    if (Math.abs(watts) >= 1000) {
        return `${(watts / 1000).toFixed(2)} kW`;
    }
    return `${watts.toFixed(2)} W`;
}

function formatVoltage(voltage) {
    return `${voltage.toFixed(1)} V`;
}

function formatCurrent(current) {
    return `${current.toFixed(2)} A`;
}

function formatEnergy(wh) {
    if (wh >= 1000) {
        return `${(wh / 1000).toFixed(2)} kWh`;
    }
    return `${wh.toFixed(2)} Wh`;
}

// WebSocket functions
function connectWebSocket() {
    console.log('Connecting to WebSocket...');
    updateStatus('ws-status', 'Connecting...', 'connecting');

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('✓ WebSocket connected');
            updateStatus('ws-status', 'Connected', 'connected');
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('ws-status', 'Error', 'disconnected');
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            updateStatus('ws-status', 'Disconnected', 'disconnected');

            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
                setTimeout(connectWebSocket, 3000 * reconnectAttempts);
            }
        };
    } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        updateStatus('ws-status', 'Failed', 'disconnected');
    }
}

function handleWebSocketMessage(message) {
    console.log('WebSocket message:', message.type);

    switch (message.type) {
        case 'connected':
            console.log('WebSocket connection confirmed');
            break;

        case 'mqtt_status':
            const status = message.data.status;
            updateStatus('mqtt-status', status, status === 'connected' ? 'connected' : 'disconnected');
            break;

        case 'new_reading':
            handleNewReading(message.data);
            break;

        default:
            console.log('Unknown message type:', message.type);
    }
}

function handleNewReading(data) {
    console.log('New reading:', data.system_id);
    updateLastUpdate();

    // Add to recent activity
    addRecentActivity(data);

    // Refresh latest readings
    fetchLatestReadings();
}

function addRecentActivity(data) {
    const activity = {
        system_id: data.system_id,
        system_type: data.system_type,
        timestamp: data.timestamp,
        power: calculateTotalPower(data.data)
    };

    recentActivity.unshift(activity);
    if (recentActivity.length > maxRecentActivity) {
        recentActivity.pop();
    }

    renderRecentActivity();
}

function calculateTotalPower(data) {
    const nmid = data['NMID_1-18'] || [];
    const power = (nmid[6] || 0) + (nmid[7] || 0) + (nmid[8] || 0);
    return power;
}

// API functions
async function fetchLatestReadings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/readings/latest`);
        if (!response.ok) throw new Error('Failed to fetch latest readings');

        latestReadings = await response.json();
        renderOverview();
        renderHouseholdSystems();
        renderIceRinkSystems();
    } catch (err) {
        console.error('Error fetching latest readings:', err);
    }
}

async function fetchSystemsList() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/systems`);
        if (!response.ok) throw new Error('Failed to fetch systems list');

        const systems = await response.json();
        renderSystemsList(systems);
    } catch (err) {
        console.error('Error fetching systems list:', err);
    }
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (!response.ok) throw new Error('Health check failed');

        const health = await response.json();
        updateStatus('mqtt-status', health.mqtt, health.mqtt === 'connected' ? 'connected' : 'disconnected');
    } catch (err) {
        console.error('Health check error:', err);
        updateStatus('mqtt-status', 'Unknown', 'disconnected');
    }
}

// Render functions
function renderOverview() {
    const householdSummary = document.getElementById('household-summary');
    const iceRinkSummary = document.getElementById('ice-rink-summary');

    // Household summary
    if (latestReadings.household.length === 0) {
        householdSummary.innerHTML = '<div class="loading">No household data available</div>';
    } else {
        const totalPower = latestReadings.household.reduce((sum, reading) => {
            return sum + (reading.power_active_l1 || 0) + (reading.power_active_l2 || 0) + (reading.power_active_l3 || 0);
        }, 0);

        householdSummary.innerHTML = `
            <div class="summary-stats">
                <div class="stat-card">
                    <div class="stat-value">${latestReadings.household.length}</div>
                    <div class="stat-label">Systems</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatPower(totalPower)}</div>
                    <div class="stat-label">Total Power</div>
                </div>
            </div>
        `;
    }

    // Ice rink summary
    if (latestReadings.ice_rink.length === 0) {
        iceRinkSummary.innerHTML = '<div class="loading">No ice rink data available</div>';
    } else {
        const totalPower = latestReadings.ice_rink.reduce((sum, reading) => {
            return sum + (reading.power_active_l1 || 0) + (reading.power_active_l2 || 0) + (reading.power_active_l3 || 0);
        }, 0);

        iceRinkSummary.innerHTML = `
            <div class="summary-stats">
                <div class="stat-card">
                    <div class="stat-value">${latestReadings.ice_rink.length}</div>
                    <div class="stat-label">Systems</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatPower(totalPower)}</div>
                    <div class="stat-label">Total Power</div>
                </div>
            </div>
        `;
    }
}

function renderHouseholdSystems() {
    const container = document.getElementById('household-systems');

    if (latestReadings.household.length === 0) {
        container.innerHTML = '<div class="loading">No household systems found</div>';
        return;
    }

    container.innerHTML = latestReadings.household.map(reading => createSystemCard(reading, 'household')).join('');
}

function renderIceRinkSystems() {
    const container = document.getElementById('ice-rink-systems');

    if (latestReadings.ice_rink.length === 0) {
        container.innerHTML = '<div class="loading">No ice rink systems found</div>';
        return;
    }

    container.innerHTML = latestReadings.ice_rink.map(reading => createSystemCard(reading, 'ice_rink')).join('');
}

function createSystemCard(reading, systemType) {
    const totalPower = (reading.power_active_l1 || 0) + (reading.power_active_l2 || 0) + (reading.power_active_l3 || 0);
    const avgVoltage = ((reading.voltage_l1 || 0) + (reading.voltage_l2 || 0) + (reading.voltage_l3 || 0)) / 3;
    const totalCurrent = (reading.current_l1 || 0) + (reading.current_l2 || 0) + (reading.current_l3 || 0);
    const avgPowerFactor = ((reading.power_factor_l1 || 0) + (reading.power_factor_l2 || 0) + (reading.power_factor_l3 || 0)) / 3;

    return `
        <div class="system-card ${systemType}">
            <h3>${reading.system_id}</h3>
            <div class="device-id">Device: ${reading.device_id || 'Unknown'}</div>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-label">Total Power</div>
                    <div class="metric-value">${formatPower(totalPower)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Avg Voltage</div>
                    <div class="metric-value">${formatVoltage(avgVoltage)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Total Current</div>
                    <div class="metric-value">${formatCurrent(totalCurrent)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Power Factor</div>
                    <div class="metric-value">${avgPowerFactor.toFixed(3)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Energy Import</div>
                    <div class="metric-value">${formatEnergy(reading.energy_active_import || 0)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Energy Export</div>
                    <div class="metric-value">${formatEnergy(reading.energy_active_export || 0)}</div>
                </div>
            </div>
            <div class="timestamp">${formatTimeAgo(reading.timestamp)}</div>
        </div>
    `;
}

function renderRecentActivity() {
    const container = document.getElementById('recent-activity');

    if (recentActivity.length === 0) {
        container.innerHTML = '<div class="loading">No recent activity</div>';
        return;
    }

    container.innerHTML = recentActivity.map(activity => `
        <div class="activity-item ${activity.system_type}">
            <div class="activity-header">
                <span class="system-name">${activity.system_id}</span>
                <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
            </div>
            <div class="activity-data">
                Power: ${formatPower(activity.power)}
            </div>
        </div>
    `).join('');
}

function renderSystemsList(systems) {
    const container = document.getElementById('all-systems-list');

    if (systems.length === 0) {
        container.innerHTML = '<div class="loading">No systems found</div>';
        return;
    }

    container.innerHTML = systems.map(system => `
        <div class="system-list-item ${system.system_type}">
            <div class="system-info">
                <h4>${system.system_id}</h4>
                <div class="system-type">${system.system_type.replace('_', ' ')}</div>
            </div>
            <div class="system-stats">
                <div class="last-seen">Last seen: ${formatTimeAgo(system.last_seen)}</div>
            </div>
        </div>
    `).join('');
}

// UI functions
function updateStatus(elementId, text, status) {
    const element = document.getElementById(elementId);
    element.textContent = text;
    element.className = 'status-indicator';

    if (status === 'connected') {
        element.classList.add('connected');
    } else if (status === 'disconnected') {
        element.classList.add('disconnected');
    }
}

function updateLastUpdate() {
    const element = document.getElementById('last-update');
    element.textContent = new Date().toLocaleTimeString();
}

// Tab navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Load data for specific tabs
            if (targetTab === 'all-systems') {
                fetchSystemsList();
            }
        });
    });
}

// Initialize app
function init() {
    console.log('🚀 Initializing Vata Dashboard...');

    setupTabs();
    connectWebSocket();
    checkHealth();
    fetchLatestReadings();

    // Refresh data periodically
    setInterval(() => {
        checkHealth();
        fetchLatestReadings();
    }, 30000); // Every 30 seconds

    console.log('✓ Dashboard initialized');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
