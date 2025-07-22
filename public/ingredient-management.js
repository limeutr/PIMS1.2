// Global variables
let allIngredients = [];
let filteredIngredients = [];
let currentEditingId = null;
let deleteIngredientId = null;
let originalEditData = null; // Store original data for reset functionality

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await fetchIngredients();
        updateStats();
        populateFilters();
        setupEventListeners();
        
        // Hide form initially
        document.getElementById('ingredientFormSection').style.display = 'none';
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Fetch ingredients from API
async function fetchIngredients() {
    try {
        const response = await fetch('/ingredients');
        if (!response.ok) {
            throw new Error('Failed to fetch ingredients');
        }
        allIngredients = await response.json();
        filteredIngredients = [...allIngredients];
        renderIngredientsTable();
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        showNotification('Error loading ingredients', 'error');
    }
}

// Calculate status based on conditions
function calculateStatus(quantity, stock, expiryDate) {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    // Check if expired
    if (daysUntilExpiry < 0) {
        return 'expired';
    }
    
    // Check if expiring soon (within 2 weeks = 14 days)
    if (daysUntilExpiry <= 14) {
        return 'expiring';
    }
    
    // Check if low stock (quantity is at or below minimum stock level)
    if (quantity <= stock) {
        return 'low';
    }
    
    // If none of the above conditions, it's in good condition
    return 'good';
}

// Add new ingredient
async function addIngredient(ingredientData) {
    try {
        const response = await fetch('/ingredients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ingredientData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add ingredient');
        }
        
        showNotification('Ingredient added successfully!', 'success');
        await fetchIngredients();
        updateStats();
        resetForm();
        toggleFormSection();
        // Clear original edit data
        originalEditData = null;
    } catch (error) {
        console.error('Error adding ingredient:', error);
        showNotification('Error adding ingredient', 'error');
    }
}

// Update ingredient
async function updateIngredient(id, ingredientData) {
    try {
        const response = await fetch(`/ingredients/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ingredientData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update ingredient');
        }
        
        showNotification('Ingredient updated successfully!', 'success');
        await fetchIngredients();
        updateStats();
        resetForm();
        toggleFormSection();
        // Clear original edit data
        originalEditData = null;
    } catch (error) {
        console.error('Error updating ingredient:', error);
        showNotification('Error updating ingredient', 'error');
    }
}

// Delete ingredient
async function deleteIngredient(id) {
    try {
        console.log('Attempting to delete ingredient with ID:', id);
        const response = await fetch(`/ingredients/${id}`, {
            method: 'DELETE'
        });
        
        console.log('Delete response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Delete failed:', errorText);
            throw new Error(`Failed to delete ingredient: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Delete successful:', result);
        
        showNotification('Ingredient deleted successfully!', 'success');
        await fetchIngredients();
        updateStats();
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        showNotification('Error deleting ingredient: ' + error.message, 'error');
    }
}

// Form submission handler
function setupEventListeners() {
    const form = document.getElementById('ingredientForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const ingredientData = {
            name: formData.get('ingredientName'),
            category: formData.get('ingredientCategory'),
            quantity: parseFloat(formData.get('quantity')),
            stock: parseFloat(formData.get('stock')),
            supplier: formData.get('supplier'),
            expirydate: formData.get('expiryDate'),
            location: formData.get('storageLocation')
        };
        
        // Calculate status automatically
        ingredientData.status = calculateStatus(ingredientData.quantity, ingredientData.stock, ingredientData.expirydate);
        
        // Validate required fields
        if (!ingredientData.name || !ingredientData.category || 
            !ingredientData.quantity || !ingredientData.stock || 
            !ingredientData.supplier || !ingredientData.expirydate || 
            !ingredientData.location) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const editingId = document.getElementById('editingId').value;
        
        if (editingId) {
            // Update existing ingredient
            await updateIngredient(editingId, ingredientData);
        } else {
            // Add new ingredient
            await addIngredient(ingredientData);
        }
    });
    
    // Add event listeners for real-time status calculation
    const quantityInput = document.getElementById('quantity');
    const stockInput = document.getElementById('stock');
    const expiryInput = document.getElementById('expiryDate');
    const statusDisplay = document.getElementById('statusDisplay');
    
    function updateStatusDisplay() {
        const quantity = parseFloat(quantityInput.value) || 0;
        const stock = parseFloat(stockInput.value) || 0;
        const expiryDate = expiryInput.value;
        
        if (expiryDate) {
            const status = calculateStatus(quantity, stock, expiryDate);
            statusDisplay.value = formatStatus(status);
            
            // Update the background color based on status
            switch(status) {
                case 'good':
                    statusDisplay.style.backgroundColor = '#d4edda';
                    statusDisplay.style.color = '#155724';
                    break;
                case 'low':
                    statusDisplay.style.backgroundColor = '#d1ecf1';
                    statusDisplay.style.color = '#0c5460';
                    break;
                case 'expiring':
                    statusDisplay.style.backgroundColor = '#fff3cd';
                    statusDisplay.style.color = '#856404';
                    break;
                case 'expired':
                    statusDisplay.style.backgroundColor = '#f8d7da';
                    statusDisplay.style.color = '#721c24';
                    break;
                default:
                    statusDisplay.style.backgroundColor = '#f8f9fa';
                    statusDisplay.style.color = '#6c757d';
            }
        } else {
            statusDisplay.value = 'Enter expiry date to calculate';
            statusDisplay.style.backgroundColor = '#f8f9fa';
            statusDisplay.style.color = '#6c757d';
        }
    }
    
    quantityInput.addEventListener('input', updateStatusDisplay);
    stockInput.addEventListener('input', updateStatusDisplay);
    expiryInput.addEventListener('change', updateStatusDisplay);
}

// Render ingredients table
function renderIngredientsTable() {
    const tbody = document.getElementById('ingredientsTableBody');
    tbody.innerHTML = '';
    
    if (filteredIngredients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">No ingredients found</td></tr>';
        return;
    }
    
    filteredIngredients.forEach(ingredient => {
        const row = createIngredientRow(ingredient);
        tbody.appendChild(row);
    });
}

// Create table row for ingredient
function createIngredientRow(ingredient) {
    const row = document.createElement('tr');
    
    // Determine status class for styling
    const statusClass = getStatusClass(ingredient);
    row.className = statusClass;
    
    // Create edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '✏️';
    editBtn.onclick = () => editIngredient(ingredient.id);
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = () => showDeleteModal(ingredient.id, ingredient.name);
    
    // Create actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions';
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);
    
    row.innerHTML = `
        <td>${ingredient.id || 'N/A'}</td>
        <td>${ingredient.name}</td>
        <td>${formatCategory(ingredient.category)}</td>
        <td>${ingredient.quantity}</td>
        <td>${ingredient.stock}</td>
        <td>${ingredient.supplier || 'N/A'}</td>
        <td>${formatDate(ingredient.expirydate)}</td>
        <td><span class="status-badge status-${ingredient.status}">${formatStatus(ingredient.status)}</span></td>
        <td>${formatLocation(ingredient.location)}</td>
    `;
    
    // Append the actions cell
    row.appendChild(actionsCell);
    
    return row;
}

// Get status class for row styling
function getStatusClass(ingredient) {
    const today = new Date();
    const expiryDate = new Date(ingredient.expirydate);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired-row';
    if (daysUntilExpiry <= 7) return 'expiring-row';
    if (ingredient.quantity <= ingredient.stock) return 'low-stock-row';
    return '';
}

// Format category for display
function formatCategory(category) {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format status for display
function formatStatus(status) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format location for display
function formatLocation(location) {
    return location.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            // If invalid date, return empty string
            return '';
        }
        return date.toISOString().split('T')[0];
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

// Edit ingredient
function editIngredient(id) {
    const ingredient = allIngredients.find(item => item.id == id);
    if (!ingredient) return;
    
    // Store original data for reset functionality
    originalEditData = {
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        quantity: ingredient.quantity,
        stock: ingredient.stock,
        supplier: ingredient.supplier || '',
        expirydate: ingredient.expirydate,
        location: ingredient.location
    };
    
    // Populate form with ingredient data
    populateEditForm(ingredient);
    
    // Update form title and button
    document.getElementById('formTitle').textContent = '✏️ Edit Ingredient';
    document.getElementById('submitBtn').textContent = 'Update Ingredient';
    document.getElementById('resetBtn').textContent = 'Reset to Original';
    
    // Show form
    document.getElementById('ingredientFormSection').style.display = 'block';
    document.getElementById('toggleFormBtn').textContent = 'Close Form';
    document.getElementById('addIngredientBtn').textContent = '📝 Edit Mode';
}

// Helper function to populate edit form
function populateEditForm(ingredient) {
    // Populate form with ingredient data
    document.getElementById('editingId').value = ingredient.id;
    document.getElementById('ingredientName').value = ingredient.name;
    document.getElementById('ingredientCategory').value = ingredient.category;
    document.getElementById('quantity').value = ingredient.quantity;
    document.getElementById('stock').value = ingredient.stock;
    document.getElementById('supplier').value = ingredient.supplier || '';
    
    // Format the expiry date properly for the date input
    document.getElementById('expiryDate').value = formatDateForInput(ingredient.expirydate);
    
    document.getElementById('storageLocation').value = ingredient.location;
    
    // Calculate and display current status using the formatted date
    const formattedExpiryDate = formatDateForInput(ingredient.expirydate);
    const currentStatus = calculateStatus(ingredient.quantity, ingredient.stock, formattedExpiryDate);
    const statusDisplay = document.getElementById('statusDisplay');
    statusDisplay.value = formatStatus(currentStatus);
    
    // Update status display color
    switch(currentStatus) {
        case 'good':
            statusDisplay.style.backgroundColor = '#d4edda';
            statusDisplay.style.color = '#155724';
            break;
        case 'low':
            statusDisplay.style.backgroundColor = '#d1ecf1';
            statusDisplay.style.color = '#0c5460';
            break;
        case 'expiring':
            statusDisplay.style.backgroundColor = '#fff3cd';
            statusDisplay.style.color = '#856404';
            break;
        case 'expired':
            statusDisplay.style.backgroundColor = '#f8d7da';
            statusDisplay.style.color = '#721c24';
            break;
    }
}

// Show delete confirmation modal
function showDeleteModal(id, name) {
    deleteIngredientId = id;
    const deleteDetails = document.getElementById('deleteDetails');
    deleteDetails.innerHTML = '';
    
    // Create content safely to avoid XSS
    const ingredientInfo = document.createElement('div');
    ingredientInfo.innerHTML = '<strong>Ingredient:</strong> ';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    ingredientInfo.appendChild(nameSpan);
    ingredientInfo.appendChild(document.createElement('br'));
    
    const idInfo = document.createElement('div');
    idInfo.innerHTML = '<strong>ID:</strong> ';
    const idSpan = document.createElement('span');
    idSpan.textContent = id;
    idInfo.appendChild(idSpan);
    
    deleteDetails.appendChild(ingredientInfo);
    deleteDetails.appendChild(idInfo);
    
    document.getElementById('deleteModal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    deleteIngredientId = null;
}

// Confirm delete
async function confirmDelete() {
    console.log('Confirm delete called, deleteIngredientId:', deleteIngredientId);
    if (deleteIngredientId) {
        await deleteIngredient(deleteIngredientId);
        closeDeleteModal();
    } else {
        console.error('No ingredient ID set for deletion');
        showNotification('Error: No ingredient selected for deletion', 'error');
    }
}

// Toggle form section visibility
function toggleFormSection() {
    const formSection = document.getElementById('ingredientFormSection');
    const toggleBtn = document.getElementById('toggleFormBtn');
    const addBtn = document.getElementById('addIngredientBtn');
    
    if (formSection.style.display === 'none' || formSection.style.display === '') {
        formSection.style.display = 'block';
        toggleBtn.textContent = 'Close Form';
        addBtn.textContent = '📝 Form Open';
        resetForm();
    } else {
        formSection.style.display = 'none';
        toggleBtn.textContent = 'Show Form';
        addBtn.textContent = '➕ Add Ingredient';
        resetForm();
        // Clear original edit data when closing form
        originalEditData = null;
    }
}

// Reset form
function resetForm() {
    const editingId = document.getElementById('editingId').value;
    
    if (editingId && originalEditData) {
        // In edit mode - restore original data
        populateEditForm(originalEditData);
        showNotification('Form reset to original values', 'info');
    } else {
        // In add mode - clear form completely
        const form = document.getElementById('ingredientForm');
        form.reset();
        document.getElementById('editingId').value = '';
        document.getElementById('formTitle').textContent = '➕ Add New Ingredient';
        document.getElementById('submitBtn').textContent = 'Add Ingredient';
        document.getElementById('resetBtn').textContent = 'Reset';
        
        // Reset status display
        const statusDisplay = document.getElementById('statusDisplay');
        statusDisplay.value = 'Enter details to calculate status';
        statusDisplay.style.backgroundColor = '#f8f9fa';
        statusDisplay.style.color = '#6c757d';
        
        // Clear original edit data
        originalEditData = null;
        
        showNotification('Form cleared', 'info');
    }
}

// Filter ingredients
function filterIngredients() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const supplierFilter = document.getElementById('supplierFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const unitFilter = document.getElementById('unitFilter').value;
    
    filteredIngredients = allIngredients.filter(ingredient => {
        const matchesSearch = !searchTerm || 
            ingredient.name.toLowerCase().includes(searchTerm) ||
            ingredient.category.toLowerCase().includes(searchTerm) ||
            (ingredient.supplier && ingredient.supplier.toLowerCase().includes(searchTerm)) ||
            (ingredient.id && ingredient.id.toString().includes(searchTerm));
        
        const matchesStatus = !statusFilter || ingredient.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    renderIngredientsTable();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('supplierFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('unitFilter').value = '';
    
    filteredIngredients = [...allIngredients];
    renderIngredientsTable();
}

// Update statistics
function updateStats() {
    const today = new Date();
    
    const totalIngredients = allIngredients.length;
    const expiredIngredients = allIngredients.filter(item => {
        const expiryDate = new Date(item.expirydate);
        return expiryDate < today;
    }).length;
    
    const lowStockIngredients = allIngredients.filter(item => {
        return item.quantity <= item.stock;
    }).length;
    
    const suppliers = new Set(allIngredients.map(item => item.supplier || 'Unknown')).size;
    
    document.getElementById('totalIngredients').textContent = totalIngredients;
    document.getElementById('expiredIngredients').textContent = expiredIngredients;
    document.getElementById('lowStockIngredients').textContent = lowStockIngredients;
    document.getElementById('activeSuppliers').textContent = suppliers;
}

// Populate filter dropdowns
function populateFilters() {
    // No need to populate supplier filter as it's not in current schema
    // This function can be expanded when more filter options are needed
}

// Export data functionality
function exportData() {
    const csvContent = generateCSV(allIngredients);
    downloadCSV(csvContent, 'ingredients_export.csv');
}

// Generate CSV content
function generateCSV(data) {
    const headers = ['ID', 'Name', 'Category', 'Quantity', 'Stock', 'Supplier', 'Expiry Date', 'Status', 'Location'];
    const rows = data.map(item => [
        item.id || '',
        item.name || '',
        item.category || '',
        item.quantity || '',
        item.stock || '',
        item.supplier || '',
        item.expirydate || '',
        item.status || '',
        item.location || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    return csvContent;
}

// Download CSV file
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Show notification
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

// Navigation functions (placeholder)
function goBackToDashboard() {
    // Implement navigation to dashboard
    console.log('Navigate back to dashboard');
}

// Logout function (placeholder)
document.getElementById('logoutBtn').addEventListener('click', function() {
    // Implement logout functionality
    console.log('Logout clicked');
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('deleteModal');
    if (event.target === modal) {
        closeDeleteModal();
    }
});
