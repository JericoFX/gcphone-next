-- Darkrooms callbacks.
-- Extraído de client/nui_bridge.lua (OPT-04).

RegisterNUICallback('darkroomsGetRooms', function(_, cb)
    lib.callback('gcphone:darkrooms:getRooms', false, function(rooms)
        cb(rooms or {})
    end)
end)

RegisterNUICallback('darkroomsCreateRoom', function(data, cb)
    lib.callback('gcphone:darkrooms:createRoom', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsJoinRoom', function(data, cb)
    lib.callback('gcphone:darkrooms:joinRoom', false, function(payload)
        cb(payload or { success = false })
    end, data)
end)

RegisterNUICallback('darkroomsGetPosts', function(data, cb)
    lib.callback('gcphone:darkrooms:getPosts', false, function(posts)
        cb(posts or {})
    end, data or {})
end)

RegisterNUICallback('darkroomsCreatePost', function(data, cb)
    lib.callback('gcphone:darkrooms:createPost', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsVotePost', function(data, cb)
    lib.callback('gcphone:darkrooms:votePost', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

RegisterNUICallback('darkroomsGetComments', function(data, cb)
    lib.callback('gcphone:darkrooms:getComments', false, function(comments)
        cb(comments or {})
    end, data or {})
end)

RegisterNUICallback('darkroomsCreateComment', function(data, cb)
    lib.callback('gcphone:darkrooms:createComment', false, function(payload)
        cb(payload or { success = false })
    end, data or {})
end)

return {}
