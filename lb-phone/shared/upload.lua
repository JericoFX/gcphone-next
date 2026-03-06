-----------------------------------------------------------------------------------------------------------------------------------
--                                       ONLY EDIT THIS FILE IF YOU KNOW WHAT YOU ARE DOING                                      --
--                                         WE WILL NOT HELP YOU, OR ANSWER ANY QUESTIONS                                         --
-----------------------------------------------------------------------------------------------------------------------------------

---@class UploadMethod
---@field url string # The url to upload to. Can use BASE_URL & PRESIGNED_URL as well.
---@field field string # The field name (formData)
---@field headers? table<string, any>
---@field error? { path: string, value: any } # The path to the error value and the value to check for
---@field success { path: string } # The path to the video file
---@field suffix? string # Add a suffix to the url? Needed if the url doesn't return the correct file name
---@field sendPlayer? string # The formData field name to send player's metadata to, as json
---@field sendResource? boolean # Send the resource name in the formData?

---@type table<string, { Default: UploadMethod?, Video?: UploadMethod, Image?: UploadMethod, Audio?: UploadMethod }>
UploadMethods = {
    Custom = {
        Video = {
            url = "https://your-custom-url.com/upload?api=API_KEY",
            field = "file", -- The field name (formData)
            headers = {     -- headers to send when uploading
                ["Authorization"] = "Key API_KEY"
            },
            error = {
                path = "success", -- The path to the error value (res.success)
                value = false     -- If the path is equal to this value, it's an error
            },
            success = {
                path = "url" -- The path to the video file (res.url)
            },
            suffix = "webm", -- Add a suffix to the url (not needed if you return the correct name)
        },
        Image = {
            url = "https://your-custom-url.com/upload?api=API_KEY",
            field = "file", -- The field name (formData)
            headers = {     -- headers to send when uploading
                ["Authorization"] = "Key API_KEY"
            },
            error = {
                path = "success", -- The path to the error value (res.success)
                value = false     -- If the path is equal to this value, it's an error
            },
            success = {
                path = "url" -- The path to the image file (res.url)
            },
            suffix = "png",  -- Add a suffix to the url (not needed if you return the correct name)
        },
        Audio = {
            url = "https://your-custom-url.com/upload?api=API_KEY",
            field = "file", -- The field name (formData)
            headers = {     -- headers to send when uploading
                ["Authorization"] = "Key API_KEY"
            },
            error = {
                path = "success", -- The path to the error value (res.success)
                value = false     -- If the path is equal to this value, it's an error
            },
            success = {
                path = "url" -- The path to the audio file (res.url)
            },
            suffix = "mp3",  -- Add a suffix to the url (not needed if you return the correct name)
        },
    },
    Fivemanage = {
        Default = {
            url = "PRESIGNED_URL",
            field = "file",
            success = {
                path = "data.url"
            },
            sendPlayer = "metadata"
        },
    },
    LBUpload = {
        Default = {
            url = "https://BASE_URL/lb-upload/",
            field = "file",
            headers = {
                ["Authorization"] = "API_KEY"
            },
            error = {
                path = "success",
                value = false
            },
            success = {
                path = "link"
            },
            sendPlayer = "metadata"
        },
    },
    OldFivemanage = {
        Video = {
            url = "https://fmapi.net/api/v2/video",
            field = "file",
            headers = {
                ["Authorization"] = "API_KEY"
            },
            success = {
                path = "data.url"
            },
        },
        Image = {
            url = "https://fmapi.net/api/v2/image",
            field = "file",
            headers = {
                ["Authorization"] = "API_KEY"
            },
            success = {
                path = "data.url"
            }
        },
        Audio = {
            url = "https://fmapi.net/api/v2/audio",
            field = "file",
            headers = {
                ["Authorization"] = "API_KEY"
            },
            success = {
                path = "data.url"
            }
        },
    },
}
