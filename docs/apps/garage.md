---
title: Garage
---

# Garage

Vehicle management app with location tracking, impound GPS, spawn point resolution, and external resource integration via exports. Supports dynamic spawn/impound points from config, batch registration, and provider callbacks.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_garage` | Vehicle records -- identifier, plate, model, model_name, garage_name, impounded, properties (JSON) |
| `phone_garage_locations` | Current vehicle locations -- identifier, plate, location_x/y/z, location_updated |
| `phone_garage_location_history` | Location history trail -- identifier, plate, location_x/y/z, created_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:garage:getVehicles` | Returns all vehicles with their current location data |
| `gcphone:garage:getVehicle` | Returns a single vehicle with full location details |
| `gcphone:garage:updateLocation` | Updates/inserts the current location of a vehicle and adds history |
| `gcphone:garage:getLocationHistory` | Returns the last 20 location history entries for a vehicle |
| `gcphone:garage:requestVehicle` | Requests to spawn a vehicle at the nearest spawn point |
| `gcphone:garage:getImpoundLocation` | Returns the nearest impound location for GPS |
| `gcphone:garage:shareLocation` | Shares a vehicle's location with a contact via phone number |
| `gcphone:garage:storeVehicle` | Returns a vehicle to the garage (updates garage_name, clears impound) |
| `gcphone:garage:getStats` | Returns location request stats for a vehicle |

## Config Options

```lua
Config.Garage = {
    MaxVehicles = 20,
    Impounds    = { { label = '...', x = 0, y = 0, z = 0 }, ... },
    SpawnPoints = { { label = '...', x = 0, y = 0, z = 0, h = 0 }, ... },
}
```

## Exports

### Registration (single)

| Export | Purpose |
|---|---|
| `RegisterGarageSpawnPoint(id, point)` | Register a single spawn point |
| `RegisterImpoundLocation(id, point)` | Register a single impound location |

### Registration (batch)

| Export | Purpose |
|---|---|
| `RegisterGarageSpawnPoints(list, prefix?)` | Register multiple spawn points at once |
| `RegisterImpoundLocations(list, prefix?)` | Register multiple impound locations at once |

### Remove / Clear

| Export | Purpose |
|---|---|
| `RemoveGarageSpawnPoint(id)` | Remove a spawn point by ID |
| `RemoveImpoundLocation(id)` | Remove an impound location by ID |
| `ClearGarageSpawnPoints(prefix?)` | Clear spawn points (optionally by prefix) |
| `ClearImpoundLocations(prefix?)` | Clear impound locations (optionally by prefix) |

### Provider Callbacks

| Export | Purpose |
|---|---|
| `SetSpawnPointProvider(fn)` | Set a dynamic callback `fn(source) -> GaragePoint[]` for spawn points |
| `SetImpoundProvider(fn)` | Set a dynamic callback `fn(source) -> GaragePoint[]` for impound locations |

### Query

| Export | Purpose |
|---|---|
| `GetGarageSpawnPoints()` | Returns the static spawn point registry |
| `GetImpoundLocations()` | Returns the static impound location registry |
| `GetNearestSpawnPoint(source)` | Returns the nearest spawn point to the player (static + provider) |
| `GetNearestImpound(source)` | Returns the nearest impound location to the player (static + provider) |

### Sync

| Export | Purpose |
|---|---|
| `SyncVehicle(identifier, plate, model, modelName?, garageName?, impounded?, properties?, coords?)` | Insert or update a vehicle entry from an external garage resource |
