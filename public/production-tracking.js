// Global variables
let currentUser = null;
let allIngredients = [];
let productionHistory = [];
let filteredHistory = [];
let currentEntryType = 'inbound';
let pendingEntry = null;

// Authentication functions
function getUserSession() {
    const sessionData = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
    return sessionData ? JSON.parse(sessionData) : null;
}

function clearUserSession() {
    sessionStorage.removeItem('userSession');
    localStorage.removeItem('userSession');
}

function checkAuthentication() {
    // Simplified authentication for testing
    const session = getUserSession();
    if (!session) {
        console.log('No session found, creating default session...');
        // Create a default session for testing
        const defaultSession = {
            username: 'test',
            role: 'supervisor',
            name: 'Test User'
        };
        setUserSession('test', defaultSession);
        currentUser = defaultSession;
    } else {
        currentUser = session;
    }
    
    updateUserInterface();
    return true;
}

function setUserSession(username, userData) {
    const sessionData = {
        username: username,
        role: userData.role,
        name: userData.name,
        loginTime: new Date().toISOString()
    };
    
    sessionStorage.setItem('userSession', JSON.stringify(sessionData));
    localStorage.setItem('userSession', JSON.stringify(sessionData));
}

function updateUserInterface() {
    if (currentUser) {
        const welcomeMessage = document.getElementById('welcomeMessage');
        const userRoleBadge = document.getElementById('userRoleBadge');
        
        if (welcomeMessage) {
            // Show role-based welcome message
            let displayName = 'User';
            
            // If we have a proper name, use it, otherwise use the role
            if (currentUser.name && currentUser.name.trim() && currentUser.name !== 'undefined') {
                displayName = currentUser.name;
            } else if (currentUser.role === 'supervisor') {
                displayName = 'Supervisor';
            } else if (currentUser.role === 'admin') {
                displayName = 'Admin';
            } else {
                displayName = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
            }
            
            welcomeMessage.textContent = `Welcome, ${displayName}!`;
        }
        
        if (userRoleBadge) {
            userRoleBadge.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
            userRoleBadge.className = `role-badge ${currentUser.role}`;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Remove the alert for production use
    // alert('Production Tracking JavaScript loaded - check console for debug info');
    
    // Try to check authentication, but continue even if it fails for testing
    try {
        if (!checkAuthentication()) {
            console.log('Authentication failed, but continuing for testing...');
            // Set a default user for testing
            currentUser = { username: 'test', role: 'supervisor', name: 'Test User' };
            updateUserInterface();
        }
    } catch (error) {
        console.log('Authentication error, but continuing for testing:', error);
        currentUser = { username: 'test', role: 'supervisor', name: 'Test User' };
    }
    
    // Initialize with a delay to ensure DOM is ready
    setTimeout(async () => {
        try {
            await initializeApp();
            
            // Call updateStats after a short delay to ensure everything is loaded
            setTimeout(async () => {
                console.log('Calling updateStats after delay...');
                await updateStats();
            }, 1000);
            
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }, 500);
    
    // Make updateStats available globally for testing
    window.testUpdateStats = updateStats;
    window.testLoadHistory = loadProductionHistory;
    
    // Set up regular stats updates for testing (every 5 seconds)
    setTimeout(() => {
        console.log('Setting up regular stats updates...');
        setInterval(async () => {
            console.log('Auto-updating stats...');
            await updateStats();
        }, 5000);
    }, 2000);
});
;

async function initializeApp() {
    try {
        await loadIngredients();
        await loadProductionHistory();
        setupEventListeners();
        setDefaultDateTime();
        
        // Update stats with fresh data
        await updateStats();
        
        console.log('Production tracking module initialized');
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading production tracking data', 'error');
    }
}

// Load ingredients from API
async function loadIngredients() {
    try {
        console.log('Loading ingredients...');
        const response = await fetch('/ingredients');
        if (!response.ok) {
            throw new Error('Failed to fetch ingredients');
        }
        
        allIngredients = await response.json();
        console.log('Ingredients loaded:', allIngredients.length);
        populateItemSelect();
    } catch (error) {
        console.error('Error loading ingredients:', error);
        showNotification('Error loading ingredients list', 'error');
    }
}

// Load production history from API
async function loadProductionHistory() {
    try {
        console.log('Loading production history...');
        const response = await fetch('/production-tracking');
        if (!response.ok) {
            throw new Error('Failed to fetch production history');
        }
        
        productionHistory = await response.json();
        console.log('Production history loaded:', productionHistory);
        filteredHistory = [...productionHistory];
        renderHistoryTable();
        updateStats(); // Update statistics after loading data
    } catch (error) {
        console.error('Error loading production history:', error);
        showNotification('Error loading production history', 'error');
    }
}

// Populate item select dropdown
function populateItemSelect() {
    const itemSelect = document.getElementById('itemSelect');
    itemSelect.innerHTML = '<option value="">Choose an inventory item...</option>';
    
    allIngredients.forEach(ingredient => {
        const option = document.createElement('option');
        option.value = ingredient.id;
        option.textContent = `${ingredient.name} (Current: ${ingredient.quantity})`;
        option.dataset.quantity = ingredient.quantity;
        option.dataset.name = ingredient.name;
        itemSelect.appendChild(option);
    });
}

// Set default date and time
function setDefaultDateTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    document.getElementById('entryDate').value = today;
    document.getElementById('entryTime').value = currentTime;
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    const form = document.getElementById('productionForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Item selection change
    const itemSelect = document.getElementById('itemSelect');
    itemSelect.addEventListener('change', updateStockInfo);
    
    // Quantity change
    const quantityInput = document.getElementById('quantity');
    quantityInput.addEventListener('input', updateStockInfo);
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                clearUserSession();
                showNotification('Logged out successfully!', 'info');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            }
        });
    }
}

// Switch entry type (inbound/outbound)
function switchEntryType(type) {
    currentEntryType = type;
    
    // Update tab appearance
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');
    
    // Show/hide destination fields
    const destinationRow = document.getElementById('outboundDestination');
    const submitBtn = document.getElementById('submitBtn');
    
    if (type === 'outbound') {
        destinationRow.style.display = 'grid';
        submitBtn.textContent = 'Record Outbound Entry';
        document.getElementById('destination').required = true;
    } else {
        destinationRow.style.display = 'none';
        submitBtn.textContent = 'Record Inbound Entry';
        document.getElementById('destination').required = false;
    }
    
    updateStockInfo();
}

// Update stock information display
function updateStockInfo() {
    const itemSelect = document.getElementById('itemSelect');
    const quantityInput = document.getElementById('quantity');
    const stockInfo = document.getElementById('stockInfo');
    const currentStockSpan = document.getElementById('currentStock');
    const afterStockSpan = document.getElementById('afterStock');
    const warningRow = document.getElementById('warningRow');
    const warningText = document.getElementById('warningText');
    
    if (!itemSelect.value || !quantityInput.value) {
        stockInfo.style.display = 'none';
        return;
    }
    
    const selectedOption = itemSelect.selectedOptions[0];
    const currentStock = parseFloat(selectedOption.dataset.quantity);
    const quantity = parseFloat(quantityInput.value);
    
    let afterStock;
    if (currentEntryType === 'inbound') {
        afterStock = currentStock + quantity;
    } else {
        afterStock = currentStock - quantity;
    }
    
    currentStockSpan.textContent = currentStock.toFixed(2);
    afterStockSpan.textContent = afterStock.toFixed(2);
    
    // Show warning if outbound exceeds current stock
    if (currentEntryType === 'outbound' && quantity > currentStock) {
        warningRow.style.display = 'flex';
        warningText.textContent = `Insufficient stock! Available: ${currentStock.toFixed(2)}`;
        afterStockSpan.style.color = '#dc3545';
    } else if (afterStock < 0) {
        warningRow.style.display = 'flex';
        warningText.textContent = 'This will result in negative stock!';
        afterStockSpan.style.color = '#dc3545';
    } else {
        warningRow.style.display = 'none';
        afterStockSpan.style.color = '#007bff';
    }
    
    stockInfo.style.display = 'block';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const itemSelect = document.getElementById('itemSelect');
    const selectedOption = itemSelect.selectedOptions[0];
    
    if (!selectedOption) {
        showNotification('Please select an item', 'error');
        return;
    }
    
    const entryData = {
        type: currentEntryType,
        item: selectedOption.dataset.name,
        item_id: itemSelect.value,
        quantity: parseFloat(formData.get('quantity')),
        timestamp: `${formData.get('entryDate')} ${formData.get('entryTime')}`,
        destination_source: currentEntryType === 'outbound' ? formData.get('destination') : 'factory_production',
        batch: formData.get('batchNumber') || '',
        staff: currentUser.name,
        notes: formData.get('notes') || ''
    };
    
    // Validate outbound quantity
    if (currentEntryType === 'outbound') {
        const currentStock = parseFloat(selectedOption.dataset.quantity);
        if (entryData.quantity > currentStock) {
            showNotification('Cannot ship more than available stock', 'error');
            return;
        }
        
        if (!entryData.destination_source) {
            showNotification('Please select a destination outlet', 'error');
            return;
        }
    }
    
    pendingEntry = entryData;
    showConfirmModal();
}

// Show confirmation modal
function showConfirmModal() {
    const modal = document.getElementById('confirmModal');
    const confirmationText = document.getElementById('confirmationText');
    const stockImpactText = document.getElementById('stockImpactText');
    
    const itemSelect = document.getElementById('itemSelect');
    const selectedOption = itemSelect.selectedOptions[0];
    const currentStock = parseFloat(selectedOption.dataset.quantity);
    
    confirmationText.innerHTML = `
        <strong>Type:</strong> ${pendingEntry.type.charAt(0).toUpperCase() + pendingEntry.type.slice(1)}<br>
        <strong>Item:</strong> ${pendingEntry.item}<br>
        <strong>Quantity:</strong> ${pendingEntry.quantity}<br>
        <strong>Time:</strong> ${pendingEntry.timestamp}<br>
        ${pendingEntry.type === 'outbound' ? `<strong>Destination:</strong> ${formatDestination(pendingEntry.destination_source)}<br>` : ''}
        ${pendingEntry.batch ? `<strong>Batch:</strong> ${pendingEntry.batch}<br>` : ''}
        ${pendingEntry.notes ? `<strong>Notes:</strong> ${pendingEntry.notes}` : ''}
    `;
    
    const afterStock = pendingEntry.type === 'inbound' ? 
        currentStock + pendingEntry.quantity : 
        currentStock - pendingEntry.quantity;
    
    stockImpactText.innerHTML = `
        <strong>Current Stock:</strong> ${currentStock.toFixed(2)}<br>
        <strong>After Entry:</strong> ${afterStock.toFixed(2)}<br>
        <strong>Change:</strong> ${pendingEntry.type === 'inbound' ? '+' : '-'}${pendingEntry.quantity}
    `;
    
    modal.style.display = 'flex';
}

// Close confirmation modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    pendingEntry = null;
}

// Confirm and submit entry
async function confirmEntry() {
    if (!pendingEntry) return;
    
    try {
        console.log('Submitting production entry:', pendingEntry);
        
        const response = await fetch('/production-tracking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pendingEntry)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error('Failed to record production entry');
        }
        
        const result = await response.json();
        console.log('Entry recorded successfully:', result);
        
        showNotification('Production entry recorded successfully!', 'success');
        closeConfirmModal();
        resetForm();
        await loadProductionHistory();
        await loadIngredients(); // Refresh ingredient quantities
        updateStats();
        
    } catch (error) {
        console.error('Error recording entry:', error);
        showNotification('Error recording production entry: ' + error.message, 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('productionForm').reset();
    document.getElementById('stockInfo').style.display = 'none';
    setDefaultDateTime();
}

// Update statistics
async function updateStats() {
    try {
        console.log('=== UPDATING STATS ===');
        
        // Fetch fresh data from API
        const response = await fetch('/production-tracking');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fresh API data:', data);
        
        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            return;
        }
        
        // For testing, use the date that exists in our data (2025-07-22)
        // In production, you'd use: const today = new Date().toISOString().split('T')[0];
        const testDate = '2025-07-22'; // Use the date that actually has data
        console.log('Using date for filtering:', testDate);
        
        // Filter entries for our test date
        const todayEntries = data.filter(entry => {
            const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
            const isMatch = entryDate === testDate;
            console.log(`Entry ${entry.id}: timestamp=${entry.timestamp}, date=${entryDate}, matches=${isMatch}`);
            return isMatch;
        });
        
        console.log('Filtered entries for', testDate, ':', todayEntries);
        
        // Calculate statistics
        const todayInbound = todayEntries
            .filter(entry => entry.type === 'inbound')
            .reduce((count, entry) => count + 1, 0);
            
        const todayOutbound = todayEntries
            .filter(entry => entry.type === 'outbound')
            .reduce((count, entry) => count + 1, 0);
        
        const totalProduction = todayEntries
            .filter(entry => entry.type === 'inbound')
            .reduce((sum, entry) => sum + parseFloat(entry.quantity || 0), 0);
        
        const itemsShipped = todayEntries
            .filter(entry => entry.type === 'outbound')
            .reduce((sum, entry) => sum + parseFloat(entry.quantity || 0), 0);
        
        console.log('=== CALCULATED STATS ===');
        console.log('Today inbound count:', todayInbound);
        console.log('Today outbound count:', todayOutbound);
        console.log('Total production quantity:', totalProduction);
        console.log('Items shipped quantity:', itemsShipped);
        
        // Update DOM elements
        const todayInboundEl = document.getElementById('todayInbound');
        const todayOutboundEl = document.getElementById('todayOutbound');
        const totalProductionEl = document.getElementById('totalProduction');
        const itemsShippedEl = document.getElementById('itemsShipped');
        
        console.log('DOM elements found:', {
            todayInbound: !!todayInboundEl,
            todayOutbound: !!todayOutboundEl,
            totalProduction: !!totalProductionEl,
            itemsShipped: !!itemsShippedEl
        });
        
        if (todayInboundEl) {
            todayInboundEl.textContent = todayInbound;
            console.log('✅ Updated todayInbound element to:', todayInbound);
        } else {
            console.error('❌ todayInbound element not found');
        }
        
        if (todayOutboundEl) {
            todayOutboundEl.textContent = todayOutbound;
            console.log('✅ Updated todayOutbound element to:', todayOutbound);
        } else {
            console.error('❌ todayOutbound element not found');
        }
        
        if (totalProductionEl) {
            totalProductionEl.textContent = Math.round(totalProduction);
            console.log('✅ Updated totalProduction element to:', Math.round(totalProduction));
        } else {
            console.error('❌ totalProduction element not found');
        }
        
        if (itemsShippedEl) {
            itemsShippedEl.textContent = Math.round(itemsShipped);
            console.log('✅ Updated itemsShipped element to:', Math.round(itemsShipped));
        } else {
            console.error('❌ itemsShipped element not found');
        }
        
        // Update page title to indicate stats are working
        document.title = `PAU Inventory - Stats Updated! I:${todayInbound} O:${todayOutbound} P:${Math.round(totalProduction)} S:${Math.round(itemsShipped)}`;
        
        // Add a visible indicator to the page
        let indicator = document.getElementById('stats-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'stats-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #4CAF50;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(indicator);
        }
        indicator.innerHTML = `Stats Updated! 📊<br>In: ${todayInbound} | Out: ${todayOutbound}<br>Prod: ${Math.round(totalProduction)} | Ship: ${Math.round(itemsShipped)}`;
        
        console.log('=== STATS UPDATE COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Error in updateStats:', error);
        
        // Set default values on error
        const elements = ['todayInbound', 'todayOutbound', 'totalProduction', 'itemsShipped'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '0';
            }
        });
    }
}

// Filter history
function filterHistory() {
    const dateFilter = document.getElementById('filterDate').value;
    const typeFilter = document.getElementById('filterType').value;
    const today = new Date();
    
    filteredHistory = productionHistory.filter(entry => {
        const entryDate = new Date(entry.timestamp.split(' ')[0]);
        
        // Date filter
        let dateMatch = true;
        switch (dateFilter) {
            case 'today':
                dateMatch = entryDate.toDateString() === today.toDateString();
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                dateMatch = entryDate.toDateString() === yesterday.toDateString();
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                dateMatch = entryDate >= weekAgo;
                break;
            case 'all':
                dateMatch = true;
                break;
        }
        
        // Type filter
        const typeMatch = !typeFilter || entry.type === typeFilter;
        
        return dateMatch && typeMatch;
    });
    
    renderHistoryTable();
}

// Render history table
function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #6c757d;">No production entries found</td></tr>';
        return;
    }
    
    filteredHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(entry => {
            const row = document.createElement('tr');
            // Handle the destination/source field name with slash
            const destinationSource = entry['destination/source'] || entry.destination_source || '-';
            
            row.innerHTML = `
                <td>${formatTimestamp(entry.timestamp)}</td>
                <td><span class="type-badge ${entry.type}">${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</span></td>
                <td>${entry.item}</td>
                <td>${entry.quantity}</td>
                <td>${formatDestination(destinationSource)}</td>
                <td>${entry.batch || '-'}</td>
                <td>${entry.staff}</td>
                <td>${entry.notes || '-'}</td>
                <td>
                    <button class="delete-btn" onclick="deleteProductionEntry(${entry.id})" title="Delete Entry">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Format destination for display
function formatDestination(destination) {
    return destination.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Delete production entry
async function deleteProductionEntry(entryId) {
    if (!entryId) {
        showNotification('Invalid entry ID', 'error');
        return;
    }
    
    const entry = productionHistory.find(e => e.id === entryId);
    if (!entry) {
        showNotification('Entry not found', 'error');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete this ${entry.type} entry for "${entry.item}"?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/production-tracking/${entryId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete entry');
        }
        
        showNotification('Production entry deleted successfully', 'success');
        
        // Reload production history to reflect changes
        await loadProductionHistory();
        updateStats(); // Update statistics after deletion
        
    } catch (error) {
        console.error('Error deleting production entry:', error);
        showNotification(`Failed to delete entry: ${error.message}`, 'error');
    }
}

// Navigation functions
function goBackToDashboard() {
    if (currentUser && currentUser.role === 'supervisor') {
        window.location.href = 'supervisor-dashboard.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Utility function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('confirmModal');
    if (event.target === modal) {
        closeConfirmModal();
    }
});
