
-- Drop all row-level security policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can create their own profile" ON users;
DROP POLICY IF EXISTS "Users can delete their own profile" ON users;

-- Drop existing primary key
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- Change id type from uuid to text
ALTER TABLE users ALTER COLUMN id TYPE text USING id::text;

-- Re-add primary key
ALTER TABLE users ADD PRIMARY KEY (id);
