const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database - add missing columns if they don't exist
function initializeDatabase() {
  // Check and add rejection_reason column to supply_request table
  db.query("SHOW COLUMNS FROM supply_request LIKE 'rejection_reason'", (err, results) => {
    if (err) {
      console.error('Error checking columns:', err);
      return;
    }
    
    if (results.length === 0) {
      // Column doesn't exist, add it
      db.query("ALTER TABLE supply_request ADD COLUMN rejection_reason TEXT", (err) => {
        if (err) {
          console.error('Error adding rejection_reason column:', err);
        } else {
          console.log('Added rejection_reason column to supply_request table');
        }
      });
    }
  });

  // Check if wastage table exists, create if it doesn't
  db.query("SHOW TABLES LIKE 'wastage'", (err, results) => {
    if (err) {
      console.error('Error checking wastage table:', err);
      return;
    }
    
    if (results.length === 0) {
      // Table doesn't exist, create it
      const createWastageTable = `
        CREATE TABLE wastage (
          id int(11) NOT NULL AUTO_INCREMENT,
          timestamp datetime NOT NULL DEFAULT current_timestamp(),
          location varchar(100) NOT NULL,
          item varchar(100) NOT NULL,
          quantity int(11) NOT NULL,
          reason varchar(255) NOT NULL,
          value_lost decimal(10,2) NOT NULL,
          logged_by varchar(100) NOT NULL,
          notes text DEFAULT NULL,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `;
      
      db.query(createWastageTable, (err) => {
        if (err) {
          console.error('Error creating wastage table:', err);
        } else {
          console.log('Created wastage table successfully');
        }
      });
    }
  });
}

// Call database initialization
initializeDatabase();

// TEST endpoint to verify stats calculation
app.get('/test-stats', (req, res) => {
  console.log('TEST STATS ENDPOINT CALLED');
  
  db.query('SELECT * FROM production_tracking ORDER BY timestamp DESC', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log('Database results:', results);
    
    const testDate = '2025-07-22';
    const todayEntries = results.filter(entry => {
      const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
      return entryDate === testDate;
    });
    
    const stats = {
      totalEntries: results.length,
      todayEntries: todayEntries.length,
      todayInbound: todayEntries.filter(e => e.type === 'inbound').length,
      todayOutbound: todayEntries.filter(e => e.type === 'outbound').length,
      totalProduction: todayEntries.filter(e => e.type === 'inbound').reduce((sum, e) => sum + e.quantity, 0),
      itemsShipped: todayEntries.filter(e => e.type === 'outbound').reduce((sum, e) => sum + e.quantity, 0),
      testDate: testDate,
      sampleEntries: todayEntries.slice(0, 3)
    };
    
    console.log('Calculated stats:', stats);
    res.json(stats);
  });
});

// Route to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Function to calculate status based on conditions
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

// Function to check if an item should trigger an alert
function shouldTriggerAlert(ingredient) {
    const today = new Date();
    const expiry = new Date(ingredient.expirydate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    // Condition 1: Quantity below 100
    if (ingredient.quantity < 100) {
        return true;
    }
    
    // Condition 2: Nearing expiration (within 14 days)
    if (daysUntilExpiry <= 14 && daysUntilExpiry >= 0) {
        return true;
    }
    
    // Condition 3: Already expired
    if (daysUntilExpiry < 0) {
        return true;
    }
    
    return false;
}

// GET stock alerts endpoint
app.get('/stock-alerts', (req, res) => {
    db.query('SELECT * FROM ingredients', (err, results) => {
        if (err) {
            console.error('Error fetching ingredients for alerts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const alerts = [];
        
        results.forEach(ingredient => {
            if (shouldTriggerAlert(ingredient)) {
                const today = new Date();
                const expiry = new Date(ingredient.expirydate);
                const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                
                let alertType = 'warning';
                let message = '';
                let priority = 1;
                
                // Determine alert type and message
                if (daysUntilExpiry < 0) {
                    alertType = 'expired';
                    message = `Expired ${Math.abs(daysUntilExpiry)} day(s) ago`;
                    priority = 3; // Highest priority
                } else if (daysUntilExpiry <= 3) {
                    alertType = 'critical';
                    message = `Expires in ${daysUntilExpiry} day(s)`;
                    priority = 3;
                } else if (daysUntilExpiry <= 14) {
                    alertType = 'warning';
                    message = `Expires in ${daysUntilExpiry} day(s)`;
                    priority = 2;
                } else if (ingredient.quantity < 50) {
                    alertType = 'critical';
                    message = `Critical low stock: ${ingredient.quantity} ${ingredient.unit || 'units'} (Min: ${ingredient.stock})`;
                    priority = 3;
                } else if (ingredient.quantity < 100) {
                    alertType = 'warning';
                    message = `Low stock: ${ingredient.quantity} ${ingredient.unit || 'units'} (Min: ${ingredient.stock})`;
                    priority = 2;
                }
                
                alerts.push({
                    id: ingredient.id,
                    name: ingredient.name,
                    category: ingredient.category,
                    quantity: ingredient.quantity,
                    unit: ingredient.unit,
                    stock: ingredient.stock,
                    expirydate: ingredient.expirydate,
                    location: ingredient.location,
                    alertType: alertType,
                    message: message,
                    priority: priority,
                    daysUntilExpiry: daysUntilExpiry
                });
            }
        });
        
        // Sort alerts by priority (highest first)
        alerts.sort((a, b) => b.priority - a.priority);
        
        res.json(alerts);
    });
});

// GET all ingredients
app.get('/ingredients', (req, res) => {
  db.query('SELECT * FROM ingredients', (err, results) => {
    if (err) {
      console.error('Error fetching ingredients:', err);
      return res.status(500).json({ error: 'Failed to fetch ingredients' });
    }
    
    // Recalculate status for each ingredient to ensure accuracy
    const updatedResults = results.map(ingredient => {
        const calculatedStatus = calculateStatus(ingredient.quantity, ingredient.stock, ingredient.expirydate);
        return {
            ...ingredient,
            status: calculatedStatus
        };
    });
    
    res.json(updatedResults);
  });
});

// GET single ingredient
app.get('/ingredients/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM ingredients WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error fetching ingredient:', err);
      return res.status(500).json({ error: 'Failed to fetch ingredient' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    
    // Recalculate status to ensure accuracy
    const ingredient = results[0];
    const calculatedStatus = calculateStatus(ingredient.quantity, ingredient.stock, ingredient.expirydate);
    
    res.json({
        ...ingredient,
        status: calculatedStatus
    });
  });
});

// POST new ingredient
app.post('/ingredients', (req, res) => {
  const { name, category, quantity, stock, supplier, expirydate, location } = req.body;
  
  // Validate required fields
  if (!name || !category || !quantity || !stock || !supplier || !expirydate || !location) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Calculate status automatically
  const status = calculateStatus(quantity, stock, expirydate);
  
  db.query(
    'INSERT INTO ingredients (name, category, quantity, stock, supplier, expirydate, status, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [name, category, quantity, stock, supplier, expirydate, status, location], 
    (err, result) => {
      if (err) {
        console.error('Error adding ingredient:', err);
        return res.status(500).json({ error: 'Failed to add ingredient' });
      }
      res.status(201).json({ 
        id: result.insertId, 
        name, 
        category, 
        quantity, 
        stock, 
        supplier,
        expirydate, 
        status, 
        location 
      });
    }
  );
});

// PUT update ingredient
app.put('/ingredients/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, quantity, stock, supplier, expirydate, location } = req.body;
  
  // Validate required fields
  if (!name || !category || !quantity || !stock || !supplier || !expirydate || !location) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Calculate status automatically
  const status = calculateStatus(quantity, stock, expirydate);
  
  db.query(
    'UPDATE ingredients SET name = ?, category = ?, quantity = ?, stock = ?, supplier = ?, expirydate = ?, status = ?, location = ? WHERE id = ?',
    [name, category, quantity, stock, supplier, expirydate, status, location, id],
    (err, result) => {
      if (err) {
        console.error('Error updating ingredient:', err);
        return res.status(500).json({ error: 'Failed to update ingredient' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }
      res.json({ 
        id: parseInt(id), 
        name, 
        category, 
        quantity, 
        stock, 
        supplier,
        expirydate, 
        status, 
        location 
      });
    }
  );
});

// DELETE ingredient
app.delete('/ingredients/:id', (req, res) => {
  const { id } = req.params;
  
  db.query('DELETE FROM ingredients WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting ingredient:', err);
      return res.status(500).json({ error: 'Failed to delete ingredient' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json({ message: 'Ingredient deleted successfully' });
  });
});

// Production Tracking API Endpoints

// GET all production tracking entries
app.get('/production-tracking', (req, res) => {
  db.query('SELECT * FROM production_tracking ORDER BY timestamp DESC', (err, results) => {
    if (err) {
      console.error('Error fetching production tracking entries:', err);
      return res.status(500).json({ error: 'Failed to fetch production tracking entries' });
    }
    res.json(results);
  });
});

// POST new production tracking entry
app.post('/production-tracking', (req, res) => {
  const { type, item, item_id, quantity, timestamp, destination_source, batch, staff, notes } = req.body;
  
  // Validate required fields
  if (!type || !item || !quantity || !timestamp || !staff) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Insert production tracking entry
  const insertQuery = `
    INSERT INTO production_tracking (timestamp, type, item, quantity, \`destination/source\`, batch, staff, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(insertQuery, [timestamp, type, item, quantity, destination_source || '', batch || '', staff, notes || ''], (err, result) => {
    if (err) {
      console.error('Error inserting production tracking entry:', err);
      return res.status(500).json({ error: 'Failed to insert production tracking entry' });
    }
    
    // Update ingredient quantity based on entry type
    if (item_id) {
      let updateQuery;
      if (type === 'inbound') {
        updateQuery = 'UPDATE ingredients SET quantity = quantity + ? WHERE id = ?';
      } else if (type === 'outbound') {
        updateQuery = 'UPDATE ingredients SET quantity = quantity - ? WHERE id = ?';
      }
      
      if (updateQuery) {
        db.query(updateQuery, [quantity, item_id], (updateErr) => {
          if (updateErr) {
            console.error('Error updating ingredient quantity:', updateErr);
            // Note: We don't return error here as the tracking entry was successful
          }
          
          // Recalculate status for the updated ingredient
          db.query('SELECT * FROM ingredients WHERE id = ?', [item_id], (selectErr, ingredients) => {
            if (!selectErr && ingredients.length > 0) {
              const ingredient = ingredients[0];
              const newStatus = calculateStatus(ingredient.quantity, ingredient.stock, ingredient.expirydate);
              
              db.query('UPDATE ingredients SET status = ? WHERE id = ?', [newStatus, item_id], (statusErr) => {
                if (statusErr) {
                  console.error('Error updating ingredient status:', statusErr);
                }
              });
            }
          });
        });
      }
    }
    
    res.json({ 
      message: 'Production tracking entry recorded successfully',
      id: result.insertId
    });
  });
});

// DELETE production tracking entry
app.delete('/production-tracking/:id', (req, res) => {
  const { id } = req.params;
  
  db.query('DELETE FROM production_tracking WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting production tracking entry:', err);
      return res.status(500).json({ error: 'Failed to delete production tracking entry' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Production tracking entry not found' });
    }
    res.json({ message: 'Production tracking entry deleted successfully' });
  });
});

// GET production tracking entries by date range
app.get('/production-tracking/date/:startDate/:endDate', (req, res) => {
  const { startDate, endDate } = req.params;
  
  const query = `
    SELECT * FROM production_tracking 
    WHERE DATE(timestamp) BETWEEN ? AND ? 
    ORDER BY timestamp DESC
  `;
  
  db.query(query, [startDate, endDate], (err, results) => {
    if (err) {
      console.error('Error fetching production tracking entries by date:', err);
      return res.status(500).json({ error: 'Failed to fetch production tracking entries' });
    }
    res.json(results);
  });
});

// GET production tracking statistics
app.get('/production-tracking/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const statsQuery = `
    SELECT 
      type,
      COUNT(*) as count,
      SUM(quantity) as total_quantity
    FROM production_tracking 
    WHERE DATE(timestamp) = ? 
    GROUP BY type
  `;
  
  db.query(statsQuery, [today], (err, results) => {
    if (err) {
      console.error('Error fetching production tracking stats:', err);
      return res.status(500).json({ error: 'Failed to fetch production tracking statistics' });
    }
    
    const stats = {
      inbound: { count: 0, total_quantity: 0 },
      outbound: { count: 0, total_quantity: 0 }
    };
    
    results.forEach(row => {
      stats[row.type] = {
        count: row.count,
        total_quantity: parseFloat(row.total_quantity) || 0
      };
    });
    
    res.json(stats);
  });
});

// Supply Request API Endpoints

// GET all supply requests
app.get('/supply-requests', (req, res) => {
  db.query('SELECT * FROM supply_request ORDER BY date DESC', (err, results) => {
    if (err) {
      console.error('Error fetching supply requests:', err);
      return res.status(500).json({ error: 'Failed to fetch supply requests' });
    }
    res.json(results);
  });
});

// GET single supply request
app.get('/supply-requests/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM supply_request WHERE `request id` = ?', [id], (err, results) => {
    if (err) {
      console.error('Error fetching supply request:', err);
      return res.status(500).json({ error: 'Failed to fetch supply request' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Supply request not found' });
    }
    res.json(results[0]);
  });
});

// POST new supply request
app.post('/supply-requests', (req, res) => {
  const { 
    item_name, 
    category, 
    quantity, 
    unit, 
    priority, 
    needed_by, 
    justification, 
    preferred_supplier, 
    requested_by, 
    status, 
    date 
  } = req.body;
  
  // Validate required fields
  if (!item_name || !quantity || !priority || !requested_by || !justification) {
    return res.status(400).json({ error: 'Missing required fields: item_name, quantity, priority, requested_by, justification' });
  }
  
  // Build the insert query with proper field names (using backticks for fields with spaces)
  const insertQuery = `
    INSERT INTO supply_request (
      \`item name\`, 
      quantity, 
      priority, 
      status, 
      \`requested by\`, 
      date,
      category,
      unit,
      needed_by,
      justification,
      preferred_supplier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const values = [
    item_name,
    quantity,
    priority,
    status || 'pending',
    requested_by,
    date || new Date().toISOString().split('T')[0],
    category || null,
    unit || null,
    needed_by || null,
    justification,
    preferred_supplier || null
  ];
  
  db.query(insertQuery, values, (err, result) => {
    if (err) {
      console.error('Error adding supply request:', err);
      return res.status(500).json({ error: 'Failed to add supply request' });
    }
    
    res.status(201).json({ 
      message: 'Supply request created successfully',
      id: result.insertId,
      item_name,
      quantity,
      priority,
      status: status || 'pending',
      requested_by,
      date: date || new Date().toISOString().split('T')[0]
    });
  });
});

// PUT update supply request status to approved
app.put('/supply-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approved_by, approved_date } = req.body;
  
  db.query(
    'UPDATE supply_request SET status = ?, approved_by = ?, approved_date = ? WHERE `request id` = ?',
    ['approved', approved_by, approved_date || new Date().toISOString().split('T')[0], id],
    (err, result) => {
      if (err) {
        console.error('Error approving supply request:', err);
        return res.status(500).json({ error: 'Failed to approve supply request' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Supply request not found' });
      }
      res.json({ message: 'Supply request approved successfully' });
    }
  );
});

// PUT update supply request status to rejected
app.put('/supply-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rejected_by, rejected_date, rejection_reason } = req.body;
  
  db.query(
    'UPDATE supply_request SET status = ?, rejected_by = ?, rejected_date = ?, rejection_reason = ? WHERE `request id` = ?',
    ['rejected', rejected_by, rejected_date || new Date().toISOString().split('T')[0], rejection_reason || '', id],
    (err, result) => {
      if (err) {
        console.error('Error rejecting supply request:', err);
        return res.status(500).json({ error: 'Failed to reject supply request' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Supply request not found' });
      }
      res.json({ message: 'Supply request rejected successfully' });
    }
  );
});

// DELETE supply request
app.delete('/supply-requests/:id', (req, res) => {
  const { id } = req.params;
  
  db.query('DELETE FROM supply_request WHERE `request id` = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting supply request:', err);
      return res.status(500).json({ error: 'Failed to delete supply request' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Supply request not found' });
    }
    res.json({ message: 'Supply request deleted successfully' });
  });
});

// GET supply request statistics
app.get('/supply-requests/stats/summary', (req, res) => {
  const statsQuery = `
    SELECT 
      status,
      COUNT(*) as count
    FROM supply_request 
    GROUP BY status
  `;
  
  db.query(statsQuery, (err, results) => {
    if (err) {
      console.error('Error fetching supply request stats:', err);
      return res.status(500).json({ error: 'Failed to fetch supply request statistics' });
    }
    
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      total: 0
    };
    
    results.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });
    
    res.json(stats);
  });
});

// WASTAGE LOGGING ENDPOINTS

// POST new wastage entry
app.post('/wastage', (req, res) => {
  const { timestamp, location, item, itemId, quantity, reason, value_lost, logged_by, notes } = req.body;
  
  // Validate required fields
  if (!timestamp || !location || !item || !quantity || !reason || !logged_by || value_lost === undefined) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }
  
  // First, check if ingredient exists and has sufficient quantity
  db.query(
    'SELECT * FROM ingredients WHERE id = ?',
    [itemId],
    (err, ingredients) => {
      if (err) {
        console.error('Error checking ingredient:', err);
        return res.status(500).json({ error: 'Failed to check ingredient' });
      }
      
      if (ingredients.length === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }
      
      const ingredient = ingredients[0];
      if (ingredient.quantity < quantity) {
        return res.status(400).json({ error: `Insufficient quantity. Available: ${ingredient.quantity}, Requested: ${quantity}` });
      }
      
      // Update the ingredient quantity (actual inventory)
      const newQuantity = ingredient.quantity - quantity;
      const newStatus = calculateStatus(newQuantity, ingredient.stock, ingredient.expirydate);
      
      db.query(
        'UPDATE ingredients SET quantity = ?, status = ? WHERE id = ?',
        [newQuantity, newStatus, itemId],
        (err, updateResult) => {
          if (err) {
            console.error('Error updating ingredient quantity:', err);
            return res.status(500).json({ error: 'Failed to update ingredient quantity' });
          }
          
          // Then insert the wastage record
          db.query(
            'INSERT INTO wastage (timestamp, location, item, quantity, reason, value_lost, logged_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [timestamp, location, item, quantity, reason, value_lost, logged_by, notes],
            (err, result) => {
              if (err) {
                console.error('Error logging wastage:', err);
                // Rollback the ingredient quantity update
                db.query('UPDATE ingredients SET quantity = ?, status = ? WHERE id = ?', [ingredient.quantity, ingredient.status, itemId]);
                return res.status(500).json({ error: 'Failed to log wastage entry' });
              }
              
              // Check if the new quantity triggers any alerts
              const alertTriggered = shouldTriggerAlert({
                ...ingredient,
                quantity: newQuantity,
                status: newStatus
              });
              
              res.status(201).json({ 
                id: result.insertId,
                message: 'Wastage logged successfully',
                timestamp,
                location,
                item,
                quantity,
                reason,
                value_lost,
                logged_by,
                notes,
                inventoryUpdate: {
                  previousQuantity: ingredient.quantity,
                  newQuantity: newQuantity,
                  statusChanged: ingredient.status !== newStatus,
                  newStatus: newStatus,
                  alertTriggered: alertTriggered
                }
              });
            }
          );
        }
      );
    }
  );
});

// GET wastage statistics
app.get('/wastage/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const statsQuery = `
    SELECT 
      COUNT(*) as totalItems,
      SUM(value_lost) as totalValue,
      SUM(quantity) as totalQuantity,
      SUM(CASE WHEN location = 'factory' THEN 1 ELSE 0 END) as factoryItems,
      SUM(CASE WHEN location != 'factory' THEN 1 ELSE 0 END) as outletItems,
      SUM(CASE WHEN location = 'factory' THEN value_lost ELSE 0 END) as factoryValue,
      SUM(CASE WHEN location != 'factory' THEN value_lost ELSE 0 END) as outletValue,
      SUM(CASE WHEN location = 'factory' THEN quantity ELSE 0 END) as factoryQuantity,
      SUM(CASE WHEN location != 'factory' THEN quantity ELSE 0 END) as outletQuantity,
      -- Recent trends (last 7 days for comparison)
      (SELECT COUNT(*) FROM wastage WHERE DATE(timestamp) >= DATE_SUB(?, INTERVAL 7 DAY)) as weeklyTotal,
      (SELECT SUM(value_lost) FROM wastage WHERE DATE(timestamp) >= DATE_SUB(?, INTERVAL 7 DAY)) as weeklyValue
    FROM wastage 
    WHERE DATE(timestamp) = ?
  `;
  
  db.query(statsQuery, [today, today, today], (err, results) => {
    if (err) {
      console.error('Error fetching wastage statistics:', err);
      return res.status(500).json({ error: 'Failed to fetch wastage statistics' });
    }
    
    const stats = results[0] || {
      totalItems: 0,
      totalValue: 0,
      totalQuantity: 0,
      factoryItems: 0,
      outletItems: 0,
      factoryValue: 0,
      outletValue: 0,
      factoryQuantity: 0,
      outletQuantity: 0,
      weeklyTotal: 0,
      weeklyValue: 0
    };
    
    // Calculate percentages and trends
    const responseStats = {
      ...stats,
      // Convert null values to 0
      totalValue: parseFloat(stats.totalValue) || 0,
      factoryValue: parseFloat(stats.factoryValue) || 0,
      outletValue: parseFloat(stats.outletValue) || 0,
      weeklyValue: parseFloat(stats.weeklyValue) || 0,
      
      // Calculate averages
      avgDailyItems: stats.weeklyTotal ? Math.round(stats.weeklyTotal / 7) : 0,
      avgDailyValue: stats.weeklyValue ? (stats.weeklyValue / 7) : 0,
      
      // Calculate percentages
      factoryPercentage: stats.totalItems ? Math.round((stats.factoryItems / stats.totalItems) * 100) : 0,
      outletPercentage: stats.totalItems ? Math.round((stats.outletItems / stats.totalItems) * 100) : 0,
      
      // Trend indicators (comparing today vs weekly average)
      itemsTrend: stats.weeklyTotal ? (stats.totalItems > (stats.weeklyTotal / 7) ? 'up' : stats.totalItems < (stats.weeklyTotal / 7) ? 'down' : 'stable') : 'stable',
      valueTrend: stats.weeklyValue ? (stats.totalValue > (stats.weeklyValue / 7) ? 'up' : stats.totalValue < (stats.weeklyValue / 7) ? 'down' : 'stable') : 'stable'
    };
    
    res.json(responseStats);
  });
});

// GET wastage history with optional filtering
app.get('/wastage/history', (req, res) => {
  const { location, reason, startDate, endDate, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM wastage WHERE 1=1';
  const params = [];
  
  if (location) {
    if (location === 'factory') {
      query += ' AND location = ?';
      params.push('factory');
    } else if (location === 'outlet') {
      query += ' AND location != ?';
      params.push('factory');
    }
  }
  
  if (reason) {
    query += ' AND reason LIKE ?';
    params.push(`%${reason}%`);
  }
  
  if (startDate) {
    query += ' AND DATE(timestamp) >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND DATE(timestamp) <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching wastage history:', err);
      return res.status(500).json({ error: 'Failed to fetch wastage history' });
    }
    
    res.json(results);
  });
});

// GET wastage analytics (monthly/weekly trends)
app.get('/wastage/analytics', (req, res) => {
  const { period = 'month' } = req.query;
  
  let groupBy, dateFormat;
  if (period === 'week') {
    groupBy = 'YEARWEEK(timestamp)';
    dateFormat = 'CONCAT(YEAR(timestamp), "-W", WEEK(timestamp))';
  } else {
    groupBy = 'YEAR(timestamp), MONTH(timestamp)';
    dateFormat = 'CONCAT(YEAR(timestamp), "-", LPAD(MONTH(timestamp), 2, "0"))';
  }
  
  const analyticsQuery = `
    SELECT 
      ${dateFormat} as period,
      COUNT(*) as totalItems,
      SUM(value_lost) as totalValue,
      SUM(CASE WHEN location = 'factory' THEN 1 ELSE 0 END) as factoryItems,
      SUM(CASE WHEN location != 'factory' THEN 1 ELSE 0 END) as outletItems,
      reason,
      COUNT(reason) as reasonCount
    FROM wastage 
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 6 ${period === 'week' ? 'WEEK' : 'MONTH'})
    GROUP BY ${groupBy}, reason
    ORDER BY period DESC, reasonCount DESC
  `;
  
  db.query(analyticsQuery, (err, results) => {
    if (err) {
      console.error('Error fetching wastage analytics:', err);
      return res.status(500).json({ error: 'Failed to fetch wastage analytics' });
    }
    
    res.json(results);
  });
});

// DELETE wastage entry (for corrections)
app.delete('/wastage/:id', (req, res) => {
  const { id } = req.params;
  
  // First get the wastage details to restore inventory
  db.query('SELECT * FROM wastage WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error fetching wastage entry:', err);
      return res.status(500).json({ error: 'Failed to fetch wastage entry' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Wastage entry not found' });
    }
    
    const wastageEntry = results[0];
    
    // Find the ingredient by name and restore stock
    db.query(
      'UPDATE ingredients SET stock = stock + ? WHERE name = ?',
      [wastageEntry.quantity, wastageEntry.item],
      (err, updateResult) => {
        if (err) {
          console.error('Error restoring ingredient stock:', err);
          return res.status(500).json({ error: 'Failed to restore ingredient stock' });
        }
        
        // Delete the wastage entry
        db.query('DELETE FROM wastage WHERE id = ?', [id], (err, deleteResult) => {
          if (err) {
            console.error('Error deleting wastage entry:', err);
            // Rollback the stock restoration
            db.query('UPDATE ingredients SET stock = stock - ? WHERE name = ?', 
              [wastageEntry.quantity, wastageEntry.item]);
            return res.status(500).json({ error: 'Failed to delete wastage entry' });
          }
          
          res.json({ 
            message: 'Wastage entry deleted and inventory restored successfully',
            restoredQuantity: wastageEntry.quantity,
            item: wastageEntry.item
          });
        });
      }
    );
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
