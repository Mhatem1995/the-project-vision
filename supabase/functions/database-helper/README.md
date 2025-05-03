
# Database Helper Function

This edge function is meant to create SQL helper functions to work around TypeScript type issues when accessing new database tables that haven't been properly typed yet.

It creates the following database functions:

1. `save_wallet_connection`: Safely store a wallet connection in the wallets table
2. `insert_payment`: Insert a payment record without TypeScript issues
3. `get_wallet_connections`: Get all wallet connections for retrieving from client-side

Run this function once after deploying to create all necessary helper functions in the database.
