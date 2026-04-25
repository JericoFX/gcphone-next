local Nui = require 'client.nui_helpers'

Nui.proxySuccess('setWallpaper', 'gcphone:setWallpaper')
Nui.proxySuccess('setRingtone', 'gcphone:setRingtone')
Nui.proxySuccess('setCallRingtone', 'gcphone:setCallRingtone')
Nui.proxySuccess('setNotificationTone', 'gcphone:setNotificationTone')
Nui.proxySuccess('setMessageTone', 'gcphone:setMessageTone')
Nui.proxySuccess('setVolume', 'gcphone:setVolume')
Nui.proxySuccess('setTheme', 'gcphone:setTheme')
Nui.proxySuccess('setLanguage', 'gcphone:setLanguage')
Nui.proxySuccess('setAudioProfile', 'gcphone:setAudioProfile')
Nui.proxySuccess('setStreamerMode', 'gcphone:setStreamerMode')
Nui.proxySuccess('setLockCode', 'gcphone:setLockCode')

Nui.proxy('factoryResetPhone', 'gcphone:factoryResetPhone', { success = false }, false)

return {}
