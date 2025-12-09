-- Create customers table if not exists
CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_name (name)
);

-- Ensure transactions has customer_id and payment_method columns
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_id INT NULL,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'cash';

-- Optional: add FK if supported and table exists
ALTER TABLE transactions
   ADD CONSTRAINT fk_transactions_customer
   FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL;


