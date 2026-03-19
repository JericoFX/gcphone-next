---
title: Calls
---

# Calls

Voice call system supporting WebRTC and pma-voice call channels. Handles call initiation, acceptance, rejection, ending, ICE candidate relay, airplane mode, hidden numbers, emergency SOS, and call history persistence.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_calls` | Call history -- owner, num, incoming, accepts, duration, hidden, time |
| `phone_numbers` | Read -- resolves phone number, call_ringtone, audio_profile per player |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:getCallHistory` | Returns the last 100 call records for the player |
| `gcphone:deleteCallHistory` | Deletes call records between the player and a specific number |
| `gcphone:clearCallHistory` | Deletes all call records for the player |
| `gcphone:startCall` | Initiates a call to a target number (supports hidden prefix `#`, emergency, fixed phones) |
| `gcphone:acceptCall` | Accepts an incoming call, sets pma-voice call channel |
| `gcphone:emergencySOS` | Sends an SOS notification with GPS coords to all emergency contacts |

## Net Events (Server)

| Event | Purpose |
|---|---|
| `gcphone:setAirplaneMode` | Toggles airplane mode for the player (blocks calls) |
| `gcphone:rejectCall` | Rejects or cancels a call |
| `gcphone:endCall` | Ends an active call |
| `gcphone:sendIceCandidate` | Relays WebRTC ICE candidates between call participants |

## Config Options

```lua
Config.Calls = {
    UseWebRTC          = true,
    MaxCallDuration    = 3600,
    HiddenNumberPrefix = '#',
    RTCConfig          = { iceServers = { { urls = 'stun:stun.l.google.com:19302' } } },
}

Config.Phone.Setup.EmergencyContacts = {
    { label = 'Policia', number = '911' },
    { label = 'EMS',     number = '912' },
}

Config.FixePhone = { ['911'] = { name = '...', coords = vector3(...) } }
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `GetActiveCalls` | `() -> table<int, table>` | Returns the currently active calls map |
| `GetCallHistory` | `(identifier, requestSource) -> table[]` | Returns call history for a player (access-checked) |

## Hooks

The module fires the following phone hooks via `TriggerPhoneHook`:

- `numberDialed` -- when a number is dialed
- `callStarted` -- when a call begins
- `emergencyCallStarted` -- when an emergency call begins
