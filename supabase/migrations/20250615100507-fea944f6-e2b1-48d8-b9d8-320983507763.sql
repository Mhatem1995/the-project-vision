
-- Step 1: Clean up duplicate wallet entries for each user, keeping only the most recent one.
-- This is necessary before adding a unique constraint on the user's ID.
DELETE FROM public.wallets
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER(PARTITION BY telegram_id ORDER BY created_at DESC) as rn
    FROM public.wallets
  ) t
  WHERE t.rn > 1
);

-- Step 2: Add a unique constraint to the telegram_id column.
-- This enforces that each user can only have one wallet address stored at a time.
ALTER TABLE public.wallets
ADD CONSTRAINT wallets_telegram_id_key UNIQUE (telegram_id);

-- Step 3: Update the function that saves wallet connections to perform an "upsert".
-- If a user connects a wallet, it will be inserted. If they connect a different one later,
-- it will update their existing entry with the new wallet address.
CREATE OR REPLACE FUNCTION public.save_wallet_connection(p_telegram_id text, p_wallet_address text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.wallets (telegram_id, wallet_address)
  VALUES (p_telegram_id, p_wallet_address)
  ON CONFLICT (telegram_id) 
  DO UPDATE SET 
    wallet_address = EXCLUDED.wallet_address,
    -- also update the timestamp to reflect the latest connection
    created_at = now();
END;
$function$
