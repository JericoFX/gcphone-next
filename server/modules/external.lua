local function SanitizeQuery(value, maxLength)
    if type(value) ~= 'string' then return '' end
    local text = value:gsub('[%c]', '')
    text = text:gsub('[<>"`]', '')
    text = text:gsub("'", '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    return text:sub(1, maxLength or 80)
end

local LastSearchBySource = {}

local function UrlEncode(str)
    return (str:gsub('([^%w%-_%.~])', function(c)
        return string.format('%%%02X', string.byte(c))
    end))
end

local function CanSearch(source)
    local now = GetGameTimer()
    local last = LastSearchBySource[source] or 0
    if (now - last) < 350 then
        return false
    end
    LastSearchBySource[source] = now
    return true
end

local function IsSafeBaseUrl(url)
    if type(url) ~= 'string' then return false end
    local normalized = url:lower()
    if normalized:sub(1, 8) ~= 'https://' then return false end
    if normalized:find('localhost', 1, true) then return false end
    if normalized:find('127.0.0.1', 1, true) then return false end
    if normalized:find('0.0.0.0', 1, true) then return false end
    return true
end

local function HttpGetJson(url)
    local p = promise.new()
    PerformHttpRequest(url, function(statusCode, body)
        if statusCode < 200 or statusCode >= 300 or type(body) ~= 'string' or body == '' then
            p:resolve(nil)
            return
        end

        local ok, payload = pcall(function()
            return json.decode(body)
        end)

        p:resolve(ok and payload or nil)
    end, 'GET', '', {
        ['Content-Type'] = 'application/json'
    })

    return Citizen.Await(p)
end

lib.callback.register('gcphone:music:searchCatalog', function(source, data)
    if not CanSearch(source) then return {} end
    local query = type(data) == 'table' and SanitizeQuery(data.query or '', 80) or ''
    if query == '' then return {} end
    if not (Config.APIs and Config.APIs.Piped and Config.APIs.Piped.Enabled) then return {} end

    local baseUrl = tostring((Config.APIs.Piped.BaseUrl or 'https://piped.video'))
    if not IsSafeBaseUrl(baseUrl) then return {} end
    local url = ('%s/api/v1/search?q=%s&filter=music_songs'):format(baseUrl, UrlEncode(query))
    local payload = HttpGetJson(url)
    if type(payload) ~= 'table' then return {} end

    local out = {}
    local count = 0
    for i = 1, #payload do
        local item = payload[i]
        if type(item) == 'table' and item.id and item.title then
            count = count + 1
            out[count] = {
                id = tostring(item.id):sub(1, 64),
                title = SanitizeQuery(tostring(item.title or ''), 80),
                artist = SanitizeQuery(tostring(item.uploaderName or item.author or 'Desconocido'), 40),
                thumbnail = tostring(item.thumbnail or ('https://i.ytimg.com/vi/' .. tostring(item.id) .. '/mqdefault.jpg')),
                duration = tonumber(item.duration) or 0,
            }
            if count >= 12 then break end
        end
    end

    return out
end)

lib.callback.register('gcphone:wavechat:searchGifs', function(source, data)
    if not CanSearch(source) then return {} end
    local query = type(data) == 'table' and SanitizeQuery(data.query or '', 80) or ''
    if query == '' then return {} end
    if not (Config.APIs and Config.APIs.Tenor and Config.APIs.Tenor.Enabled) then return {} end

    local apiKey = tostring(GetConvar('gcphone_tenor_api_key', tostring((Config.APIs.Tenor.APIKey or ''))))
    if apiKey == '' then return {} end

    local url = ('https://tenor.googleapis.com/v2/search?q=%s&key=%s&limit=18&media_filter=gif')
        :format(UrlEncode(query), UrlEncode(apiKey))

    local payload = HttpGetJson(url)
    if type(payload) ~= 'table' or type(payload.results) ~= 'table' then return {} end

    local out = {}
    local count = 0
    for i = 1, #payload.results do
        local item = payload.results[i]
        local gif = item and item.media_formats and item.media_formats.gif
        if type(item) == 'table' and item.id and type(gif) == 'table' and gif.url then
            count = count + 1
            out[count] = {
                id = tostring(item.id):sub(1, 64),
                url = tostring(gif.url):sub(1, 500),
            }
            if count >= 18 then break end
        end
    end

    return out
end)

AddEventHandler('playerDropped', function()
    LastSearchBySource[source] = nil
end)
