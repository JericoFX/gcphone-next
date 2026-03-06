local cursorX = 0.5
local cursorY = 0.5
local scrollAmount = 0.005
local isKeyboardActive = false

local function isUsingController()
  -- Retorna true se NÃO estiver usando teclado (ou seja, está usando controle)
  return not IsUsingKeyboard(0)
end

local function getControlInput(control)
  local input = GetDisabledControlNormal(0, control)
  if input < -0.1 or input > 0.1 then
    return input
  end
  return 0.0
end

local function processInputToggle(data)
  if not isUsingController() then return end
  isKeyboardActive = (data == true)
  if not data then
    Wait(250)
    if isKeyboardActive then
      return
    end
  end
  SendReactMessage("controller:toggleKeyboard", isKeyboardActive)
end
RegisterNUICallback("toggleInput", processInputToggle)

local function handleControllerInput()
  local inputX = getControlInput(1)
  local inputY = getControlInput(2)
  local scrollInput = getControlInput(31)

  cursorX = cursorX + (inputX * scrollAmount)
  cursorY = cursorY + (inputY * scrollAmount)

  -- Clamp cursor positions para [0, 1]
  cursorX = math.min(0.99999, math.max(0, cursorX))
  cursorY = math.min(1.0, math.max(0, cursorY))

  if IsDisabledControlJustPressed(0, 18) then -- Botão A, por exemplo
    SendReactMessage("controller:press", { x = cursorX, y = cursorY })
  elseif IsDisabledControlJustReleased(0, 18) then
    SendReactMessage("controller:release", { x = cursorX, y = cursorY })
  elseif IsDisabledControlJustReleased(0, 199) or IsDisabledControlJustReleased(0, 177) then
    ToggleOpen(false)
  end

  if inputX ~= 0.0 or inputY ~= 0.0 then
    SetCursorLocation(cursorX, cursorY)
  end

  if scrollInput ~= 0.0 then
    SendReactMessage("controller:scroll", { amount = math.floor(scrollInput * 25), x = cursorX, y = cursorY })
  end

  DisableAllControlActions(0)
  DisableAllControlActions(1)
  DisableAllControlActions(2)
  InvalidateIdleCam()
end

local function ControllerThread()
  while phoneOpen do
    Wait(0)
    if isUsingController() and IsNuiFocused() then
      handleControllerInput()
    else
      Wait(500)
    end
  end

  -- Reset cursor ao fechar telefone
  cursorX = 0.5
  cursorY = 0.5
  if isUsingController() then
    SetCursorLocation(cursorX, cursorY)
  end
end

ControllerThread = ControllerThread
