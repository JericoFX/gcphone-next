---
title: Documents
---

# Documents

![Documents](/img/apps/documents.png)

Digital document wallet supporting ID cards, licenses, passports, permits, insurance, and registration certificates. Documents have verification codes, NFC sharing, and proximity-based sharing.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_documents` | Documents -- identifier, doc_type, title, holder_name, holder_number, expires_at, verification_code, nfc_enabled |
| `phone_documents_nfc_scans` | NFC scan log -- document_id, scanned_by, scan_type (nfc/manual/shared) |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:documents:getList` | Returns all documents for the player |
| `gcphone:documents:create` | Creates a new document with a generated verification code |
| `gcphone:documents:delete` | Deletes a document |
| `gcphone:documents:toggleNFC` | Enables/disables NFC sharing on a document |
| `gcphone:documents:scanNFC` | Stub -- returns NFC_USE_OX_TARGET (handled via ox_target) |
| `gcphone:documents:verify` | Stub -- returns VERIFY_DISABLED_USE_OX_TARGET |
| `gcphone:documents:getScanHistory` | Returns NFC scan history for the player's documents |
| `gcphone:documents:share` | Shares a document with a nearby player (proximity check, NFC must be enabled) |
| `gcphone:documents:getTypes` | Returns the list of available document types |

## Document Types

| ID | Name |
|---|---|
| `id` | DNI / ID |
| `license` | Licencia de Conducir |
| `passport` | Pasaporte |
| `permit` | Permiso Especial |
| `work_permit` | Permiso de Trabajo |
| `insurance` | Seguro |
| `registration` | Registro Civil |

## Config Options

```lua
Config.Features.Documents = true

Config.Documents = {
    AllowCustomTitle = true,
}

Config.Proximity.ShareDocumentDistance = 2.0
```

## Exports

None.
