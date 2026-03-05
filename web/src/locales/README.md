Locale files live in this folder as JSON to keep translations easy to edit.

File format:

{
  "lang": "es_ES",
  "name": "Español",
  "strings": {
    "settings.title": "Ajustes Pro"
  }
}

How to add a new language:

1. Copy `es_ES.json` to a new file, for example `it_IT.json`.
2. Translate only the values under `strings`.
3. Register the locale in `src/i18n/index.ts`:
   - add import
   - add locale code type
   - add to `LOCALES`
   - add mapping in `LANGUAGE_TO_LOCALE` when needed.

Fallback order:

1. Requested locale key
2. `es_ES` key
3. The key itself
