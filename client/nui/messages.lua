local Nui = require 'client.nui_helpers'

Nui.proxy('getMessages', 'gcphone:getMessages', {}, false)

Nui.proxySuccess('sendMessage', 'gcphone:sendMessage')

Nui.proxy('setAutoReply', 'gcphone:setAutoReply', { success = false })

Nui.proxy('getAutoReply', 'gcphone:getAutoReply', { enabled = false, message = '' }, false)

Nui.proxySuccess('deleteMessage', 'gcphone:deleteMessage', function(data)
    return data and tonumber(data.id) or nil
end)

Nui.proxySuccess('deleteConversation', 'gcphone:deleteConversation', function(data)
    return data and data.phoneNumber or nil
end)

Nui.proxySuccess('markAsRead', 'gcphone:markAsRead', function(data)
    return data and data.phoneNumber or nil
end)

Nui.proxySuccess('reactToMessage', 'gcphone:reactToMessage', function(data)
    return data or {}
end)

Nui.proxySuccess('removeReaction', 'gcphone:removeReaction', function(data)
    return data or {}
end)

return {}
