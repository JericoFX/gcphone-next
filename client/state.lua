---@class GCPhoneClientState
---@field isOpen boolean
---@field phoneNumber string|nil
---@field hasFocus boolean
---@field useMouse boolean
---@field airplaneMode boolean
local State = {
    isOpen = false,
    phoneNumber = nil,
    hasFocus = false,
    useMouse = false,
    airplaneMode = false,
}

return State
