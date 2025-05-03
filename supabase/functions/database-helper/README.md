
# Database Helper Edge Function

This edge function provides a centralized way to interact with the database, especially for operations that involve proper type handling between the telegram_id as a text string and other operations. It handles operations such as:

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

**Response on success:**
```json
{
  "success": true,
  "message": "Wallet connection saved successfully"
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

**Response on success:**
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "telegram_id": "user_telegram_id",
    "wallet_address": "wallet_address",
    "amount_paid": 0.1,
    "task_type": "task3",
    "transaction_hash": null,
    "created_at": "timestamp"
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

**Response on success:**
```json
{
  "success": true,
  "connections": [
    {
      "telegram_id": "user1",
      "wallet_address": "wallet1"
    },
    {
      "telegram_id": "user2",
      "wallet_address": "wallet2"
    }
  ]
}
```

## Usage

Call this function from your frontend code:

```typescript
try {
  // Example: Save wallet connection
  const { data, error } = await supabase.functions.invoke('database-helper', {
    body: {
      action: 'save_wallet_connection',
      params: {
        telegram_id: 'user123',
        wallet_address: '0xWallet'
      }
    }
  });
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Success:", data);
} catch (err) {
  console.error("Exception:", err);
}
```

## Error Handling

The function returns detailed error messages in a standardized format:

```json
{
  "success": false,
  "error": "Detailed error message"
}
```

## Important Notes

1. The `telegram_id` is stored as a text field, not a UUID, in all related tables.
2. All IDs in this function are treated as text, not UUID format.
3. The function handles duplicate wallet connections by checking if they already exist.
4. Extensive logging is included to help with debugging.
5. For security reasons, this function uses the service role key to access the database directly.
