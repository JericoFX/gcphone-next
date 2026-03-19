---
title: Yellow Pages
---

# Yellow Pages

Marketplace / classified ads app where players can list items for sale, browse by category, search, share location, and contact sellers.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_market` | Listings -- identifier, phone_number, seller_name, seller_avatar, title, description, price, category, photos (JSON), views, status (active/sold/expired), location fields |
| `phone_yellowpages_contacts` | Contact history -- listing_id, buyer_identifier, seller_identifier, contact_type (call/message) |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:yellowpages:getListings` | Returns active listings with optional category/search filter and pagination |
| `gcphone:yellowpages:getMyListings` | Returns the caller's own listings |
| `gcphone:yellowpages:createListing` | Creates a new listing with photos |
| `gcphone:yellowpages:deleteListing` | Deletes own listing |
| `gcphone:yellowpages:getSellerInfo` | Returns seller contact info and increments views |
| `gcphone:yellowpages:recordContact` | Records a contact event (call or message) for analytics |
| `gcphone:yellowpages:shareLocation` | Attaches the player's current coordinates to a listing |
| `gcphone:yellowpages:getCategories` | Returns the hardcoded category list |

## Categories

| ID | Name |
|---|---|
| `all` | Todos |
| `autos` | Autos |
| `properties` | Propiedades |
| `electronics` | Electronica |
| `services` | Servicios |
| `jobs` | Trabajo |
| `items` | Articulos |
| `other` | Otros |

## Config Options

```lua
Config.Features.YellowPages = true

Config.Market = {
    MaxListings     = 10,
    ListingDuration = 604800,
    MaxPhotos       = 5,
    Categories      = { ... },
}

Config.Security.RateLimits.market = 2500
```

## Exports

None.
