-- Complete database reset for TON wallet system
-- Run this in your Supabase SQL editor

-- 1. Clear all wallet connections
DELETE FROM public.wallets;

-- 2. Clear all payment records
DELETE FROM public.payments;

-- 3. Clear wallet addresses from users table
UPDATE public.users SET links = NULL WHERE links IS NOT NULL;

-- 4. Clear mining boosts
DELETE FROM public.mining_boosts;

-- 5. Clear completed tasks
DELETE FROM public.tasks_completed;

-- 6. Clear daily tasks
DELETE FROM public.daily_tasks;

-- 7. Reset wallet connection function to ensure proper upserts
CREATE OR REPLACE FUNCTION public.save_wallet_connection(p_telegram_id text, p_wallet_address text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log the operation
  RAISE NOTICE 'Saving wallet connection for user % with address %', p_telegram_id, p_wallet_address;
  
  INSERT INTO public.wallets (telegram_id, wallet_address)
  VALUES (p_telegram_id, p_wallet_address)
  ON CONFLICT (telegram_id) 
  DO UPDATE SET 
    wallet_address = EXCLUDED.wallet_address,
    created_at = now();
    
  -- Also update the users table for backward compatibility
  UPDATE public.users 
  SET links = p_wallet_address 
  WHERE id = p_telegram_id;
  
  RAISE NOTICE 'Wallet connection saved successfully';
END;
$function$;

-- 8. Verify the wallets table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'wallets' 
ORDER BY ordinal_position;

-- 9. Check if unique constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'wallets' AND constraint_type = 'UNIQUE';

-- 10. Ensure telegram_id is unique (should already exist from previous migration)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'wallets' 
        AND constraint_name = 'wallets_telegram_id_key'
    ) THEN
        ALTER TABLE public.wallets ADD CONSTRAINT wallets_telegram_id_key UNIQUE (telegram_id);
        RAISE NOTICE 'Added unique constraint on telegram_id';
    ELSE
        RAISE NOTICE 'Unique constraint on telegram_id already exists';
    END IF;
END $$;