
-- Clear all wallet connections from the wallets table
DELETE FROM public.wallets;

-- Clear all payments records (optional, if you want a complete refresh)
DELETE FROM public.payments;

-- Clear wallet address from users table (the links field)
UPDATE public.users SET links = NULL;

-- Clear any mining boosts that might reference old wallet data
DELETE FROM public.mining_boosts;

-- Clear any completed tasks that might reference old wallet data
DELETE FROM public.tasks_completed;

-- Clear daily tasks to reset any wallet-related tasks
DELETE FROM public.daily_tasks;

-- Clear wheel spins history
DELETE FROM public.wheel_spins;
