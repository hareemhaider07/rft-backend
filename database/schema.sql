-- RFT Entertainment Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  residence VARCHAR(255),
  occupation VARCHAR(255),
  whatsapp VARCHAR(20),
  age INTEGER,
  gender VARCHAR(10),
  provider VARCHAR(50) DEFAULT 'email',
  provider_id VARCHAR(255),
  kyc_status VARCHAR(20) DEFAULT 'not_started',
  kyc_data JSONB,
  balance_usdt DECIMAL(10, 2) DEFAULT 0.00,
  points INTEGER DEFAULT 0,
  referral_code VARCHAR(20) UNIQUE,
  referred_by VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referral_code') THEN
        ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referred_by') THEN
        ALTER TABLE users ADD COLUMN referred_by VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_status') THEN
        ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'not_started';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kyc_data') THEN
        ALTER TABLE users ADD COLUMN kyc_data JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'balance_usdt') THEN
        ALTER TABLE users ADD COLUMN balance_usdt DECIMAL(10, 2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'points') THEN
        ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  video_url VARCHAR(500),
  task_type VARCHAR(50) NOT NULL,
  reward_usdt DECIMAL(10, 4) NOT NULL,
  duration_seconds INTEGER,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to tasks table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
        ALTER TABLE tasks ADD COLUMN task_type VARCHAR(50) NOT NULL DEFAULT 'youtube';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'reward_usdt') THEN
        ALTER TABLE tasks ADD COLUMN reward_usdt DECIMAL(10, 4) NOT NULL DEFAULT 0.10;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'duration_seconds') THEN
        ALTER TABLE tasks ADD COLUMN duration_seconds INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_active') THEN
        ALTER TABLE tasks ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'order_index') THEN
        ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(order_index);

-- User tasks (task completions)
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMP,
  reward_usdt DECIMAL(10, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id)
);

-- Add missing columns to user_tasks table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'status') THEN
        ALTER TABLE user_tasks ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'completed_at') THEN
        ALTER TABLE user_tasks ADD COLUMN completed_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tasks' AND column_name = 'reward_usdt') THEN
        ALTER TABLE user_tasks ADD COLUMN reward_usdt DECIMAL(10, 4);
    END IF;
END $$;

-- Create indexes for user_tasks
CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_date ON user_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount_usdt DECIMAL(10, 2) NOT NULL,
  amount_pkr DECIMAL(12, 2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  screenshot_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to transactions table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'amount_pkr') THEN
        ALTER TABLE transactions ADD COLUMN amount_pkr DECIMAL(12, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_method') THEN
        ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_reference') THEN
        ALTER TABLE transactions ADD COLUMN payment_reference VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'screenshot_url') THEN
        ALTER TABLE transactions ADD COLUMN screenshot_url VARCHAR(500);
    END IF;
END $$;

-- Create indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);

-- KYC documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  issuing_country VARCHAR(3) NOT NULL,
  document_number VARCHAR(100) NOT NULL,
  front_image_url VARCHAR(500),
  back_image_url VARCHAR(500),
  selfie_image_url VARCHAR(500),
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to kyc_documents table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_documents' AND column_name = 'verification_status') THEN
        ALTER TABLE kyc_documents ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_documents' AND column_name = 'rejection_reason') THEN
        ALTER TABLE kyc_documents ADD COLUMN rejection_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_documents' AND column_name = 'verified_at') THEN
        ALTER TABLE kyc_documents ADD COLUMN verified_at TIMESTAMP;
    END IF;
END $$;

-- Create indexes for kyc_documents
CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_documents(verification_status);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);

-- Add missing columns to refresh_tokens table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at') THEN
        ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMP;
    END IF;
END $$;

-- Create indexes for refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample tasks (only if columns exist)
DO $$
BEGIN
    -- Check if all required columns exist before inserting
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        AND column_name IN ('title', 'description', 'thumbnail_url', 'video_url', 'task_type', 'reward_usdt', 'duration_seconds', 'order_index')
        GROUP BY table_name
        HAVING COUNT(*) = 8
    ) THEN
        INSERT INTO tasks (title, description, thumbnail_url, video_url, task_type, reward_usdt, duration_seconds, order_index) VALUES
        ('Watch YouTube Video', 'Watch the complete video to earn rewards', 'https://via.placeholder.com/300x180/1a1a1a/d4a843?text=YouTube', 'https://www.youtube.com/watch?v=example', 'youtube', 0.10, 150, 1),
        ('Follow TikTok Account', 'Follow the account to earn rewards', 'https://via.placeholder.com/300x180/1a1a1a/ff0050?text=TikTok', 'https://tiktok.com/@example', 'tiktok', 0.10, 30, 2),
        ('Like Instagram Post', 'Like the post to earn rewards', 'https://via.placeholder.com/300x180/1a1a1a/E1306C?text=Instagram', 'https://instagram.com/p/example', 'instagram', 0.10, 15, 3),
        ('Share Facebook Post', 'Share the post to earn rewards', 'https://via.placeholder.com/300x180/1a1a1a/1877F2?text=Facebook', 'https://facebook.com/post/example', 'facebook', 0.10, 45, 4)
        ON CONFLICT DO NOTHING;
    ELSE
        RAISE NOTICE 'Skipping sample tasks insertion - required columns not all present';
    END IF;
END $$;
