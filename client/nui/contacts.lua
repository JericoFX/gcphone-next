local Nui = require 'client.nui_helpers'
local cbSuccess = Nui.cbSuccess

Nui.proxy('getContacts', 'gcphone:getContacts', {}, false)

RegisterNUICallback('addContact', function(data, cb)
    lib.callback('gcphone:addContact', false, function(success, value)
        if success then
            cb(cbSuccess(true, nil, { id = value }))
            return
        end

        cb(cbSuccess(false, value))
    end, data)
end)

Nui.proxySuccess('updateContact', 'gcphone:updateContact')

Nui.proxySuccess('deleteContact', 'gcphone:deleteContact', function(data)
    return data and tonumber(data.id) or nil
end)

Nui.proxySuccess('toggleFavorite', 'gcphone:toggleFavorite', function(data)
    return data and tonumber(data.id) or nil
end)

return {}
