---
title: Wallet
---

# Wallet

Digital wallet with in-app balance, card management, transfers, proximity payments (QR/NFC), payment requests, and invoice system (NFC and remote). Integrates with the framework's money system for invoice payments.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_wallets` | Wallet balances -- identifier, balance (DECIMAL 12,2) |
| `phone_wallet_cards` | Saved cards -- identifier, label, last4, color |
| `phone_wallet_transactions` | Transaction history -- identifier, amount, type (in/out/adjust), title, target_phone |
| `phone_wallet_requests` | Payment requests -- requester/target identifiers and phones, amount, title, method (qr/nfc), status, expires_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:wallet:getState` | Returns balance, cards, and recent transactions |
| `gcphone:wallet:addCard` | Adds a card to the wallet |
| `gcphone:wallet:removeCard` | Removes a card |
| `gcphone:wallet:transfer` | Transfers wallet balance to a phone number |
| `gcphone:wallet:proximityTransfer` | Transfers to a nearby player (proximity check) |
| `gcphone:wallet:createRequest` | Creates a payment request to a nearby player |
| `gcphone:wallet:getPendingRequests` | Returns incoming and outgoing pending requests |
| `gcphone:wallet:respondRequest` | Accept or decline a payment request (proximity re-check) |
| `gcphone:wallet:createInvoice` | Creates an invoice (NFC proximity or remote) |
| `gcphone:wallet:respondInvoice` | Pays or rejects an invoice (supports bank/cash for NFC) |
| `gcphone:wallet:createNfcInvoice` | Creates an NFC-only invoice (requires targetServerId) |
| `gcphone:wallet:respondNfcInvoice` | Responds to an NFC invoice |

## Config Options

```lua
Config.Features.Wallet = true

Config.Wallet = {
    InitialBalance    = 2500,
    MaxTransferAmount = 500000,
    ProximityDistance  = 3.0,
}

Config.Security.RateLimits.wallet        = 900
Config.Security.RateLimits.walletRequest = 1300
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `CanUseProximityPayment` | `(source, targetSource, maxDistance?) -> bool, string?, number?` | Check if two players are within proximity range |
| `ProximityTransfer` | `(source, targetSource, amount, title?, method?) -> GCWalletTransferResponse` | Execute a proximity wallet transfer between two players |
