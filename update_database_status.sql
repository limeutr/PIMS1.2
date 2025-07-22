-- SQL script to update your database structure
-- This removes the NOT NULL constraint from the status column since it will be calculated automatically

-- Option 1: If you want to keep the status column for reference but make it auto-calculated
-- You don't need to modify the table structure, the application will handle it

-- Option 2: If you want to remove the status column entirely (not recommended as it's useful for filtering)
-- ALTER TABLE ingredients DROP COLUMN status;

-- Option 3: Update existing records to have the correct calculated status
-- This query will update all existing records with the correct status based on current conditions

-- Note: This is a MySQL script. Run this in your MySQL database if needed.

-- First, let's see what we have:
-- SELECT id, name, quantity, stock, expirydate, 
--        CASE 
--            WHEN expirydate < CURDATE() THEN 'expired'
--            WHEN DATEDIFF(expirydate, CURDATE()) <= 14 THEN 'expiring'
--            WHEN quantity <= stock THEN 'low'
--            ELSE 'good'
--        END as calculated_status,
--        status as current_status
-- FROM ingredients;

-- Update all records with calculated status:
UPDATE ingredients 
SET status = CASE 
    WHEN expirydate < CURDATE() THEN 'expired'
    WHEN DATEDIFF(expirydate, CURDATE()) <= 14 THEN 'expiring'
    WHEN quantity <= stock THEN 'low'
    ELSE 'good'
END;

-- Verify the update:
-- SELECT * FROM ingredients;
