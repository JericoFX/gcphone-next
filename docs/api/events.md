---
title: Net Events
---

# Net Events

All events use `RegisterNetEvent` and are triggered via `TriggerClientEvent` or `TriggerServerEvent`.

## Phone Core

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:init` | `data: table` | Initialize the phone UI with player data (phoneNumber, wallpaper, ringtone, volume, lockCode, language, audioProfile, etc.). |
| `gcphone:notify` | `payload: GCPhoneNotificationPayload` | Push a phone notification to the NUI. |
| `gcphone:forceOpenPhone` | -- | Force-open the phone if it is closed. |
| `gcphone:forceClosePhone` | -- | Force-close the phone if it is open. |
| `gcphone:phoneMarkedStolen` | `data: { isStolen: boolean, reason: string }` | Notify the client that the phone's stolen state changed. |

### Server Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:clearPhoneAccessContext` | -- | Clear the phone access context for the calling source (used when switching phones). |

## Calls

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:incomingCall` | `callData: table` | Incoming call notification with caller info. |
| `gcphone:callAccepted` | `callData: table` | The remote party accepted the call. |
| `gcphone:callRejected` | `callId: integer` | The remote party rejected the call. |
| `gcphone:callEnded` | `callId: integer` | The call has ended. |
| `gcphone:receiveIceCandidate` | `candidates: table` | WebRTC ICE candidates for call audio. |
| `gcphone:stopIncomingCallTone` | -- | Stop the incoming call ringtone. |

### Server Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:setAirplaneMode` | `enabled: boolean` | Set airplane mode on/off for the player. |
| `gcphone:rejectCall` | `callId: integer` | Reject an incoming call. |
| `gcphone:endCall` | `callId: integer` | End an active call. |
| `gcphone:sendIceCandidate` | `callId: integer, candidates: table` | Forward WebRTC ICE candidates to the remote party. |

## Messages & WaveChat

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:contactsUpdated` | `contacts: table[]` | Contact list has been updated. |
| `gcphone:messageSent` | `message: table` | A message was sent successfully. |
| `gcphone:messageReceived` | `message: table` | A new message was received. |
| `gcphone:wavechatGroupMessage` | `payload: table` | A new group message was received in WaveChat. |

## Settings

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:wallpaperUpdated` | `url: string` | The wallpaper was changed. |

## Bank & Wallet

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:bankTransferReceived` | `payload: table` | A bank transfer was received. |
| `gcphone:bankInvoiceReceived` | `data: table` | A bank invoice was received. |
| `gcphone:bankInvoiceResult` | `data: table` | Result of a bank invoice response. |
| `gcphone:walletNfcInvoiceReceived` | `data: table` | NFC wallet invoice received via proximity. |
| `gcphone:walletNfcInvoiceResult` | `data: table` | Result of an NFC invoice response. |

## Snap (Social Media)

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:snap:newPost` | `post: table` | A new Snap post was published. |
| `gcphone:snap:newStory` | `story: table` | A new Snap story was published. |
| `gcphone:snap:liveStarted` | `live: table` | A Snap live stream started. |
| `gcphone:snap:liveEnded` | `liveId: integer` | A Snap live stream ended. |
| `gcphone:snap:liveViewersUpdated` | `payload: table` | Live stream viewer count updated. |
| `gcphone:snap:liveMessage` | `payload: table` | A message was sent in a live stream chat. |
| `gcphone:snap:liveReaction` | `payload: table` | A reaction was sent in a live stream. |
| `gcphone:snap:liveMessageRemoved` | `payload: table` | A live stream message was removed. |
| `gcphone:snap:liveUserMuted` | `payload: table` | A user was muted in a live stream. |

## News

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:news:newArticle` | `article: table` | A new news article was published. |
| `gcphone:news:liveStarted` | `article: table` | A news live broadcast started. |
| `gcphone:news:liveEnded` | `articleId: integer` | A news live broadcast ended. |
| `gcphone:news:scaleformUpdated` | `articleId: integer, scaleform: table` | A news scaleform overlay was updated. |
| `gcphone:news:viewersUpdated` | `payload: table` | News live viewer count updated. |
| `gcphone:news:liveMessage` | `payload: table` | A message in the news live chat. |
| `gcphone:news:liveReaction` | `payload: table` | A reaction in the news live stream. |
| `gcphone:news:liveMessageRemoved` | `payload: table` | A news live message was removed. |
| `gcphone:news:liveUserMuted` | `payload: table` | A user was muted in the news live chat. |

## Proximity

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:receiveContactRequest` | `data: table` | A nearby player shared a contact via proximity. |
| `gcphone:receiveSharedLocation` | `data: table` | A shared location was received from another player. |
| `gcphone:receiveFriendRequest` | `data: table` | A friend request was received from a nearby player. |
| `gcphone:friendRequestAccepted` | `data: table` | A friend request was accepted. |
| `gcphone:receiveSharedPost` | `data: table` | A shared social post was received. |
| `gcphone:receiveSharedPhoto` | `data: table` | A shared photo was received via proximity. |
| `gcphone:receiveSharedDocument` | `data: table` | A shared document was received via proximity. |

## Nearby Voice

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:nearbyVoice:started` | `serverId: integer, peerId: integer` | Nearby voice streaming started with a player. |
| `gcphone:nearbyVoice:stopped` | `peerId: integer` | Nearby voice streaming stopped. |

### Server Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:nearbyVoice:setPeerId` | `peerId: integer` | Register a voice peer ID for the calling player. |

## Music

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:music:playFromNUI` | `data: table` | Start playing music from the NUI. |
| `gcphone:music:pauseFromNUI` | -- | Pause music playback. |
| `gcphone:music:resumeFromNUI` | -- | Resume music playback. |
| `gcphone:music:stopFromNUI` | -- | Stop music playback. |
| `gcphone:music:setVolumeFromNUI` | `payload: { volume: number }` | Set music volume. |
| `gcphone:music:setState` | `state: table` | Sync music state. |

### Server Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:music:play` | `data: table` | Request to play a music track. |
| `gcphone:music:pause` | -- | Pause the current track. |
| `gcphone:music:resume` | -- | Resume the current track. |
| `gcphone:music:stop` | -- | Stop the current track. |
| `gcphone:music:setVolume` | `data: { volume: number }` | Set playback volume. |

## Location Tracking

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:liveLocation:started` | `data: table` | Live location sharing started. |
| `gcphone:liveLocation:updated` | `data: table` | Live location position updated. |

### Server Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:liveLocation:updatePosition` | -- | Player position update tick for live location sharing. |

## Live Streams (Server)

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:live:create` | -- | Create a new live room. |
| `gcphone:live:join` | -- | Join a live room. |
| `gcphone:live:leave` | -- | Leave a live room. |
| `gcphone:live:message` | -- | Send a message in a live room. |
| `gcphone:live:reaction` | -- | Send a reaction in a live room. |
| `gcphone:live:deleteMessage` | -- | Delete a message in a live room. |
| `gcphone:live:mute` | -- | Mute a user in a live room. |
| `gcphone:live:unmute` | -- | Unmute a user in a live room. |
| `gcphone:live:end` | -- | End a live room. |

## Garage

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:garage:spawnVehicle` | `vehicle: table` | Spawn a vehicle at the nearest garage point. Contains vehicle data plus `_spawnX/Y/Z/H` coordinates. |

## Phone Drop

### Client Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:phoneDropped` | `data: table` | A phone was dropped in the world. |
| `gcphone:phonePickedUp` | `phoneId: integer` | A dropped phone was picked up. |

## Flashlight (Server)

| Event | Parameters | Description |
|-------|-----------|-------------|
| `gcphone:stateChanged` | `open: boolean` | The phone open/close state changed. |
| `gcphone:flashlight:setEnabled` | `enabled: boolean` | Toggle the phone flashlight state. |
| `gcphone:flashlight:setProfile` | `data: table` | Update flashlight profile settings. |

## Framework Integration (Server)

| Event | Parameters | Description |
|-------|-----------|-------------|
| `QBCore:Server:PlayerLoaded` | `Player: table` | QBCore player loaded hook (auto phone init). |
| `QBCore:Server:OnPlayerUnload` | `source: integer` | QBCore player unload hook (cleanup). |
