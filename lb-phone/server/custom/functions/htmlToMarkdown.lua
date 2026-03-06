local patterns = {
    -- Line breaks
    {
        "<[Bb][Rr][^>]-%s*/?%s*>",
        "\n"
    },

    -- Text formatting
    {
        "<[Ss][Tt][Rr][Oo][Nn][Gg][^>]*>(.-)</[Ss][Tt][Rr][Oo][Nn][Gg][^>]*>",
        "**%1**"
    },
    {
        "<[Bb][^>]*>(.-)</[Bb][^>]*>",
        "**%1**"
    },
    {
        "<[Ii][^>]*>(.-)</[Ii][^>]*>",
        "*%1*"
    },
    {
        "<[Ee][Mm][^>]*>(.-)</[Ee][Mm][^>]*>",
        "*%1*"
    },
    {
        "<[Dd][Ee][Ll][^>]*>(.-)</[Dd][Ee][Ll][^>]*>",
        "~~%1~~"
    },
    {
        "<[Ss][^>]*>(.-)</[Ss][^>]*>",
        "~~%1~~"
    },
    {
        "<[Mm][Aa][Rr][Kk][^>]*>(.-)</[Mm][Aa][Rr][Kk][^>]*>",
        "==%1=="
    },
    {
        "<[Cc][Oo][Dd][Ee][^>]*>(.-)</[Cc][Oo][Dd][Ee][^>]*>",
        "`%1`"
    },
    {
        "<[Pp][Rr][Ee][^>]*>(.-)</[Pp][Rr][Ee][^>]*>",
        "```\n%1\n```"
    },

    -- Headings
    {
        "<[Hh]1[^>]*>(.-)</[Hh]1[^>]*>",
        "# %1\n"
    },
    {
        "<[Hh]2[^>]*>(.-)</[Hh]2[^>]*>",
        "## %1\n"
    },
    {
        "<[Hh]3[^>]*>(.-)</[Hh]3[^>]*>",
        "### %1\n"
    },
    {
        "<[Hh]4[^>]*>(.-)</[Hh]4[^>]*>",
        "#### %1\n"
    },
    {
        "<[Hh]5[^>]*>(.-)</[Hh]5[^>]*>",
        "##### %1\n"
    },
    {
        "<[Hh]6[^>]*>(.-)</[Hh]6[^>]*>",
        "###### %1\n"
    },

    -- Lists
    {
        "<[Uu][Ll][^>]*>",
        ""
    },
    {
        "</[Uu][Ll][^>]*>",
        ""
    },
    {
        "<[Oo][Ll][^>]*>",
        "\n"
    },
    {
        "</[Oo][Ll][^>]*>",
        "\n"
    },
    {
        "<[Ll][Ii][^>]*>(.-)</[Ll][Ii][^>]*>",
        "- %1\n"
    },

    -- Links
    {
        '<[Aa][^>]-href%s*=%s*"([^"]-)"[^>]*>(.-)</[Aa][^>]*>',
        "[%2](%1)"
    },
    {
        "<[Aa][^>]-href%s*=%s*'([^']-)'[^>]*>(.-)</[Aa][^>]*>",
        "[%2](%1)"
    },

    -- Images
    {
        '<[Ii][Mm][Gg][^>]-src%s*=%s*"([^"]-)"[^>]-alt%s*=%s*"([^"]-)"[^>]*>',
        "![%2](%1)"
    },
    {
        "<[Ii][Mm][Gg][^>]-src%s*=%s*'([^']-)'[^>]-alt%s*=%s*'([^']-)'[^>]*>",
        "![%2](%1)"
    },
    {
        '<[Ii][Mm][Gg][^>]-src%s*=%s*"([^"]-)"[^>]*>',
        "![](%1)"
    },

    -- Blockquotes
    {
        "<[Bb][Ll][Oo][Cc][Kk][Qq][Uu][Oo][Tt][Ee][^>]*>(.-)</[Bb][Ll][Oo][Cc][Kk][Qq][Uu][Oo][Tt][Ee][^>]*>",
        "> %1\n"
    },

    -- Horizontal rules
    {
        "<[Hh][Rr][^>]*>",
        "\n---\n"
    },

    -- Tables (basic structure)
    {
        "<[Tt][Aa][Bb][Ll][Ee][^>]*>",
        "\n"
    },
    {
        "</[Tt][Aa][Bb][Ll][Ee][^>]*>",
        "\n"
    },
    {
        "<[Tt][Rr][^>]*>",
        ""
    },
    {
        "</[Tt][Rr][^>]*>",
        "|\n"
    },
    {
        "<[Tt][Hh][^>]*>(.-)</[Tt][Hh][^>]*>",
        "| %1 "
    },
    {
        "<[Tt][Dd][^>]*>(.-)</[Tt][Dd][^>]*>",
        "| %1 "
    },

    -- Paragraphs
    {
        "<[Pp][^>]*>",
        "\n\n"
    },
    {
        "</[Pp][^>]*>",
        "\n\n"
    },
}

---@param input string
---@return string
function ConvertHTMLToMarkdown(input)
    local madeChanges = false
    local changes = 0
    local html = input:gsub("\n%s+(<)", "\n%1"):gsub("\n", ""):gsub("\t", "")

    for i = 1, #patterns do
        html, changes = html:gsub(patterns[i][1], patterns[i][2])

        if changes > 0 then
            madeChanges = true
        end
    end

    if madeChanges then
        return html
    else
        return input
    end
end
