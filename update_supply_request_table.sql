-- Updated supply_request table with additional fields
-- Run this in phpMyAdmin to add the missing columns

-- Add additional columns to the existing supply_request table
ALTER TABLE `supply_request` 
ADD COLUMN `category` VARCHAR(255) NULL AFTER `item name`,
ADD COLUMN `unit` VARCHAR(50) NULL AFTER `quantity`,
ADD COLUMN `needed_by` DATE NULL AFTER `date`,
ADD COLUMN `justification` TEXT NULL AFTER `needed_by`,
ADD COLUMN `preferred_supplier` VARCHAR(255) NULL AFTER `justification`,
ADD COLUMN `approved_by` VARCHAR(255) NULL AFTER `preferred_supplier`,
ADD COLUMN `approved_date` DATE NULL AFTER `approved_by`,
ADD COLUMN `rejected_by` VARCHAR(255) NULL AFTER `approved_date`,
ADD COLUMN `rejected_date` DATE NULL AFTER `rejected_by`,
ADD COLUMN `rejection_reason` TEXT NULL AFTER `rejected_date`;

-- If you want to create a completely new table with all fields, use this instead:
/*
DROP TABLE IF EXISTS `supply_request`;

CREATE TABLE `supply_request` (
  `request id` int(11) NOT NULL AUTO_INCREMENT,
  `item name` varchar(255) NOT NULL,
  `category` varchar(255) NULL,
  `quantity` int(255) NOT NULL,
  `unit` varchar(50) NULL,
  `priority` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `requested by` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `needed_by` date NULL,
  `justification` text NULL,
  `preferred_supplier` varchar(255) NULL,
  `approved_by` varchar(255) NULL,
  `approved_date` date NULL,
  `rejected_by` varchar(255) NULL,
  `rejected_date` date NULL,
  PRIMARY KEY (`request id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
*/
