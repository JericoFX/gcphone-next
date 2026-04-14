-- Pure server→NUI event forwarders.
-- Extraído de client/nui_bridge.lua (OPT-04).

RegisterNetEvent('gcphone:contactsUpdated', function(contacts)
    SendNUIMessage({
        action = 'contactsUpdated',
        data = contacts or {}
    })
end)

RegisterNetEvent('gcphone:messageSent', function(message)
    SendNUIMessage({
        action = 'messageSent',
        data = message
    })
end)

RegisterNetEvent('gcphone:messageReceived', function(message)
    SendNUIMessage({
        action = 'messageReceived',
        data = message
    })
end)

RegisterNetEvent('gcphone:wallpaperUpdated', function(url)
    SendNUIMessage({
        action = 'phone:show',
        data = {
            wallpaper = url
        }
    })
end)

RegisterNetEvent('gcphone:bankTransferReceived', function(payload)
    SendNUIMessage({
        action = 'bankTransferReceived',
        data = payload
    })

    SendNUIMessage({
        action = 'bankInvoiceReceived',
        data = payload
    })
end)

RegisterNetEvent('gcphone:snap:newPost', function(post)
    SendNUIMessage({
        action = 'gcphone:snap:newPost',
        data = post
    })
end)

RegisterNetEvent('gcphone:snap:newStory', function(story)
    SendNUIMessage({
        action = 'gcphone:snap:newStory',
        data = story
    })
end)

RegisterNetEvent('gcphone:snap:liveStarted', function(live)
    SendNUIMessage({
        action = 'gcphone:snap:liveStarted',
        data = live
    })
end)

RegisterNetEvent('gcphone:snap:liveEnded', function(liveId)
    SendNUIMessage({
        action = 'gcphone:snap:liveEnded',
        data = liveId
    })
end)

RegisterNetEvent('gcphone:snap:liveViewersUpdated', function(payload)
    SendNUIMessage({
        action = 'gcphone:snap:liveViewersUpdated',
        data = payload
    })
end)

RegisterNetEvent('gcphone:snap:liveMessage', function(payload)
    SendNUIMessage({
        action = 'gcphone:snap:liveMessage',
        data = payload
    })
end)

RegisterNetEvent('gcphone:snap:liveReaction', function(payload)
    SendNUIMessage({
        action = 'gcphone:snap:liveReaction',
        data = payload
    })
end)

RegisterNetEvent('gcphone:snap:liveMessageRemoved', function(payload)
    SendNUIMessage({
        action = 'gcphone:snap:liveMessageRemoved',
        data = payload
    })
end)

RegisterNetEvent('gcphone:snap:liveUserMuted', function(payload)
    SendNUIMessage({
        action = 'gcphone:snap:liveUserMuted',
        data = payload
    })
end)

RegisterNetEvent('gcphone:news:newArticle', function(article)
    SendNUIMessage({
        action = 'gcphone:news:newArticle',
        data = article
    })
end)

RegisterNetEvent('gcphone:news:liveStarted', function(article)
    SendNUIMessage({
        action = 'gcphone:news:liveStarted',
        data = article
    })
end)

RegisterNetEvent('gcphone:news:liveEnded', function(articleId)
    SendNUIMessage({
        action = 'gcphone:news:liveEnded',
        data = articleId
    })
end)

RegisterNetEvent('gcphone:news:scaleformUpdated', function(articleId, scaleform)
    SendNUIMessage({
        action = 'gcphone:news:scaleformUpdated',
        data = {
            articleId = articleId,
            scaleform = scaleform
        }
    })
end)

RegisterNetEvent('gcphone:news:viewersUpdated', function(payload)
    SendNUIMessage({
        action = 'gcphone:news:viewersUpdated',
        data = payload
    })
end)

RegisterNetEvent('gcphone:news:liveMessage', function(payload)
    SendNUIMessage({
        action = 'gcphone:news:liveMessage',
        data = payload
    })
end)

RegisterNetEvent('gcphone:news:liveReaction', function(payload)
    SendNUIMessage({
        action = 'gcphone:news:liveReaction',
        data = payload
    })
end)

RegisterNetEvent('gcphone:news:liveMessageRemoved', function(payload)
    SendNUIMessage({
        action = 'gcphone:news:liveMessageRemoved',
        data = payload
    })
end)

RegisterNetEvent('gcphone:news:liveUserMuted', function(payload)
    SendNUIMessage({
        action = 'gcphone:news:liveUserMuted',
        data = payload
    })
end)

return {}
