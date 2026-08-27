## CueCapture

Control CueCapture over OSC — recording, playback decks, Mix Mode, theatre and
fullscreen views, the playback mixer, and cue-list navigation — with live state
feedback driving Companion variables and button colors.

Built for Stream Deck, Stream Deck +, and Loupedeck on Companion 4.x.

### Before you start

Turn on OSC in CueCapture: **Settings → Integrations → OSC**.

- **Enable inbound OSC** so CueCapture accepts commands from Companion.
- **Also enable TX** if you want variables and feedbacks. Set the TX destination
  to the machine running Companion, on the port you enter as _Module RX port_
  below.

Without TX enabled the buttons still work, but every variable stays empty and no
feedback ever lights up.

### Configuration

| Field                                 | Meaning                                                                                                                          | Default     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Host IP**                           | The machine running CueCapture.                                                                                                  | `127.0.0.1` |
| **CueCapture RX port (we send to)**   | Port CueCapture listens on for commands. Must match CueCapture's inbound OSC port.                                               | `8001`      |
| **Module RX port (we listen on)**     | Port this module binds for the TX state stream. Must match CueCapture's TX destination port.                                     | `8002`      |
| **Instance ID (1–99) or `broadcast`** | Matches CueCapture's OSC ID setting so several instances can share a network. `broadcast` targets and listens to every instance. | `1`         |

If CueCapture runs on the same computer as Companion, leave the host at
`127.0.0.1`. The two ports must differ. Anything other than a number in 1–99 (or
an empty field) is treated as `broadcast`.

### What you get

**Actions** cover the full command surface: recording start/stop/toggle, live
frame-grab snapshots, per-deck transport (play/pause/stop/jog/rate), Mix Mode with
opacity/gain/threshold/blend, theatre and fullscreen view targeting, cue-list
navigation and filters, Follow Console, playback-mixer channel and main
volume/mute, panel show/hide, and app shutdown. Deck-targeted actions accept
`a`/`b`/`c`/`d` or **active**, which resolves to whichever deck CueCapture
currently has focused.

Rotary-capable actions (jog, rate, opacity, gain, threshold, mixer volume) come in
step and cycle variants for Stream Deck + dials and Loupedeck knobs.

**Recording: take snapshot (live frame grab)** saves a still PNG of the live
record pipeline into the recording folder. Its **Mode** dropdown picks **With
overlays** (the composited frame exactly as recorded), **Without overlays** (the
camera as you framed it — rotation, crop and zoom applied — with no overlay
modules drawn), or **Raw camera** (the untouched source frame). This is the
record-side grab; the separate **Deck: snapshot** action targets a playback deck.

A **Send custom** action is included as an escape hatch — type any OSC address and
arguments by hand for verbs this module doesn't wrap yet, including mixer channels
above the pre-declared readout limit.

**Feedbacks** are mostly boolean state matches — recording state, current view,
deck transport state, Mix on/off and blend mode, active/theatre/fullscreen deck,
panel visibility, mixer mute, Follow Console state and sync, and cue-list filter.
Recording flash is an advanced feedback that pulses on a 250 ms timer while
recording.

**Variables** mirror CueCapture's state: recording status and duration, show name,
per-deck position (a formatted string plus split `hh`/`mm`/`ss`/`ff` parts and raw
seconds), filename, cue title and index, rate, Mix parameters, and Follow Console
state. Every per-deck variable also exists in an `active_deck_*` form that tracks
the focused deck. Playback-mixer levels are exposed per channel as percentages.

**Presets** ship across a dozen browser categories — Recording, Playback panels,
Active deck nav, Cue list filters, Mixer, Rotary knobs, Live readout buttons,
Settings shortcuts, and more.

### Notes

- **Preset styles bake in at drop time.** If you update the module and a preset's
  icon or default color changed, buttons you already placed keep their old look.
  Re-drop them to pick up the new style.
- **Variable references use the connection label**, not the module id. If your
  connection is labeled `CueCapture`, write `$(CueCapture:recording_duration)`.
- The module never expects replies to actions — CueCapture's OSC control is
  fire-and-forget. All state arrives on the separate TX stream.

### Troubleshooting

**Buttons do nothing.** Check Host IP and _CueCapture RX port_ against
CueCapture's inbound OSC settings, and confirm the Instance ID matches (or set it
to `broadcast`). A firewall between the two machines will silently drop UDP.

**Buttons work but variables stay empty.** TX isn't reaching the module. Confirm
TX is enabled in CueCapture, its destination is the Companion machine, and its
port equals _Module RX port_. If another application already holds that port, the
module logs a bind error on startup — pick a different port on both sides.

**Wrong deck responds.** Deck-targeted actions set to **active** follow
CueCapture's focused deck. Pin the action to an explicit `a`–`d` if you want it
fixed.
