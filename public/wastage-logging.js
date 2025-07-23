// Wastage Logging System - JavaScript Implementation
let currentLocation = 'factory';
let inventoryItems = [];
let wastageHistory = [];
let currentUser = 'Supervisor'; // Default role
let isFormVisible = false;

// Initialize page on load
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    loadInventoryItems();
    loadWastageStats();
    loadWastageHistory();
    setCurrentDateTime();
    
    // Set up form event listeners
    setupEventListeners();
});

// Initialize page with role-based content
function initializePage() {
    updateWelcomeMessage();
    switchLocation('factory'); // Default to factory
    // Form starts hidden by default
    
    // Set up auto-refresh for statistics every 30 seconds
    setInterval(() => {
        loadWastageStats();
        loadWastageHistory();
    }, 30000);
}

// Toggle wastage form visibility
function toggleWastageForm() {
    const formSection = document.getElementById('wastageFormSection');
    const toggleBtn = document.getElementById('toggleFormBtn');
    
    if (isFormVisible) {
        // Hide form
        formSection.style.display = 'none';
        toggleBtn.textContent = '📝 Log Wastage Entry';
        toggleBtn.classList.remove('active');
        isFormVisible = false;
        
        // Hide stock info when form is closed
        document.getElementById('stockInfo').style.display = 'none';
    } else {
        // Show form
        formSection.style.display = 'block';
        toggleBtn.textContent = '❌ Close Form';
        toggleBtn.classList.add('active');
        isFormVisible = true;
    }
}

// Update welcome message based on role
function updateWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const roleBadge = document.getElementById('userRoleBadge');
    
    if (welcomeMessage && roleBadge) {
        welcomeMessage.textContent = `Welcome, ${currentUser}!`;
        roleBadge.textContent = currentUser;
    }
}

// Set up all event listeners
function setupEventListeners() {
    // Form submission
    document.getElementById('wastageForm').addEventListener('submit', handleFormSubmission);
    
    // Item selection change
    document.getElementById('itemSelect').addEventListener('change', handleItemSelection);
    
    // Quantity change for real-time calculations
    document.getElementById('quantity').addEventListener('input', calculateStockImpact);
    
    // Waste reason change
    document.getElementById('wasteReason').addEventListener('change', handleReasonChange);
    
    // Date/time validation
    document.getElementById('wasteDate').addEventListener('change', validateDateTime);
    document.getElementById('wasteTime').addEventListener('change', validateDateTime);
}

// Set current date and time as defaults
function setCurrentDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    document.getElementById('wasteDate').value = dateStr;
    document.getElementById('wasteTime').value = timeStr;
}

// Switch between factory and outlet locations
function switchLocation(location) {
    currentLocation = location;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-location="${location}"]`).classList.add('active');
    
    // Show/hide outlet-specific fields
    const outletDetails = document.getElementById('outletDetails');
    if (location === 'outlet') {
        outletDetails.style.display = 'flex';
        document.getElementById('outletLocation').required = true;
    } else {
        outletDetails.style.display = 'none';
        document.getElementById('outletLocation').required = false;
        document.getElementById('outletLocation').value = '';
        document.getElementById('reportedBy').value = '';
    }
    
    // Update submit button text
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = location === 'factory' ? 'Log Factory Wastage' : 'Log Outlet Wastage';
    
    // Reload stats for the selected location
    loadWastageStats();
}

// Load inventory items from server
async function loadInventoryItems() {
    try {
        const response = await fetch('/ingredients');
        if (!response.ok) throw new Error('Failed to fetch inventory items');
        
        inventoryItems = await response.json();
        populateItemSelect();
    } catch (error) {
        console.error('Error loading inventory items:', error);
        showNotification('Failed to load inventory items', 'error');
    }
}

// Populate the item selection dropdown
function populateItemSelect() {
    const itemSelect = document.getElementById('itemSelect');
    itemSelect.innerHTML = '<option value="">Choose an inventory item...</option>';
    
    inventoryItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (Available: ${item.quantity})`;
        option.dataset.quantity = item.quantity; // Use actual quantity as the available amount
        option.dataset.stock = item.stock; // Keep minimum stock level for reference
        option.dataset.name = item.name;
        itemSelect.appendChild(option);
    });
}

// Handle item selection change
function handleItemSelection(event) {
    const selectedOption = event.target.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        const currentQuantity = selectedOption.dataset.quantity; // Use actual quantity
        const stockUnit = 'units'; // Generic unit
        
        // Show stock info
        const stockInfo = document.getElementById('stockInfo');
        document.getElementById('currentStock').textContent = `${currentQuantity} units`;
        stockInfo.style.display = 'block';
        
        // Clear previous calculations
        document.getElementById('afterStock').textContent = '-';
        document.getElementById('valueLost').textContent = '-';
        hideWarning();
        
        // Trigger calculation if quantity is already entered
        const quantity = document.getElementById('quantity').value;
        if (quantity) {
            calculateStockImpact();
        }
    } else {
        document.getElementById('stockInfo').style.display = 'none';
    }
}

// Calculate stock impact and value lost
function calculateStockImpact() {
    const itemSelect = document.getElementById('itemSelect');
    const selectedOption = itemSelect.selectedOptions[0];
    const quantity = parseFloat(document.getElementById('quantity').value);
    
    if (!selectedOption || !selectedOption.value || !quantity || quantity <= 0) {
        return;
    }
    
    const currentQuantity = parseFloat(selectedOption.dataset.quantity); // Use actual quantity
    const minStock = parseFloat(selectedOption.dataset.stock); // Minimum stock level
    const stockUnit = 'units'; // Generic unit
    const itemName = selectedOption.dataset.name;
    
    // Calculate remaining quantity
    const afterQuantity = Math.max(0, currentQuantity - quantity);
    document.getElementById('afterStock').textContent = `${afterQuantity.toFixed(2)} units`;
    
    // Estimate value lost (simplified calculation - $2 per unit average)
    const estimatedValue = quantity * 2; // This could be enhanced with actual cost data
    document.getElementById('valueLost').textContent = `$${estimatedValue.toFixed(2)}`;
    document.getElementById('valueRow').style.display = 'flex';
    
    // Show warnings
    if (quantity > currentQuantity) {
        showWarning(`Wastage quantity (${quantity}) exceeds available quantity (${currentQuantity})`);
    } else if (afterQuantity <= minStock) {
        showWarning(`Quantity will fall to or below minimum stock level after wastage (${afterQuantity.toFixed(2)} units remaining, minimum: ${minStock})`);
    } else if (afterQuantity < 20) {
        showWarning(`Quantity will be low after wastage (${afterQuantity.toFixed(2)} units remaining)`);
    } else {
        hideWarning();
    }
}

// Show warning message
function showWarning(message) {
    document.getElementById('warningRow').style.display = 'flex';
    document.getElementById('warningText').textContent = message;
}

// Hide warning message
function hideWarning() {
    document.getElementById('warningRow').style.display = 'none';
}

// Handle waste reason change
function handleReasonChange(event) {
    const customReasonGroup = document.getElementById('customReasonGroup');
    const customReasonInput = document.getElementById('customReason');
    
    if (event.target.value === 'other') {
        customReasonGroup.style.display = 'block';
        customReasonInput.required = true;
    } else {
        customReasonGroup.style.display = 'none';
        customReasonInput.required = false;
        customReasonInput.value = '';
    }
}

// Validate date and time
function validateDateTime() {
    const wasteDate = document.getElementById('wasteDate').value;
    const wasteTime = document.getElementById('wasteTime').value;
    
    if (wasteDate && wasteTime) {
        const selectedDateTime = new Date(`${wasteDate}T${wasteTime}`);
        const now = new Date();
        
        if (selectedDateTime > now) {
            showNotification('Wastage date/time cannot be in the future', 'warning');
            return false;
        }
    }
    return true;
}

// Handle form submission
function handleFormSubmission(event) {
    event.preventDefault();
    
    if (!validateDateTime()) {
        return;
    }
    
    const formData = gatherFormData();
    if (!formData) {
        return;
    }
    
    // Show confirmation modal
    showConfirmationModal(formData);
}

// Gather form data
function gatherFormData() {
    const itemSelect = document.getElementById('itemSelect');
    const selectedOption = itemSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        showNotification('Please select an item', 'warning');
        return null;
    }
    
    const quantity = parseFloat(document.getElementById('quantity').value);
    const currentQuantity = parseFloat(selectedOption.dataset.quantity); // Use actual quantity
    
    if (quantity > currentQuantity) {
        showNotification('Wastage quantity cannot exceed available quantity', 'error');
        return null;
    }
    
    const wasteReason = document.getElementById('wasteReason').value;
    const customReason = document.getElementById('customReason').value;
    const finalReason = wasteReason === 'other' ? customReason : document.querySelector(`#wasteReason option[value="${wasteReason}"]`).textContent;
    
    const wasteDate = document.getElementById('wasteDate').value;
    const wasteTime = document.getElementById('wasteTime').value;
    const timestamp = `${wasteDate} ${wasteTime}:00`;
    
    let location = currentLocation;
    if (currentLocation === 'outlet') {
        const outletLocation = document.getElementById('outletLocation').value;
        if (!outletLocation) {
            showNotification('Please select an outlet location', 'warning');
            return null;
        }
        location = document.querySelector(`#outletLocation option[value="${outletLocation}"]`).textContent;
    }
    
    const reportedBy = currentLocation === 'outlet' ? 
        (document.getElementById('reportedBy').value || currentUser) : 
        currentUser;
    
    return {
        timestamp,
        location,
        item: selectedOption.dataset.name,
        itemId: parseInt(selectedOption.value),
        quantity,
        reason: finalReason,
        value_lost: quantity * 2, // Simplified calculation
        logged_by: reportedBy,
        notes: document.getElementById('notes').value || null,
        currentStock: currentQuantity,
        afterStock: Math.max(0, currentQuantity - quantity)
    };
}

// Show confirmation modal
function showConfirmationModal(formData) {
    const modal = document.getElementById('confirmModal');
    const confirmationText = document.getElementById('confirmationText');
    const stockImpactText = document.getElementById('stockImpactText');
    
    confirmationText.innerHTML = `
        <div class="detail-row"><strong>Location:</strong> ${formData.location}</div>
        <div class="detail-row"><strong>Item:</strong> ${formData.item}</div>
        <div class="detail-row"><strong>Quantity:</strong> ${formData.quantity}</div>
        <div class="detail-row"><strong>Reason:</strong> ${formData.reason}</div>
        <div class="detail-row"><strong>Date/Time:</strong> ${formData.timestamp}</div>
        <div class="detail-row"><strong>Logged By:</strong> ${formData.logged_by}</div>
        ${formData.notes ? `<div class="detail-row"><strong>Notes:</strong> ${formData.notes}</div>` : ''}
    `;
    
    stockImpactText.innerHTML = `
        <div class="impact-row">Current Stock: ${formData.currentStock}</div>
        <div class="impact-row">After Wastage: ${formData.afterStock}</div>
        <div class="impact-row">Estimated Value Lost: $${formData.value_lost.toFixed(2)}</div>
    `;
    
    // Store form data for confirmation
    modal.dataset.formData = JSON.stringify(formData);
    modal.style.display = 'block';
    
    // Add keyboard event listeners
    document.addEventListener('keydown', handleModalKeydown);
    
    // Focus on the confirm button for better accessibility
    setTimeout(() => {
        const confirmBtn = modal.querySelector('.confirm-btn');
        if (confirmBtn) {
            confirmBtn.focus();
        }
    }, 100);
}

// Handle keyboard events in modal
function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        closeConfirmModal();
    } else if (event.key === 'Enter') {
        confirmWastage();
    }
}

// Close confirmation modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleModalKeydown);
}

// Confirm and submit wastage
async function confirmWastage() {
    const modal = document.getElementById('confirmModal');
    const formData = JSON.parse(modal.dataset.formData);
    
    try {
        const response = await fetch('/wastage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to log wastage');
        }
        
        const result = await response.json();
        closeConfirmModal();
        
        // Show detailed success message with inventory impact
        let successMessage = 'Wastage logged successfully';
        
        if (result.inventoryUpdate) {
            const update = result.inventoryUpdate;
            successMessage += `<br>📦 Inventory Updated: ${update.previousQuantity} → ${update.newQuantity}`;
            
            if (update.statusChanged) {
                successMessage += `<br>⚠️ Status Changed: ${update.newStatus.toUpperCase()}`;
            }
            
            if (update.alertTriggered) {
                successMessage += `<br>🚨 Alert: Low stock or expiring item detected!`;
            }
        }
        
        showNotification(successMessage, 'success');
        
        // Reset form and reload data
        resetForm();
        loadInventoryItems();
        loadWastageStats();
        loadWastageHistory();
        
        // Close the form after successful submission
        if (isFormVisible) {
            toggleWastageForm();
        }
        
    } catch (error) {
        console.error('Error logging wastage:', error);
        showNotification(error.message, 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('wastageForm').reset();
    document.getElementById('stockInfo').style.display = 'none';
    document.getElementById('customReasonGroup').style.display = 'none';
    document.getElementById('customReason').required = false;
    hideWarning();
    setCurrentDateTime();
    
    // Reset to factory location
    switchLocation('factory');
}

// Load wastage statistics
async function loadWastageStats() {
    try {
        const response = await fetch('/wastage/stats');
        if (!response.ok) throw new Error('Failed to fetch wastage statistics');
        
        const stats = await response.json();
        updateStatsDisplay(stats);
        updateLastUpdatedTime();
    } catch (error) {
        console.error('Error loading wastage stats:', error);
        // Silently handle error - don't show notification to user
        // Set default stats instead
        updateStatsDisplay({
            totalItems: 0,
            totalValue: 0,
            factoryItems: 0,
            outletItems: 0,
            factoryValue: 0,
            outletValue: 0
        });
    }
}

// Manual refresh function
async function refreshStats() {
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.classList.add('loading');
    
    try {
        await loadWastageStats();
        await loadWastageHistory();
        showNotification('Statistics refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing stats:', error);
        showNotification('Failed to refresh statistics', 'error');
    } finally {
        refreshBtn.classList.remove('loading');
    }
}

// Update last updated timestamp
function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const lastUpdatedElement = document.getElementById('lastUpdated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = timeString;
    }
}

// Update statistics display
function updateStatsDisplay(stats) {
    // Update basic numbers
    document.getElementById('todayWastage').textContent = stats.totalItems || 0;
    document.getElementById('factoryWastage').textContent = stats.factoryItems || 0;
    document.getElementById('outletWastage').textContent = stats.outletItems || 0;
    document.getElementById('totalValueLost').textContent = `$${(stats.totalValue || 0).toFixed(2)}`;
    
    // Add trend indicators and enhanced information
    updateTodayWastageCard(stats);
    updateFactoryWastageCard(stats);
    updateOutletWastageCard(stats);
    updateTotalValueCard(stats);
}

// Update Today's Wastage card with trends
function updateTodayWastageCard(stats) {
    const card = document.querySelector('.stat-card.today-wastage');
    const numberElement = card.querySelector('.stat-number');
    const labelElement = card.querySelector('.stat-label');
    
    // Add trend indicator
    const trendIcon = getTrendIcon(stats.itemsTrend);
    numberElement.innerHTML = `${stats.totalItems || 0} ${trendIcon}`;
    
    // Update label with additional info
    if (stats.totalQuantity > 0) {
        labelElement.innerHTML = `items (${stats.totalQuantity} units total)`;
    } else {
        labelElement.textContent = 'items';
    }
    
    // Add trend class
    card.classList.remove('trend-up', 'trend-down', 'trend-stable');
    card.classList.add(`trend-${stats.itemsTrend || 'stable'}`);
}

// Update Factory Wastage card (Inbound items)
function updateFactoryWastageCard(stats) {
    const card = document.querySelector('.stat-card.factory-wastage');
    const infoElement = card.querySelector('.stat-info h3');
    const numberElement = card.querySelector('.stat-number');
    const labelElement = card.querySelector('.stat-label');
    
    // Update title to clarify it's inbound
    infoElement.textContent = 'Factory Wastage (Inbound)';
    
    // Add percentage if there are items
    let displayText = stats.factoryItems || 0;
    if (stats.totalItems > 0) {
        displayText += ` (${stats.factoryPercentage || 0}%)`;
    }
    numberElement.textContent = displayText;
    
    // Update label with value information
    if (stats.factoryValue > 0) {
        labelElement.innerHTML = `items • $${stats.factoryValue.toFixed(2)} lost`;
    } else {
        labelElement.textContent = 'items today';
    }
}

// Update Outlet Wastage card (Outbound items)
function updateOutletWastageCard(stats) {
    const card = document.querySelector('.stat-card.outlet-wastage');
    const infoElement = card.querySelector('.stat-info h3');
    const numberElement = card.querySelector('.stat-number');
    const labelElement = card.querySelector('.stat-label');
    
    // Update title to clarify it's outbound
    infoElement.textContent = 'Outlet Wastage (Outbound)';
    
    // Add percentage if there are items
    let displayText = stats.outletItems || 0;
    if (stats.totalItems > 0) {
        displayText += ` (${stats.outletPercentage || 0}%)`;
    }
    numberElement.textContent = displayText;
    
    // Update label with value information
    if (stats.outletValue > 0) {
        labelElement.innerHTML = `items • $${stats.outletValue.toFixed(2)} lost`;
    } else {
        labelElement.textContent = 'items today';
    }
}

// Update Total Value card with trends and comparisons
function updateTotalValueCard(stats) {
    const card = document.getElementById('totalValueCard');
    const numberElement = card.querySelector('.stat-number');
    const labelElement = card.querySelector('.stat-label');
    
    // Add trend indicator
    const trendIcon = getTrendIcon(stats.valueTrend);
    const totalValue = stats.totalValue || 0;
    numberElement.innerHTML = `$${totalValue.toFixed(2)} ${trendIcon}`;
    
    // Update label with weekly average comparison
    if (stats.avgDailyValue > 0) {
        const weeklyAvg = stats.avgDailyValue;
        const comparison = totalValue > weeklyAvg ? 'above' : totalValue < weeklyAvg ? 'below' : 'at';
        labelElement.innerHTML = `today • ${comparison} avg ($${weeklyAvg.toFixed(2)})`;
    } else {
        labelElement.textContent = 'today';
    }
    
    // Update color based on amount and trend
    card.classList.remove('high-value', 'medium-value', 'low-value', 'trend-up', 'trend-down', 'trend-stable');
    
    if (totalValue > 100) {
        card.classList.add('high-value');
    } else if (totalValue > 50) {
        card.classList.add('medium-value');
    } else {
        card.classList.add('low-value');
    }
    
    card.classList.add(`trend-${stats.valueTrend || 'stable'}`);
}

// Get trend icon based on trend direction
function getTrendIcon(trend) {
    switch (trend) {
        case 'up':
            return '<span class="trend-icon trend-up">📈</span>';
        case 'down':
            return '<span class="trend-icon trend-down">📉</span>';
        default:
            return '<span class="trend-icon trend-stable">➡️</span>';
    }
}

// Load wastage history
async function loadWastageHistory() {
    try {
        const response = await fetch('/wastage/history');
        if (!response.ok) throw new Error('Failed to fetch wastage history');
        
        wastageHistory = await response.json();
        filterHistory(); // Apply current filters
    } catch (error) {
        console.error('Error loading wastage history:', error);
        showNotification('Failed to load wastage history', 'error');
    }
}

// Filter and display history
function filterHistory() {
    const dateFilter = document.getElementById('filterDate').value;
    const locationFilter = document.getElementById('filterLocation').value;
    const reasonFilter = document.getElementById('filterReason').value;
    
    let filteredHistory = [...wastageHistory];
    
    // Date filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    filteredHistory = filteredHistory.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        
        switch (dateFilter) {
            case 'today':
                return entryDate >= today;
            case 'yesterday':
                const yesterdayEnd = new Date(today.getTime() - 1);
                return entryDate >= yesterday && entryDate < yesterdayEnd;
            case 'week':
                return entryDate >= weekAgo;
            case 'month':
                return entryDate >= monthAgo;
            default:
                return true;
        }
    });
    
    // Location filtering
    if (locationFilter) {
        filteredHistory = filteredHistory.filter(entry => {
            const location = entry.location.toLowerCase();
            return locationFilter === 'factory' ? 
                location.includes('factory') : 
                !location.includes('factory');
        });
    }
    
    // Reason filtering
    if (reasonFilter) {
        filteredHistory = filteredHistory.filter(entry => 
            entry.reason.toLowerCase().includes(reasonFilter.toLowerCase())
        );
    }
    
    displayHistoryTable(filteredHistory);
}

// Display history in table
function displayHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No wastage entries found for the selected filters</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = history.map(entry => `
        <tr>
            <td>${formatDateTime(entry.timestamp)}</td>
            <td>${entry.location}</td>
            <td>${entry.item}</td>
            <td>${entry.quantity}</td>
            <td>${entry.reason}</td>
            <td>$${parseFloat(entry.value_lost).toFixed(2)}</td>
            <td>${entry.logged_by}</td>
            <td>${entry.notes || '-'}</td>
        </tr>
    `).join('');
}

// Format date/time for display
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Navigation functions
function goBackToDashboard() {
    window.location.href = 'supervisor-dashboard.html';
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="notification-close">&times;</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Logout function
document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'index.html';
    }
});
