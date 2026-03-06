-- Função para salvar gravação de memo
BaseCallback("voiceMemo:saveRecording", function(A0_2, phoneNumber, memoData)
    -- Variáveis externas
    local file_src = memoData.src
    local file_duration = memoData.duration
    local file_title = memoData.title or "Unknown"

    -- Verificação de existência de 'src' e 'duration'
    if not file_src or not file_duration then
        debugprint("VoiceMemo: no src/duration, not saving")
        return
    end

    -- Salvando no banco de dados
    local query =
    "INSERT INTO phone_voice_memos_recordings (phone_number, file_name, file_url, file_length) VALUES (?, ?, ?, ?)"
    local values = { phoneNumber, file_title, file_src, file_duration }

    return MySQL.insert.await(query, values)
end)

-- Função para obter todos os memos de voz
BaseCallback("voiceMemo:getMemos", function(A0_2, phoneNumber)
    -- Consultando os dados no banco
    local query =
    "SELECT id, file_name AS `title`, file_url AS `src`, file_length AS `duration`, created_at AS `timestamp` FROM phone_voice_memos_recordings WHERE phone_number = ? ORDER BY created_at DESC"
    local values = { phoneNumber }

    return MySQL.query.await(query, values)
end)

-- Função para deletar um memo de voz
BaseCallback("voiceMemo:deleteMemo", function(A0_2, phoneNumber, memoId)
    -- Deletando o memo de voz no banco
    local query = "DELETE FROM phone_voice_memos_recordings WHERE id = ? AND phone_number = ?"
    local values = { memoId, phoneNumber }

    local result = MySQL.update.await(query, values)
    return result > 0
end)

-- Função para renomear um memo de voz
BaseCallback("voiceMemo:renameMemo", function(A0_2, phoneNumber, memoId, newTitle)
    local query = "UPDATE phone_voice_memos_recordings SET file_name = ? WHERE id = ? AND phone_number = ?"
    local values = { newTitle, memoId, phoneNumber }

    local result = MySQL.update.await(query, values)
    return result > 0
end)
