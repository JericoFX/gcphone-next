---
title: NUI Domain Map
---

# NUI Domain Map

The client NUI bridge is split by domain under `client/nui/*.lua`. Each file owns browser callbacks for one phone area and forwards sensitive work to server callbacks or events.

| Domain | NUI callback | Server callback or event | Request | Response |
|---|---|---|---|---|
| Contacts | `getContacts` | `gcphone:contacts:get` | none | `Contact[]` |
| Contacts | `addContact` | `gcphone:contacts:add` | contact form | `{ success, id? }` |
| Contacts | `updateContact` | `gcphone:contacts:update` | contact form | `{ success }` |
| Contacts | `deleteContact` | `gcphone:contacts:delete` | `{ id }` | `{ success }` |
| Contacts | `toggleFavorite` | `gcphone:contacts:toggleFavorite` | `{ id }` | `{ success }` |
| Messages | `getMessages` | `gcphone:messages:getAll` | none | `Message[]` |
| Messages | `sendMessage` | `gcphone:messages:send` | message form | `{ success }` |
| Messages | `setAutoReply` | `gcphone:messages:setAutoReply` | `{ enabled, message? }` | `{ success }` |
| Messages | `getAutoReply` | `gcphone:messages:getAutoReply` | none | `{ enabled, message }` |
| Messages | `deleteMessage` | `gcphone:messages:delete` | `{ id }` | `{ success }` |
| Messages | `deleteConversation` | `gcphone:messages:deleteConversation` | `{ phoneNumber }` | `{ success }` |
| Messages | `markAsRead` | `gcphone:messages:markAsRead` | `{ phoneNumber }` | `{ success }` |
| Messages | `reactToMessage` | `gcphone:messages:react` | `{ messageId, emoji }` | `{ success }` |
| Messages | `removeReaction` | `gcphone:messages:removeReaction` | `{ messageId }` | `{ success }` |
| Mail | `mailGetState` | `gcphone:mail:getState` | `{ limit?, offset? }` | mail state |
| Mail | `mailCreateAccount` | `gcphone:mail:createAccount` | `{ alias? }` | mail state |
| Mail | `mailSend` | `gcphone:mail:send` | mail payload | `{ success, id? }` |
| Mail | `mailGetMessages` | `gcphone:mail:getMessages` | `{ folder?, limit?, offset? }` | `{ success, messages }` |
| Mail | `mailMarkRead` | `gcphone:mail:markRead` | `{ messageId }` | `{ success }` |
| Mail | `mailDelete` | `gcphone:mail:delete` | `{ messageId, folder? }` | `{ success }` |
| Phone setup | `phoneVerifyPin` | `gcphone:phone:verifyPin` | `{ pin }` | `{ success, unlocked? }` |
| Phone setup | `phoneGetSetupState` | `gcphone:phone:getSetupState` | none | setup state |
| Phone setup | `phoneCompleteSetup` | `gcphone:phone:completeSetup` | setup payload | `{ success, requiresSetup?, setup? }` |
| Notifications | `notificationsGet` | `gcphone:notifications:get` | `{ limit?, offset? }` | inbox state |
| Notifications | `notificationsMarkRead` | `gcphone:notifications:markRead` | `{ id }` | `{ success }` |
| Notifications | `notificationsMarkAllRead` | `gcphone:notifications:markAllRead` | none | `{ success }` |
| Notifications | `notificationsDelete` | `gcphone:notifications:delete` | `{ id }` | `{ success }` |
| Settings | `setWallpaper` | `gcphone:settings:setWallpaper` | `{ url }` | `{ success }` |
| Settings | `setRingtone` | `gcphone:settings:setRingtone` | `{ ringtone }` | `{ success }` |
| Settings | `setTheme` | `gcphone:settings:setTheme` | `{ theme }` | `{ success }` |
| Settings | `setLanguage` | `gcphone:settings:setLanguage` | `{ language }` | `{ success }` |
| Settings | `setLockCode` | `gcphone:settings:setLockCode` | `{ code }` | `{ success }` |
| Settings | `setAirplaneMode` | `gcphone:setAirplaneMode` | `{ enabled }` | `boolean` |
| Settings | `factoryResetPhone` | `gcphone:settings:factoryReset` | none | phone payload |
| Gallery | `getGallery` | `gcphone:gallery:get` | none | photo list |
| Gallery | `galleryGetAlbums` | `gcphone:gallery:getAlbums` | none | album list |
| Gallery | `galleryCreateAlbum` | `gcphone:gallery:createAlbum` | `{ name, color }` | `{ success, id? }` |
| Gallery | `galleryDeleteAlbum` | `gcphone:gallery:deleteAlbum` | `{ albumId }` | `{ success }` |
| Gallery | `galleryMoveToAlbum` | `gcphone:gallery:moveToAlbum` | `{ photoId, albumId }` | `{ success }` |
| Gallery | `galleryShareNfc` | `gcphone:gallery:shareNfc` | `{ photoId, targetServerId }` | `{ success }` |
| Bank | `getBankBalance` | `gcphone:bank:getBalance` | none | `number` |
| Bank | `getBankTransactions` | `gcphone:bank:getTransactions` | none | transaction list |
| Bank | `transferMoney` | `gcphone:bank:transfer` | `{ targetNumber, amount }` | `{ success }` |
| Wallet | `walletGetState` | `gcphone:wallet:getState` | none | wallet state |
| Wallet | `walletAddCard` | `gcphone:wallet:addCard` | card payload | `{ success }` |
| Wallet | `walletRemoveCard` | `gcphone:wallet:removeCard` | `{ cardId }` | `{ success }` |
| Wallet | `walletProximityTransfer` | `gcphone:wallet:proximityTransfer` | transfer payload | `{ success, balance? }` |
| Wallet | `walletGetPendingRequests` | `gcphone:wallet:getPendingRequests` | none | pending requests |
| Wallet | `walletRespondRequest` | `gcphone:wallet:respondRequest` | `{ requestId, accept }` | `{ success }` |
| Wallet | `walletCreateInvoice` | `gcphone:wallet:createInvoice` | invoice payload | `{ success, channel? }` |
| Wallet | `walletRespondInvoice` | `gcphone:wallet:respondInvoice` | invoice response | `{ success }` |

Directorio is not a marketplace and does not install apps. It lists internal apps and SDK shortcuts that are already registered by server resources, then relies on Settings permissions for user control.
