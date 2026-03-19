---
title: Bank
---

# Bank

Transfer money between players using their phone numbers. Records transaction history and integrates with the framework's bank account system (`GetMoney` / `RemoveMoney` / `AddMoney`).

## Database Tables

| Table | Purpose |
|---|---|
| `phone_wallet_transactions` | Stores all bank transfer records (amount, type in/out, title, target phone) |
| `phone_contacts` | Read-only -- used to resolve contacts for transfer |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:getBankBalance` | Returns the player's framework bank balance |
| `gcphone:getBankTransactions` | Returns the last 50 wallet transactions for the player |
| `gcphone:transferMoney` | Transfers money from the caller to a target phone number (validates amount, balance, fee) |
| `gcphone:getContactsForTransfer` | Returns the player's contacts that have valid identifiers (usable as transfer targets) |

## Config Options

```lua
Config.Bank = {
    TransferFee    = 0,         -- percentage fee applied on transfers (0 = none)
    MaxTransferAmount = 1000000 -- max single transfer
}
```

## Exports

None.

## Client Events

| Event | Direction | Purpose |
|---|---|---|
| `gcphone:bankTransferReceived` | Server -> Client | Notifies the receiver that they received a transfer |
