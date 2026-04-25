local Nui = require 'client.nui_helpers'

Nui.proxy('notificationsGet', 'gcphone:notifications:get', { success = false, notifications = {}, unread = 0 }, function(data) return data or {} end)
Nui.proxySuccess('notificationsMarkRead', 'gcphone:notifications:markRead', function(data) return data or {} end)
Nui.proxySuccess('notificationsMarkAllRead', 'gcphone:notifications:markAllRead', false)
Nui.proxySuccess('notificationsDelete', 'gcphone:notifications:delete', function(data) return data or {} end)

return {}
