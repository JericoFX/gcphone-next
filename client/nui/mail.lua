local Nui = require 'client.nui_helpers'

Nui.proxy('mailGetState', 'gcphone:mail:getState', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('mailCreateAccount', 'gcphone:mail:createAccount', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('mailSend', 'gcphone:mail:send', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('mailGetMessages', 'gcphone:mail:getMessages', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('mailMarkRead', 'gcphone:mail:markRead', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('mailDelete', 'gcphone:mail:delete', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)

return {}
