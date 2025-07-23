// Supply Request Management JavaScript

// Global variables
let currentUser = null;
let currentRole = null;
let allRequests = [];
let filteredRequests = [];
let currentViewMode = 'all';
let selectedRequestId = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    loadSupplyRequests();
    updateStatistics();
    
    // Set up form submission
    document.getElementById('requestForm').addEventListener('submit', handleFormSubmission);
    
    // Set up modal close events
    setupModalEvents();
    
    // Set up logout functionality
    document.getElementById('logoutBtn').addEventListener('click', logout);
});

// Initialize page based on user role
function initializePage() {
    // Get user info from session storage or localStorage
    currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser') || 'Supervisor';
    currentRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || 'supervisor';
    
    // Focus on supervisor role - default to supervisor if not specified
    if (currentRole !== 'supervisor') {
        currentRole = 'supervisor';
    }
    
    // Update UI elements based on role
    let displayName = currentUser;
    let roleName = 'Supervisor';
    
    // Clean up the user name if it's just whitespace or generic
    if (!currentUser || currentUser.trim() === '' || currentUser.trim() === 'supervisor') {
        displayName = roleName;
    }
    
    // Set the welcome message to show the role
    document.getElementById('welcomeMessage').textContent = `Welcome, ${roleName}!`;
    document.getElementById('userRoleBadge').textContent = roleName;
    
    // Always show admin elements for supervisor-focused system
    document.getElementById('viewAllBtn').style.display = 'flex';
    document.getElementById('userRoleBadge').style.background = 'linear-gradient(135deg, #28a745, #20c997)';
}

// Load supply requests from API
async function loadSupplyRequests() {
    try {
        showLoading(true);
        const response = await fetch('/supply-requests');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allRequests = await response.json();
        filteredRequests = [...allRequests];
        
        console.log('Loaded supply requests:', allRequests);
        
        renderRequestsTable();
        updateStatistics();
        
    } catch (error) {
        console.error('Error loading supply requests:', error);
        showMessage('Failed to load supply requests. Please try again.', 'error');
        
        // Show empty table with message
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    Failed to load requests. Please refresh the page.
                </td>
            </tr>
        `;
    } finally {
        showLoading(false);
    }
}

// Render requests table
function renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    
    if (filteredRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    No supply requests found.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredRequests.map(request => `
        <tr>
            <td>#${request['request id'] || request.id}</td>
            <td>${request['item name'] || request.item_name}</td>
            <td>${request.quantity} ${request.unit || ''}</td>
            <td><span class="priority-badge priority-${request.priority}">${request.priority}</span></td>
            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
            <td>${request['requested by'] || request.requested_by}</td>
            <td>${formatDate(request.date)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-details-btn" onclick="viewRequestDetails(${request['request id'] || request.id})">
                        👁️ View
                    </button>
                    ${request.status === 'pending' ? `
                        <button class="action-btn approve-btn" onclick="approveRequestQuick(${request['request id'] || request.id})" title="Quick Approve">
                            ✅ Approve
                        </button>
                        <button class="action-btn reject-btn" onclick="rejectRequestQuick(${request['request id'] || request.id})" title="Quick Reject">
                            ❌ Reject
                        </button>
                    ` : ''}
                    ${request.status === 'pending' ? `
                        <button class="action-btn delete-btn" onclick="deleteRequest(${request['request id'] || request.id})">
                            🗑️ Delete
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Update statistics
function updateStatistics() {
    const stats = {
        pending: allRequests.filter(r => r.status === 'pending').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        total: allRequests.length,
        urgent: allRequests.filter(r => r.priority === 'urgent').length
    };
    
    document.getElementById('pendingCount').textContent = stats.pending;
    document.getElementById('approvedCount').textContent = stats.approved;
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('urgentCount').textContent = stats.urgent;
}

// Open new request modal
function openNewRequestModal() {
    document.getElementById('modalTitle').textContent = 'New Supply Request';
    document.getElementById('requestForm').reset();
    
    // Set default values
    document.getElementById('priority').value = 'medium';
    document.getElementById('unit').value = 'kg';
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('neededBy').min = today;
    
    document.getElementById('requestModal').style.display = 'block';
}

// Handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    try {
        // Disable submit button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';
        
        const formData = new FormData(event.target);
        const requestData = {
            item_name: formData.get('itemName'),
            category: formData.get('category'),
            quantity: parseInt(formData.get('quantity')),
            unit: formData.get('unit'),
            priority: formData.get('priority'),
            needed_by: formData.get('neededBy') || null,
            justification: formData.get('justification'),
            preferred_supplier: formData.get('preferredSupplier') || null,
            requested_by: currentUser,
            status: 'pending',
            date: new Date().toISOString().split('T')[0]
        };
        
        console.log('Submitting request data:', requestData);
        
        const response = await fetch('/supply-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit request');
        }
        
        const result = await response.json();
        console.log('Request submitted successfully:', result);
        
        showMessage('Supply request submitted successfully!', 'success');
        closeModal();
        loadSupplyRequests(); // Reload the requests
        
    } catch (error) {
        console.error('Error submitting request:', error);
        showMessage(`Failed to submit request: ${error.message}`, 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// View request details
async function viewRequestDetails(requestId) {
    try {
        const request = allRequests.find(r => (r['request id'] || r.id) == requestId);
        
        if (!request) {
            showMessage('Request not found', 'error');
            return;
        }
        
        const detailsHtml = `
            <div class="detail-item">
                <div class="detail-label">Request ID:</div>
                <div class="detail-value">#${request['request id'] || request.id}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Item Name:</div>
                <div class="detail-value">${request['item name'] || request.item_name}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Category:</div>
                <div class="detail-value">${request.category || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Quantity:</div>
                <div class="detail-value">${request.quantity} ${request.unit || ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Priority:</div>
                <div class="detail-value"><span class="priority-badge priority-${request.priority}">${request.priority}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status:</div>
                <div class="detail-value"><span class="status-badge status-${request.status}">${request.status}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Requested By:</div>
                <div class="detail-value">${request['requested by'] || request.requested_by}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date Requested:</div>
                <div class="detail-value">${formatDate(request.date)}</div>
            </div>
            ${request.needed_by ? `
                <div class="detail-item">
                    <div class="detail-label">Needed By:</div>
                    <div class="detail-value">${formatDate(request.needed_by)}</div>
                </div>
            ` : ''}
            ${request.justification ? `
                <div class="detail-item">
                    <div class="detail-label">Justification:</div>
                    <div class="detail-value">${request.justification}</div>
                </div>
            ` : ''}
            ${request.preferred_supplier ? `
                <div class="detail-item">
                    <div class="detail-label">Preferred Supplier:</div>
                    <div class="detail-value">${request.preferred_supplier}</div>
                </div>
            ` : ''}
            ${request.status === 'approved' ? `
                <div class="detail-section">
                    <h4 class="section-title">Approval Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Approved By:</div>
                        <div class="detail-value">${request.approved_by || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Approval Date:</div>
                        <div class="detail-value">${formatDate(request.approved_date) || 'N/A'}</div>
                    </div>
                </div>
            ` : ''}
            ${request.status === 'rejected' ? `
                <div class="detail-section rejected-section">
                    <h4 class="section-title">Rejection Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Rejected By:</div>
                        <div class="detail-value">${request.rejected_by || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Rejection Date:</div>
                        <div class="detail-value">${formatDate(request.rejected_date) || 'N/A'}</div>
                    </div>
                    ${request.rejection_reason ? `
                        <div class="detail-item">
                            <div class="detail-label">Rejection Reason:</div>
                            <div class="detail-value rejection-reason">${request.rejection_reason}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;
        
        document.getElementById('requestDetails').innerHTML = detailsHtml;
        
        // Show admin actions if user is supervisor/admin and request is pending
        const adminActions = document.getElementById('adminActions');
        if ((currentRole === 'supervisor' || currentRole === 'admin') && request.status === 'pending') {
            adminActions.style.display = 'flex';
            selectedRequestId = requestId;
        } else {
            adminActions.style.display = 'none';
        }
        
        document.getElementById('viewModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error viewing request details:', error);
        showMessage('Failed to load request details', 'error');
    }
}

// Quick approve function for table actions
async function approveRequestQuick(requestId) {
    if (currentRole !== 'supervisor' && currentRole !== 'admin') {
        showMessage('⚠️ Access Denied - Only supervisors can approve requests.', 'error');
        return;
    }
    
    const request = allRequests.find(r => (r['request id'] || r.id) == requestId);
    if (!request) {
        showMessage('Request not found', 'error');
        return;
    }
    
    if (request.status !== 'pending') {
        showMessage('⚠️ Cannot Approve - Only pending requests can be approved.', 'error');
        return;
    }
    
    const itemName = request['item name'] || request.item_name;
    const confirmMessage = `Are you sure you want to approve the request for "${itemName}"?`;
    
    showConfirmation(confirmMessage, async () => {
        try {
            const response = await fetch(`/supply-requests/${requestId}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    approved_by: currentUser,
                    approved_date: new Date().toISOString().split('T')[0]
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to approve request');
            }
            
            showMessage('Request approved successfully!', 'success');
            loadSupplyRequests(); // Reload the requests
            
        } catch (error) {
            console.error('Error approving request:', error);
            showMessage('Failed to approve request', 'error');
        }
    });
}

// Quick reject function for table actions
async function rejectRequestQuick(requestId) {
    console.log('rejectRequestQuick called with:', requestId);
    console.log('Current role:', currentRole);
    console.log('Current user:', currentUser);
    
    if (currentRole !== 'supervisor' && currentRole !== 'admin') {
        console.log('Access denied - role check failed');
        showMessage('⚠️ Access Denied - Only supervisors can reject requests.', 'error');
        return;
    }
    
    const request = allRequests.find(r => (r['request id'] || r.id) == requestId);
    if (!request) {
        console.log('Request not found:', requestId);
        showMessage('Request not found', 'error');
        return;
    }
    
    console.log('Found request:', request);
    
    if (request.status !== 'pending') {
        console.log('Request status is not pending:', request.status);
        showMessage('⚠️ Cannot Reject - Only pending requests can be rejected.', 'error');
        return;
    }
    
    const itemName = request['item name'] || request.item_name;
    const reason = prompt(`Please provide a reason for rejecting the request for "${itemName}":`);
    
    if (reason === null) {
        console.log('User cancelled rejection');
        return; // User cancelled
    }
    
    if (!reason.trim()) {
        console.log('No reason provided');
        showMessage('Rejection reason is required', 'error');
        return;
    }
    
    console.log('Attempting to reject request with reason:', reason);
    
    try {
        const response = await fetch(`/supply-requests/${requestId}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rejected_by: currentUser,
                rejected_date: new Date().toISOString().split('T')[0],
                rejection_reason: reason
            })
        });
        
        console.log('Reject response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.log('Reject response error:', errorData);
            throw new Error(errorData.error || 'Failed to reject request');
        }
        
        const result = await response.json();
        console.log('Reject success:', result);
        
        showMessage('✅ Request rejected successfully', 'success');
        loadSupplyRequests(); // Reload the requests
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        showMessage('❌ Failed to reject request: ' + error.message, 'error');
    }
}

// Approve request (from modal)
async function approveRequest() {
    if (!selectedRequestId) return;
    
    if (currentRole !== 'supervisor' && currentRole !== 'admin') {
        showMessage('⚠️ Access Denied - Only supervisors can approve requests.', 'error');
        return;
    }
    
    showConfirmation(
        'Are you sure you want to approve this request?',
        async () => {
            try {
                const response = await fetch(`/supply-requests/${selectedRequestId}/approve`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        approved_by: currentUser,
                        approved_date: new Date().toISOString().split('T')[0]
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to approve request');
                }
                
                showMessage('Request approved successfully!', 'success');
                closeViewModal();
                loadSupplyRequests();
                
            } catch (error) {
                console.error('Error approving request:', error);
                showMessage('Failed to approve request', 'error');
            }
        }
    );
}

// Reject request (from modal)
async function rejectRequest() {
    if (!selectedRequestId) {
        console.log('No request selected');
        return;
    }
    
    console.log('rejectRequest called for ID:', selectedRequestId);
    console.log('Current role:', currentRole);
    console.log('Current user:', currentUser);
    
    if (currentRole !== 'supervisor' && currentRole !== 'admin') {
        console.log('Access denied - role check failed');
        showMessage('⚠️ Access Denied - Only supervisors can reject requests.', 'error');
        return;
    }
    
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) {
        console.log('User cancelled rejection');
        return; // User cancelled
    }
    
    if (!reason.trim()) {
        console.log('No reason provided');
        showMessage('Rejection reason is required', 'error');
        return;
    }
    
    console.log('Attempting to reject request with reason:', reason);
    
    try {
        const response = await fetch(`/supply-requests/${selectedRequestId}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rejected_by: currentUser,
                rejected_date: new Date().toISOString().split('T')[0],
                rejection_reason: reason
            })
        });
        
        console.log('Reject response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.log('Reject response error:', errorData);
            throw new Error(errorData.error || 'Failed to reject request');
        }
        
        const result = await response.json();
        console.log('Reject success:', result);
        
        showMessage('✅ Request rejected successfully', 'success');
        closeViewModal();
        loadSupplyRequests();
        loadSupplyRequests();
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        showMessage('Failed to reject request', 'error');
    }
}

// Delete request
async function deleteRequest(requestId) {
    showConfirmation(
        'Are you sure you want to delete this request? This action cannot be undone.',
        async () => {
            try {
                const response = await fetch(`/supply-requests/${requestId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete request');
                }
                
                showMessage('Request deleted successfully!', 'success');
                loadSupplyRequests();
                
            } catch (error) {
                console.error('Error deleting request:', error);
                showMessage('Failed to delete request', 'error');
            }
        }
    );
}

// View my requests
function viewMyRequests() {
    currentViewMode = 'my';
    filteredRequests = allRequests.filter(request => 
        (request['requested by'] || request.requested_by) === currentUser
    );
    renderRequestsTable();
    updateStatistics();
}

// View all requests (supervisor only)
function viewAllRequests() {
    currentViewMode = 'all';
    filteredRequests = [...allRequests];
    renderRequestsTable();
    updateStatistics();
}

// Search functionality
function searchRequests() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(request => {
            const itemName = (request['item name'] || request.item_name || '').toLowerCase();
            const requestedBy = (request['requested by'] || request.requested_by || '').toLowerCase();
            const status = (request.status || '').toLowerCase();
            const priority = (request.priority || '').toLowerCase();
            
            return itemName.includes(searchTerm) || 
                   requestedBy.includes(searchTerm) || 
                   status.includes(searchTerm) || 
                   priority.includes(searchTerm);
        });
    }
    
    renderRequestsTable();
}

// Filter functionality
function filterRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    filteredRequests = allRequests.filter(request => {
        let matches = true;
        
        if (statusFilter && request.status !== statusFilter) {
            matches = false;
        }
        
        if (priorityFilter && request.priority !== priorityFilter) {
            matches = false;
        }
        
        if (dateFilter) {
            const requestDate = new Date(request.date).toISOString().split('T')[0];
            if (requestDate !== dateFilter) {
                matches = false;
            }
        }
        
        return matches;
    });
    
    renderRequestsTable();
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(show) {
    const container = document.querySelector('.table-section');
    if (show) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

function showMessage(message, type = 'info') {
    // Remove any existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(messageDiv, mainContent.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

function showConfirmation(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'block';
    
    // Set up confirm button
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = () => {
        closeConfirmModal();
        onConfirm();
    };
}

// Modal functions
function closeModal() {
    document.getElementById('requestModal').style.display = 'none';
    document.getElementById('requestForm').reset();
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
    selectedRequestId = null;
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function setupModalEvents() {
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const requestModal = document.getElementById('requestModal');
        const viewModal = document.getElementById('viewModal');
        const confirmModal = document.getElementById('confirmModal');
        
        if (event.target === requestModal) {
            closeModal();
        } else if (event.target === viewModal) {
            closeViewModal();
        } else if (event.target === confirmModal) {
            closeConfirmModal();
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
            closeViewModal();
            closeConfirmModal();
        }
    });
}

// Navigation functions
function goBackToDashboard() {
    window.location.href = 'supervisor-dashboard.html';
}

function logout() {
    // Clear session data
    sessionStorage.clear();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
    
    // Redirect to login
    window.location.href = 'login.html';
}
