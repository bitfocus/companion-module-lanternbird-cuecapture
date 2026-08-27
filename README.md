# CueCapture for Bitfocus Companion

Bitfocus Companion module for [**CueCapture**](https://cuecapture.com) — the
macOS/Windows desktop app for theatrical tech-rehearsal recording with real-time
cue overlays and cue-aware playback.

Wraps CueCapture's full OSC control surface: recording start/stop, view
switching, per-deck playback transport (4 decks), mix mode (4 knobs per deck),
theatre / fullscreen toggles, panel toggles, overlay master + per-module
visibility, Custom OSC text slots, Meter Panel value pushing, and settings
shortcuts. State streams the other way too — when CueCapture's TX is enabled,
Companion gets live variables and feedbacks for everything that matters.

## Status

Pre-release build being prepared for the Bitfocus module registry. Until it is
approved, install it through the **Import module package** flow below.

## Install

1. Download the latest `cuecapture-x.y.z.tgz` from the
   [Releases](https://github.com/bitfocus/companion-module-lanternbird-cuecapture/releases)
   tab, or build it locally (see [Develop](#develop) below).
2. Open Companion → **Modules**.
3. Click **Import module package** and select the `.tgz`.
4. **Connections** → **Add connection** → search "CueCapture".

## Connect

In Companion's connection settings:

| Field                  | Default     | What it means                                                                                                 |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| **Host IP**            | `127.0.0.1` | Where CueCapture is reachable                                                                                 |
| **CueCapture RX port** | `8001`      | Port we send commands to (matches **UDP RX Port** in CueCapture's OSC settings)                               |
| **Module RX port**     | `8002`      | Port we listen on for CueCapture's TX feedback stream                                                         |
| **Instance ID**        | `1`         | Numeric ID (1–99) matching CueCapture's **OSC ID**, or `broadcast` to target/listen to every running instance |

In CueCapture:

1. **Settings → Integrations → OSC** → enable **OSC Integration**.
2. Set **OSC ID** to match the value above.
3. **Enable TX**, set **Destination IP** = this Mac's IP (or `127.0.0.1` when
   Companion runs locally), **Destination Port** = the **Module RX port**
   above (default `8002`). **Apply.**

When the connection comes up, the module fires `/cuecapture/{id}/identify`,
which causes CueCapture to flash its title bar AND emit a full state snapshot
back — so every variable and feedback populates immediately.

## Preset library

Drop these on any button to get going. Organized into 10 browser sections.

**Recording**

- Record Toggle — flashes red while recording (uses the `recording_flash`
  advanced feedback; period configurable per-button)
- Record Start, Record Stop, Identify

**Views** — Switch to Record / Switch to Playback (lit when active)

**Per deck** (one section per deck **a / b / c / d / active**)

- Play, Pause, Play/Pause Toggle, Next Chapter, Previous Chapter
- Theatre Toggle, Fullscreen Toggle, Mix Toggle (each lit when the deck is in
  that mode — the `active` variant lights up when whatever's currently active
  is in that mode)
- (a/b/c/d only:) Make active

**Active deck nav** — Next / Previous (cycle which deck the Playback panels are
focused on)

**Playback panels** — Cuelist / Files / Timeline+Mixer toggle (lit when
expanded)

**Settings** — Counter reset

**Shutdown** — Quit CueCapture app

**Readouts** — single buttons that show live state via variables:

- Recording status + duration
- Active deck position
- Active deck current cue title
- Last recording filename

## Actions and feedbacks

This module ships **~38 actions** wrapping every OSC RX address in CueCapture's
manual and **12 feedbacks** (11 boolean enum-state feedbacks + 1 advanced
flashing-record-indicator). All variables and feedback values come from
CueCapture's TX stream — see CueCapture's
[OSC Control Spec](docs/osc-control.md)
for the canonical source of truth on what each address/state means.

## Variables

```
recording_state, recording_duration, recording_duration_seconds
view, active_deck, theatre_deck, fullscreen_deck
showname, counter, log_level
last_recording_{path,duration,state}
identify_{id,version}

# Mirror of the currently-active deck — useful for one-button readouts that
# don't have to be rewired when the user switches decks.
active_deck_{position, position_seconds, cue_title, cue_index, filename, state}

# Per deck (a, b, c, d):
deck_X_{state, position, position_seconds, filename, cue_title, cue_index, rate}
deck_X_mix_{state, opacity, gain, threshold, blend}
```

Use them in any text field via `$(cuecapture:variable_name)`.

## Develop

Requires Node 22+, Yarn 4 (via corepack), and macOS or Linux. Tested on Node 25.

```bash
git clone https://github.com/bitfocus/companion-module-lanternbird-cuecapture.git
cd companion-module-lanternbird-cuecapture

corepack enable
yarn install

yarn build         # tsc → dist/
yarn lint          # eslint + prettier
yarn package       # builds cuecapture-x.y.z.tgz for import into Companion
yarn build:icons   # regenerates assets/icons/*.png + src/icons-data.ts (only
                   # needed when editing the SVG sources in scripts/build-icons.mjs)
```

The module's icon set is rendered from inline SVG sources via Sharp and baked
into the JS bundle as base64 (esbuild bundles companion modules to a single
`main.js` — loose asset files don't survive the bundle).

## License

MIT
