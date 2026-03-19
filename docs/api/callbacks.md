---
title: Server Callbacks
---

# Server Callbacks

All callbacks are registered via `lib.callback.register` (ox_lib) and invoked from the client with `lib.callback`. The first parameter is always `source` (injected by ox_lib).

## Phone

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getPhoneData` | `source` | `table` | Get initial phone data for the player. |
| `gcphone:phone:getSetupState` | `source` | `table` | Get the phone setup/onboarding state. |
| `gcphone:phone:completeSetup` | `source, data: table` | `table` | Complete phone initial setup. |
| `gcphone:phone:verifyPin` | `source, data: table` | `table` | Verify the phone lock PIN. |
| `gcphone:phone:reportImeiViewed` | `source, data: table` | `table` | Report that the IMEI was viewed (audit). |
| `gcphone:setWallpaper` | `source, data: table` | `boolean` | Set the phone wallpaper. |
| `gcphone:setRingtone` | `source, data: table` | `boolean` | Set the ringtone. |
| `gcphone:setCallRingtone` | `source, data: table` | `boolean` | Set the call ringtone. |
| `gcphone:setNotificationTone` | `source, data: table` | `boolean` | Set the notification tone. |
| `gcphone:setMessageTone` | `source, data: table` | `boolean` | Set the message tone. |
| `gcphone:setVolume` | `source, data: table` | `boolean` | Set the phone volume. |
| `gcphone:setLockCode` | `source, data: table` | `boolean` | Set or change the lock code. |
| `gcphone:factoryResetPhone` | `source` | `boolean` | Factory reset the phone (wipes all data). |
| `gcphone:setTheme` | `source, data: table` | `boolean` | Set the phone theme. |
| `gcphone:setLanguage` | `source, data: table` | `boolean` | Set the phone language. |
| `gcphone:setAudioProfile` | `source, data: table` | `boolean` | Set the audio profile. |
| `gcphone:getAppLayout` | `source` | `table` | Get the app layout/order. |
| `gcphone:setAppLayout` | `source, layout: table` | `boolean` | Set the app layout/order. |
| `gcphone:getPhoneMetadata` | `source, phoneId: integer` | `table` | Get metadata for a specific phone (dropped phone context). |

## Contacts

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getContacts` | `source` | `table[]` | Get all contacts for the player. |
| `gcphone:addContact` | `source, data: table` | `table` | Add a new contact. |
| `gcphone:updateContact` | `source, data: table` | `table` | Update an existing contact. |
| `gcphone:deleteContact` | `source, contactId: integer` | `boolean` | Delete a contact. |
| `gcphone:toggleFavorite` | `source, contactId: integer` | `boolean` | Toggle contact favorite status. |
| `gcphone:shareContact` | `source, data: table` | `boolean` | Share a contact via SMS. |
| `gcphone:acceptSharedContact` | `source, data: table` | `table` | Accept a shared contact. |

## Messages

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getMessages` | `source` | `table[]` | Get all message threads. |
| `gcphone:getConversation` | `source, phoneNumber: string` | `table[]` | Get messages in a conversation. |
| `gcphone:sendMessage` | `source, data: table` | `table` | Send an SMS message. |
| `gcphone:deleteMessage` | `source, messageId: integer` | `boolean` | Delete a single message. |
| `gcphone:deleteConversation` | `source, phoneNumber: string` | `boolean` | Delete an entire conversation. |
| `gcphone:markAsRead` | `source, phoneNumber: string` | `boolean` | Mark a conversation as read. |
| `gcphone:getUnreadCount` | `source` | `integer` | Get unread message count. |
| `gcphone:setAutoReply` | `source, data: table` | `boolean` | Set auto-reply settings. |
| `gcphone:getAutoReply` | `source` | `table` | Get current auto-reply settings. |

## WaveChat (Group Messages)

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:wavechatGetGroups` | `source` | `table[]` | Get all group chats. |
| `gcphone:wavechatGetInvites` | `source` | `table[]` | Get pending group invites. |
| `gcphone:wavechatCreateGroup` | `source, data: table` | `table` | Create a new group chat. |
| `gcphone:wavechatGetGroupMessages` | `source, data: table` | `table[]` | Get messages in a group. |
| `gcphone:wavechatRespondInvite` | `source, data: table` | `boolean` | Accept or reject a group invite. |
| `gcphone:wavechatSendGroupMessage` | `source, data: table` | `table` | Send a message to a group. |
| `gcphone:wavechatGetStatuses` | `source` | `table[]` | Get WaveChat status updates. |
| `gcphone:wavechatCreateStatus` | `source, data: table` | `table` | Create a status update. |
| `gcphone:wavechatMarkStatusViewed` | `source, statusId: integer` | `boolean` | Mark a status as viewed. |

## Calls

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getCallHistory` | `source` | `table[]` | Get call history. |
| `gcphone:deleteCallHistory` | `source, phoneNumber: string` | `boolean` | Delete call history for a number. |
| `gcphone:clearCallHistory` | `source` | `boolean` | Clear all call history. |
| `gcphone:startCall` | `source, data: table` | `table` | Initiate a phone call. |
| `gcphone:acceptCall` | `source, data: table` | `table` | Accept an incoming call. |
| `gcphone:emergencySOS` | `source` | `table` | Trigger an emergency SOS. |

## Bank

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getBankBalance` | `source` | `table` | Get the player's bank balance. |
| `gcphone:getBankTransactions` | `source` | `table[]` | Get bank transaction history. |
| `gcphone:transferMoney` | `source, data: table` | `table` | Transfer money to another player. |
| `gcphone:getContactsForTransfer` | `source` | `table[]` | Get contacts available for bank transfer. |

## Wallet

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:wallet:getState` | `source` | `table` | Get full wallet state (balance, cards). |
| `gcphone:wallet:addCard` | `source, data: table` | `table` | Add a card to the wallet. |
| `gcphone:wallet:removeCard` | `source, data: table` | `boolean` | Remove a card from the wallet. |
| `gcphone:wallet:transfer` | `source, data: table` | `table` | Transfer money via wallet. |
| `gcphone:wallet:proximityTransfer` | `source, data: table` | `table` | Proximity-based wallet transfer. |
| `gcphone:wallet:createRequest` | `source, data: table` | `table` | Create a payment request. |
| `gcphone:wallet:getPendingRequests` | `source` | `table[]` | Get pending payment requests. |
| `gcphone:wallet:respondRequest` | `source, data: table` | `table` | Accept or reject a payment request. |
| `gcphone:wallet:createInvoice` | `source, data: table` | `table` | Create an invoice. |
| `gcphone:wallet:respondInvoice` | `source, data: table` | `table` | Respond to an invoice. |
| `gcphone:wallet:createNfcInvoice` | `source, data: table` | `table` | Create an NFC invoice. |
| `gcphone:wallet:respondNfcInvoice` | `source, data: table` | `table` | Respond to an NFC invoice. |

## Gallery

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getGallery` | `source` | `table[]` | Get all gallery photos. |
| `gcphone:savePhoto` | `source, data: table` | `table` | Save a photo to gallery. |
| `gcphone:deletePhoto` | `source, photoId: integer` | `boolean` | Delete a photo. |
| `gcphone:setPhotoAsWallpaper` | `source, data: table` | `boolean` | Set a photo as the wallpaper. |
| `gcphone:gallery:shareNfc` | `source, data: table` | `table` | Share a photo via NFC. |

## Snap (Social Media)

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:snap:getAccount` | `source` | `table` | Get the Snap account for the player. |
| `gcphone:snap:createAccount` | `source, data: table` | `table` | Create a new Snap account. |
| `gcphone:snap:updateAccount` | `source, data: table` | `table` | Update Snap account profile. |
| `gcphone:snap:getFeed` | `source, data: table` | `table[]` | Get the Snap feed (paginated). |
| `gcphone:snap:getStories` | `source` | `table[]` | Get stories. |
| `gcphone:snap:publishPost` | `source, data: table` | `table` | Publish a new Snap post. |
| `gcphone:snap:publishStory` | `source, data: table` | `table` | Publish a new story. |
| `gcphone:snap:toggleLike` | `source, data: table` | `boolean` | Toggle like on a post. |
| `gcphone:snap:deletePost` | `source, postId: integer` | `boolean` | Delete a post. |
| `gcphone:snap:deleteStory` | `source, storyId: integer` | `boolean` | Delete a story. |
| `gcphone:snap:follow` | `source, data: table` | `table` | Follow/unfollow a user. |
| `gcphone:snap:getProfile` | `source, data: table` | `table` | Get a user profile. |
| `gcphone:snap:getDiscoverAccounts` | `source, data: table` | `table[]` | Discover accounts to follow. |
| `gcphone:snap:getDiscoverFeed` | `source, data: table` | `table[]` | Get the discover feed. |
| `gcphone:snap:getPendingFollowRequests` | `source` | `table[]` | Get pending follow requests. |
| `gcphone:snap:getSentFollowRequests` | `source` | `table[]` | Get sent follow requests. |
| `gcphone:snap:respondFollowRequest` | `source, data: table` | `boolean` | Accept/reject a follow request. |
| `gcphone:snap:cancelFollowRequest` | `source, data: table` | `boolean` | Cancel a sent follow request. |
| `gcphone:snap:startLive` | `source` | `table` | Start a Snap live stream. |
| `gcphone:snap:endLive` | `source, postId: integer` | `boolean` | End a Snap live stream. |
| `gcphone:snap:getLiveStreams` | `source` | `table[]` | Get active live streams. |
| `gcphone:snap:joinLive` | `source, data: table` | `table` | Join a live stream. |
| `gcphone:snap:leaveLive` | `source, data: table` | `boolean` | Leave a live stream. |
| `gcphone:snap:sendLiveMessage` | `source, data: table` | `table` | Send a live stream message. |
| `gcphone:snap:sendLiveReaction` | `source, data: table` | `boolean` | Send a live stream reaction. |
| `gcphone:snap:removeLiveMessage` | `source, data: table` | `boolean` | Remove a live stream message. |
| `gcphone:snap:muteLiveUser` | `source, data: table` | `boolean` | Mute a user in a live stream. |
| `gcphone:snap:getLiveAudioSession` | `source, data: table` | `table` | Get live audio session info. |

## Clips

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:clips:getAccount` | `source` | `table` | Get the Clips account. |
| `gcphone:clips:createAccount` | `source, data: table` | `table` | Create a Clips account. |
| `gcphone:clips:updateAccount` | `source, data: table` | `table` | Update the Clips account. |
| `gcphone:clips:getFeed` | `source, data: table` | `table[]` | Get the Clips feed. |
| `gcphone:clips:getMyClips` | `source, data: table` | `table[]` | Get the player's own clips. |
| `gcphone:clips:publish` | `source, data: table` | `table` | Publish a new clip. |
| `gcphone:clips:deletePost` | `source, postId: integer` | `boolean` | Delete a clip. |
| `gcphone:clips:toggleLike` | `source, data: table` | `boolean` | Toggle like on a clip. |
| `gcphone:clips:getComments` | `source, data: table` | `table[]` | Get comments on a clip. |
| `gcphone:clips:addComment` | `source, data: table` | `table` | Add a comment to a clip. |
| `gcphone:clips:deleteComment` | `source, data: table` | `boolean` | Delete a comment from a clip. |

## Chirp (Twitter-like)

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:chirp:getAccount` | `source` | `table` | Get the Chirp account. |
| `gcphone:chirp:createAccount` | `source, data: table` | `table` | Create a Chirp account. |
| `gcphone:chirp:updateAccount` | `source, data: table` | `table` | Update Chirp account profile. |
| `gcphone:chirp:getTweets` | `source, data: table` | `table[]` | Get tweets (paginated). |
| `gcphone:chirp:publishTweet` | `source, data: table` | `table` | Publish a tweet. |
| `gcphone:chirp:toggleLike` | `source, data: table` | `boolean` | Toggle like on a tweet. |
| `gcphone:chirp:toggleRechirp` | `source, data: table` | `boolean` | Toggle rechirp (retweet). |
| `gcphone:chirp:getComments` | `source, data: table` | `table[]` | Get comments on a tweet. |
| `gcphone:chirp:addComment` | `source, data: table` | `table` | Add a comment/reply. |
| `gcphone:chirp:deleteComment` | `source, data: table` | `boolean` | Delete a comment. |
| `gcphone:chirp:deleteTweet` | `source, tweetId: integer` | `boolean` | Delete a tweet. |
| `gcphone:chirp:follow` | `source, data: table` | `table` | Follow/unfollow a user. |
| `gcphone:chirp:getProfile` | `source, data: table` | `table` | Get a user profile. |
| `gcphone:chirp:getPendingFollowRequests` | `source` | `table[]` | Get pending follow requests. |
| `gcphone:chirp:getSentFollowRequests` | `source` | `table[]` | Get sent follow requests. |
| `gcphone:chirp:respondFollowRequest` | `source, data: table` | `boolean` | Respond to a follow request. |
| `gcphone:chirp:cancelFollowRequest` | `source, data: table` | `boolean` | Cancel a sent follow request. |

## News

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:news:getAccount` | `source` | `table` | Get the News account. |
| `gcphone:news:createAccount` | `source, data: table` | `table` | Create a News account. |
| `gcphone:news:updateAccount` | `source, data: table` | `table` | Update News account profile. |
| `gcphone:news:getArticles` | `source, data: table` | `table[]` | Get news articles (paginated). |
| `gcphone:news:publishArticle` | `source, data: table` | `table` | Publish an article. |
| `gcphone:news:deleteArticle` | `source, articleId: integer` | `boolean` | Delete an article. |
| `gcphone:news:viewArticle` | `source, articleId: integer` | `boolean` | Record an article view. |
| `gcphone:news:getCategories` | `source` | `table[]` | Get news categories. |
| `gcphone:news:getLiveNews` | `source` | `table[]` | Get active news live broadcasts. |
| `gcphone:news:startLive` | `source, data: table` | `table` | Start a news live broadcast. |
| `gcphone:news:endLive` | `source, articleId: integer` | `boolean` | End a news live broadcast. |
| `gcphone:news:joinLive` | `source, data: table` | `table` | Join a news live broadcast. |
| `gcphone:news:leaveLive` | `source, data: table` | `boolean` | Leave a news live broadcast. |
| `gcphone:news:sendLiveMessage` | `source, data: table` | `table` | Send a message in news live chat. |
| `gcphone:news:sendLiveReaction` | `source, data: table` | `boolean` | Send a reaction in news live. |
| `gcphone:news:removeLiveMessage` | `source, data: table` | `boolean` | Remove a news live message. |
| `gcphone:news:muteLiveUser` | `source, data: table` | `boolean` | Mute a user in news live. |
| `gcphone:news:setScaleform` | `source, data: table` | `boolean` | Set the news scaleform overlay. |
| `gcphone:news:getScaleform` | `source, articleId: integer` | `table` | Get the scaleform for an article. |

## Notifications

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:notifications:get` | `source, data: { limit?, offset? }` | `table` | Get notifications (paginated). Returns `{ success, notifications, unread }`. |
| `gcphone:notifications:markRead` | `source, data: { id: integer }` | `boolean` | Mark a notification as read. |
| `gcphone:notifications:markAllRead` | `source` | `boolean` | Mark all notifications as read. |
| `gcphone:notifications:delete` | `source, data: { id: integer }` | `boolean` | Delete a notification. |

## Social Notifications

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:social:getNotifications` | `source, data: table` | `table` | Get social notifications. |
| `gcphone:social:markNotificationRead` | `source, data: table` | `boolean` | Mark a social notification as read. |
| `gcphone:social:markAllNotificationsRead` | `source, data: table` | `boolean` | Mark all social notifications as read. |
| `gcphone:social:deleteNotification` | `source, data: table` | `boolean` | Delete a social notification. |

## Notes

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:notes:getAll` | `source` | `table[]` | Get all notes. |
| `gcphone:notes:save` | `source, data: table` | `table` | Create or update a note. |
| `gcphone:notes:delete` | `source, data: table` | `boolean` | Delete a note. |

## Mail

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:mail:getState` | `source, data: table` | `table` | Get mail state (accounts, unread count). |
| `gcphone:mail:createAccount` | `source, data: table` | `table` | Create a mail account. |
| `gcphone:mail:send` | `source, data: table` | `table` | Send an email. |
| `gcphone:mail:markRead` | `source, data: table` | `boolean` | Mark a mail as read. |
| `gcphone:mail:getMessages` | `source, data: table` | `table[]` | Get mail messages (paginated). |
| `gcphone:mail:delete` | `source, data: table` | `boolean` | Delete a mail. |

## Security

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:security:getBlockedNumbers` | `source` | `table[]` | Get blocked phone numbers. |
| `gcphone:security:blockNumber` | `source, data: table` | `boolean` | Block a phone number. |
| `gcphone:security:unblockNumber` | `source, data: table` | `boolean` | Unblock a phone number. |
| `gcphone:security:reportUser` | `source, data: table` | `table` | Report a user. |

## Market

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:market:getListings` | `source, data: table` | `table[]` | Get market listings (paginated). |
| `gcphone:market:getMyListings` | `source` | `table[]` | Get the player's own listings. |
| `gcphone:market:createListing` | `source, data: table` | `table` | Create a market listing. |
| `gcphone:market:updateListing` | `source, data: table` | `table` | Update a listing. |
| `gcphone:market:deleteListing` | `source, listingId: integer` | `boolean` | Delete a listing. |
| `gcphone:market:markAsSold` | `source, listingId: integer` | `boolean` | Mark a listing as sold. |
| `gcphone:market:contactSeller` | `source, data: table` | `boolean` | Contact a seller. |
| `gcphone:market:getCategories` | `source` | `table[]` | Get market categories. |

## Yellow Pages

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:yellowpages:getListings` | `source, data: table` | `table[]` | Get yellow pages listings. |
| `gcphone:yellowpages:getMyListings` | `source, data: table` | `table[]` | Get the player's own listings. |
| `gcphone:yellowpages:createListing` | `source, data: table` | `table` | Create a listing. |
| `gcphone:yellowpages:deleteListing` | `source, listingId: integer` | `boolean` | Delete a listing. |
| `gcphone:yellowpages:getSellerInfo` | `source, listingId: integer` | `table` | Get seller info for a listing. |
| `gcphone:yellowpages:recordContact` | `source, data: table` | `boolean` | Record a contact interaction. |
| `gcphone:yellowpages:shareLocation` | `source, listingId: integer` | `boolean` | Share seller location. |
| `gcphone:yellowpages:getCategories` | `source` | `table[]` | Get yellow pages categories. |

## Proximity

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:proximity:shareContact` | `source, data: table` | `boolean` | Share a contact via proximity. |
| `gcphone:proximity:acceptContact` | `source, data: table` | `table` | Accept a proximity contact share. |
| `gcphone:proximity:shareLocation` | `source, data: table` | `boolean` | Share location with a nearby player. |
| `gcphone:proximity:getSharedLocations` | `source` | `table[]` | Get received shared locations. |
| `gcphone:proximity:sendFriendRequest` | `source, data: table` | `boolean` | Send a friend request. |
| `gcphone:proximity:acceptFriendRequest` | `source, data: table` | `boolean` | Accept a friend request. |
| `gcphone:proximity:rejectFriendRequest` | `source, data: table` | `boolean` | Reject a friend request. |
| `gcphone:proximity:sharePost` | `source, data: table` | `boolean` | Share a social post via proximity. |

## Phone Drop

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:dropPhone` | `source` | `table` | Drop the phone in the world. |
| `gcphone:getDroppedPhones` | `source` | `table[]` | Get nearby dropped phones. |
| `gcphone:pickupPhone` | `source, data: table` | `table` | Pick up a dropped phone. |
| `gcphone:getPhoneInfo` | `source, data: table` | `table` | Get info about a dropped phone. |
| `gcphone:unlockDroppedPhone` | `source, data: table` | `table` | Attempt to unlock a dropped phone. |

## Darkrooms

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:darkrooms:getRooms` | `source` | `table[]` | Get available darkrooms. |
| `gcphone:darkrooms:createRoom` | `source, data: table` | `table` | Create a new darkroom. |
| `gcphone:darkrooms:joinRoom` | `source, data: table` | `table` | Join a darkroom. |
| `gcphone:darkrooms:getPosts` | `source, data: table` | `table[]` | Get posts in a darkroom. |
| `gcphone:darkrooms:createPost` | `source, data: table` | `table` | Create a post in a darkroom. |
| `gcphone:darkrooms:votePost` | `source, data: table` | `boolean` | Vote on a darkroom post. |
| `gcphone:darkrooms:getComments` | `source, data: table` | `table[]` | Get comments on a darkroom post. |
| `gcphone:darkrooms:createComment` | `source, data: table` | `table` | Add a comment to a darkroom post. |

## Documents

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:documents:getList` | `source` | `table[]` | Get all documents. |
| `gcphone:documents:create` | `source, data: table` | `table` | Create a document. |
| `gcphone:documents:delete` | `source, data: table` | `boolean` | Delete a document. |
| `gcphone:documents:toggleNFC` | `source, data: table` | `boolean` | Toggle NFC sharing for a document. |
| `gcphone:documents:scanNFC` | `source, data: table` | `table` | Scan an NFC document. |
| `gcphone:documents:verify` | `source, data: table` | `table` | Verify a document. |
| `gcphone:documents:getScanHistory` | `source` | `table[]` | Get document scan history. |
| `gcphone:documents:share` | `source, data: table` | `boolean` | Share a document via proximity. |
| `gcphone:documents:getTypes` | `source` | `table[]` | Get available document types. |

## Storage & Media

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:getStorageConfig` | `source` | `table` | Get storage/upload configuration. |
| `gcphone:storeMediaUrl` | `source, data: table` | `table` | Store a media URL. |
| `gcphone:storage:capturePhoto` | `source` | `table` | Capture and upload a photo. |
| `gcphone:wavechat:getStatusMediaConfig` | `source` | `table` | Get media config for WaveChat statuses. |

## Music

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:music:searchCatalog` | `source, data: table` | `table[]` | Search the music catalog. |
| `gcphone:music:searchITunes` | `source, data: table` | `table[]` | Search iTunes for tracks. |
| `gcphone:music:canSearchCatalog` | -- | `boolean` | Check if catalog search is available. |

## Location Tracking

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:liveLocation:start` | `source, data: table` | `table` | Start sharing live location. |
| `gcphone:liveLocation:stop` | `source` | `boolean` | Stop sharing live location. |
| `gcphone:liveLocation:getActive` | `source` | `table[]` | Get active live location shares. |

## Garage

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:garage:getVehicles` | `source` | `table[]` | Get all vehicles for the player. |
| `gcphone:garage:getVehicle` | `source, plate: string` | `table` | Get a specific vehicle by plate. |
| `gcphone:garage:updateLocation` | `source, data: table` | `boolean` | Update vehicle location. |
| `gcphone:garage:getLocationHistory` | `source, plate: string` | `table[]` | Get location history for a vehicle. |
| `gcphone:garage:requestVehicle` | `source, plate: string` | `boolean` | Request vehicle spawn at nearest garage. |
| `gcphone:garage:getImpoundLocation` | `source` | `GaragePoint\|nil` | Get the nearest impound location. |
| `gcphone:garage:shareLocation` | `source, data: table` | `boolean` | Share vehicle location with a contact. |
| `gcphone:garage:storeVehicle` | `source, data: table` | `boolean` | Return a vehicle to the garage. |
| `gcphone:garage:getStats` | `source, plate: string` | `table` | Get vehicle statistics. |

## External / Misc

| Callback | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `gcphone:wavechat:searchGifs` | `source, data: table` | `table[]` | Search for GIFs (Tenor/Giphy). |
| `gcphone:socket:getToken` | `source, data: table` | `table` | Get a WebSocket authentication token. |
| `gcphone:livekit:getToken` | `source, data: table` | `table` | Get a LiveKit room token for voice/video. |
