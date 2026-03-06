-- Variáveis de estado da câmera
cameraOpen = false
isSelfieMode = false
isVideoMode = false
isHudHidden = false
recordingPeerId = nil
cameraTypes = {
    selfies = "selfie",
    screenshots = "screenshot",
    imports = "import"
}

-- Função para ativar/desativar a câmera do telefone
function TogglePhoneCamera()
    CreateMobilePhone(0)
    CellCamActivate(true, true)
    Citizen.InvokeNative(0x2635073306796480568, isSelfieMode) -- Native para configuração de câmera

    -- Limpa objetos de telefone próximos após 500ms
    SetTimeout(500, function()
        local phoneObjects = GetGamePool("CObject")
        local playerCoords = GetEntityCoords(PlayerPedId())

        for _, object in ipairs(phoneObjects) do
            local objCoords = GetEntityCoords(object)
            if #(playerCoords - objCoords) < 4.0 and GetEntityModel(object) == 413312110 then
                SetEntityAsMissionEntity(object, true, true)
                DeleteObject(object)
            end
        end
    end)

    -- Mantém a câmera ativa enquanto necessário
    while phoneOpen and cameraOpen and not IsWalkingCamEnabled() do
        Wait(250)
        InvalidateIdleCam()
        InvalidateVehicleIdleCam()
    end

    DestroyMobilePhone()

    -- Se a câmera estava aberta mas o telefone foi fechado, reativa quando o telefone reabrir
    if cameraOpen and not IsWalkingCamEnabled() then
        while not phoneOpen do
            Wait(500)
        end
        TogglePhoneCamera()
    end
end

-- Mostra dicas de controles da câmera
function ShowCameraControlsTip()
    if isHudHidden or not Config.Camera or not Config.Camera.ShowTip then
        return
    end

    local tips = {}

    -- Adiciona dicas para cada controle configurado
    if Config.KeyBinds.TakePhoto and Config.KeyBinds.TakePhoto.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.TAKE_PHOTO", {
            key = Config.KeyBinds.TakePhoto.bindData.instructional
        })
    end

    if Config.KeyBinds.FlipCamera and Config.KeyBinds.FlipCamera.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.FLIP_CAMERA", {
            key = Config.KeyBinds.FlipCamera.bindData.instructional
        })
    end

    if Config.KeyBinds.ToggleFlash and Config.KeyBinds.ToggleFlash.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.TOGGLE_FLASH", {
            key = Config.KeyBinds.ToggleFlash.bindData.instructional
        })
    end

    -- Dica combinada para modos esquerdo/direito
    if Config.KeyBinds.LeftMode and Config.KeyBinds.LeftMode.Command and
        Config.KeyBinds.RightMode and Config.KeyBinds.RightMode.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.CHANGE_MODE", {
            key = Config.KeyBinds.LeftMode.bindData.instructional,
            key2 = Config.KeyBinds.RightMode.bindData.instructional
        })
    end

    -- Dica combinada para rotação
    if Config.KeyBinds.RollLeft and Config.KeyBinds.RollLeft.Command and
        Config.KeyBinds.RollRight and Config.KeyBinds.RollRight.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.ROLL", {
            key = Config.KeyBinds.RollLeft.bindData.instructional,
            key2 = Config.KeyBinds.RollRight.bindData.instructional
        })
    end

    -- Dica para congelar câmera
    if Config.Camera and Config.Camera.Freeze and Config.Camera.Freeze.Enabled and
        Config.KeyBinds.FreezeCamera and Config.KeyBinds.FreezeCamera.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.FREEZE", {
            key = Config.KeyBinds.FreezeCamera.bindData.instructional
        })
    end

    -- Dica para alternar foco
    if Config.KeyBinds.Focus and Config.KeyBinds.Focus.Command then
        tips[#tips + 1] = L("BACKEND.CAMERA.TOGGLE_CURSOR", {
            key = Config.KeyBinds.Focus.bindData.instructional
        })
    end

    -- Exibe as dicas se houver alguma
    if #tips > 0 then
        local tipText = table.concat(tips, "\n")
        AddTextEntry("CAMERA_TIP2", tipText)
        BeginTextCommandDisplayHelp("CAMERA_TIP2")
        EndTextCommandDisplayHelp(0, true, true, 0)
    end
end

-- Processa filtros para a galeria
function ProcessGalleryFilters(filter)
    if not filter then
        filter = {}
    end

    -- Trata álbuns especiais
    if filter.album == "recents" then
        filter.album = nil
    elseif filter.album == "favourites" then
        filter.album = nil
        filter.favourites = true
    end

    -- Trata tipos especiais
    if filter.type == "videos" then
        filter = {
            showPhotos = false,
            showVideos = true
        }
    elseif filter.type then
        filter.album = nil
        if cameraTypes[filter.type] then
            filter.type = cameraTypes[filter.type]
        else
            filter.type = nil
            filter.duplicates = true
        end
    end

    -- Garante que pelo menos fotos ou vídeos serão mostrados
    if not filter.showPhotos and not filter.showVideos then
        filter.showPhotos = true
        filter.showVideos = true
    end

    return filter
end

-- Obtém método de upload configurado
function GetUploadMethod(uploadType)
    local uploadMethod

    -- Permite método de upload customizado
    if CustomGetUploadMethod then
        uploadMethod = CustomGetUploadMethod(uploadType)
    else
        local methodConfig = UploadMethods[Config.UploadMethod[uploadType]]
        if not methodConfig then
            infoprint("error", "Upload methods not found for " .. uploadType)
            return nil
        end

        uploadMethod = methodConfig[uploadType] or methodConfig.Default
        if not uploadMethod then
            infoprint("error", "Upload method not found for " .. uploadType)
            return nil
        end
    end

    -- Define método padrão se não especificado
    if not uploadMethod.method then
        uploadMethod.method = Config.UploadMethod[uploadType]
    end

    -- Adiciona informações do jogador se necessário
    if uploadMethod.sendPlayer and not uploadMethod.player then
        uploadMethod.player = {
            identifier = GetIdentifier(),
            name = GetPlayerName(PlayerId())
        }
    end

    -- Substitui placeholders na URL
    if uploadMethod.url:find("BASE_URL") then
        if not baseUploadUrl then
            baseUploadUrl = AwaitCallback("camera:getBaseUrl")
        end
        uploadMethod.url = uploadMethod.url:gsub("BASE_URL", baseUploadUrl)
    end

    -- Verifica e substitui chaves API
    local hasApiKey = uploadMethod.url:find("API_KEY")
    if not hasApiKey and uploadMethod.headers then
        for _, header in pairs(uploadMethod.headers) do
            if header:find("API_KEY") then
                hasApiKey = true
                break
            end
        end
    end

    if hasApiKey then
        local apiKey = AwaitCallback("camera:getUploadApiKey", uploadType)
        uploadMethod.url = uploadMethod.url:gsub("API_KEY", apiKey)

        if uploadMethod.headers then
            for key, header in pairs(uploadMethod.headers) do
                uploadMethod.headers[key] = header:gsub("API_KEY", apiKey)
            end
        end
    end

    -- Trata URLs pré-assinadas
    if uploadMethod.url:find("PRESIGNED_URL") then
        local presignedUrl = AwaitCallback("camera:getPresignedUrl", uploadType)
        if not presignedUrl then
            infoprint("error", "Failed to get presigned url for " .. uploadType)
            return nil
        end
        uploadMethod.presignedUrl = uploadMethod.url:gsub("PRESIGNED_URL", presignedUrl)
    end

    return uploadMethod
end

-- Callback para ações da câmera
RegisterNUICallback("Camera", function(data, callback)
    if not currentPhone then return end
    if not data then return debugprint("Camera data is nil") end

    local action = data.action
    debugprint("Camera:" .. (action or ""))

    if action == "open" then
        callback("ok")
        cameraOpen = true
        ShowCameraControlsTip()

        if Config.Camera and Config.Camera.Enabled then
            EnableWalkableCam()
        else
            TogglePhoneCamera()
        end
    elseif action == "saveToGallery" then
        TriggerCallback("camera:saveToGallery", callback,
            data.link,
            data.size,
            data.isVideo and true or false,
            data.type,
            data.shouldLog)
    elseif action == "deleteFromGallery" then
        if type(data.ids) ~= "table" then
            data.ids = { data.ids }
        end
        TriggerCallback("camera:deleteFromGallery", callback, data.ids)
    elseif action == "getLastImage" then
        TriggerCallback("camera:getLastImage", callback)
    elseif action == "getImages" then
        local filter = ProcessGalleryFilters(data.filter or {})
        local images = AwaitCallback("camera:getImages", filter, data.page or 0)

        local formattedImages = {}
        for i, image in ipairs(images) do
            formattedImages[i] = {
                id = image.id,
                src = image.link,
                isVideo = image.is_video,
                type = image.metadata,
                favourite = image.is_favourite,
                timestamp = image.timestamp,
                size = image.size or 0
            }
        end
        callback(formattedImages)
    elseif action == "getAlbums" then
        TriggerCallback("camera:getHomePageData", callback)
    elseif action == "createAlbum" then
        TriggerCallback("camera:createAlbum", callback, data.title)
    elseif action == "renameAlbum" then
        TriggerCallback("camera:renameAlbum", callback, data.id, data.title)
    elseif action == "addToAlbum" then
        TriggerCallback("camera:addToAlbum", callback, data.album, data.ids)
    elseif action == "removeFromAlbum" then
        TriggerCallback("camera:removeFromAlbum", callback, data.album, data.ids)
    elseif action == "deleteAlbum" then
        TriggerCallback("camera:deleteAlbum", callback, data.id)
    elseif action == "removeMemberFromAlbum" then
        TriggerCallback("camera:removeMemberFromAlbum", callback, data.number, data.album)
    elseif action == "leaveSharedAlbum" then
        TriggerCallback("camera:leaveSharedAlbum", callback, data.id)
    elseif action == "getAlbumMembers" then
        TriggerCallback("camera:getAlbumMembers", callback, data.id)
    elseif action == "toggleFavourites" then
        TriggerCallback("camera:toggleFavourites", callback, data.favourite, data.ids)
    elseif action == "toggleVideo" then
        if isVideoMode == data.toggled then
            return callback("ok")
        end

        isVideoMode = data.toggled
        callback("ok")
        cameraOpen = true
        SendReactMessage("camera:toggleMicrophone", IsTalking())

        if not isVideoMode and Config.Camera and Config.Camera.Enabled then
            EnableWalkableCam(isSelfieMode)
        else
            DisableWalkableCam()
            TogglePhoneCamera()
        end
    elseif action == "toggleHud" then
        isHudHidden = not data.toggled
        TriggerEvent("lb-phone:toggleHud", isHudHidden)

        SetTimeout(100, function()
            callback(true)
        end)

        while isHudHidden do
            Wait(0)
            HideHudComponents()
        end
    elseif action == "getUploadApi" then
        callback(GetUploadMethod(data.uploadType) or false)
    elseif action == "toggleLandscape" then
        local phoneObject = GetPhoneObject()
        local playerPed = PlayerPedId()

        if not DoesEntityExist(phoneObject) then
            return
        end

        if data.toggled then
            AttachEntityToEntity(
                phoneObject, playerPed,
                GetPedBoneIndex(playerPed, 28422),
                -0.03, -0.005, -0.02,
                0.0, 90.0, 180.0,
                false, false, false, false, 2, true
            )
        else
            AttachEntityToEntity(
                phoneObject, playerPed,
                GetPedBoneIndex(playerPed, 28422),
                0.0, -0.005, 0.0,
                0.0, 0.0, 180.0,
                false, false, false, false, 2, true
            )
        end
        callback("ok")
    elseif action == "flipCamera" then
        data.value = data.value == true
        if isSelfieMode == data.value then
            return callback("ok")
        end

        isSelfieMode = data.value
        if IsWalkingCamEnabled() then
            ToggleSelfieCam(isSelfieMode)
        else
            Citizen.InvokeNative(0x2635073306796480568, isSelfieMode)
        end
        callback("ok")
    elseif action == "setQuickZoom" then
        if IsWalkingCamEnabled() then
            SetCameraZoom(data.value)
        end
        callback(true)
    elseif action == "setRecordingPeerId" then
        TriggerServerEvent("phone:camera:setPeer", data.peerId)
        recordingPeerId = data.peerId
        callback("ok")
    elseif action == "endedRecording" and recordingPeerId then
        TriggerServerEvent("phone:camera:endedRecording", recordingPeerId)
        recordingPeerId = nil
        callback("ok")
    elseif action == "close" then
        cameraOpen = false
        isVideoMode = false
        isSelfieMode = false
        ClearAllHelpMessages()
        ClearHelp(true)
        DisableWalkableCam()
        callback("ok")
    end
end)

-- Export para salvar na galeria
exports("SaveToGallery", function(link)
    assert(type(link) == "string", "Expected string for link, got " .. type(link))
    SendReactMessage("saveMedia", link)
end)

-- Eventos para gerenciamento de álbuns compartilhados
RegisterNetEvent("phone:photos:addMemberToAlbum", function(albumId, phoneNumber)
    SendReactMessage("photos:addMemberToAlbum", {
        albumId = albumId,
        phoneNumber = phoneNumber
    })
end)

RegisterNetEvent("phone:photos:removeMemberFromAlbum", function(albumId, phoneNumber)
    SendReactMessage("photos:removeMemberFromAlbum", {
        albumId = albumId,
        phoneNumber = phoneNumber
    })
end)

RegisterNetEvent("phone:photos:addSharedAlbum", function(albumData)
    SendReactMessage("photos:addSharedAlbum", albumData)
end)

RegisterNetEvent("phone:photos:updateAlbum", function(albumData)
    debugprint("phone:photos:updateAlbum", albumData)
    SendReactMessage("photos:updateAlbum", albumData)
end)
