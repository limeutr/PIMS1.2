// Global variables
let currentUser = null;

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
    const session = getUserSession();
    if (!session) {
        // No valid session, redirect to login
        window.location.href = 'login.html';
        return false;
    }
    
    // Check if user is supervisor
    if (session.role !== 'supervisor') {
        // Not a supervisor, redirect to appropriate page
        alert('Access denied. This page is only accessible to supervisors.');
        window.location.href = 'login.html';
        return false;
    }
    
    currentUser = session;
    updateUserInterface();
    return true;
}

function updateUserInterface() {
    if (currentUser) {
        const welcomeMessage = document.getElementById('welcomeMessage');
        
        if (welcomeMessage) {
            // Show role-based welcome message
            let displayName = 'Supervisor';
            
            // If we have a proper name, use it, otherwise use the role
            if (currentUser.name && currentUser.name.trim() && currentUser.name !== 'undefined') {
                displayName = currentUser.name;
            } else if (currentUser.role === 'supervisor') {
                displayName = 'Supervisor';
            }
            
            welcomeMessage.textContent = `Welcome, ${displayName}!`;
        }
    }
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!checkAuthentication()) {
        return; // Will redirect to login
    }
    
    initializeDashboard();
    setupEventListeners();
});

function initializeDashboard() {
    // Load real-time data
    loadKPIData();
    loadStockData();
    loadSalesData();
    
    // Set up periodic updates
    setInterval(loadKPIData, 30000); // Update KPIs every 30 seconds
    setInterval(loadStockData, 60000); // Update stock every minute
}

function setupEventListeners() {
    // Setup logout button
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
    
    // Add hover effects to KPI cards
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.boxShadow = '';
        });
    });
}

// Data loading functions (placeholder - will be connected to real API later)
function loadKPIData() {
    // Simulate loading KPI data
    console.log('Loading KPI data...');
    // This will be replaced with actual API calls
}

function loadStockData() {
    // Load stock alerts from the API
    console.log('Loading stock data...');
    
    fetch('/stock-alerts')
        .then(response => response.json())
        .then(alerts => {
            console.log('Stock alerts loaded:', alerts);
            updateStockAlerts(alerts);
        })
        .catch(error => {
            console.error('Error loading stock alerts:', error);
        });
}

function updateStockAlerts(alerts) {
    const alertList = document.querySelector('.alert-list');
    
    if (!alertList) {
        console.error('Alert list container not found');
        return;
    }
    
    // Clear existing alerts
    alertList.innerHTML = '';
    
    if (alerts.length === 0) {
        alertList.innerHTML = '<div class="no-alerts"><p>✅ No stock alerts at this time</p></div>';
        return;
    }
    
    // Add each alert
    alerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item ${alert.alertType}`;
        
        // Get appropriate icon based on alert type
        let icon = '🟡'; // default warning
        switch (alert.alertType) {
            case 'critical':
                icon = '🔴';
                break;
            case 'warning':
                icon = '🟡';
                break;
            case 'expired':
                icon = '⏰';
                break;
        }
        
        alertItem.innerHTML = `
            <span class="alert-icon">${icon}</span>
            <div class="alert-info">
                <strong>${alert.name}</strong>
                <p>${alert.message}</p>
                <small>Location: ${alert.location || 'Unknown'}</small>
            </div>
        `;
        
        alertList.appendChild(alertItem);
    });
}

function loadSalesData() {
    // Simulate loading sales data
    console.log('Loading sales data...');
    // This will be replaced with actual API calls
}

// Navigation functions
function goToDashboard() {
    // Already on dashboard, just refresh
    window.location.reload();
}

// Management tool functions
function openInventoryManagement() {
    // Redirect to inventory management page
    window.location.href = 'index.html';
}

function openProductionTracking() {
    // Redirect to production tracking page
    window.location.href = 'production-tracking.html';
}

function openSupplyRequest() {
    window.location.href = 'supply-request.html';
}

function openWastageLogging() {
    window.location.href = 'wastage-logging.html';
}

function openStaffManagement() {
    showNotification('Staff Management module coming soon!', 'info');
    // TODO: Implement staff management
}

function openReportIssue() {
    showNotification('Report Issue module coming soon!', 'info');
    // TODO: Implement issue reporting
}

function generateReport() {
    showNotification('Report Generation module coming soon!', 'info');
    // TODO: Implement report generation
}

function openSettings() {
    showNotification('System Settings module coming soon!', 'info');
    // TODO: Implement settings
}

function openSalesAnalytics() {
    showNotification('Detailed Sales Analytics coming soon!', 'info');
    // TODO: Implement detailed analytics
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add styles
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
    
    // Set background color based on type
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
    
    // Add to document
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
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

// Add some interactive features
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) {
        return;
    }
    
    // Add click effects to chart bars
    const bars = document.querySelectorAll('.bar');
    bars.forEach(bar => {
        bar.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            showNotification(`Sales for this month: ${value}`, 'info');
        });
    });
    
    // Add click effects to product items
    const productItems = document.querySelectorAll('.product-item');
    productItems.forEach(item => {
        item.addEventListener('click', function() {
            const productName = this.querySelector('strong').textContent;
            showNotification(`Viewing details for ${productName}`, 'info');
        });
    });
});
