local Nui = require 'client.nui_helpers'
local cbSuccess = Nui.cbSuccess

RegisterNUICallback('getBankBalance', function(_, cb)
    lib.callback('gcphone:getBankBalance', false, function(balance)
        cb(balance or 0)
    end)
end)

RegisterNUICallback('getBankTransactions', function(_, cb)
    lib.callback('gcphone:getBankTransactions', false, function(transactions)
        cb(transactions or {})
    end)
end)

RegisterNUICallback('getContactsForTransfer', function(_, cb)
    lib.callback('gcphone:getContactsForTransfer', false, function(contacts)
        cb(contacts or {})
    end)
end)

RegisterNUICallback('transferMoney', function(data, cb)
    lib.callback('gcphone:transferMoney', false, function(success, message)
        cb(cbSuccess(success, message))
    end, data)
end)

Nui.proxy('walletGetState', 'gcphone:wallet:getState', { balance = 0, cards = {}, transactions = {} }, false)
Nui.proxy('walletTransfer', 'gcphone:wallet:transfer', { success = false }, function(data) return data or {} end)
Nui.proxy('walletChatTransfer', 'gcphone:wallet:chatTransfer', { success = false }, function(data) return data or {} end)
Nui.proxy('walletSplitPayment', 'gcphone:wallet:splitPayment', { success = false }, function(data) return data or {} end)
Nui.proxy('walletProximityTransfer', 'gcphone:wallet:proximityTransfer', { success = false }, function(data) return data or {} end)
Nui.proxy('walletCreateRequest', 'gcphone:wallet:createRequest', { success = false }, function(data) return data or {} end)
Nui.proxy('walletGetPendingRequests', 'gcphone:wallet:getPendingRequests', { incoming = {}, outgoing = {} }, false)
Nui.proxy('walletRespondRequest', 'gcphone:wallet:respondRequest', { success = false }, function(data) return data or {} end)
Nui.proxy('walletAddCard', 'gcphone:wallet:addCard', { success = false }, function(data) return data or {} end)
Nui.proxy('walletRemoveCard', 'gcphone:wallet:removeCard', { success = false }, function(data) return data or {} end)
Nui.proxy('walletCreateNfcInvoice', 'gcphone:wallet:createNfcInvoice', { success = false }, function(data) return data or {} end)
Nui.proxy('walletCreateInvoice', 'gcphone:wallet:createInvoice', { success = false }, function(data) return data or {} end)
Nui.proxy('walletRespondNfcInvoice', 'gcphone:wallet:respondNfcInvoice', { success = false }, function(data) return data or {} end)
Nui.proxy('walletRespondInvoice', 'gcphone:wallet:respondInvoice', { success = false }, function(data) return data or {} end)

return {}
