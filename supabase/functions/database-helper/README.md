# Database Helper Function

This edge function is meant to create SQL helper functions to work around TypeScript type issues when accessing new database tables that haven't been properly typed yet.

It creates the following database functions:

1. `save_wallet_connection`: Safely store a wallet connection in the wallets table
2. `insert_payment`: Insert a payment record without TypeScript issues
3. `get_wallet_connections`: Get all wallet connections for retrieving from client-side

The function also serves as an API endpoint to interact with these functions without TypeScript errors in the client code.

## Usage

Call this function with action and params properties:

```javascript
await supabase.functions.invoke('database-helper', {
  body: {
    action: 'save_wallet_connection', // or 'insert_payment' or 'get_wallet_connections'
    params: {
      // Parameters required by the function
      telegram_id: 'user123',
      wallet_address: 'EQD...'
      // ... other params depending on the action
    }
  }
});
```

Run this function once after deploying to create all necessary helper functions in the database.
