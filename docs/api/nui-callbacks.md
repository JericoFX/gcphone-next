---
title: NUI Callbacks
---

# NUI Callbacks

NUI callbacks are registered on the client via `RegisterNUICallback` and invoked from the SolidJS frontend using `fetchNui`. Each callback receives `data` from the NUI and must call `cb(response)`.

Most NUI callbacks in `nui_bridge.lua` are thin wrappers that forward to a server `lib.callback` and return the result. The mapping follows a consistent pattern:

```
NUI: fetchNui('callbackName', data) -> client RegisterNUICallback -> lib.callback('gcphone:...', data) -> server -> response -> cb(response)
```

## Phone Core

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `nuiReady` | -- | `true` | main.lua |
| `closePhone` | -- | `true` | phone.lua |
| `useMouse` | `state: boolean` | `true` | phone.lua |
| `setIgnoreFocus` | `data: table` | `true` | phone.lua |
| `phoneSetVisualMode` | `{ mode: string, options?: table }` | `true` | phone.lua |
| `getPhoneMetadata` | -- | `table` | phone_drop.lua |

## Contacts

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `getContacts` | -- | `table[]` | nui_bridge.lua |
| `addContact` | `{ display, number, ... }` | `table` | nui_bridge.lua |
| `updateContact` | `{ id, display, number, ... }` | `table` | nui_bridge.lua |
| `deleteContact` | `{ id: integer }` | `boolean` | nui_bridge.lua |
| `toggleFavorite` | `{ id: integer }` | `boolean` | nui_bridge.lua |

## Messages

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `getMessages` | -- | `table[]` | nui_bridge.lua |
| `sendMessage` | `{ phoneNumber, message, ... }` | `table` | nui_bridge.lua |
| `deleteMessage` | `{ id: integer }` | `boolean` | nui_bridge.lua |
| `deleteConversation` | `{ phoneNumber: string }` | `boolean` | nui_bridge.lua |
| `markAsRead` | `{ phoneNumber: string }` | `boolean` | nui_bridge.lua |
| `setAutoReply` | `{ enabled, message }` | `boolean` | nui_bridge.lua |
| `getAutoReply` | -- | `table` | nui_bridge.lua |

## WaveChat

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `wavechatGetGroups` | -- | `table[]` | nui_bridge.lua |
| `wavechatGetInvites` | -- | `table[]` | nui_bridge.lua |
| `wavechatGetStatusMediaConfig` | -- | `table` | nui_bridge.lua |
| `wavechatGetStatuses` | -- | `table[]` | nui_bridge.lua |
| `wavechatCreateStatus` | `{ media, text, ... }` | `table` | nui_bridge.lua |
| `wavechatMarkStatusViewed` | `{ statusId: integer }` | `boolean` | nui_bridge.lua |
| `wavechatCreateGroup` | `{ name, members, ... }` | `table` | nui_bridge.lua |
| `wavechatRespondInvite` | `{ groupId, accept }` | `boolean` | nui_bridge.lua |
| `wavechatGetGroupMessages` | `{ groupId, ... }` | `table[]` | nui_bridge.lua |
| `wavechatSendGroupMessage` | `{ groupId, message, ... }` | `table` | nui_bridge.lua |
| `wavechatSearchGifs` | `{ query: string }` | `table[]` | nui_bridge.lua |

## Calls

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `startCall` | `{ number: string }` | `table` | calls.lua |
| `acceptCall` | `{ callId: integer }` | `table` | calls.lua |
| `rejectCall` | `{ callId: integer }` | -- | calls.lua |
| `endCall` | `{ callId: integer }` | -- | calls.lua |
| `sendIceCandidate` | `{ callId, candidates }` | -- | calls.lua |
| `setUseRTC` | `{ enabled: boolean }` | `true` | calls.lua |
| `getCallHistory` | -- | `table[]` | calls.lua |
| `deleteCallHistory` | `{ phoneNumber: string }` | `boolean` | calls.lua |
| `clearCallHistory` | -- | `boolean` | calls.lua |
| `emergencySOS` | -- | `table` | nui_bridge.lua |

## Phone Settings

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `phoneGetSetupState` | -- | `table` | nui_bridge.lua |
| `phoneCompleteSetup` | `{ ... }` | `table` | nui_bridge.lua |
| `phoneVerifyPin` | `{ pin: string }` | `table` | nui_bridge.lua |
| `phoneReportImeiViewed` | `{ imei: string }` | `table` | nui_bridge.lua |
| `setWallpaper` | `{ url: string }` | `boolean` | nui_bridge.lua |
| `setRingtone` | `{ tone: string }` | `boolean` | nui_bridge.lua |
| `setCallRingtone` | `{ tone: string }` | `boolean` | nui_bridge.lua |
| `setNotificationTone` | `{ tone: string }` | `boolean` | nui_bridge.lua |
| `setMessageTone` | `{ tone: string }` | `boolean` | nui_bridge.lua |
| `setVolume` | `{ volume: number }` | `boolean` | nui_bridge.lua |
| `setTheme` | `{ theme: string }` | `boolean` | nui_bridge.lua |
| `setLanguage` | `{ language: string }` | `boolean` | nui_bridge.lua |
| `setAudioProfile` | `{ profile: string }` | `boolean` | nui_bridge.lua |
| `setLockCode` | `{ code: string }` | `boolean` | nui_bridge.lua |
| `factoryResetPhone` | -- | `boolean` | nui_bridge.lua |
| `setAirplaneMode` | `{ enabled: boolean }` | -- | nui_bridge.lua |
| `getAppLayout` | -- | `table` | nui_bridge.lua |
| `setAppLayout` | `layout: table` | `boolean` | nui_bridge.lua |

## Notifications

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `notificationsGet` | `{ limit?, offset? }` | `table` | nui_bridge.lua |
| `notificationsMarkRead` | `{ id: integer }` | `boolean` | nui_bridge.lua |
| `notificationsMarkAllRead` | -- | `boolean` | nui_bridge.lua |
| `notificationsDelete` | `{ id: integer }` | `boolean` | nui_bridge.lua |

## Social Notifications

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `socialGetNotifications` | `data: table` | `table` | nui_bridge.lua |
| `socialMarkNotificationRead` | `data: table` | `boolean` | nui_bridge.lua |
| `socialMarkAllNotificationsRead` | `data: table` | `boolean` | nui_bridge.lua |
| `socialDeleteNotification` | `data: table` | `boolean` | nui_bridge.lua |

## Gallery

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `getGallery` | -- | `table[]` | nui_bridge.lua |
| `getUploadConfig` | -- | `table` | nui_bridge.lua |
| `getStorageConfig` | -- | `table` | nui_bridge.lua |
| `storeMediaUrl` | `{ url, type, ... }` | `table` | nui_bridge.lua |
| `deletePhoto` | `{ id: integer }` | `boolean` | nui_bridge.lua |
| `galleryShareNfc` | `data: table` | `table` | nui_bridge.lua |
| `openGallery` | -- | -- | nui_bridge.lua |

## Bank

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `getBankBalance` | -- | `table` | nui_bridge.lua |
| `getBankTransactions` | -- | `table[]` | nui_bridge.lua |
| `getContactsForTransfer` | -- | `table[]` | nui_bridge.lua |
| `transferMoney` | `{ phoneNumber, amount, ... }` | `table` | nui_bridge.lua |

## Wallet

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `walletGetState` | -- | `table` | nui_bridge.lua |
| `walletTransfer` | `data: table` | `table` | nui_bridge.lua |
| `walletProximityTransfer` | `data: table` | `table` | nui_bridge.lua |
| `walletCreateRequest` | `data: table` | `table` | nui_bridge.lua |
| `walletGetPendingRequests` | -- | `table[]` | nui_bridge.lua |
| `walletRespondRequest` | `data: table` | `table` | nui_bridge.lua |
| `walletAddCard` | `data: table` | `table` | nui_bridge.lua |
| `walletRemoveCard` | `data: table` | `boolean` | nui_bridge.lua |
| `walletCreateNfcInvoice` | `data: table` | `table` | nui_bridge.lua |
| `walletCreateInvoice` | `data: table` | `table` | nui_bridge.lua |
| `walletRespondNfcInvoice` | `data: table` | `table` | nui_bridge.lua |
| `walletRespondInvoice` | `data: table` | `table` | nui_bridge.lua |

## Documents

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `documentsGetList` | -- | `table[]` | nui_bridge.lua |
| `documentsCreate` | `data: table` | `table` | nui_bridge.lua |
| `documentsDelete` | `data: table` | `boolean` | nui_bridge.lua |
| `documentsToggleNFC` | `data: table` | `boolean` | nui_bridge.lua |
| `documentsScanNFC` | `data: table` | `table` | nui_bridge.lua |
| `documentsVerify` | `data: table` | `table` | nui_bridge.lua |
| `documentsGetScanHistory` | -- | `table[]` | nui_bridge.lua |
| `documentsGetTypes` | -- | `table[]` | nui_bridge.lua |

## Chirp

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `chirpGetAccount` | -- | `table` | nui_bridge.lua |
| `chirpCreateAccount` | `{ username, ... }` | `table` | nui_bridge.lua |
| `chirpUpdateAccount` | `data: table` | `table` | nui_bridge.lua |
| `chirpGetTweets` | `{ page?, filter? }` | `table[]` | nui_bridge.lua |
| `chirpPublishTweet` | `{ content, media? }` | `table` | nui_bridge.lua |
| `chirpToggleLike` | `{ tweetId }` | `boolean` | nui_bridge.lua |
| `chirpToggleRechirp` | `{ tweetId }` | `boolean` | nui_bridge.lua |
| `chirpFollow` | `{ accountId }` | `table` | nui_bridge.lua |
| `chirpGetProfile` | `{ accountId }` | `table` | nui_bridge.lua |
| `chirpGetPendingFollowRequests` | -- | `table[]` | nui_bridge.lua |
| `chirpGetSentFollowRequests` | -- | `table[]` | nui_bridge.lua |
| `chirpRespondFollowRequest` | `data: table` | `boolean` | nui_bridge.lua |
| `chirpCancelFollowRequest` | `data: table` | `boolean` | nui_bridge.lua |
| `chirpGetComments` | `{ tweetId }` | `table[]` | nui_bridge.lua |
| `chirpAddComment` | `{ tweetId, content }` | `table` | nui_bridge.lua |
| `chirpDeleteTweet` | `{ tweetId }` | `boolean` | nui_bridge.lua |
| `chirpDeleteComment` | `data: table` | `boolean` | nui_bridge.lua |

## Snap

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `snapGetAccount` | -- | `table` | nui_bridge.lua |
| `snapCreateAccount` | `{ username, ... }` | `table` | nui_bridge.lua |
| `snapUpdateAccount` | `data: table` | `table` | nui_bridge.lua |
| `snapGetFeed` | `{ page?, filter? }` | `table[]` | nui_bridge.lua |
| `snapPublishPost` | `{ content, media }` | `table` | nui_bridge.lua |
| `snapToggleLike` | `{ postId }` | `boolean` | nui_bridge.lua |
| `snapFollow` | `{ accountId }` | `table` | nui_bridge.lua |
| `snapGetProfile` | `{ accountId }` | `table` | nui_bridge.lua |
| `snapGetDiscoverAccounts` | `data: table` | `table[]` | nui_bridge.lua |
| `snapGetDiscoverFeed` | `data: table` | `table[]` | nui_bridge.lua |
| `snapGetPendingFollowRequests` | -- | `table[]` | nui_bridge.lua |
| `snapGetSentFollowRequests` | -- | `table[]` | nui_bridge.lua |
| `snapRespondFollowRequest` | `data: table` | `boolean` | nui_bridge.lua |
| `snapCancelFollowRequest` | `data: table` | `boolean` | nui_bridge.lua |
| `snapGetStories` | -- | `table[]` | nui_bridge.lua |
| `snapPublishStory` | `data: table` | `table` | nui_bridge.lua |
| `snapGetLiveStreams` | -- | `table[]` | nui_bridge.lua |
| `snapStartLive` | -- | `table` | nui_bridge.lua |
| `snapEndLive` | `{ postId }` | `boolean` | nui_bridge.lua |
| `snapDeletePost` | `{ postId }` | `boolean` | nui_bridge.lua |
| `snapDeleteStory` | `{ storyId }` | `boolean` | nui_bridge.lua |
| `snapJoinLive` | `data: table` | `table` | nui_bridge.lua |
| `snapLeaveLive` | `data: table` | `boolean` | nui_bridge.lua |
| `snapSendLiveMessage` | `data: table` | `table` | nui_bridge.lua |
| `snapSendLiveReaction` | `data: table` | `boolean` | nui_bridge.lua |
| `snapRemoveLiveMessage` | `data: table` | `boolean` | nui_bridge.lua |
| `snapMuteLiveUser` | `data: table` | `boolean` | nui_bridge.lua |

## Clips

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `clipsGetAccount` | -- | `table` | nui_bridge.lua |
| `clipsCreateAccount` | `{ username, ... }` | `table` | nui_bridge.lua |
| `clipsUpdateAccount` | `data: table` | `table` | nui_bridge.lua |
| `clipsGetFeed` | `data: table` | `table[]` | nui_bridge.lua |
| `clipsGetMyClips` | `data: table` | `table[]` | nui_bridge.lua |
| `clipsPublish` | `data: table` | `table` | nui_bridge.lua |
| `clipsDeletePost` | `{ postId }` | `boolean` | nui_bridge.lua |
| `clipsToggleLike` | `{ postId }` | `boolean` | nui_bridge.lua |
| `clipsGetComments` | `{ postId }` | `table[]` | nui_bridge.lua |
| `clipsAddComment` | `{ postId, content }` | `table` | nui_bridge.lua |
| `clipsDeleteComment` | `data: table` | `boolean` | nui_bridge.lua |

## News

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `newsGetAccount` | -- | `table` | nui_bridge.lua |
| `newsCreateAccount` | `{ username, ... }` | `table` | nui_bridge.lua |
| `newsUpdateAccount` | `data: table` | `table` | nui_bridge.lua |
| `newsGetArticles` | `data: table` | `table[]` | nui_bridge.lua |
| `newsPublishArticle` | `data: table` | `table` | nui_bridge.lua |
| `newsGetCategories` | -- | `table[]` | nui_bridge.lua |
| `newsGetLiveNews` | -- | `table[]` | nui_bridge.lua |
| `newsDeleteArticle` | `{ articleId }` | `boolean` | nui_bridge.lua |
| `newsViewArticle` | `{ articleId }` | `boolean` | nui_bridge.lua |
| `newsStartLive` | `data: table` | `table` | nui_bridge.lua |
| `newsEndLive` | `{ articleId }` | `boolean` | nui_bridge.lua |
| `newsGetScaleform` | `{ articleId }` | `table` | nui_bridge.lua |
| `newsJoinLive` | `data: table` | `table` | nui_bridge.lua |
| `newsLeaveLive` | `data: table` | `boolean` | nui_bridge.lua |
| `newsSendLiveMessage` | `data: table` | `table` | nui_bridge.lua |
| `newsSendLiveReaction` | `data: table` | `boolean` | nui_bridge.lua |
| `newsRemoveLiveMessage` | `data: table` | `boolean` | nui_bridge.lua |
| `newsMuteLiveUser` | `data: table` | `boolean` | nui_bridge.lua |
| `newsSetScaleform` | `data: table` | `boolean` | nui_bridge.lua |

## Market

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `marketGetListings` | `data: table` | `table[]` | nui_bridge.lua |
| `marketCreateListing` | `data: table` | `table` | nui_bridge.lua |
| `marketGetMyListings` | -- | `table[]` | nui_bridge.lua |
| `marketMarkAsSold` | `{ listingId }` | `boolean` | nui_bridge.lua |
| `marketDeleteListing` | `{ listingId }` | `boolean` | nui_bridge.lua |
| `marketContactSeller` | `data: table` | `boolean` | nui_bridge.lua |

## Yellow Pages

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `yellowpagesGetCategories` | -- | `table[]` | nui_bridge.lua |
| `yellowpagesGetListings` | `data: table` | `table[]` | nui_bridge.lua |
| `yellowpagesGetMyListings` | `data: table` | `table[]` | nui_bridge.lua |
| `yellowpagesGetSellerInfo` | `{ listingId }` | `table` | nui_bridge.lua |
| `yellowpagesCreateListing` | `data: table` | `table` | nui_bridge.lua |
| `yellowpagesDeleteListing` | `{ listingId }` | `boolean` | nui_bridge.lua |
| `yellowpagesRecordContact` | `data: table` | `boolean` | nui_bridge.lua |

## Mail

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `mailGetState` | `data: table` | `table` | nui_bridge.lua |
| `mailCreateAccount` | `data: table` | `table` | nui_bridge.lua |
| `mailSend` | `data: table` | `table` | nui_bridge.lua |
| `mailGetMessages` | `data: table` | `table[]` | nui_bridge.lua |
| `mailMarkRead` | `data: table` | `boolean` | nui_bridge.lua |
| `mailDelete` | `data: table` | `boolean` | nui_bridge.lua |

## Notes

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `notesGetAll` | -- | `table[]` | nui_bridge.lua |
| `notesSave` | `{ id?, title, content }` | `table` | nui_bridge.lua |
| `notesDelete` | `{ id: integer }` | `boolean` | nui_bridge.lua |

## Darkrooms

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `darkroomsGetRooms` | -- | `table[]` | nui_bridge.lua |
| `darkroomsCreateRoom` | `data: table` | `table` | nui_bridge.lua |
| `darkroomsJoinRoom` | `data: table` | `table` | nui_bridge.lua |
| `darkroomsGetPosts` | `data: table` | `table[]` | nui_bridge.lua |
| `darkroomsCreatePost` | `data: table` | `table` | nui_bridge.lua |
| `darkroomsVotePost` | `data: table` | `boolean` | nui_bridge.lua |
| `darkroomsGetComments` | `data: table` | `table[]` | nui_bridge.lua |
| `darkroomsCreateComment` | `data: table` | `table` | nui_bridge.lua |

## Garage

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `garageGetVehicles` | -- | `table[]` | nui_bridge.lua |
| `garageGetLocationHistory` | `{ plate: string }` | `table[]` | nui_bridge.lua |
| `garageRequestVehicle` | `{ plate: string }` | `boolean` | nui_bridge.lua |
| `garageShareLocation` | `data: table` | `boolean` | nui_bridge.lua |
| `garageGetImpoundLocation` | -- | `GaragePoint\|nil` | nui_bridge.lua |
| `garageSetGps` | `{ x, y, z }` | -- | nui_bridge.lua |

## Music

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `musicSearchCatalog` | `{ query: string }` | `table[]` | nui_bridge.lua |
| `musicSearchITunes` | `{ query: string }` | `table[]` | nui_bridge.lua |
| `musicCanSearchCatalog` | -- | `boolean` | nui_bridge.lua |
| `musicPlay` | `{ url, title, ... }` | -- | nui_bridge.lua |
| `musicPause` | -- | -- | nui_bridge.lua |
| `musicResume` | -- | -- | nui_bridge.lua |
| `musicStop` | -- | -- | nui_bridge.lua |
| `musicSetVolume` | `{ volume: number }` | -- | nui_bridge.lua |

## Proximity

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `shareContact` | `data: table` | `boolean` | proximity.lua |
| `sendFriendRequest` | `data: table` | `boolean` | proximity.lua |
| `acceptFriendRequest` | `data: table` | `boolean` | proximity.lua |
| `rejectFriendRequest` | `data: table` | `boolean` | proximity.lua |
| `acceptContactRequest` | `data: table` | `table` | proximity.lua |
| `getNearbyPlayers` | `data: table` | `table[]` | proximity.lua |
| `shareDocument` | `data: table` | `boolean` | proximity.lua |
| `snapLiveAudioStart` | `data: table` | `table` | proximity.lua |
| `snapLiveAudioStop` | -- | `true` | proximity.lua |
| `snapLiveAudioStatus` | -- | `table` | proximity.lua |

## Location Tracking

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `startLiveLocation` | `data: table` | `table` | location_tracking.lua |
| `stopLiveLocation` | -- | `boolean` | location_tracking.lua |
| `getActiveLiveLocations` | -- | `table[]` | location_tracking.lua |
| `setLiveLocationInterval` | `data: table` | `true` | location_tracking.lua |
| `getLiveLocationState` | -- | `table` | location_tracking.lua |

## Camera

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `cameraGetCapabilities` | -- | `table` | camera.lua |
| `startCameraSession` | `data: table` | -- | camera.lua |
| `updateCameraSession` | `data: table` | -- | camera.lua |
| `captureCameraSession` | `data: table` | `table` | camera.lua |
| `captureCameraVideoSession` | -- | `table` | camera.lua |
| `cameraSetFreeze` | `data: table` | -- | camera.lua |
| `cameraSetLandscape` | `data: table` | -- | camera.lua |
| `cameraSetQuickZoom` | `data: table` | -- | camera.lua |
| `stopCameraSession` | -- | -- | camera.lua |
| `takePhoto` | `data: table` | `string` (URL) | camera.lua |
| `faketakePhoto` | -- | `string` (URL) | camera.lua |

## Flashlight

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `cameraToggleFlashlight` | `data: table` | `true` | flashlight.lua |
| `cameraGetFlashlightSettings` | -- | `table` | flashlight.lua |
| `cameraSetFlashlightSettings` | `data: table` | `true` | flashlight.lua |

## Native Audio

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `previewNativeTone` | `data: table` | `true` | native_audio.lua |
| `stopNativeTonePreview` | -- | `true` | native_audio.lua |
| `playNativeNotification` | `data: table` | `true` | native_audio.lua |
| `playNativeMessage` | `data: table` | `true` | native_audio.lua |
| `playNativeOutgoing` | `data: table` | `true` | native_audio.lua |
| `stopNativeOutgoing` | -- | `true` | native_audio.lua |

## Nearby Voice

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `setListeningPeerId` | `{ peerId: integer }` | `true` | nearby_voice.lua |
| `getListeningPeerId` | -- | `integer\|nil` | nearby_voice.lua |

## Navigation & Utility

| Callback | Data | Response | Source File |
|----------|------|----------|-------------|
| `setGPS` | `{ x, y }` | `true` | nui_bridge.lua |
| `getPlayerCoords` | -- | `{ x, y, z }` | nui_bridge.lua |
| `getWeatherData` | -- | `table` | nui_bridge.lua |
| `getGameTime` | -- | `table` | nui_bridge.lua |
| `livekitGetToken` | `data: table` | `table` | nui_bridge.lua |
| `socketGetToken` | `data: table` | `table` | nui_bridge.lua |
