local Nui = require 'client.nui_helpers'

Nui.proxy('phoneGetSetupState', 'gcphone:phone:getSetupState', { success = false, error = 'NO_RESPONSE', requiresSetup = true }, false)
Nui.proxy('phoneCompleteSetup', 'gcphone:phone:completeSetup', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('phoneVerifyPin', 'gcphone:phone:verifyPin', { success = false, unlocked = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)
Nui.proxy('phoneReportImeiViewed', 'gcphone:phone:reportImeiViewed', { success = false, error = 'NO_RESPONSE' }, function(data) return data or {} end)

return {}
