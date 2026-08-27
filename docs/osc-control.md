<!-- Keep this review copy synchronized with CueCapture's canonical OSC specification. -->

# OSC Control Spec

CueCapture accepts OSC commands for recording, playback, overlay visibility, and
on-screen text. It can also send optional state feedback to a remote controller.

A condensed command reference is available under **Settings → Integrations → OSC
→ Command Reference**. This page is the complete reference. See
[Examples](#examples) for common configurations.

## Enabling OSC

Turn it on under **Settings → Integrations → OSC**. The fields in that pane are the operational reference:

| Setting | Default | Notes |
|---|---|---|
| **OSC Integration** | off | Master enable. When off, no inbound commands are honored — neither UDP nor [Eos passthrough](#transports). The only safety gate. |
| **OSC ID** | `1` | 1–99. Used in addresses like `/cuecapture/{ID}/...`. Omitting the id in an address **broadcasts** to every running CueCapture instance. |
| **UDP RX Port** | `8001` | The UDP port CueCapture listens on, on every interface. Constrained to 1024–65535 (privileged ports excluded). |
| **This Mac** | _resolved at open_ | The detected IPv4 address to use when configuring a sender. |
| **Use Eos Connection** | off | Forwards `/cuecapture/...` packets arriving over the active Eos TCP connection into the dispatcher. Locked off when Eos method is **Third Party OSC**; editable on **User TCP Port**. See [Transports](#transports). |
| **Command Reference** | — | Inline rendered copy of the catalog below. |

!!! warning "UDP is unauthenticated"
    Anyone who can reach the configured port can send commands. Treat the listener as **trusted-LAN only**, and turn it off (master toggle) on hostile networks.

## Address pattern

```
/cuecapture/{id}/{verb}/...
```

- `{id}` is **optional**. Omit it (`/cuecapture/recording/start`) to broadcast — every running CueCapture instance handles the message.
- A numeric `{id}` 1..99 targets only the instance whose **OSC ID** setting matches.
- The first segment must be `cuecapture`. Anything else is silently ignored.

### Accepted syntax

- Address segments are matched **case-insensitively**.
- Leading zeros in numeric segments are stripped: `02` == `2`.
- Trailing slashes and double slashes are tolerated: `/cuecapture/1/recording/start/` and `/cuecapture/1//recording/start` both work.
- Numeric arguments may be sent as int, float, or string — they're coerced.
- Booleans accept `1/0`, `true/false`, `on/off`, `yes/no` (any case).

### Free-text segments

For commands carrying free-form text — `overlay/{slot}/text/{text}`, `recording/marker/{label}`, `playback/deck/.../cue/{cueNumber}` — there are two ways to deliver the text:

- **Path form** — includes the text in the address. Use it for simple values without spaces or `/` characters.
- **Argument form** — sends the text as one or more OSC string arguments. Use it for human-readable text, spaces, slashes, or punctuation.

```
/cuecapture/1/overlay/1/text/Cue12          ✓ simple token
/cuecapture/1/overlay/1/text/Q-12-Bridge    ✓ hyphens, dots, underscores
/cuecapture/1/overlay/1/text/Cue 5/A        ✗ embedded slash splits segments — use arg form
```

Most senders (Eos macros, Companion, qLab, TouchOSC) expose args separately from the path, and the [Examples](#examples) section shows both forms.

Backslashes in path-form pass through; `\\` decodes to a single `\`.

## Transports

CueCapture accepts inbound OSC over two transports. Both feed the same dispatcher, so a given command works the same way no matter how it arrives.

- **UDP** on the configured **RX Port** (default `8001`). Listens on **every interface** of the host. The "This Mac" line in the OSC settings panel shows the current IPv4 address you'd point a sender at.
- **Eos console TCP passthrough.** When enabled, any `/cuecapture/...` packet sent over the active Eos OSC connection is forwarded into the dispatcher. Eos macros can drive CueCapture without configuring a second connection.
    - The toggle (**Use Eos Connection** in Settings → Integrations → OSC) is force-disabled and force-cleared while the Eos connection method is **Third Party OSC** — that channel is read-only for our addresses, so the console will not transmit a `/cuecapture/...` message over it.
    - On **User TCP Port**, the toggle is editable and stays at its persisted value. You have to opt in explicitly.

---

## Command catalog

### Handshake

| Address | Effect |
|---|---|
| `/cuecapture/{id}/identify` | Flash the title bar of the targeted instance for 2 s. Useful for confirming a sender is reaching the right instance. |

### View

> Switches which top-level tab is showing. Does **not** gate the other commands — recording can be triggered while the playback tab is on screen, and vice versa.

| Address |
|---|
| `/cuecapture/{id}/view/record` |
| `/cuecapture/{id}/view/playback` |

### Recording

| Address | Notes |
|---|---|
| `/cuecapture/{id}/recording/start` | No-op if already recording. |
| `/cuecapture/{id}/recording/stop` | No-op if not recording. |
| `/cuecapture/{id}/recording/toggle` | |
| `/cuecapture/{id}/recording/snapshot` | Save a snapshot of the live feed — camera plus overlays. |
| `/cuecapture/{id}/recording/snapshot/no-overlays` | The camera as you've framed it, without the overlay graphics. |
| `/cuecapture/{id}/recording/snapshot/raw` | The untouched camera frame at full source resolution. |

The snapshot addresses work whether or not recording is active. CueCapture refuses
the request if no video source is selected or another snapshot is in progress.

### Playback decks

Decks are addressed by `a`, `b`, `c`, or `d`. Use **`active`** to target the
currently active deck. The command still applies when that deck is outside the
visible layout.

Use `pause` to halt deck playback. There is no remote `stop` command.

| Address | Args | Notes |
|---|---|---|
| `.../playback/deck/{deck}/play` | — | No-op if already playing. |
| `.../playback/deck/{deck}/pause` | — | No-op if not playing. |
| `.../playback/deck/{deck}/toggle` | — | |
| `.../playback/deck/{deck}/seek/{seconds}` | — | Seconds is a float. |
| `.../playback/deck/{deck}/seek` | `float seconds` | Arg form. |
| `.../playback/deck/{deck}/seek/step/{Δs}` | — | **Rotary-friendly.** Adds Δseconds to current position, clamped to `[0, duration]`. Path form accepts signed floats (e.g. `/seek/step/-5`). Silent no-op if no file is loaded. |
| `.../playback/deck/{deck}/seek/step` | `float Δseconds` | Arg form of the above. |
| `.../playback/deck/{deck}/cue/{cueNumber}` | — | Scrub to the **start** of the chapter whose Number matches (case-insensitive, exact match). No-op if not found. |
| `.../playback/deck/{deck}/cue` | `string cueNumber` | Arg form. |
| `.../playback/deck/{deck}/cue/current` | — | Scrub to the **start** of the cue the console most recently fired. Uses the deck's Follow Console list source + out-of-sync setting (works whether or not Follow Console is enabled). No-op if the console isn't in a cue (none fired / cue-out / cue 0) or the cue isn't in the file. |
| `.../playback/deck/{deck}/cue/end/{cueNumber}` | — | Scrub to the **end** (cue start + fade time, clamped to the file) of the given cue. Honors the deck's Follow Console list + out-of-sync setting. |
| `.../playback/deck/{deck}/cue/end/current` | — | Scrub to the **end** of the cue the console most recently fired. Same resolution + no-op rules as `cue/current`. |
| `.../playback/deck/{deck}/cue/end` | `string cueNumber` | Arg form of `cue/end` — pass a cue number or the literal `current`. |
| `.../playback/deck/{deck}/scene/{name}` | — | Jumps to the scene divider whose name matches (case-insensitive). Path form uses `_` for spaces (`Act_1` → "Act 1"). No-op if not found. |
| `.../playback/deck/{deck}/scene` | `string name` | Arg form — supports spaces. |
| `.../playback/deck/{deck}/chapter/next` | — | Step to the next cue's **start**. |
| `.../playback/deck/{deck}/chapter/previous` | — | "Rewind to start of current cue" if elapsed > 2 s, else step to the previous cue's start. |
| `.../playback/deck/{deck}/chapter/end/next` | — | Step to the **next** cue's end point. |
| `.../playback/deck/{deck}/chapter/end/previous` (alias `.../prev`) | — | Step to the **previous** cue's end point. |
| `.../playback/deck/{deck}/rate/{speed}` | — | Speed is a float. |
| `.../playback/deck/{deck}/rate` | `float speed` | Arg form. |
| `.../playback/deck/{deck}/rate/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current speed, clamped to `[0.1, 4.0]`. Path form accepts signed floats. |
| `.../playback/deck/{deck}/rate/step` | `float Δ` | Arg form of the above. |

!!! tip "Why `/step` for rotary encoders"
    Rotary encoders normally send relative increments. Use `/step/{delta}` to
    adjust the current value without first reading it. Negative values move in
    the opposite direction.

### Scenes

Recordings made against an Eos cue list that carries scene markers get **scene dividers** in the cue list. Jump straight to one by name. Matching is case-insensitive; since the path form can't carry spaces, an underscore stands in for each space (`Act_1` → scene "Act 1"). For names with punctuation, use the arg form.

| Address | Args | Notes |
|---|---|---|
| `.../playback/deck/{deck}/scene/{name}` | — | Path form — single token; `_` ↦ space. |
| `.../playback/deck/{deck}/scene` | `string name` | Arg form — supports spaces and punctuation. |

### Timeline

Per-deck timeline **zoom** and **pan**. These drive the on-screen timeline when the addressed deck is the active one; for any other deck the value is stored and applied the moment it next becomes active (the same save/restore the timeline does as you switch decks).

Zoom is a level in `[1.0, 100.0]` — `1.0` shows the whole file, `100` is maximum magnification. Pan is the start of the visible window in **seconds**, clamped to whatever the current zoom leaves room for (at `1.0×` there's nothing to pan, so pan is pinned at 0).

| Address | Args | Notes |
|---|---|---|
| `.../playback/deck/{deck}/timeline/zoom/{value}` | — | Set zoom level. Clamped `[1.0, 100.0]`. |
| `.../playback/deck/{deck}/timeline/zoom` | `float value` | Arg form. |
| `.../playback/deck/{deck}/timeline/zoom/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current zoom, clamped. Path form accepts signed floats. |
| `.../playback/deck/{deck}/timeline/zoom/step` | `float Δ` | Arg form. |
| `.../playback/deck/{deck}/timeline/zoom/fit` | — | Reset to `1.0×` (whole file) and scroll back to the start. |
| `.../playback/deck/{deck}/timeline/pan/{seconds}` | — | Set the visible-window start (seconds). Clamped to `[0, duration − visible]`. |
| `.../playback/deck/{deck}/timeline/pan` | `float seconds` | Arg form. |
| `.../playback/deck/{deck}/timeline/pan/step/{Δs}` | — | **Rotary-friendly.** Nudges the view by Δseconds (like scrubbing the window). Signed; negative scrolls left. |
| `.../playback/deck/{deck}/timeline/pan/step` | `float Δs` | Arg form. |

### Active deck

The "active deck" is the deck the Playback side panels (cue list, timeline, file browser) are focused on — the same notion the D1–D4 hotkeys switch between. Remote control can both **address it** (via `active`, above) and **switch it**.

| Address | Notes |
|---|---|
| `.../playback/deck/{a-d}/activate` | Make this deck the active one. `active/activate` is a harmless silent no-op (no warning). |
| `.../playback/active-deck/next` | Cycle to the next visible deck, wrapping. |
| `.../playback/active-deck/previous` (alias `.../prev`) | Cycle to the previous visible deck, wrapping. |

### Theatre & fullscreen

Theatre and fullscreen are both **single-deck modes**: at most one deck is in either at a time. Theatre expands one deck within the Playback layout; fullscreen takes it full-screen on the host monitor. Both can be driven remotely:

| Address | Effect |
|---|---|
| `.../playback/deck/{deck}/theatre/show` | Enter theatre on this deck. If a *different* deck is in theatre, swap. |
| `.../playback/deck/{deck}/theatre/hide` | Exit theatre **only if this deck is the one currently in theatre**; otherwise no-op. |
| `.../playback/deck/{deck}/theatre/toggle` | Flip relative to this deck (enter, exit, or swap). |
| `.../playback/deck/{deck}/fullscreen/show` | Enter fullscreen on this deck. |
| `.../playback/deck/{deck}/fullscreen/hide` | Exit fullscreen only if this deck is the one currently fullscreen. |
| `.../playback/deck/{deck}/fullscreen/toggle` | Flip relative to this deck. |

The `hide` command affects only the addressed deck.

### Mix mode

Each deck has independent Mix controls for opacity, gain, threshold, and blend
mode, plus the Default and P1–P3 presets. Enabling or disabling Mix does not
change the control values.

| Address | Args | Notes |
|---|---|---|
| `.../playback/deck/{deck}/mix/show` | — | Enable Mix Mode. |
| `.../playback/deck/{deck}/mix/hide` | — | Disable Mix Mode. |
| `.../playback/deck/{deck}/mix/toggle` | — | Toggle Mix Mode. |
| `.../playback/deck/{deck}/mix/recall/{default\|1\|2\|3}` | — | Recall the named slot into the deck's knobs. Does not change `MixEnabled`. |
| `.../playback/deck/{deck}/mix/recall` | `string slot` | Arg form (`default`, `1`, `2`, `3`). |
| `.../playback/deck/{deck}/mix/opacity/{value}` | — | 0..1, clamped. |
| `.../playback/deck/{deck}/mix/opacity` | `float value` | Arg form. |
| `.../playback/deck/{deck}/mix/opacity/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current opacity, clamped `[0, 1]`. Path form accepts signed floats. |
| `.../playback/deck/{deck}/mix/opacity/step` | `float Δ` | Arg form. |
| `.../playback/deck/{deck}/mix/gain/{value}` | — | Brightness gain (≥ 0, clamped). |
| `.../playback/deck/{deck}/mix/gain` | `float value` | Arg form. |
| `.../playback/deck/{deck}/mix/gain/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current gain, clamped `[0, 10]`. |
| `.../playback/deck/{deck}/mix/gain/step` | `float Δ` | Arg form. |
| `.../playback/deck/{deck}/mix/threshold/{value}` | — | 0..1, clamped. |
| `.../playback/deck/{deck}/mix/threshold` | `float value` | Arg form. |
| `.../playback/deck/{deck}/mix/threshold/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current threshold, clamped `[0, 1]`. |
| `.../playback/deck/{deck}/mix/threshold/step` | `float Δ` | Arg form. |
| `.../playback/deck/{deck}/mix/blend/{name}` | — | Blend mode name. Valid values: `normal`, `screen`, `lighten`, `difference` (case-insensitive). Unknown names log Debug and no-op. |
| `.../playback/deck/{deck}/mix/blend` | `string name` | Arg form. |
| `.../playback/deck/{deck}/mix/blend/cycle/{dir}` | — | **Rotary-friendly.** `+1` advances one blend slot, `-1` retreats, with wrap-around (forward from `difference` → `normal`). `0` is a silent no-op so a rotary encoder that emits `0` mid-detent doesn't fire spuriously. Only the **sign** of `dir` is honored — `+2` steps the same one slot as `+1`. Send multiple cycles to skip multiple slots. |
| `.../playback/deck/{deck}/mix/blend/cycle` | `int dir` | Arg form. |

### Follow Console

Each deck can **follow the live Eos console**: when a cue fires on the list it's watching, the deck scrubs to that cue's chapter automatically. These addresses expose the per-deck Follow Console panel the same way the Mix addresses expose Mix mode — every option here mirrors a control in the deck's Follow Console flyout, and changes persist with the deck's settings.

- **source** picks which cue list to follow: `native` (the list embedded in the recording), `default` (the global list set in Settings → Eos), or `custom`.
- **list** sets the custom list number — only meaningful while source is `custom`.
- **mode** picks whether a fire scrubs to the cue's **start** or its **end** (start + fade time).
- **out-of-sync** is a recovery toggle: when on, a fired cue that has *no* matching chapter in the file scrubs to the nearest **prior** cue that does exist, rather than leaving the deck where it sits. Off by default — the deck only moves on exact matches.

| Address | Args | Notes |
|---|---|---|
| `.../playback/deck/{deck}/follow/show` | — | Enable Follow Console on this deck. |
| `.../playback/deck/{deck}/follow/hide` | — | Disable it. |
| `.../playback/deck/{deck}/follow/toggle` | — | Flip it. |
| `.../playback/deck/{deck}/follow/source/{native\|default\|custom}` | — | Which list to follow. |
| `.../playback/deck/{deck}/follow/source` | `string` | Arg form. |
| `.../playback/deck/{deck}/follow/list/{N}` | — | Custom list number (applies when source = `custom`). |
| `.../playback/deck/{deck}/follow/list` | `string` | Arg form. |
| `.../playback/deck/{deck}/follow/mode/{start\|end}` | — | Scrub to cue start, or end (start + fade). |
| `.../playback/deck/{deck}/follow/mode` | `string` | Arg form. |
| `.../playback/deck/{deck}/follow/out-of-sync/{show\|hide\|toggle}` | — | Toggle the prior-cue fallback. |

### Playback panels

The three collapsible Playback-area panels can be toggled remotely. `timeline` is the alias for the bottom row — note that **the bottom row contains Timeline AND Mixer together**, so toggling it hides/shows both.

| Address |
|---|
| `/cuecapture/{id}/playback/panel/cuelist/{show\|hide\|toggle}` |
| `/cuecapture/{id}/playback/panel/files/{show\|hide\|toggle}` |
| `/cuecapture/{id}/playback/panel/timeline/{show\|hide\|toggle}` |

### Cue list filters

The Cue List panel's hamburger menu has a set of display toggles — show/hide scenes, cues, and the individual cue fields. Each is addressable over OSC, so a controller can reshape the list for the moment (e.g. hide everything but cue numbers during a fast sequence). Global to the Playback tab. `show` also accepts `enable`/`on`; `hide` accepts `disable`/`off`.

| Address |
|---|
| `/cuecapture/{id}/playback/cuelist/filter/{name}/{show\|hide\|toggle}` |

`{name}` is one of:

| Name | Toggles |
|---|---|
| `scenes` | Scene divider rows |
| `cues` | Cue rows (gates the five fields below) |
| `number` | Cue number column |
| `label` | Cue label column |
| `time` | Cue start timecode |
| `console-tc` | Eos console timecode |
| `fade-bar` | Fade-duration bar |

The five cue-field filters only have a visible effect while `cues` is shown.

### Playback mixer

The Playback mixer exposes one fader and mute per physical output. Output numbers
are 1-based and match the `Out 1` through `Out N` labels in the interface.

**Channel `0` is the main (master) fader** — the global fader that scales every output whose **MAIN** assign toggle is on. It takes the exact same `volume` / `volume/step` / `mute` shapes as a numbered output, so a console fader or rotary maps to it with no special case. Its clamp is the same `[0, 2.0]`, unity = `1.0 = 0 dB`.

The output count is dynamic — it follows the active deck's device-reachable outputs and changes when a different file is loaded. Commands addressing an output beyond the current count are silent no-ops (CueCapture logs at Debug); channel `0` is always valid (the main fader exists regardless of the loaded file). Volume is unitless gain with `1.0 = 0 dB (unity)`; the underlying clamp is `[0, 2.0]`.

| Address | Args | Notes |
|---|---|---|
| `.../playback/mixer/channel/{N}/volume/{value}` | — | Set output N's fader. Clamped `[0, 2.0]`. `N = 0` → main fader. |
| `.../playback/mixer/channel/{N}/volume` | `float value` | Arg form. |
| `.../playback/mixer/channel/{N}/volume/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current fader, clamped `[0, 2.0]`. Path form accepts signed floats. |
| `.../playback/mixer/channel/{N}/volume/step` | `float Δ` | Arg form. |
| `.../playback/mixer/channel/{N}/mute/on` | — | Mute output N. `N = 0` targets MAIN. |
| `.../playback/mixer/channel/{N}/mute/off` | — | Unmute output N. |
| `.../playback/mixer/channel/{N}/mute/toggle` | — | Toggle mute. |
| `.../playback/mixer/channel/{N}/mute` | `bool` | Arg form. Accepts `1/0`, `true/false`, `on/off`, `yes/no`. |

!!! tip "Main fader = channel 0"
    `/cuecapture/{id}/playback/mixer/channel/0/volume 0.5` rides the master; `channel/0/mute/toggle` mutes the whole assigned bus. Channels `1..N` are the physical output strips.

!!! note "Source controls are not over OSC"
    Per-source **volume**, **mute**, and **solo** — along with **routing**, **channel labels**, and waveform-display gain — live on the timeline left strip and are **per-file**, not remote-controlled performance state. They are deliberately not exposed over OSC. The MAIN-assign checkbox on each output strip is likewise a setup-time decision and is not over OSC.

!!! note "Output count changes on file load"
    Loading a file may change the available output count. CueCapture sends the
    complete volume and mute state again whenever that count changes.

### Settings

| Address | Args | Notes |
|---|---|---|
| `/cuecapture/{id}/settings/set/showname/{name}` | — | Path-form — single token only. |
| `/cuecapture/{id}/settings/set/showname` | `string name` | Arg form — supports spaces. |
| `/cuecapture/{id}/settings/set/customtext/{text}` | — | Sets the file-naming **Custom Text** field (the `[Custom]` token). Path-form — single token only. (`custom-text` / `custom` also accepted.) |
| `/cuecapture/{id}/settings/set/customtext` | `string text` | Arg form — supports spaces. |
| `/cuecapture/{id}/settings/set/counter/{N}` | — | Sets the file-naming counter to N. Clamped to ≥ 0. |
| `/cuecapture/{id}/settings/set/counter` | `int N` | Arg form. |
| `/cuecapture/{id}/settings/counter/step/{Δ}` | — | **Rotary-friendly.** Adds Δ to current counter, clamped ≥ 0. Path form accepts signed ints. |
| `/cuecapture/{id}/settings/counter/step` | `int Δ` | Arg form. |
| `/cuecapture/{id}/settings/counter/reset` | — | Resets counter to `CounterStart`. |
| `/cuecapture/{id}/settings/set/log-level/{level}` | — | Level: `verbose`, `debug`, `information`, `warning`, `error`, or `fatal`. Aliases: `info`, `warn`. |
| `/cuecapture/{id}/settings/set/log-level` | `string level` | Arg form. |

!!! note "Settings display refresh"
    An open Settings window does not refresh after these commands. Reopen it to
    display the new values. The next recording uses the updated values.

### App lifecycle

| Address | Notes |
|---|---|
| `/cuecapture/{id}/shutdown/app` | Quit the app cleanly (same exit path as the OS quit menu). |
| `/cuecapture/{id}/shutdown/computer` | Power off the host computer. **Gated** by the "Allow remote computer shutdown" setting in Settings → Integrations → OSC (default off). Additionally refused while recording. macOS uses an AppleScript send-event and may need Automation permission on first use; failures log a Warning. |

### Overlay master visibility

When master is **hidden**, no overlay modules render. The camera passthrough is unaffected — useful for grabbing a clean feed without disabling individual modules.

| Address |
|---|
| `/cuecapture/{id}/overlay/show` |
| `/cuecapture/{id}/overlay/hide` |
| `/cuecapture/{id}/overlay/toggle` |

### Per-module visibility

Match by the **Module Name** as set in the Modules panel. Case-insensitive and whitespace-trimmed. Module names containing spaces can be addressed by substituting `_` for each space — e.g. a module named `Show Notes` matches `/cuecapture/1/overlay/module/Show_Notes/hide`. The literal segment is tried first, so a module whose actual name contains an underscore still wins. Silent no-op if no module matches.

| Address |
|---|
| `/cuecapture/{id}/overlay/module/{ModuleName}/show` |
| `/cuecapture/{id}/overlay/module/{ModuleName}/hide` |
| `/cuecapture/{id}/overlay/module/{ModuleName}/toggle` |

### Custom OSC overlay slots

Place a **Custom OSC** module from the Add Module menu and set its **Slot** number 1..32 in the properties panel. Inbound commands push text into that slot, and any Custom OSC module bound to that slot re-renders automatically.

Each slot has 16 addressable lines.

| Address | Args | Behavior |
|---|---|---|
| `.../overlay/{slot}/text/{text}` | — | Sets **line 1 only**. Other lines preserved. |
| `.../overlay/{slot}/text` | 1–16 strings | Replaces **all 16 lines** with the args, one per line. Excess args (>16) are dropped with a warning. |
| `.../overlay/{slot}/line/{N}/text/{text}` | — | Sets line N (1-indexed, 1..16). |
| `.../overlay/{slot}/line/{N}/text` | 1 string | Arg form. |
| `.../overlay/{slot}/line/{N}/clear` | — | Empties line N. |
| `.../overlay/{slot}/clear` | — | Empties all 16 lines. |

Notes:

- If the slot has no Custom OSC module placed on the canvas, the message is **silently ignored**.
- Slot text is **process-local**. It is not persisted across app restarts.
- Multiple modules may reference the same slot (mirrored display).

### Meter Panel {#meter-panel}

Drive any number of live meters on a **Meter Panel** module. Each panel is identified by its **Bank** number (1..99, set in the inspector); meters within a panel are numbered 1..N by position.

| Address | Args | Behavior |
|---|---|---|
| `.../meter/{bank}` | N floats | **Batch.** Sets the value of each meter in order — first arg → meter 1, second → meter 2, etc. The fastest way to push a row of VU levels. |
| `.../meter/{bank}/{n}` | 1 float | **Shortcut.** Sets meter N's value. Equivalent to `.../meter/{bank}/{n}/value`. |
| `.../meter/{bank}/{n}` | 5 args: `s, f, f, s\|i, f` | **Bundled.** Sets label, min, max, type, and value in one packet. Order is fixed; all five required. |
| `.../meter/{bank}/{n}/value` | 1 float | Sets meter N's value only. |
| `.../meter/{bank}/{n}/label` | 1 string | Sets meter N's label. |
| `.../meter/{bank}/{n}/min` | 1 float | Sets meter N's range minimum. |
| `.../meter/{bank}/{n}/max` | 1 float | Sets meter N's range maximum. |
| `.../meter/{bank}/{n}/type` | 1 string or int | Sets meter N's shape. Accepts `linear`, `thinear`, `arc12`/`archalf`, `arc34`/`arcthreequarter`, `square`/`solidsquare`, `circle`/`solidcircle`, `segbar`/`segmentedbar`, `numeric` (case-insensitive), or the ordinal 0..7. |

Notes:

- **Values are transient.** They live in memory only and reset to each meter's `Min` on app restart. The sender is expected to keep streaming.
- **Metadata is persistent.** Label, Min, Max, and Type set via OSC are saved with the panel and survive restart. A controller can configure a panel once at session start; the inspector reflects the OSC-pushed values.
- If no Meter Panel module exists with the targeted bank, the message is silently dropped.
- Two panels with the same bank both receive the same packets (intentional, for mirrored display).

---

## Examples

The catalog above is the spec; the rest of this page is recipes. Pick the closest match and adapt.

### Quick wins

```
# Start recording on the CueCapture instance whose OSC ID = 1
/cuecapture/1/recording/start

# Stop it
/cuecapture/1/recording/stop

# Toggle recording on EVERY running CueCapture instance (no id)
/cuecapture/recording/toggle

# Confirm a target is reachable — flashes the title bar for 2s
/cuecapture/1/identify
```

### Switching views and driving a deck

```
# Switch instance 2 to playback view, then play deck A
/cuecapture/2/view/playback
/cuecapture/2/playback/deck/a/play

# Pause deck A
/cuecapture/2/playback/deck/a/pause

# Jump deck A to chapter (cue) "Q42"
/cuecapture/2/playback/deck/a/cue/Q42

# Step to the next chapter on deck A
/cuecapture/2/playback/deck/a/chapter/next

# Seek deck A to 90 seconds (path form)
/cuecapture/2/playback/deck/a/seek/90

# Seek deck A to 90.5 seconds (arg form — float arg)
#   address: /cuecapture/2/playback/deck/a/seek
#   arg 1:   90.5

# Set deck A to half speed
/cuecapture/2/playback/deck/a/rate/0.5
```

### Cleaning up the camera feed

```
# Hide the entire overlay (clean camera feed)
/cuecapture/1/overlay/hide

# Show it again
/cuecapture/1/overlay/show

# Toggle just one module by name (case-insensitive)
/cuecapture/1/overlay/module/Notes/hide

# Hide a module whose name has a space ("Show Notes")
/cuecapture/1/overlay/module/Show_Notes/hide
```

### Driving a Custom OSC overlay

A **Custom OSC** module is a freeform 16-line text block. Drop one onto the modules panel, set its **Slot** number (1–32) in the properties panel, and you can push text from anywhere on the network.

```
# Path-form text — only when the value is a simple ASCII token (no spaces, no slashes)
/cuecapture/1/overlay/1/text/Cue12-OnDeck

# Arg-form text — handles spaces, punctuation, slashes
#   address  = /cuecapture/1/overlay/1/text
#   string 1 = "Cue 5/A — Scene Open"

# Replace ALL 16 lines of slot 5 in one shot (arg form)
#   address    = /cuecapture/1/overlay/5/text
#   string 1   = "Cue 12.0"
#   string 2   = "Bridge Out"
#   string 3   = "00:01:30 left"
#   (lines 4–16 become empty)

# Update only line 3 of slot 5 (arg form, single string)
#   address  = /cuecapture/1/overlay/5/line/3/text
#   string 1 = "00:01:15 left"

# Clear line 3 only
/cuecapture/1/overlay/5/line/3/clear

# Wipe slot 5 entirely
/cuecapture/1/overlay/5/clear
```

### Driving CueCapture from an Eos macro

If you've enabled **Use Eos Connection** in Settings → Integrations → OSC (only available on **User TCP Port** mode), an Eos macro can drive CueCapture by issuing an OSC string command. In Eos, an OSC string command in a macro looks like:

```
/cuecapture/1/recording/start
```

Eos sends it over the existing TCP connection; CueCapture forwards it into the same dispatcher that handles UDP. No second connection needed.

If you're on **Third Party OSC** (the default and recommended Eos connection), Eos won't transmit `/cuecapture/...` messages to us — point your macro at the UDP listener instead. The OSC settings panel shows your Mac's IP under "This Mac" so you know what address to put in the macro.

### Driving from Companion or qLab

Companion and qLab both send OSC over UDP. Configure the destination as:

- **Host** — the IP shown under **This Mac** in CueCapture's OSC settings (or `127.0.0.1` if Companion / qLab is running on the same Mac).
- **Port** — the **UDP RX Port** in CueCapture's OSC settings (default `8001`).

Then create a button or cue that sends the OSC address from the catalog above. Most controllers will let you put the address (e.g. `/cuecapture/1/recording/toggle`) in one field and any arguments in separate fields — that's the **arg form** described in [Free-text segments](#free-text-segments).

## Outputs (TX) {#outputs-tx}

CueCapture can send state under `/cuecapture/{id}/out/...` so a remote controller
can update without polling. Enable **TX Enable** under **Settings → Integrations →
OSC**.

Outbound addresses always include the instance ID and use the same **OSC ID** as
inbound commands.

!!! tip "Companion module hint"
    Discrete states are sent in both path and argument forms. A Companion
    recording indicator can listen to `/cuecapture/1/out/recording/recording`
    without parsing an argument.

### Two emit forms

For **discrete enum states** every transition emits two messages:

- **Arg form** — `/cuecapture/{id}/out/<address>` with the value as a single OSC string arg.
- **Path form** — `/cuecapture/{id}/out/<address>/<value>` with no args.

For **continuous / free-form values** (position, duration, filename, rate, cue title), only the arg form is emitted.

### State vocabulary

Stable state names so each Companion feedback pin maps to one durable state:

- View: `"record"`, `"playback"`
- Recording: `"recording"`, `"stopped"`, `"fault"`, `"idle"`
- Deck transport: `"playing"`, `"paused"`, `"stopped"`

### Address catalog

```
/out/identify                              args: <id int>, "<app version>"

/out/view                                  args: "record" | "playback"
/out/view/record                           args: (none)
/out/view/playback                         args: (none)

/out/recording                             args: "recording" | "stopped" | "fault" | "idle"
/out/recording/recording                   args: (none)
/out/recording/stopped                     args: (none)
/out/recording/fault                       args: (none)
/out/recording/idle                        args: (none)

/out/recording/duration                    args: "00:01:23"
/out/recording/duration/seconds            args: <double>           # 1 Hz while recording

/out/recording/last/state                  args: "stopped" | "fault"
/out/recording/last/state/stopped          args: (none)
/out/recording/last/state/fault            args: (none)
/out/recording/last/path                   args: "/Users/.../My Show.mp4"
/out/recording/last/duration               args: "00:42:17"
/out/recording/last/duration/seconds       args: <double>

/out/playback/deck/{a-d}                   args: "playing" | "paused" | "stopped"
/out/playback/deck/{a-d}/playing           args: (none)
/out/playback/deck/{a-d}/paused            args: (none)
/out/playback/deck/{a-d}/stopped           args: (none)

/out/playback/deck/{a-d}/rate              args: <float>
/out/playback/deck/{a-d}/cue               args: "Chapter title", <int 1-based index>

/out/playback/deck/{a-d}/position          args: "hh:mm:ss:ff"      # display, 1 Hz
/out/playback/deck/{a-d}/position/seconds  args: <double>           # math, 1 Hz
/out/playback/deck/{a-d}/filename          args: "Show.mp4"

/out/playback/deck/{a-d}/mix             args: "on" | "off"
/out/playback/deck/{a-d}/mix/on          args: (none)
/out/playback/deck/{a-d}/mix/off         args: (none)
/out/playback/deck/{a-d}/mix/opacity     args: <float 0..1>
/out/playback/deck/{a-d}/mix/gain        args: <float ≥ 0>
/out/playback/deck/{a-d}/mix/threshold   args: <float 0..1>
/out/playback/deck/{a-d}/mix/blend       args: "normal" | "screen" | "lighten" | "difference"

/out/playback/deck/{a-d}/follow            args: "on" | "off"                       # + path-form pair (/follow/on, /follow/off)
/out/playback/deck/{a-d}/follow/source     args: "native" | "default" | "custom"    # + path-form pair
/out/playback/deck/{a-d}/follow/mode       args: "start" | "end"                    # + path-form pair
/out/playback/deck/{a-d}/follow/out-of-sync  args: "on" | "off"                     # + path-form pair
/out/playback/deck/{a-d}/follow/list       args: "<custom list #>"                  # arg-only; "" when unset

/out/playback/active-deck                  args: "a" | "b" | "c" | "d" | ""  # "" when no deck is active
/out/playback/theatre                      args: "a" | "b" | "c" | "d" | ""
/out/playback/fullscreen                   args: "a" | "b" | "c" | "d" | ""
/out/playback/panel/cuelist                args: "expanded" | "collapsed"
/out/playback/panel/cuelist/expanded       args: (none)
/out/playback/panel/cuelist/collapsed      args: (none)
/out/playback/panel/files                  args: "expanded" | "collapsed"    # + path-form pair
/out/playback/panel/timeline               args: "expanded" | "collapsed"    # + path-form pair (bottom row = Timeline + Mixer)
/out/playback/cuelist/filter/{name}        args: "shown" | "hidden"  # + path-form pair; name = scenes|cues|number|label|time|console-tc|fade-bar

/out/playback/mixer/channel/{N}/volume     args: <float 0..2>        # unity (0 dB) = 1.0; N = output N, N=0 = main fader
/out/playback/mixer/channel/{N}/mute       args: "on" | "off"        # N = output N, N=0 = main mute
/out/playback/mixer/channel/{N}/mute/on    args: (none)              # + path-form pair
/out/playback/mixer/channel/{N}/mute/off   args: (none)

/out/settings/showname                     args: "Production"
/out/settings/counter                      args: <int>               # next recording number
/out/settings/log-level                    args: "Information"       # application log level
/out/shutdown/computer-allowed             args: "true" | "false"    # mirror of the OSC safety gate
```

### State snapshots

A full snapshot of the catalog is emitted whenever:

1. A TX configuration is applied with TX enabled.
2. CueCapture receives `/cuecapture/{id}/identify` or its broadcast form.

Snapshot order: `identify` → `view` → `recording` → `recording/duration` (if recording) → `recording/last/*` (if a finished session exists) → each deck a–d in order (state, rate, cue, position, filename, mix block, follow block) → global Playback state (`active-deck`, `theatre`, `fullscreen`, panels, cue-list filters) → settings mirror (`showname`, `counter`, `log-level`, `shutdown/computer-allowed`) → mixer channels in order.

### Cadence

- Continuous outputs (deck position, recording duration, deck cue change-detection) tick at **1 Hz**.
- Transition outputs are sent immediately when the corresponding state changes.

### Not emitted

- **Overlay state** — master visibility, per-module visibility, and slot/line text are deliberately one-way inbound only.
- **Timeline zoom / pan** — continuous, and pan auto-follows the playhead during playback, so streaming them as feedback would flood the wire. Inbound-only.
- **Scene jump** — a navigation action with no durable state; the active chapter is already reflected by `/out/playback/deck/{a-d}/cue`.
- **Active Mix preset** — CueCapture reports the applied Mix values, not the last preset selected.
- **Mix preset contents** — only the values currently applied to each deck are emitted.

### Verification recipe (loopback)

To smoke-test on the same Mac without a Companion config:

1. **Settings → Integrations → OSC → TX Enable on, Broadcast off, Destination IP `127.0.0.1`, Destination Port `8002`**, Apply.
2. In a terminal: `nc -ul 8002` (or `oscdump 8002` if liblo is installed).
3. Toggle the Record/Playback view, start/stop a recording, scrub a loaded deck. The dual-emit messages stream through the listener immediately.

## What to read next

- **Settings → Integrations → OSC** — the field reference for everything that controls inbound OSC and the new TX section.
- **Modules → Custom OSC** — the overlay module that receives slot text.
- **Connecting to an Eos console** — the Eos TCP path that the **Use Eos Connection** toggle hooks into.
