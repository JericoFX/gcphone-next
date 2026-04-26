local Nui = require 'client.nui_helpers'

local function dataOrEmpty(data)
    return data or {}
end

RegisterNUICallback('sdkGetAllAppPermissions', function(_, cb)
    lib.callback('gcphone:sdk:getAllAppPermissions', false, function(result)
        cb(result or {})
    end)
end)

RegisterNUICallback('sdkGetBlockedApps', function(_, cb)
    lib.callback('gcphone:sdk:getBlockedApps', false, function(result)
        cb(result or {})
    end)
end)

RegisterNUICallback('sdkSetPermission', function(data, cb)
    data = dataOrEmpty(data)
    lib.callback('gcphone:sdk:setPermission', false, function(success)
        cb(Nui.cbSuccess(success))
    end, data.appId, data.permission, data.granted == true)
end)

RegisterNUICallback('sdkGrantAllPermissions', function(data, cb)
    data = dataOrEmpty(data)
    lib.callback('gcphone:sdk:grantAllPermissions', false, function(success)
        cb(Nui.cbSuccess(success))
    end, data.appId, data.permissions or {})
end)

RegisterNUICallback('sdkDenyAllPermissions', function(data, cb)
    data = dataOrEmpty(data)
    lib.callback('gcphone:sdk:denyAllPermissions', false, function(success)
        cb(Nui.cbSuccess(success))
    end, data.appId, data.permissions or {})
end)

RegisterNUICallback('sdkBlockApp', function(data, cb)
    data = dataOrEmpty(data)
    lib.callback('gcphone:sdk:blockApp', false, function(success)
        cb(Nui.cbSuccess(success))
    end, data.appId)
end)

RegisterNUICallback('sdkUnblockApp', function(data, cb)
    data = dataOrEmpty(data)
    lib.callback('gcphone:sdk:unblockApp', false, function(success)
        cb(Nui.cbSuccess(success))
    end, data.appId)
end)

return {}
