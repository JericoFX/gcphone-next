---
title: Tools & Scripts
---

# Tools & Scripts

gcphone-next includes automation scripts for setting up and managing the LiveKit + Redis stack. All scripts are located in `tools/livekit/`.

## Overview

| Script | Type | Purpose |
|---|---|---|
| `setup-livekit.ps1` | PowerShell | Interactive setup wizard -- configures LiveKit, Redis, Socket.IO, firewall, and auto-start |
| `setup-livekit.bat` | BAT | Convenience wrapper that launches the PowerShell wizard |
| `start-livekit.bat` | BAT | Starts the Docker Compose stack (LiveKit + Redis) |
| `stop-livekit.bat` | BAT | Stops the Docker Compose stack |

---

## setup-livekit.ps1 (PowerShell Wizard)

This is the main configuration script. It walks you through the entire LiveKit setup interactively, generating all necessary config files and printing the `server.cfg` convars you need.

### How to Run

```powershell
# From the resource root
powershell -ExecutionPolicy Bypass -File tools\livekit\setup-livekit.ps1
```

> **About `-ExecutionPolicy Bypass`:** Windows blocks unsigned PowerShell scripts by default. This flag allows the script to run **only for this process** -- it does not change your system-wide policy. If you prefer, you can inspect the `.ps1` file first before running it.

### Step-by-Step Breakdown

The script runs through the following stages in order. Every stage that involves system changes **asks for your confirmation first** -- nothing is forced.

#### 1. Docker Detection

The script checks if Docker Desktop is installed on your system.

- **If Docker is found:** It verifies the daemon is running and Docker Compose is available. If the daemon is not running, it warns you to start Docker Desktop before using `start-livekit.bat`.
- **If Docker is NOT found:** It **asks** if you want to download and install Docker Desktop automatically. If you decline, it continues with the configuration anyway -- you can install Docker later and use the generated files.

The automatic install downloads the official Docker Desktop installer (~600 MB) from `desktop.docker.com` and runs it in silent mode with `--quiet --accept-license`. After install it refreshes your PATH so the current session can find `docker`.

#### 2. Connection Settings

The wizard prompts for all the network values LiveKit needs:

| Prompt | Default | What It Configures |
|---|---|---|
| Connection scheme | `ws` | Protocol prefix for the LiveKit host URL. Use `wss` only if you have TLS certificates. |
| Public IP or domain | Auto-detected via `api.ipify.org` | The address FiveM clients use to reach LiveKit. `127.0.0.1` only works for local testing. |
| Signal/WebSocket port | `7880` | TCP port for LiveKit signaling. |
| RTC TCP port | `7881` | TCP fallback port for clients that can't use UDP. |
| RTC UDP range start | `50000` | Start of the UDP port range for media traffic. |
| RTC UDP range end | `50100` | End of the UDP port range. |
| `use_external_ip` | `yes` | Whether LiveKit should advertise its external IP. Required for non-localhost setups. |

#### 3. API Credentials

| Prompt | Default | What It Configures |
|---|---|---|
| API key | `gcphone` | Identifier shared between LiveKit server and FiveM. |
| API secret | Auto-generated (48 chars) | Secret used to sign LiveKit tokens. If you leave it empty, a secure random token is generated. |
| Room prefix | `gcphone` | Prepended to room names to prevent collisions with other LiveKit users. |
| Max call duration | `300` seconds | Calls are automatically ended after this duration (range: 30--86400). |
| Socket.IO port | `3001` | Port for the Socket.IO real-time chat server. |

#### 4. TURN/TLS (Advanced)

| Prompt | Default | What It Configures |
|---|---|---|
| Enable TURN/TLS | `no` | Only needed for strict NAT environments or production TLS setups. |
| TURN domain | -- | Domain for TURN server (only if TURN enabled). |
| TURN TLS port | `5349` | Port for TURN TLS (only if TURN enabled). |
| cert_file / key_file | Container paths | Paths to TLS certificates inside the Docker container. |

Most users should leave TURN disabled.

#### 5. File Generation

The script generates four files in `tools/livekit/`:

| File | Contents |
|---|---|
| `.env` | All configuration as environment variables: host URL, ports, API key/secret, room prefix, call duration, Socket.IO port, TURN settings. Used by Docker Compose. |
| `livekit.yaml` | LiveKit server configuration in YAML format: port, log level, RTC settings, Redis connection (`redis:6379`), API keys, and TURN config. |
| `start-livekit.bat` | Generated start script that checks for `.env`/`livekit.yaml`, verifies Docker is available, and runs `docker compose up -d`. |
| `stop-livekit.bat` | Generated stop script that runs `docker compose down`. |

#### 6. Firewall Rules (You Choose)

The script **asks** if you want to open the required ports in Windows Firewall. You can say no and configure your firewall manually.

If you accept, it creates these inbound rules using `netsh`:

| Rule Name | Protocol | Port |
|---|---|---|
| `gcphone-livekit-signal` | TCP | Signal port (default 7880) |
| `gcphone-livekit-rtc-tcp` | TCP | RTC TCP port (default 7881) |
| `gcphone-livekit-rtc-udp` | UDP | RTC range (default 50000--50100) |
| `gcphone-socket-io` | TCP | Socket.IO port (default 3001) |

**About admin privileges:** Modifying Windows Firewall requires administrator access. If the script is not running as admin, it **asks** you to approve a UAC elevation prompt. If you cancel the elevation, the script shows you the exact `netsh` commands so you can run them yourself later. Nothing is forced.

To configure the firewall manually instead:

```cmd
netsh advfirewall firewall add rule name="gcphone-livekit-signal" dir=in action=allow protocol=TCP localport=7880
netsh advfirewall firewall add rule name="gcphone-livekit-rtc-tcp" dir=in action=allow protocol=TCP localport=7881
netsh advfirewall firewall add rule name="gcphone-livekit-rtc-udp" dir=in action=allow protocol=UDP localport=50000-50100
netsh advfirewall firewall add rule name="gcphone-socket-io" dir=in action=allow protocol=TCP localport=3001
```

#### 7. Auto-Start (You Choose)

The script offers three options for starting LiveKit automatically:

| Option | Behavior |
|---|---|
| `1` (default) | No auto-start. You run `start-livekit.bat` manually. |
| `2` | Creates a Windows scheduled task (`gcphone-livekit-autostart`) that runs `start-livekit.bat` at logon. Requires admin for `schtasks`. |
| `3` | Shows you the exact `schtasks` commands to create or remove the task yourself. |

If you pick option 2 and the script is not running as admin, it **asks** for UAC elevation. If you decline, it prints the commands for you to run later.

#### 8. Convar Output

Finally, the script prints the exact lines to copy into your FiveM `server.cfg`:

```cfg
setr livekit_host "ws://YOUR_IP:7880"
setr livekit_api_key "gcphone"
setr livekit_api_secret "YOUR_GENERATED_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

setr gcphone_socket_host "ws://YOUR_IP:3001"
```

---

## setup-livekit.bat (BAT Wrapper)

A convenience wrapper that launches the PowerShell wizard. Useful if you prefer double-clicking a file.

```
tools\livekit\setup-livekit.bat
```

**What it does:**

1. Verifies `setup-livekit.ps1` exists in the same directory.
2. Launches PowerShell with `-NoProfile -ExecutionPolicy Bypass`.
3. Reports success or failure when the PowerShell script exits.

The result is identical to running the `.ps1` directly.

---

## start-livekit.bat

Starts the Docker Compose stack (LiveKit + Redis).

```
tools\livekit\start-livekit.bat
```

**What it does:**

1. Checks that `.env` and `livekit.yaml` exist. If missing, tells you to run setup first.
2. Checks if Docker is installed. If not, **asks** if you want to download and install it.
3. Checks if Docker Compose is available.
4. Runs `docker compose up -d` with the generated config.
5. Shows the running container status with `docker compose ps`.

**Prerequisites:** Docker Desktop must be installed and running. The setup wizard must have been run at least once.

---

## stop-livekit.bat

Stops the Docker Compose stack.

```
tools\livekit\stop-livekit.bat
```

**What it does:**

1. Runs `docker compose down` with the generated `.env` and `docker-compose.yml`.
2. Confirms the stack is stopped.

---

## Security Notes

- The script **never** modifies your system without asking first. Docker install, firewall rules, and scheduled tasks all require your explicit confirmation.
- UAC elevation prompts are triggered by Windows, not forced by the script. You can always decline and apply changes manually.
- The `-ExecutionPolicy Bypass` flag only affects the current PowerShell process. Your system policy remains unchanged.
- You can inspect the full source of `setup-livekit.ps1` before running it -- it is plain text.
- API secrets generated by the script use `Get-Random` with a 62-character alphabet (a-z, A-Z, 0-9) at 48 characters length.

## Troubleshooting

| Issue | Solution |
|---|---|
| BAT file closes immediately when double-clicked | Run from `cmd` instead to see error output |
| "Missing setup-livekit.ps1" | Ensure the `.ps1` file was not deleted or moved |
| "Missing .env" or "Missing livekit.yaml" | Run `setup-livekit.bat` or the `.ps1` wizard first |
| Execution policy error | Use `powershell -ExecutionPolicy Bypass -File setup-livekit.ps1` |
| Firewall rules fail | Approve the UAC prompt, or apply rules manually with `netsh` (see commands above) |
| Docker not detected after install | Restart your terminal and launch Docker Desktop from the Start menu |
| Scheduled task fails to create | Approve the UAC prompt, or run the `schtasks` command manually (option 3 prints it) |
