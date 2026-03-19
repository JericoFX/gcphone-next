---
title: CityRide
---

# CityRide

Uber-style ride-hailing app. Players register as drivers, riders request pickups with destination, drivers accept and complete rides with fare calculated by distance.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_cityride_drivers` | Registered drivers -- identifier, phone_number, display_name, vehicle_model, vehicle_color, plate, is_available, rating_avg, rating_count |
| `phone_cityride_rides` | Ride history -- rider/driver identifiers, pickup/destination coords, status (requested/accepted/in_progress/completed/cancelled), fare, distance, timestamps |
| `phone_cityride_ratings` | Driver ratings -- ride_id, rater_identifier, score, comment |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:cityride:registerDriver` | Registers as a driver |
| `gcphone:cityride:getDriverProfile` | Returns the caller's driver profile |
| `gcphone:cityride:updateDriver` | Updates vehicle info |
| `gcphone:cityride:setDriverAvailability` | Toggle available/offline |
| `gcphone:cityride:requestRide` | Rider requests a ride (pickup + destination coords) |
| `gcphone:cityride:getAvailableRides` | Driver gets pending ride requests |
| `gcphone:cityride:acceptRide` | Driver accepts a ride request |
| `gcphone:cityride:confirmPickup` | Driver confirms rider pickup |
| `gcphone:cityride:completeRide` | Driver marks ride as completed, fare charged |
| `gcphone:cityride:cancelRide` | Either party cancels the ride |
| `gcphone:cityride:getActiveRide` | Gets current active ride for the caller |
| `gcphone:cityride:getRideHistory` | Ride history for the caller |
| `gcphone:cityride:rateDriver` | Rider rates a completed ride |
| `gcphone:cityride:estimatePrice` | Calculates estimated fare from distance |
| `gcphone:cityride:getAvailableDriverCount` | Returns number of online drivers |

## Config Options

```lua
Config.Features.CityRide = true

Config.CityRide = {
    PricePerUnit = 12,
    MinPrice = 50,
    MaxPrice = 50000,
    RequestTimeoutSeconds = 120,
}
```

## Notes

- Fare formula: `max(MinPrice, min(distance * PricePerUnit, MaxPrice))`
- Ride request expires after `RequestTimeoutSeconds` if no driver accepts
- Payment is handled via framework money (RemoveMoney/AddMoney through the bridge)
