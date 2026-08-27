import type ModuleInstance from './main.js'
import type { CompanionActionDefinitions } from '@companion-module/base'
import { DECK_LETTERS, DECK_SLOT_CHOICES, type DeckLetter, type DeckSlot } from './osc/address.js'
import type { OscArg } from './osc/codec.js'
import { CUELIST_FILTER_NAMES, type CuelistFilterName } from './state.js'

// ───────────────────────────────────────────────────────────────────────────
// Argument parsing for the `send_custom` escape-hatch action.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parses a single arg token from the `send_custom` action's args field.
 * Explicit type prefixes win; otherwise we autodetect int / float / bool /
 * string from the literal.
 *
 *   s:Hello      → "Hello"           (string, prefix wins even for digits)
 *   i:42         → int 42
 *   f:0.5        → float 0.5
 *   b:true       → true              (also accepts 1, yes, on; opposite for false)
 *   42           → int 42            (autodetect)
 *   0.5          → float 0.5         (autodetect — has a decimal)
 *   true         → true              (autodetect)
 *   anything else → string
 */
function parseCustomArg(raw: string): OscArg {
	const t = raw.trim()
	if (t.length === 0) return ''
	const prefix = t.slice(0, 2).toLowerCase()
	if (prefix === 's:') return t.slice(2)
	if (prefix === 'i:') {
		const n = Number(t.slice(2))
		return Number.isInteger(n) ? { type: 'int' as const, value: n } : t.slice(2)
	}
	if (prefix === 'f:') {
		const n = Number(t.slice(2))
		return Number.isFinite(n) ? { type: 'float' as const, value: n } : t.slice(2)
	}
	if (prefix === 'b:') {
		const v = t.slice(2).trim().toLowerCase()
		return v === 'true' || v === '1' || v === 'yes' || v === 'on'
	}
	if (/^-?\d+$/.test(t)) return { type: 'int' as const, value: Number(t) }
	if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(t) && t.includes('.')) {
		return { type: 'float' as const, value: Number(t) }
	}
	if (t.toLowerCase() === 'true') return true
	if (t.toLowerCase() === 'false') return false
	return t
}

/**
 * Splits the args field on `;` (not `,` — too easy for strings to contain
 * a comma) and parses each segment. Empty input → no args.
 */
function parseCustomArgs(raw: string): readonly OscArg[] {
	const trimmed = raw.trim()
	if (trimmed.length === 0) return []
	return trimmed.split(';').map(parseCustomArg)
}

// ───────────────────────────────────────────────────────────────────────────
// Schema — declares the option shape of every action so callbacks are typed.
// ───────────────────────────────────────────────────────────────────────────

type EmptyOpts = Record<string, never>
type DeckSlotOpts = { deck: DeckSlot }
type DeckLetterOpts = { deck: DeckLetter }

type Verb3 = 'show' | 'hide' | 'toggle'
type RecVerb = 'start' | 'stop' | 'toggle'
type PlayVerb = 'play' | 'pause' | 'toggle'
type ChapterVerb = 'next' | 'previous'
type ViewName = 'record' | 'playback'
type PanelName = 'cuelist' | 'files' | 'timeline'
type MixSlot = 'default' | '1' | '2' | '3'
type MixBlendName = 'normal' | 'screen' | 'lighten' | 'difference'
type LogLevelName = 'verbose' | 'debug' | 'information' | 'warning' | 'error' | 'fatal'
type MeterType = 'linear' | 'thinear' | 'arc12' | 'arc34' | 'square' | 'circle' | 'segbar' | 'numeric'
type FollowSourceName = 'native' | 'default' | 'custom'
type FollowModeName = 'start' | 'end'
type SnapshotModeName = 'overlay' | 'no-overlays' | 'raw'

export type ActionsSchema = {
	identify: { options: EmptyOpts }
	view: { options: { view: ViewName } }
	recording_verb: { options: { verb: RecVerb } }
	recording_marker: { options: { label: string } }
	recording_snapshot: { options: { mode: SnapshotModeName } }

	deck_transport: { options: DeckSlotOpts & { verb: PlayVerb } }
	deck_seek: { options: DeckSlotOpts & { seconds: number } }
	deck_rate: { options: DeckSlotOpts & { rate: number } }
	deck_cue: { options: DeckSlotOpts & { cue: string } }
	deck_cue_current: { options: DeckSlotOpts }
	deck_cue_end: { options: DeckSlotOpts & { cue: string } }
	deck_chapter: { options: DeckSlotOpts & { verb: ChapterVerb } }
	deck_chapter_end: { options: DeckSlotOpts & { verb: ChapterVerb } }
	deck_snapshot: { options: DeckSlotOpts }
	deck_activate: { options: DeckLetterOpts }

	deck_theatre: { options: DeckSlotOpts & { verb: Verb3 } }
	deck_fullscreen: { options: DeckSlotOpts & { verb: Verb3 } }
	deck_mix_visibility: { options: DeckSlotOpts & { verb: Verb3 } }
	deck_mix_recall: { options: DeckSlotOpts & { slot: MixSlot } }
	deck_mix_opacity: { options: DeckSlotOpts & { value: number } }
	deck_mix_gain: { options: DeckSlotOpts & { value: number } }
	deck_mix_threshold: { options: DeckSlotOpts & { value: number } }
	deck_mix_blend: { options: DeckSlotOpts & { blend: MixBlendName } }

	active_deck_nav: { options: { verb: ChapterVerb } }
	panel: { options: { panel: PanelName; verb: Verb3 } }

	settings_showname: { options: { name: string } }
	settings_counter: { options: { value: number } }
	settings_counter_reset: { options: EmptyOpts }
	settings_log_level: { options: { level: LogLevelName } }

	shutdown_app: { options: EmptyOpts }
	shutdown_computer: { options: EmptyOpts }

	overlay: { options: { verb: Verb3 } }
	overlay_module: { options: { moduleName: string; verb: Verb3 } }
	overlay_slot_text: { options: { slot: number; line: number; text: string } }
	overlay_slot_clear: { options: { slot: number; line: number } }

	// Step / cycle verbs — designed for rotary knobs. CueCapture handles the
	// read-modify-write atomically and clamps server-side.
	send_custom: {
		options: {
			address: string
			prependInstanceId: boolean
			args: string
		}
	}

	deck_mix_opacity_step: { options: DeckSlotOpts & { delta: number } }
	deck_mix_gain_step: { options: DeckSlotOpts & { delta: number } }
	deck_mix_threshold_step: { options: DeckSlotOpts & { delta: number } }
	deck_mix_blend_cycle: { options: DeckSlotOpts & { direction: number } }
	deck_rate_step: { options: DeckSlotOpts & { delta: number } }
	deck_seek_step: { options: DeckSlotOpts & { deltaSeconds: number } }
	settings_counter_step: { options: { delta: number } }

	// Mixer — per-output volume + mute. Output is 1-based (matches the UI's
	// "Out 1".."Out N" labels). CueCapture clamps volume to [0, 2.0] (unity = 1.0).
	mixer_volume: { options: { channel: number; value: number } }
	mixer_volume_step: { options: { channel: number; delta: number } }
	mixer_mute: { options: { channel: number; verb: 'on' | 'off' | 'toggle' } }

	// Mixer MAIN (master) fader = channel 0. Addressed exactly like a numbered
	// output but with N=0. Always present, independent of the loaded file's
	// output count. No output field — it's hard-wired to 0.
	mixer_main_volume: { options: { value: number } }
	mixer_main_volume_step: { options: { delta: number } }
	mixer_main_mute: { options: { verb: 'on' | 'off' | 'toggle' } }

	// Follow console — per deck. CueCapture auto-scrubs the deck to track the
	// live Eos console as cues fire.
	deck_follow_visibility: { options: DeckSlotOpts & { verb: Verb3 } }
	deck_follow_source: { options: DeckSlotOpts & { source: FollowSourceName } }
	deck_follow_list: { options: DeckSlotOpts & { list: number } }
	deck_follow_mode: { options: DeckSlotOpts & { mode: FollowModeName } }
	deck_follow_out_of_sync: { options: DeckSlotOpts & { verb: Verb3 } }

	// Timeline zoom + pan — per deck. Inbound-only (CueCapture does NOT TX
	// these; pan auto-follows the playhead during playback so we'd flood the
	// wire if it did).
	deck_timeline_zoom: { options: DeckSlotOpts & { value: number } }
	deck_timeline_zoom_step: { options: DeckSlotOpts & { delta: number } }
	deck_timeline_zoom_fit: { options: DeckSlotOpts }
	deck_timeline_pan: { options: DeckSlotOpts & { seconds: number } }
	deck_timeline_pan_step: { options: DeckSlotOpts & { deltaSeconds: number } }

	// Scene navigation — jump a deck to a scene divider by name.
	deck_scene: { options: DeckSlotOpts & { name: string } }

	// Cue-list panel display filters (global; not deck-scoped).
	cuelist_filter: { options: { name: CuelistFilterName; verb: Verb3 } }

	meter_batch: { options: { bank: number; values: string } }
	meter_value: { options: { bank: number; meter: number; value: number } }
	meter_label: { options: { bank: number; meter: number; label: string } }
	meter_min: { options: { bank: number; meter: number; value: number } }
	meter_max: { options: { bank: number; meter: number; value: number } }
	meter_type: { options: { bank: number; meter: number; type: MeterType } }
	meter_set_all: {
		options: {
			bank: number
			meter: number
			label: string
			min: number
			max: number
			type: MeterType
			value: number
		}
	}
}

// ───────────────────────────────────────────────────────────────────────────
// Option-field constructors (kept small so each action stays readable).
// ───────────────────────────────────────────────────────────────────────────

const VERB3_CHOICES = [
	{ id: 'show', label: 'Show' },
	{ id: 'hide', label: 'Hide' },
	{ id: 'toggle', label: 'Toggle' },
] as const

const REC_VERB_CHOICES = [
	{ id: 'start', label: 'Start' },
	{ id: 'stop', label: 'Stop' },
	{ id: 'toggle', label: 'Toggle' },
] as const

const PLAY_VERB_CHOICES = [
	{ id: 'play', label: 'Play' },
	{ id: 'pause', label: 'Pause' },
	{ id: 'toggle', label: 'Toggle' },
] as const

const CHAPTER_VERB_CHOICES = [
	{ id: 'next', label: 'Next' },
	{ id: 'previous', label: 'Previous' },
] as const

const VIEW_CHOICES = [
	{ id: 'record', label: 'Record' },
	{ id: 'playback', label: 'Playback' },
] as const

const SNAPSHOT_MODE_CHOICES = [
	{ id: 'overlay', label: 'With overlays' },
	{ id: 'no-overlays', label: 'Without overlays' },
	{ id: 'raw', label: 'Raw camera' },
] as const

const PANEL_CHOICES = [
	{ id: 'cuelist', label: 'Cue list' },
	{ id: 'files', label: 'Files' },
	{ id: 'timeline', label: 'Timeline + Mixer' },
] as const

const MIX_SLOT_CHOICES = [
	{ id: 'default', label: 'Default' },
	{ id: '1', label: 'Slot 1' },
	{ id: '2', label: 'Slot 2' },
	{ id: '3', label: 'Slot 3' },
] as const

const MIX_BLEND_CHOICES = [
	{ id: 'normal', label: 'Normal' },
	{ id: 'screen', label: 'Screen' },
	{ id: 'lighten', label: 'Lighten' },
	{ id: 'difference', label: 'Difference' },
] as const

const LOG_LEVEL_CHOICES = [
	{ id: 'verbose', label: 'Verbose' },
	{ id: 'debug', label: 'Debug' },
	{ id: 'information', label: 'Information' },
	{ id: 'warning', label: 'Warning' },
	{ id: 'error', label: 'Error' },
	{ id: 'fatal', label: 'Fatal' },
] as const

const METER_TYPE_CHOICES = [
	{ id: 'linear', label: 'Linear bar' },
	{ id: 'thinear', label: 'Thin linear' },
	{ id: 'arc12', label: 'Arc (half)' },
	{ id: 'arc34', label: 'Arc (three-quarter)' },
	{ id: 'square', label: 'Square' },
	{ id: 'circle', label: 'Circle' },
	{ id: 'segbar', label: 'Segmented bar' },
	{ id: 'numeric', label: 'Numeric readout' },
] as const

const FOLLOW_SOURCE_CHOICES = [
	{ id: 'native', label: 'Native (deck file)' },
	{ id: 'default', label: 'Default list' },
	{ id: 'custom', label: 'Custom (set list number below)' },
] as const

const FOLLOW_MODE_CHOICES = [
	{ id: 'start', label: 'Cue start' },
	{ id: 'end', label: 'Cue end (start + fade)' },
] as const

const CUELIST_FILTER_CHOICES = CUELIST_FILTER_NAMES.map((n) => ({ id: n, label: n }))

const DECK_LETTER_CHOICES = DECK_LETTERS.map((l) => ({ id: l, label: `Deck ${l.toUpperCase()}` }))

// ───────────────────────────────────────────────────────────────────────────
// UpdateActions: build the action definition map.
// ───────────────────────────────────────────────────────────────────────────

export function UpdateActions(self: ModuleInstance): void {
	const deckSlotField = {
		id: 'deck' as const,
		type: 'dropdown' as const,
		label: 'Deck',
		default: 'a',
		choices: DECK_SLOT_CHOICES.map((c) => ({ ...c })),
	}
	const deckLetterField = {
		id: 'deck' as const,
		type: 'dropdown' as const,
		label: 'Deck',
		default: 'a',
		choices: DECK_LETTER_CHOICES.map((c) => ({ ...c })),
	}

	const defs: CompanionActionDefinitions<ActionsSchema> = {
		// Escape-hatch: fire an arbitrary OSC address against CueCapture's RX port.
		// Use this when a CueCapture verb isn't covered by a typed action above,
		// or while CueCapture is gaining new RX surface faster than this module.
		send_custom: {
			name: 'Custom: send arbitrary OSC',
			description:
				'Fires any OSC address at the configured host:txPort. Args field accepts semicolon-separated values with optional s:/i:/f:/b: type prefixes (e.g. "s:Cue 5; i:42; f:0.5; b:true"). Numbers autodetect — integer-looking → int, decimal → float, "true"/"false" → bool, anything else → string.',
			options: [
				{
					id: 'address',
					type: 'textinput',
					label: 'OSC address (suffix or full)',
					default: 'recording/toggle',
					tooltip:
						'e.g. "recording/start" or "playback/deck/a/play". If "Prepend /cuecapture/{id}/" is on, this is treated as the suffix.',
					useVariables: true,
				},
				{
					id: 'prependInstanceId',
					type: 'checkbox',
					label: "Prepend /cuecapture/{id}/ (use the connection's Instance ID)",
					default: true,
				},
				{
					id: 'args',
					type: 'textinput',
					label: 'Args (semicolon-separated; empty for verb-only)',
					default: '',
					tooltip:
						'Type prefixes: s:string, i:int, f:float, b:bool. Without a prefix: integer-string → int, decimal-string → float, true/false → bool, else string. Use ; not , because strings often contain commas.',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const addressInput = String(event.options['address'] ?? '').trim()
				if (addressInput.length === 0) return
				const prepend = event.options['prependInstanceId'] !== false
				const args = parseCustomArgs(String(event.options['args'] ?? ''))
				if (prepend) {
					const suffix = addressInput.replace(/^\/+/, '')
					const segments = suffix.split('/').filter((s) => s.length > 0)
					self.sendToApp(segments, args)
				} else {
					self.sendRawAddress(addressInput, args)
				}
			},
		},

		identify: {
			name: 'Handshake: Identify (flash title bar + snapshot)',
			options: [],
			callback: async () => self.sendIdentify(),
		},

		view: {
			name: 'View: switch',
			options: [
				{
					id: 'view',
					type: 'dropdown',
					label: 'View',
					default: 'record',
					choices: VIEW_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const v = event.options['view']
				self.sendToApp(['view', v])
			},
		},

		recording_verb: {
			name: 'Recording: start / stop / toggle',
			options: [
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: REC_VERB_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const v = event.options['verb']
				self.sendToApp(['recording', v])
			},
		},

		recording_marker: {
			name: 'Recording: drop marker (v1 stub — logs only)',
			options: [
				{
					id: 'label',
					type: 'textinput',
					label: 'Marker label (optional)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const label = (event.options['label'] as string | undefined) ?? ''
				if (label.length === 0) {
					self.sendToApp(['recording', 'marker'])
				} else {
					self.sendToApp(['recording', 'marker'], [label])
				}
			},
		},

		recording_snapshot: {
			name: 'Recording: take snapshot (live frame grab)',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'overlay',
					choices: SNAPSHOT_MODE_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const mode = event.options['mode']
				switch (mode) {
					case 'overlay':
						self.sendToApp(['recording', 'snapshot'])
						break
					case 'no-overlays':
						self.sendToApp(['recording', 'snapshot', 'no-overlays'])
						break
					case 'raw':
						self.sendToApp(['recording', 'snapshot', 'raw'])
						break
					default:
						// Deliberately not fail-closed: a stage button that silently does
						// nothing is worse than a safe with-overlays grab.
						self.log('warn', `Unknown snapshot mode ${JSON.stringify(mode)} — taking a with-overlays snapshot`)
						self.sendToApp(['recording', 'snapshot'])
						break
				}
			},
		},

		// ─── Deck transport ────────────────────────────────────────────────────

		deck_transport: {
			name: 'Deck: play / pause / toggle',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: PLAY_VERB_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, verb])
			},
		},

		deck_seek: {
			name: 'Deck: seek (seconds)',
			options: [
				deckSlotField,
				{
					id: 'seconds',
					type: 'number',
					label: 'Seconds',
					default: 0,
					min: 0,
					max: 86400,
					step: 0.1,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const seconds = Number(event.options['seconds'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'seek'], [{ type: 'float', value: seconds }])
			},
		},

		deck_rate: {
			name: 'Deck: playback rate',
			options: [
				deckSlotField,
				{
					id: 'rate',
					type: 'number',
					label: 'Rate (1.0 = normal)',
					default: 1,
					min: 0.1,
					max: 4,
					step: 0.05,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const rate = Number(event.options['rate'] ?? 1)
				self.sendToApp(['playback', 'deck', deck, 'rate'], [{ type: 'float', value: rate }])
			},
		},

		deck_cue: {
			name: 'Deck: jump to cue (by number)',
			options: [
				deckSlotField,
				{
					id: 'cue',
					type: 'textinput',
					label: 'Cue number / title',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const cue = String(event.options['cue'] ?? '')
				self.sendToApp(['playback', 'deck', deck, 'cue'], [cue])
			},
		},

		deck_cue_current: {
			name: 'Deck: scrub to last-fired cue START',
			description:
				'Scrubs the deck to the START of the cue the console most recently fired. No-op if the console is not in a cue.',
			options: [deckSlotField],
			callback: async (event) => {
				const deck = event.options['deck']
				self.sendToApp(['playback', 'deck', deck, 'cue', 'current'])
			},
		},

		deck_cue_end: {
			name: 'Deck: scrub to cue END (start + fade)',
			description:
				'Scrubs to the END (start + fade) of the given cue. Enter a cue number, or "current" for the last-fired cue.',
			options: [
				deckSlotField,
				{
					id: 'cue',
					type: 'textinput',
					label: 'Cue number (or "current" for last-fired)',
					default: 'current',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const cue = String(event.options['cue'] ?? '').trim()
				if (cue.length === 0) return
				self.sendToApp(['playback', 'deck', deck, 'cue', 'end'], [cue])
			},
		},

		deck_chapter: {
			name: 'Deck: next / previous chapter',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Direction',
					default: 'next',
					choices: CHAPTER_VERB_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'chapter', verb])
			},
		},

		deck_chapter_end: {
			name: 'Deck: step to next / previous cue END',
			description:
				'Steps to the END (start + fade) of the next or previous cue. Mirrors "next / previous chapter", which steps cue STARTS.',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Direction',
					default: 'next',
					choices: CHAPTER_VERB_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'chapter', 'end', verb])
			},
		},

		deck_snapshot: {
			name: 'Deck: snapshot (v1 stub — logs deck + position)',
			options: [deckSlotField],
			callback: async (event) => {
				const deck = event.options['deck']
				self.sendToApp(['playback', 'deck', deck, 'snapshot'])
			},
		},

		deck_activate: {
			name: 'Deck: set as active deck',
			options: [deckLetterField],
			callback: async (event) => {
				const deck = event.options['deck']
				self.sendToApp(['playback', 'deck', deck, 'activate'])
			},
		},

		// ─── Theatre / fullscreen ──────────────────────────────────────────────

		deck_theatre: {
			name: 'Deck: theatre show / hide / toggle',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'theatre', verb])
			},
		},

		deck_fullscreen: {
			name: 'Deck: fullscreen show / hide / toggle',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'fullscreen', verb])
			},
		},

		// ─── Mix ─────────────────────────────────────────────────────────────

		deck_mix_visibility: {
			name: 'Deck: mix show / hide / toggle',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'mix', verb])
			},
		},

		deck_mix_recall: {
			name: 'Deck: mix recall snapshot',
			options: [
				deckSlotField,
				{
					id: 'slot',
					type: 'dropdown',
					label: 'Slot',
					default: 'default',
					choices: MIX_SLOT_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const slot = event.options['slot']
				self.sendToApp(['playback', 'deck', deck, 'mix', 'recall'], [slot])
			},
		},

		deck_mix_opacity: {
			name: 'Deck: mix opacity (0..1)',
			options: [
				deckSlotField,
				{ id: 'value', type: 'number', label: 'Opacity', default: 0.5, min: 0, max: 1, step: 0.01 },
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const v = Number(event.options['value'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'opacity'], [{ type: 'float', value: v }])
			},
		},

		deck_mix_gain: {
			name: 'Deck: mix brightness gain (≥ 0)',
			options: [deckSlotField, { id: 'value', type: 'number', label: 'Gain', default: 1, min: 0, max: 10, step: 0.05 }],
			callback: async (event) => {
				const deck = event.options['deck']
				const v = Number(event.options['value'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'gain'], [{ type: 'float', value: v }])
			},
		},

		deck_mix_threshold: {
			name: 'Deck: mix brightness threshold (0..1)',
			options: [
				deckSlotField,
				{ id: 'value', type: 'number', label: 'Threshold', default: 0, min: 0, max: 1, step: 0.01 },
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const v = Number(event.options['value'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'threshold'], [{ type: 'float', value: v }])
			},
		},

		deck_mix_blend: {
			name: 'Deck: mix blend mode',
			options: [
				deckSlotField,
				{
					id: 'blend',
					type: 'dropdown',
					label: 'Blend',
					default: 'normal',
					choices: MIX_BLEND_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const blend = event.options['blend']
				self.sendToApp(['playback', 'deck', deck, 'mix', 'blend'], [blend])
			},
		},

		// ─── Active deck nav ───────────────────────────────────────────────────

		active_deck_nav: {
			name: 'Active deck: next / previous',
			options: [
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Direction',
					default: 'next',
					choices: CHAPTER_VERB_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const verb = event.options['verb']
				self.sendToApp(['playback', 'active-deck', verb])
			},
		},

		// ─── Panels ────────────────────────────────────────────────────────────

		panel: {
			name: 'Playback panel: show / hide / toggle',
			options: [
				{
					id: 'panel',
					type: 'dropdown',
					label: 'Panel',
					default: 'cuelist',
					choices: PANEL_CHOICES.map((c) => ({ ...c })),
				},
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const panel = event.options['panel']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'panel', panel, verb])
			},
		},

		// ─── Settings ──────────────────────────────────────────────────────────

		settings_showname: {
			name: 'Settings: show name',
			options: [{ id: 'name', type: 'textinput', label: 'Show name', default: '', useVariables: true }],
			callback: async (event) => {
				const name = String(event.options['name'] ?? '')
				self.sendToApp(['settings', 'set', 'showname'], [name])
			},
		},

		settings_counter: {
			name: 'Settings: file-naming counter',
			options: [{ id: 'value', type: 'number', label: 'Counter', default: 0, min: 0, max: 100000 }],
			callback: async (event) => {
				const v = Math.max(0, Math.floor(Number(event.options['value'] ?? 0)))
				self.sendToApp(['settings', 'set', 'counter'], [{ type: 'int', value: v }])
			},
		},

		settings_counter_reset: {
			name: 'Settings: reset counter',
			options: [],
			callback: async () => self.sendToApp(['settings', 'counter', 'reset']),
		},

		settings_log_level: {
			name: 'Settings: log level',
			options: [
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 'information',
					choices: LOG_LEVEL_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const level = event.options['level']
				self.sendToApp(['settings', 'set', 'log-level'], [level])
			},
		},

		// ─── Shutdown ──────────────────────────────────────────────────────────

		shutdown_app: {
			name: 'Shutdown: quit app',
			options: [],
			callback: async () => self.sendToApp(['shutdown', 'app']),
		},

		shutdown_computer: {
			name: 'Shutdown: power off computer (must be allowed in app settings)',
			options: [],
			callback: async () => self.sendToApp(['shutdown', 'computer']),
		},

		// ─── Overlay ───────────────────────────────────────────────────────────

		overlay: {
			name: 'Overlay: master show / hide / toggle',
			options: [
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const verb = event.options['verb']
				self.sendToApp(['overlay', verb])
			},
		},

		overlay_module: {
			name: 'Overlay module: show / hide / toggle (by name)',
			options: [
				{
					id: 'moduleName',
					type: 'textinput',
					label: 'Module name (spaces → underscores)',
					default: '',
					useVariables: true,
				},
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const name = String(event.options['moduleName'] ?? '')
				if (name.length === 0) return
				const verb = event.options['verb']
				// Module name goes on the address; replace spaces with underscores per spec.
				const safe = name.replace(/\s+/g, '_')
				self.sendToApp(['overlay', 'module', safe, verb])
			},
		},

		overlay_slot_text: {
			name: 'Overlay Custom OSC slot: set line text',
			options: [
				{ id: 'slot', type: 'number', label: 'Slot (1..32)', default: 1, min: 1, max: 32 },
				{ id: 'line', type: 'number', label: 'Line (1..16)', default: 1, min: 1, max: 16 },
				{ id: 'text', type: 'textinput', label: 'Text', default: '', useVariables: true },
			],
			callback: async (event) => {
				// Always targets the line-form address — the slot-form `/overlay/{slot}/text` with one
				// arg is the BATCH form that clobbers lines 2–16 with empties (per the OSC manual).
				const slot = Math.floor(Number(event.options['slot'] ?? 1))
				const line = Math.max(1, Math.min(16, Math.floor(Number(event.options['line'] ?? 1))))
				const text = String(event.options['text'] ?? '')
				self.sendToApp(['overlay', String(slot), 'line', String(line), 'text'], [text])
			},
		},

		overlay_slot_clear: {
			name: 'Overlay Custom OSC slot: clear (0 = whole slot)',
			options: [
				{ id: 'slot', type: 'number', label: 'Slot (1..32)', default: 1, min: 1, max: 32 },
				{ id: 'line', type: 'number', label: 'Line (0 = clear all)', default: 0, min: 0, max: 16 },
			],
			callback: async (event) => {
				const slot = Math.floor(Number(event.options['slot'] ?? 1))
				const line = Math.floor(Number(event.options['line'] ?? 0))
				if (line === 0) {
					self.sendToApp(['overlay', String(slot), 'clear'])
				} else {
					self.sendToApp(['overlay', String(slot), 'line', String(line), 'clear'])
				}
			},
		},

		// ─── Step / cycle (rotary-friendly atomic deltas) ──────────────────────
		// These mirror the CueCapture-side step verbs (e.g. /mix/opacity/step).
		// CueCapture reads current state, applies the delta, clamps, emits the
		// resulting absolute value via TX — no read-modify-write race here.

		deck_mix_opacity_step: {
			name: 'Deck: mix opacity step (rotary)',
			options: [
				deckSlotField,
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.05)',
					default: 0.05,
					min: -1,
					max: 1,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'opacity', 'step'], [{ type: 'float', value: delta }])
			},
		},

		deck_mix_gain_step: {
			name: 'Deck: mix gain step (rotary)',
			options: [
				deckSlotField,
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.1)',
					default: 0.1,
					min: -10,
					max: 10,
					step: 0.05,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'gain', 'step'], [{ type: 'float', value: delta }])
			},
		},

		deck_mix_threshold_step: {
			name: 'Deck: mix threshold step (rotary)',
			options: [
				deckSlotField,
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.05)',
					default: 0.05,
					min: -1,
					max: 1,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'mix', 'threshold', 'step'], [{ type: 'float', value: delta }])
			},
		},

		deck_mix_blend_cycle: {
			name: 'Deck: mix blend cycle (rotary)',
			options: [
				deckSlotField,
				{
					id: 'direction',
					type: 'dropdown',
					label: 'Direction',
					default: 1,
					choices: [
						{ id: 1, label: 'Forward (→ next blend)' },
						{ id: -1, label: 'Backward (← previous blend)' },
					],
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const direction = Number(event.options['direction'] ?? 1) >= 0 ? 1 : -1
				self.sendToApp(['playback', 'deck', deck, 'mix', 'blend', 'cycle'], [{ type: 'int', value: direction }])
			},
		},

		deck_rate_step: {
			name: 'Deck: playback rate step (rotary)',
			options: [
				deckSlotField,
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.05)',
					default: 0.05,
					min: -4,
					max: 4,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'rate', 'step'], [{ type: 'float', value: delta }])
			},
		},

		deck_seek_step: {
			name: 'Deck: seek step / jog (rotary, seconds)',
			options: [
				deckSlotField,
				{
					id: 'deltaSeconds',
					type: 'number',
					label: 'Delta seconds (e.g. +5)',
					default: 5,
					min: -3600,
					max: 3600,
					step: 0.5,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['deltaSeconds'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'seek', 'step'], [{ type: 'float', value: delta }])
			},
		},

		settings_counter_step: {
			name: 'Settings: counter step (rotary)',
			options: [
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +1)',
					default: 1,
					min: -1000,
					max: 1000,
					step: 1,
				},
			],
			callback: async (event) => {
				const delta = Math.trunc(Number(event.options['delta'] ?? 0))
				self.sendToApp(['settings', 'counter', 'step'], [{ type: 'int', value: delta }])
			},
		},

		// ─── Mixer (Playback mixer panel) ──────────────────────────────────────
		// Output is 1-based. CueCapture clamps volume to [0, 2.0] server-side
		// (unity = 1.0 = 0 dB). Out-of-range outputs are a silent no-op there.

		mixer_volume: {
			name: 'Mixer: set output volume (absolute, 0..2)',
			options: [
				{ id: 'channel', type: 'number', label: 'Output (1..64)', default: 1, min: 1, max: 64 },
				{
					id: 'value',
					type: 'number',
					label: 'Volume (0 = silent, 1 = unity, 2 = +6 dB max)',
					default: 1,
					min: 0,
					max: 2,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const ch = Math.floor(Number(event.options['channel'] ?? 1))
				const value = Number(event.options['value'] ?? 1)
				self.sendToApp(['playback', 'mixer', 'channel', String(ch), 'volume'], [{ type: 'float', value }])
			},
		},

		mixer_volume_step: {
			name: 'Mixer: output volume step (rotary)',
			options: [
				{ id: 'channel', type: 'number', label: 'Output (1..64)', default: 1, min: 1, max: 64 },
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.05)',
					default: 0.05,
					min: -2,
					max: 2,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const ch = Math.floor(Number(event.options['channel'] ?? 1))
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(
					['playback', 'mixer', 'channel', String(ch), 'volume', 'step'],
					[{ type: 'float', value: delta }],
				)
			},
		},

		mixer_mute: {
			name: 'Mixer: output mute on / off / toggle',
			options: [
				{ id: 'channel', type: 'number', label: 'Output (1..64)', default: 1, min: 1, max: 64 },
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: [
						{ id: 'on', label: 'Mute (on)' },
						{ id: 'off', label: 'Unmute (off)' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (event) => {
				const ch = Math.floor(Number(event.options['channel'] ?? 1))
				const verb = event.options['verb']
				self.sendToApp(['playback', 'mixer', 'channel', String(ch), 'mute', verb])
			},
		},

		// ─── Mixer MAIN / master fader (channel 0) ─────────────────────────────
		// Same wire shape + clamp as a numbered output, but hard-wired to N=0.
		// The main fader always exists regardless of the loaded file.

		mixer_main_volume: {
			name: 'Mixer: set MAIN (master) volume (absolute, 0..2)',
			options: [
				{
					id: 'value',
					type: 'number',
					label: 'Volume (0 = silent, 1 = unity, 2 = +6 dB max)',
					default: 1,
					min: 0,
					max: 2,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const value = Number(event.options['value'] ?? 1)
				self.sendToApp(['playback', 'mixer', 'channel', '0', 'volume'], [{ type: 'float', value }])
			},
		},

		mixer_main_volume_step: {
			name: 'Mixer: MAIN (master) volume step (rotary)',
			options: [
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +0.05)',
					default: 0.05,
					min: -2,
					max: 2,
					step: 0.01,
				},
			],
			callback: async (event) => {
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'mixer', 'channel', '0', 'volume', 'step'], [{ type: 'float', value: delta }])
			},
		},

		mixer_main_mute: {
			name: 'Mixer: MAIN (master) mute on / off / toggle',
			options: [
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: [
						{ id: 'on', label: 'Mute (on)' },
						{ id: 'off', label: 'Unmute (off)' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (event) => {
				const verb = event.options['verb']
				self.sendToApp(['playback', 'mixer', 'channel', '0', 'mute', verb])
			},
		},

		// ─── Follow console (per deck) ─────────────────────────────────────────
		// Address shape: /playback/deck/{deck}/follow/...
		// Enum-valued sub-keys (source, mode, out-of-sync) use the path form
		// because CueCapture rejects numeric source names; sending the value
		// as a path segment matches how its dispatcher prefers to parse them.

		deck_follow_visibility: {
			name: 'Deck: Follow Console show / hide / toggle',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'follow', verb])
			},
		},

		deck_follow_source: {
			name: 'Deck: Follow Console source (native / default / custom)',
			description: 'Which cue list the deck follows. Sending a numeric token here is rejected — use the source name.',
			options: [
				deckSlotField,
				{
					id: 'source',
					type: 'dropdown',
					label: 'Source',
					default: 'native',
					choices: FOLLOW_SOURCE_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const source = event.options['source']
				self.sendToApp(['playback', 'deck', deck, 'follow', 'source', source])
			},
		},

		deck_follow_list: {
			name: 'Deck: Follow Console custom list #',
			description:
				'Only effective when Source = Custom. CueCapture will store it but it has no effect under Native/Default.',
			options: [
				deckSlotField,
				{ id: 'list', type: 'number', label: 'Custom list number', default: 1, min: 0, max: 99999 },
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const list = Math.max(0, Math.floor(Number(event.options['list'] ?? 1)))
				self.sendToApp(['playback', 'deck', deck, 'follow', 'list', String(list)])
			},
		},

		deck_follow_mode: {
			name: 'Deck: Follow Console mode (cue start / end)',
			options: [
				deckSlotField,
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Scrub to',
					default: 'start',
					choices: FOLLOW_MODE_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const mode = event.options['mode']
				self.sendToApp(['playback', 'deck', deck, 'follow', 'mode', mode])
			},
		},

		deck_follow_out_of_sync: {
			name: 'Deck: Follow Console — out-of-sync fallback show / hide / toggle',
			description:
				'When on, a fired cue with no matching chapter seeks to the nearest prior existing cue instead of doing nothing.',
			options: [
				deckSlotField,
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'deck', deck, 'follow', 'out-of-sync', verb])
			},
		},

		// ─── Timeline zoom / pan (per deck, inbound-only) ──────────────────────
		// CueCapture clamps zoom to [1.0, 100.0] and pan to [0, duration − visible].

		deck_timeline_zoom: {
			name: 'Deck: timeline zoom (absolute, 1.0 = whole file)',
			options: [
				deckSlotField,
				{ id: 'value', type: 'number', label: 'Zoom (1..100)', default: 1, min: 1, max: 100, step: 0.5 },
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const value = Number(event.options['value'] ?? 1)
				self.sendToApp(['playback', 'deck', deck, 'timeline', 'zoom'], [{ type: 'float', value }])
			},
		},

		deck_timeline_zoom_step: {
			name: 'Deck: timeline zoom step (rotary)',
			options: [
				deckSlotField,
				{
					id: 'delta',
					type: 'number',
					label: 'Delta (e.g. +1.0)',
					default: 1,
					min: -100,
					max: 100,
					step: 0.5,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['delta'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'timeline', 'zoom', 'step'], [{ type: 'float', value: delta }])
			},
		},

		deck_timeline_zoom_fit: {
			name: 'Deck: timeline zoom fit (reset to 1×, scroll to start)',
			options: [deckSlotField],
			callback: async (event) => {
				const deck = event.options['deck']
				self.sendToApp(['playback', 'deck', deck, 'timeline', 'zoom', 'fit'])
			},
		},

		deck_timeline_pan: {
			name: 'Deck: timeline pan (visible-window start, seconds)',
			options: [
				deckSlotField,
				{ id: 'seconds', type: 'number', label: 'Seconds', default: 0, min: 0, max: 86400, step: 0.1 },
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const seconds = Number(event.options['seconds'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'timeline', 'pan'], [{ type: 'float', value: seconds }])
			},
		},

		deck_timeline_pan_step: {
			name: 'Deck: timeline pan step (rotary, negative = scroll left)',
			options: [
				deckSlotField,
				{
					id: 'deltaSeconds',
					type: 'number',
					label: 'Delta seconds (e.g. +5)',
					default: 5,
					min: -3600,
					max: 3600,
					step: 0.5,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const delta = Number(event.options['deltaSeconds'] ?? 0)
				self.sendToApp(['playback', 'deck', deck, 'timeline', 'pan', 'step'], [{ type: 'float', value: delta }])
			},
		},

		// ─── Scene navigation ──────────────────────────────────────────────────
		// Arg form is used (string arg accepts spaces/punctuation, unlike the
		// /scene/{name} path form which requires `_` for spaces).

		deck_scene: {
			name: 'Deck: jump to scene divider (by name)',
			options: [
				deckSlotField,
				{
					id: 'name',
					type: 'textinput',
					label: 'Scene name (spaces / punctuation OK)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const deck = event.options['deck']
				const name = String(event.options['name'] ?? '')
				if (name.length === 0) return
				self.sendToApp(['playback', 'deck', deck, 'scene'], [name])
			},
		},

		// ─── Cue-list display filters (global) ─────────────────────────────────
		// The 5 field filters (number/label/time/console-tc/fade-bar) only have
		// visible effect while the `cues` filter is on. No deck dimension.

		cuelist_filter: {
			name: 'Cue list filter: show / hide / toggle a display column',
			description:
				'Toggles the cue-list panel display checkboxes. The 5 field filters only have visible effect while the `cues` filter is on.',
			options: [
				{
					id: 'name',
					type: 'dropdown',
					label: 'Filter',
					default: 'cues',
					choices: CUELIST_FILTER_CHOICES.map((c) => ({ ...c })),
				},
				{
					id: 'verb',
					type: 'dropdown',
					label: 'Verb',
					default: 'toggle',
					choices: VERB3_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const name = event.options['name']
				const verb = event.options['verb']
				self.sendToApp(['playback', 'cuelist', 'filter', name, verb])
			},
		},

		// ─── Meter panel ───────────────────────────────────────────────────────

		meter_batch: {
			name: 'Meter: batch set all meter values in a bank',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{
					id: 'values',
					type: 'textinput',
					label: 'Values (comma-separated floats; first → meter 1)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const raw = String(event.options['values'] ?? '')
				const values = raw
					.split(',')
					.map((v) => Number(v.trim()))
					.filter((n) => Number.isFinite(n))
				if (values.length === 0) return
				self.sendToApp(
					['meter', String(bank)],
					values.map((value) => ({ type: 'float' as const, value })),
				)
			},
		},

		meter_value: {
			name: 'Meter: set value',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index (1-based)', default: 1, min: 1, max: 64 },
				{ id: 'value', type: 'number', label: 'Value', default: 0, min: -1e6, max: 1e6, step: 0.1 },
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const value = Number(event.options['value'] ?? 0)
				self.sendToApp(['meter', String(bank), String(meter), 'value'], [{ type: 'float', value }])
			},
		},

		meter_label: {
			name: 'Meter: set label',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index', default: 1, min: 1, max: 64 },
				{ id: 'label', type: 'textinput', label: 'Label', default: '', useVariables: true },
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const label = String(event.options['label'] ?? '')
				self.sendToApp(['meter', String(bank), String(meter), 'label'], [label])
			},
		},

		meter_min: {
			name: 'Meter: set min',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index', default: 1, min: 1, max: 64 },
				{ id: 'value', type: 'number', label: 'Min', default: 0, min: -1e6, max: 1e6, step: 0.1 },
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const value = Number(event.options['value'] ?? 0)
				self.sendToApp(['meter', String(bank), String(meter), 'min'], [{ type: 'float', value }])
			},
		},

		meter_max: {
			name: 'Meter: set max',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index', default: 1, min: 1, max: 64 },
				{ id: 'value', type: 'number', label: 'Max', default: 1, min: -1e6, max: 1e6, step: 0.1 },
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const value = Number(event.options['value'] ?? 0)
				self.sendToApp(['meter', String(bank), String(meter), 'max'], [{ type: 'float', value }])
			},
		},

		meter_type: {
			name: 'Meter: set type',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index', default: 1, min: 1, max: 64 },
				{
					id: 'type',
					type: 'dropdown',
					label: 'Type',
					default: 'linear',
					choices: METER_TYPE_CHOICES.map((c) => ({ ...c })),
				},
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const type = event.options['type']
				self.sendToApp(['meter', String(bank), String(meter), 'type'], [type])
			},
		},

		meter_set_all: {
			name: 'Meter: set all (label, min, max, type, value bundled)',
			options: [
				{ id: 'bank', type: 'number', label: 'Bank', default: 1, min: 1, max: 99 },
				{ id: 'meter', type: 'number', label: 'Meter index', default: 1, min: 1, max: 64 },
				{ id: 'label', type: 'textinput', label: 'Label', default: '', useVariables: true },
				{ id: 'min', type: 'number', label: 'Min', default: 0, min: -1e6, max: 1e6, step: 0.1 },
				{ id: 'max', type: 'number', label: 'Max', default: 1, min: -1e6, max: 1e6, step: 0.1 },
				{
					id: 'type',
					type: 'dropdown',
					label: 'Type',
					default: 'linear',
					choices: METER_TYPE_CHOICES.map((c) => ({ ...c })),
				},
				{ id: 'value', type: 'number', label: 'Value', default: 0, min: -1e6, max: 1e6, step: 0.1 },
			],
			callback: async (event) => {
				const bank = Math.floor(Number(event.options['bank'] ?? 1))
				const meter = Math.floor(Number(event.options['meter'] ?? 1))
				const label = String(event.options['label'] ?? '')
				const min = Number(event.options['min'] ?? 0)
				const max = Number(event.options['max'] ?? 1)
				const type = event.options['type']
				const value = Number(event.options['value'] ?? 0)
				self.sendToApp(
					['meter', String(bank), String(meter)],
					[label, { type: 'float', value: min }, { type: 'float', value: max }, type, { type: 'float', value }],
				)
			},
		},
	}

	self.setActionDefinitions(defs)
}
