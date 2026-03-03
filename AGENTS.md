# GCPhone Next - Agent Instructions

## Build Rules

**MANDATORY**: After modifying any file in `web/src/`, you MUST run the build command:

```bash
cd web && npm run build
```

This ensures the NUI is updated for FiveM to load the latest changes.

## Project Structure

- `web/` - SolidJS frontend (NUI)
- `client/` - FiveM client-side Lua
- `server/` - FiveM server-side Lua
- `shared/` - Shared Lua modules

## Tech Stack

- Frontend: SolidJS + TypeScript + Vite
- Backend: FiveM (Lua)
- Audio: xSound API (3D positional audio)
