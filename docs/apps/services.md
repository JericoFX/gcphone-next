---
title: Services
---

# Services

![Services](/img/apps/services.png)

Professional services directory where players register as service providers (mechanic, lawyer, doctor, taxi, etc.), set availability, and get rated by clients.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_services` | Registered service providers -- identifier, phone_number, category, name, description, is_available, rating_avg, rating_count |
| `phone_services_ratings` | Client ratings -- service_id, rater_identifier, score, comment |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:services:getCategories` | Returns configured service categories |
| `gcphone:services:getListings` | Lists services filtered by category |
| `gcphone:services:getMyService` | Returns the caller's own service registration |
| `gcphone:services:register` | Registers a new service provider |
| `gcphone:services:updateService` | Updates service name/description/category |
| `gcphone:services:setAvailability` | Toggles available/unavailable |
| `gcphone:services:deleteService` | Deletes own service registration |
| `gcphone:services:getWorkerInfo` | Gets a provider's public profile |
| `gcphone:services:rateWorker` | Submits a rating for a provider |
| `gcphone:services:getWorkerRatings` | Gets all ratings for a provider |

## Config Options

```lua
Config.Features.Services = true

Config.Services = {
    Categories = {
        { id = 'mechanic', label = 'Mecanico', icon = '🔧' },
        { id = 'lawyer', label = 'Abogado', icon = '⚖️' },
        { id = 'doctor', label = 'Doctor', icon = '🏥' },
        { id = 'taxi', label = 'Taxi', icon = '🚕' },
        { id = 'delivery', label = 'Delivery', icon = '📦' },
        { id = 'security', label = 'Seguridad', icon = '🛡️' },
        { id = 'realtor', label = 'Inmobiliaria', icon = '🏠' },
        { id = 'other', label = 'Otro', icon = '📋' },
    },
    MaxDescriptionLength = 500,
}
```
