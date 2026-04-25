local Nui = require 'client.nui_helpers'
local cbSuccess = Nui.cbSuccess

RegisterNUICallback('getGallery', function(_, cb)
    lib.callback('gcphone:getGallery', false, function(photos)
        cb(photos or {})
    end)
end)

RegisterNUICallback('galleryGetAlbums', function(_, cb)
    lib.callback('gcphone:gallery:getAlbums', false, function(albums)
        cb(albums or {})
    end)
end)

RegisterNUICallback('galleryCreateAlbum', function(data, cb)
    lib.callback('gcphone:gallery:createAlbum', false, function(success, album)
        cb(cbSuccess(success, nil, album))
    end, data)
end)

RegisterNUICallback('galleryDeleteAlbum', function(data, cb)
    lib.callback('gcphone:gallery:deleteAlbum', false, function(success)
        cb(cbSuccess(success))
    end, data and data.albumId)
end)

RegisterNUICallback('galleryMoveToAlbum', function(data, cb)
    lib.callback('gcphone:gallery:moveToAlbum', false, function(success)
        cb(cbSuccess(success))
    end, data)
end)

RegisterNUICallback('galleryShareNfc', function(data, cb)
    lib.callback('gcphone:gallery:shareNfc', false, function(result)
        cb(result or { success = false })
    end, data)
end)

RegisterNUICallback('openGallery', function(_, cb)
    cb(true)
end)

return {}
