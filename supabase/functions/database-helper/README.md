
# Database Helper Edge Function

This edge function provides a centralized way to interact with the database without running into TypeScript typing issues. It handles operations like:

- Saving wallet connections
- Recording payments
- Retrieving wallet connections

## Available Actions

### save_wallet_connection

Save a user's wallet address to both the `wallets` table and update the legacy `users.links` field.

```json
{
  "action": "save_wallet_connection",
  "params": {
    "telegram_id": "user_telegram_id",
    "wallet_address": "user_wallet_address"
  }
}
```

### insert_payment

Record a payment in the database.

```json
{
  "action": "insert_payment",
  "params": {
    "telegram_id": "user_telegram_id",
    "wallet_address": "wallet_address",
    "amount_paid": 0.1,
    "task_type": "task3",
    "transaction_hash": "optional_tx_hash"
  }
}
```

### get_wallet_connections

Retrieve all wallet connections from the database.

```json
{
  "action": "get_wallet_connections"
}
```

## Usage

Call this function from your frontend code:

```typescript
const { data, error } = await supabase.functions.invoke('database-helper', {
  body: {
    action: 'save_wallet_connection',
    params: {
      telegram_id: 'user123',
      wallet_address: '0xWallet'
    }
  }
});
```
