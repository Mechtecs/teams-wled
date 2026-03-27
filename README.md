# teams-wled

Bridge between the Microsoft Teams local WebSocket API and WLED devices. Monitors meeting state and switches WLED presets based on call status, unread messages, and idle state.

## Setup

```bash
npm install
cp .env.example .env  # adjust values
npm run dev            # watch mode
npm start              # single run
```

Or double-click `start.bat` from the desktop.

## Configuration (.env)

| Variable                 | Default                    | Description                     |
|--------------------------|----------------------------|---------------------------------|
| `LOG_LEVEL`              | `info`                     | Winston log level               |
| `TEAMS_WS_URL`           | `ws://localhost:8124`      | Teams WebSocket endpoint        |
| `WLED_URL`               | `http://192.168.178.160`   | WLED device JSON API base URL   |
| `WLED_PRESET_IDLE`       | `1`                        | WLED preset when not in a call  |
| `WLED_PRESET_IN_MEETING` | `2`                        | WLED preset when in a call      |
| `WLED_PRESET_UNREAD`     | `3`                        | WLED preset for unread messages |

## Preset Priority

1. **Unread messages** (highest) — `WLED_PRESET_UNREAD`
2. **In meeting** — `WLED_PRESET_IN_MEETING`
3. **Idle** — `WLED_PRESET_IDLE`

On shutdown (Ctrl+C), the WLED device resets to the idle preset.

---

## Microsoft Teams Local WebSocket API

Teams exposes a local WebSocket server for third-party device integrations (Elgato Stream Deck, etc.). There is no official Microsoft documentation — the information below is derived from community reverse-engineering efforts.

### Prerequisites

The API must be enabled in the Teams client under **Settings > Privacy > Third-party app API**.

> **Note:** As of late 2025, Microsoft removed the Elgato Stream Deck plugin from the marketplace and the API toggle may be hidden in some builds. The underlying WebSocket on port 8124 may still function if previously enabled or configured via policy/registry.

### Connection

Teams listens on `ws://localhost:8124`. The connection URL carries identification via query parameters:

```
ws://localhost:8124?protocol-version=2.0.0&manufacturer=MyCompany&device=MyDevice&app=MyApp&app-version=1.0
```

After obtaining a pairing token, include it on subsequent connections:

```
ws://localhost:8124?token=<uuid>&protocol-version=2.0.0&manufacturer=MyCompany&device=MyDevice&app=MyApp&app-version=1.0
```

### Protocol Versions

| Version | Client           | Notes                                                              |
|---------|------------------|--------------------------------------------------------------------|
| 1.0.0   | Classic Teams    | Token from `%appdata%\Microsoft\Teams\storage.json` (`tpdApiTokenString`). Reached end-of-life July 2025. |
| 2.0.0   | New Teams (2.x)  | Dynamic pairing flow. Token obtained at runtime.                   |

This project uses protocol version 2.0.0 exclusively.

### Pairing Flow (v2.0.0)

1. Connect **without** a token. Teams grants read-only access — `meetingUpdate` messages are received immediately.
2. When `meetingPermissions.canPair` becomes `true` (user is in a meeting), send a `pair` action.
3. Teams displays a notification prompting the user to approve the device.
4. On approval, Teams sends a token:
   ```json
   {"tokenRefresh": "<uuid>"}
   ```
5. Store the token persistently. Include it in the connection URL on subsequent connections for full command access.

### Message Format

#### Client to Server (v2.0.0)

All commands use this structure:

```json
{
  "action": "<action-name>",
  "parameters": {},
  "requestId": 1
}
```

`requestId` is a client-managed incrementing integer. Responses reference the same `requestId`.

#### Client to Server (v1.0.0 — legacy, do not use with protocol-version 2.0.0)

```json
{
  "apiVersion": "1.0.0",
  "service": "<service-name>",
  "action": "<action-name>",
  "manufacturer": "Elgato",
  "device": "StreamDeck",
  "timestamp": 1675341655453
}
```

Mixing v1.0.0 message format with a v2.0.0 connection results in errors like:

```json
{"errorMsg": "Does not fit protocol standardrequestId missing or not an int"}
```

#### Server to Client — Success Response

```json
{"requestId": 1, "response": "Success"}
```

#### Server to Client — Error Response

```json
{"errorMsg": "Some error description"}
```

Or correlated to a specific request:

```json
{"requestId": 1, "errorMsg": "Some error description"}
```

#### Server to Client — Token Refresh

```json
{"tokenRefresh": "<uuid>"}
```

### Meeting Update

Pushed automatically on state changes and in response to `query-state`. This is the primary message type:

```json
{
  "meetingUpdate": {
    "meetingState": {
      "isMuted": false,
      "isVideoOn": false,
      "isHandRaised": false,
      "isInMeeting": false,
      "isRecordingOn": false,
      "isBackgroundBlurred": false,
      "isSharing": false,
      "hasUnreadMessages": false
    },
    "meetingPermissions": {
      "canReact": false,
      "canToggleVideo": false,
      "canToggleMute": false,
      "canToggleHand": false,
      "canToggleShareTray": false,
      "canLeave": false,
      "canToggleBlur": false,
      "canToggleChat": false,
      "canStopSharing": false,
      "canPair": false
    }
  }
}
```

### Available Actions (v2.0.0)

| Action                    | Parameters              | Description                          |
|---------------------------|-------------------------|--------------------------------------|
| `query-state`             | `{}`                    | Query current meeting state          |
| `pair`                    | `{}`                    | Initiate device pairing              |
| **Microphone**            |                         |                                      |
| `toggle-mute`             | `{}`                    | Toggle microphone mute               |
| `mute`                    | `{}`                    | Mute microphone                      |
| `unmute`                  | `{}`                    | Unmute microphone                    |
| **Camera**                |                         |                                      |
| `toggle-video`            | `{}`                    | Toggle camera                        |
| `show-video`              | `{}`                    | Turn camera on                       |
| `hide-video`              | `{}`                    | Turn camera off                      |
| **Hand**                  |                         |                                      |
| `toggle-hand`             | `{}`                    | Toggle raised hand                   |
| `raise-hand`              | `{}`                    | Raise hand                           |
| `lower-hand`              | `{}`                    | Lower hand                           |
| **Background**            |                         |                                      |
| `toggle-background-blur`  | `{}`                    | Toggle background blur               |
| `blur-background`         | `{}`                    | Enable background blur               |
| `unblur-background`       | `{}`                    | Disable background blur              |
| **Call**                  |                         |                                      |
| `leave-call`              | `{}`                    | Leave the current meeting            |
| `stop-sharing`            | `{}`                    | Stop screen sharing                  |
| **Reactions**             |                         |                                      |
| `send-reaction`           | `{"type": "<reaction>"}` | Send a reaction                     |
| **UI**                    |                         |                                      |
| `toggle-ui`               | `{"type": "<element>"}` | Toggle a UI panel                    |

**Reaction types:** `like`, `love`, `applause`, `laugh`, `wow`

**UI element types:** `chat`, `share-tray`

### Community References

| Repository | Language | Description |
|---|---|---|
| [svrooij/teams-monitor](https://github.com/svrooij/teams-monitor) | C# | CLI tool + NuGet library. Best v2.0.0 protocol documentation. |
| [MrRoundRobin/TeamsLocalApi](https://github.com/MrRoundRobin/TeamsLocalApi) | C# | NuGet package. Most complete action enum. |
| [bitfocus/companion-module-microsoft-teams](https://github.com/bitfocus/companion-module-microsoft-teams) | JS | Bitfocus Companion module. Supports v1.0.0 and v2.0.0. |
| [AntoineGS/teams-status-rs](https://github.com/AntoineGS/teams-status-rs) | Rust | Teams status monitor for Home Assistant. |
| [malkstar/ms_teams_websockets](https://github.com/malkstar/ms_teams_websockets) | Python | Home Assistant custom component (v1.0.0). |

External documentation:

- [Microsoft Teams WebSocket API (Notion)](https://lostdomain.notion.site/Microsoft-Teams-WebSocket-API-5c042838bc3e4731bdfe679e864ab52a)
- [msxfaq.de — Teams 3rd Party Client API](https://www.msxfaq.de/teams/apps/teams_3rd_party_client_api_beschreibung.htm)
