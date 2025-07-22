const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
  const { name, category, quantity, stock, expirydate, location } = req.body;
  
  // Validate required fields
  if (!name || !category || !quantity || !stock || !expirydate || !location) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Calculate status automatically
  const status = calculateStatus(quantity, stock, expirydate);
  
  db.query(
    'UPDATE ingredients SET name = ?, category = ?, quantity = ?, stock = ?, expirydate = ?, status = ?, location = ? WHERE id = ?',
    [name, category, quantity, stock, expirydate, status, location, id],
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
