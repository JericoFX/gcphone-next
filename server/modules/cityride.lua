local Utils = GcPhoneUtils
local function SafeString(v, m) return Utils.SafeString(v, m) end
local function SanitizeText(v, m) return Utils.SanitizeText(v, m, true) end
local function HitRateLimit(s, k, w, m) return Utils.HitRateLimit(s, k, w, m) end

local PRICE_PER_UNIT = 12
local MIN_PRICE = 50
local MAX_PRICE = 50000

local ActiveRides = {}
local NextRideId = 0

local VALID_TRANSITIONS = {
    requested = { accepted = true, cancelled = true },
    accepted = { pickup = true, cancelled = true },
    pickup = { in_progress = true, cancelled = true },
    in_progress = { completed = true, cancelled = true },
}

local function CanTransition(from, to)
    return VALID_TRANSITIONS[from] and VALID_TRANSITIONS[from][to] or false
end

local function GenerateRideId()
    NextRideId = NextRideId + 1
    return NextRideId
end

local function ValidateCoords(data)
    if type(data) ~= 'table' then return nil end
    local x = tonumber(data.x)
    local y = tonumber(data.y)
    local z = tonumber(data.z)
    if not x or not y then return nil end
    return { x = x, y = y, z = z or 0.0 }
end

local function CalcDistance(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end

local function CalcPrice(distance)
    local price = math.floor(distance * PRICE_PER_UNIT)
    if price < MIN_PRICE then price = MIN_PRICE end
    if price > MAX_PRICE then price = MAX_PRICE end
    return price
end

local function TransferRidePayment(passengerIdentifier, driverIdentifier, amount)
    local passengerWallet = MySQL.single.await(
        'SELECT id, balance FROM phone_wallets WHERE identifier = ? LIMIT 1',
        { passengerIdentifier }
    )
    if not passengerWallet or tonumber(passengerWallet.balance) < amount then
        return false, 'INSUFFICIENT_FUNDS'
    end

    local driverWallet = MySQL.single.await(
        'SELECT id, balance FROM phone_wallets WHERE identifier = ? LIMIT 1',
        { driverIdentifier }
    )
    if not driverWallet then
        local driverId = MySQL.insert.await(
            'INSERT INTO phone_wallets (identifier, balance) VALUES (?, 0)',
            { driverIdentifier }
        )
        driverWallet = { id = driverId, balance = 0 }
    end

    MySQL.transaction.await({
        {
            query = 'UPDATE phone_wallets SET balance = balance - ? WHERE id = ?',
            values = { amount, passengerWallet.id }
        },
        {
            query = 'UPDATE phone_wallets SET balance = balance + ? WHERE id = ?',
            values = { amount, driverWallet.id }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { passengerIdentifier, amount, 'out', 'CityRide', '' }
        },
        {
            query = 'INSERT INTO phone_wallet_transactions (identifier, amount, type, title, target_phone) VALUES (?, ?, ?, ?, ?)',
            values = { driverIdentifier, amount, 'in', 'CityRide', '' }
        },
    })

    return true
end

local function BuildRidePayload(ride)
    if not ride then return nil end
    return {
        id = ride.id,
        passengerPhone = ride.passengerPhone,
        driverPhone = ride.driverPhone,
        driverName = ride.driverName,
        driverVehicle = ride.driverVehicle,
        driverPlate = ride.driverPlate,
        driverRating = ride.driverRating,
        pickup = ride.pickup,
        dest = ride.dest,
        distance = ride.distance,
        price = ride.price,
        status = ride.status,
        createdAt = ride.createdAt,
        acceptedAt = ride.acceptedAt,
        completedAt = ride.completedAt,
    }
end

local function FindActiveRideForPlayer(identifier)
    for _, ride in pairs(ActiveRides) do
        if ride.status ~= 'completed' and ride.status ~= 'cancelled' then
            if ride.passengerIdentifier == identifier or ride.driverIdentifier == identifier then
                return ride
            end
        end
    end
    return nil
end

local function BroadcastToAvailableDrivers(rideData)
    local drivers = MySQL.query.await(
        'SELECT identifier FROM phone_cityride_drivers WHERE is_available = 1',
        {}
    ) or {}

    local payload = BuildRidePayload(rideData)
    for _, driver in ipairs(drivers) do
        if driver.identifier ~= rideData.passengerIdentifier then
            local driverSource = GetSourceFromIdentifier(driver.identifier)
            if driverSource then
                TriggerClientEvent('gcphone:cityride:newRequest', driverSource, payload)
            end
        end
    end
end

-- registerDriver
lib.callback.register('gcphone:cityride:registerDriver', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_register', 2000, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local phoneNumber = GetPhoneNumber(identifier)
    if not phoneNumber then return { success = false, error = 'NO_PHONE' } end
    local displayName = GetName(source) or 'Conductor'

    local vehicleName = SanitizeText(data.vehicle_name, 50)
    local vehiclePlate = SanitizeText(data.vehicle_plate, 10)
    if vehicleName == '' then vehicleName = 'Sin vehiculo' end
    if vehiclePlate == '' then vehiclePlate = '---' end

    local existing = MySQL.single.await(
        'SELECT id FROM phone_cityride_drivers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if existing then return { success = false, error = 'ALREADY_REGISTERED' } end

    MySQL.insert.await(
        'INSERT INTO phone_cityride_drivers (identifier, phone_number, display_name, vehicle_name, vehicle_plate, is_available) VALUES (?, ?, ?, ?, ?, 0)',
        { identifier, phoneNumber, displayName, vehicleName, vehiclePlate }
    )

    return { success = true }
end)

-- getDriverProfile
lib.callback.register('gcphone:cityride:getDriverProfile', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    local driver = MySQL.single.await(
        'SELECT * FROM phone_cityride_drivers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not driver then return nil end

    return {
        id = driver.id,
        display_name = driver.display_name,
        vehicle_name = driver.vehicle_name,
        vehicle_plate = driver.vehicle_plate,
        is_available = driver.is_available == 1,
        rating = tonumber(driver.rating) or 0,
        rating_count = driver.rating_count,
        total_rides = driver.total_rides,
    }
end)

-- updateDriver
lib.callback.register('gcphone:cityride:updateDriver', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_update', 1500, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local vehicleName = SanitizeText(data.vehicle_name, 50)
    local vehiclePlate = SanitizeText(data.vehicle_plate, 10)
    if vehicleName == '' then return { success = false, error = 'INVALID_VEHICLE' } end
    if vehiclePlate == '' then return { success = false, error = 'INVALID_PLATE' } end

    MySQL.update.await(
        'UPDATE phone_cityride_drivers SET vehicle_name = ?, vehicle_plate = ? WHERE identifier = ?',
        { vehicleName, vehiclePlate, identifier }
    )

    return { success = true }
end)

-- setDriverAvailability
lib.callback.register('gcphone:cityride:setDriverAvailability', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_availability', 1000, 2) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local available = data.available == true and 1 or 0

    MySQL.update.await(
        'UPDATE phone_cityride_drivers SET is_available = ? WHERE identifier = ?',
        { available, identifier }
    )

    return { success = true, is_available = available == 1 }
end)

-- requestRide
lib.callback.register('gcphone:cityride:requestRide', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_request', 3000, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local existing = FindActiveRideForPlayer(identifier)
    if existing then return { success = false, error = 'ALREADY_IN_RIDE' } end

    local pickup = ValidateCoords(data.pickup)
    local dest = ValidateCoords(data.dest)
    if not pickup or not dest then return { success = false, error = 'INVALID_COORDS' } end

    local phoneNumber = GetPhoneNumber(identifier) or ''
    local distance = CalcDistance(pickup, dest)
    local price = CalcPrice(distance)

    local rideId = GenerateRideId()
    local ride = {
        id = rideId,
        passengerSource = source,
        passengerIdentifier = identifier,
        passengerPhone = phoneNumber,
        passengerName = GetName(source) or 'Pasajero',
        driverSource = nil,
        driverIdentifier = nil,
        driverPhone = nil,
        driverName = nil,
        driverVehicle = nil,
        driverPlate = nil,
        driverRating = 0,
        pickup = pickup,
        dest = dest,
        distance = math.floor(distance * 100) / 100,
        price = price,
        status = 'requested',
        createdAt = os.time(),
        acceptedAt = nil,
        completedAt = nil,
    }

    ActiveRides[rideId] = ride
    BroadcastToAvailableDrivers(ride)

    return { success = true, ride = BuildRidePayload(ride) }
end)

-- getAvailableRides
lib.callback.register('gcphone:cityride:getAvailableRides', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local rides = {}
    for _, ride in pairs(ActiveRides) do
        if ride.status == 'requested' then
            rides[#rides + 1] = BuildRidePayload(ride)
        end
    end

    return rides
end)

-- acceptRide
lib.callback.register('gcphone:cityride:acceptRide', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_accept', 1500, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local rideId = tonumber(data.rideId)
    if not rideId then return { success = false, error = 'INVALID_RIDE' } end

    local ride = ActiveRides[rideId]
    if not ride then return { success = false, error = 'RIDE_NOT_FOUND' } end
    if ride.status ~= 'requested' then return { success = false, error = 'RIDE_UNAVAILABLE' } end
    if ride.passengerIdentifier == identifier then return { success = false, error = 'CANNOT_ACCEPT_OWN' } end

    local existing = FindActiveRideForPlayer(identifier)
    if existing then return { success = false, error = 'ALREADY_IN_RIDE' } end

    local driver = MySQL.single.await(
        'SELECT * FROM phone_cityride_drivers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
    if not driver then return { success = false, error = 'NOT_A_DRIVER' } end

    ride.status = 'accepted'
    ride.driverSource = source
    ride.driverIdentifier = identifier
    ride.driverPhone = driver.phone_number
    ride.driverName = driver.display_name
    ride.driverVehicle = driver.vehicle_name
    ride.driverPlate = driver.vehicle_plate
    ride.driverRating = tonumber(driver.rating) or 0
    ride.acceptedAt = os.time()

    local payload = BuildRidePayload(ride)

    if ride.passengerSource then
        TriggerClientEvent('gcphone:cityride:rideAccepted', ride.passengerSource, payload)
    end

    return { success = true, ride = payload }
end)

-- confirmPickup
lib.callback.register('gcphone:cityride:confirmPickup', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_pickup', 1500, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local rideId = tonumber(data.rideId)
    if not rideId then return { success = false, error = 'INVALID_RIDE' } end

    local ride = ActiveRides[rideId]
    if not ride then return { success = false, error = 'RIDE_NOT_FOUND' } end
    if ride.driverIdentifier ~= identifier then return { success = false, error = 'NOT_AUTHORIZED' } end

    local targetStatus = data.status == 'in_progress' and 'in_progress' or 'pickup'
    if not CanTransition(ride.status, targetStatus) then
        return { success = false, error = 'INVALID_TRANSITION' }
    end

    ride.status = targetStatus
    local payload = BuildRidePayload(ride)

    if ride.passengerSource then
        TriggerClientEvent('gcphone:cityride:rideUpdate', ride.passengerSource, payload)
    end

    return { success = true, ride = payload }
end)

-- completeRide
lib.callback.register('gcphone:cityride:completeRide', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_complete', 2000, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local rideId = tonumber(data.rideId)
    if not rideId then return { success = false, error = 'INVALID_RIDE' } end

    local ride = ActiveRides[rideId]
    if not ride then return { success = false, error = 'RIDE_NOT_FOUND' } end
    if ride.driverIdentifier ~= identifier then return { success = false, error = 'NOT_AUTHORIZED' } end
    if not CanTransition(ride.status, 'completed') then return { success = false, error = 'INVALID_TRANSITION' } end

    local payOk, payErr = TransferRidePayment(ride.passengerIdentifier, ride.driverIdentifier, ride.price)
    if not payOk then
        return { success = false, error = payErr or 'PAYMENT_FAILED' }
    end

    ride.status = 'completed'
    ride.completedAt = os.time()

    MySQL.insert.await(
        'INSERT INTO phone_cityride_rides (passenger_identifier, passenger_phone, driver_identifier, driver_phone, pickup_x, pickup_y, pickup_z, dest_x, dest_y, dest_z, distance, price, status, accepted_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), NOW())',
        {
            ride.passengerIdentifier, ride.passengerPhone,
            ride.driverIdentifier, ride.driverPhone,
            ride.pickup.x, ride.pickup.y, ride.pickup.z,
            ride.dest.x, ride.dest.y, ride.dest.z,
            ride.distance, ride.price, 'completed',
            ride.acceptedAt or os.time()
        }
    )

    MySQL.update.await(
        'UPDATE phone_cityride_drivers SET total_rides = total_rides + 1 WHERE identifier = ?',
        { ride.driverIdentifier }
    )

    local payload = BuildRidePayload(ride)

    if ride.passengerSource then
        TriggerClientEvent('gcphone:cityride:rideCompleted', ride.passengerSource, payload)
    end
    if ride.driverSource then
        TriggerClientEvent('gcphone:cityride:rideCompleted', ride.driverSource, payload)
    end

    ActiveRides[rideId] = nil

    return { success = true, ride = payload }
end)

-- cancelRide
lib.callback.register('gcphone:cityride:cancelRide', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_cancel', 1500, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local rideId = tonumber(data.rideId)
    if not rideId then return { success = false, error = 'INVALID_RIDE' } end

    local ride = ActiveRides[rideId]
    if not ride then return { success = false, error = 'RIDE_NOT_FOUND' } end
    if ride.passengerIdentifier ~= identifier and ride.driverIdentifier ~= identifier then
        return { success = false, error = 'NOT_AUTHORIZED' }
    end
    if not CanTransition(ride.status, 'cancelled') then
        return { success = false, error = 'CANNOT_CANCEL' }
    end

    ride.status = 'cancelled'

    local otherSource
    if ride.passengerIdentifier == identifier then
        otherSource = ride.driverSource
    else
        otherSource = ride.passengerSource
    end

    if otherSource then
        TriggerClientEvent('gcphone:cityride:rideCancelled', otherSource, rideId)
    end

    ActiveRides[rideId] = nil

    return { success = true }
end)

-- getActiveRide
lib.callback.register('gcphone:cityride:getActiveRide', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return nil end

    local ride = FindActiveRideForPlayer(identifier)
    if not ride then return nil end

    local role = ride.passengerIdentifier == identifier and 'passenger' or 'driver'
    local payload = BuildRidePayload(ride)
    payload.role = role

    return payload
end)

-- getRideHistory
lib.callback.register('gcphone:cityride:getRideHistory', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    local rows = MySQL.query.await(
        'SELECT * FROM phone_cityride_rides WHERE (passenger_identifier = ? OR driver_identifier = ?) AND status = "completed" ORDER BY completed_at DESC LIMIT 30',
        { identifier, identifier }
    ) or {}

    local result = {}
    for _, row in ipairs(rows) do
        result[#result + 1] = {
            id = row.id,
            passenger_phone = row.passenger_phone,
            driver_phone = row.driver_phone,
            distance = row.distance,
            price = row.price,
            status = row.status,
            created_at = row.created_at,
            completed_at = row.completed_at,
            role = row.passenger_identifier == identifier and 'passenger' or 'driver',
        }
    end

    return result
end)

-- rateDriver
lib.callback.register('gcphone:cityride:rateDriver', function(source, data)
    if IsPhoneReadOnly(source) then return { success = false, error = 'READ_ONLY' } end
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if HitRateLimit(source, 'cityride_rate', 2000, 1) then return { success = false, error = 'RATE_LIMITED' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local rideId = tonumber(data.rideId)
    local score = tonumber(data.score)
    if not rideId or not score then return { success = false, error = 'INVALID_DATA' } end
    if score < 1 then score = 1 end
    if score > 5 then score = 5 end
    score = math.floor(score)

    local ride = MySQL.single.await(
        'SELECT * FROM phone_cityride_rides WHERE id = ? AND passenger_identifier = ? AND status = "completed" LIMIT 1',
        { rideId, identifier }
    )
    if not ride then return { success = false, error = 'RIDE_NOT_FOUND' } end

    local existingRating = MySQL.single.await(
        'SELECT id FROM phone_cityride_ratings WHERE ride_id = ? AND rater_identifier = ? LIMIT 1',
        { rideId, identifier }
    )
    if existingRating then return { success = false, error = 'ALREADY_RATED' } end

    local comment = SanitizeText(data.comment or '', 200)

    MySQL.insert.await(
        'INSERT INTO phone_cityride_ratings (ride_id, rater_identifier, driver_identifier, score, comment) VALUES (?, ?, ?, ?, ?)',
        { rideId, identifier, ride.driver_identifier, score, comment }
    )

    return { success = true }
end)

-- estimatePrice
lib.callback.register('gcphone:cityride:estimatePrice', function(source, data)
    if type(data) ~= 'table' then return { price = 0, distance = 0 } end

    local pickup = ValidateCoords(data.pickup)
    local dest = ValidateCoords(data.dest)
    if not pickup or not dest then return { price = 0, distance = 0 } end

    local distance = CalcDistance(pickup, dest)
    local price = CalcPrice(distance)

    return {
        price = price,
        distance = math.floor(distance * 100) / 100,
    }
end)

-- getAvailableDriverCount
lib.callback.register('gcphone:cityride:getAvailableDriverCount', function(source)
    local result = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_cityride_drivers WHERE is_available = 1',
        {}
    )
    return { count = tonumber(result) or 0 }
end)

-- Cleanup on player disconnect
AddEventHandler('playerDropped', function()
    local src = source
    for rideId, ride in pairs(ActiveRides) do
        if ride.passengerSource == src or ride.driverSource == src then
            ride.status = 'cancelled'
            local otherSrc = ride.passengerSource == src and ride.driverSource or ride.passengerSource
            if otherSrc then
                TriggerClientEvent('gcphone:cityride:rideCancelled', otherSrc, rideId)
            end
            ActiveRides[rideId] = nil
        end
    end
end)
