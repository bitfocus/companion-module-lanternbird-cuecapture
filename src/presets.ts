import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import type {
	CompanionPresetDefinitions,
	CompanionPresetGroup,
	CompanionPresetSection,
	CompanionButtonStyleProps,
} from '@companion-module/base'
import { combineRgb } from '@companion-module/base'
import { DECK_LETTERS, type DeckLetter } from './osc/address.js'
import { tryLoadIcon } from './icons.js'

// ─── Palette (matches the icon set; in feedbacks.ts the same colors drive
// default feedback styling).
const RED = combineRgb(220, 30, 30)
const RED_BRIGHT = combineRgb(255, 60, 60)
const DARK_RED = combineRgb(60, 0, 0)
const GREEN = combineRgb(30, 180, 60)
const GREEN_BRIGHT = combineRgb(60, 220, 80)
const AMBER = combineRgb(220, 160, 30)
const NEUTRAL = combineRgb(60, 60, 60)
const NEUTRAL_LIT = combineRgb(120, 120, 120)
const CYAN = combineRgb(20, 180, 200)
const PURPLE = combineRgb(120, 80, 200)
const ORANGE = combineRgb(220, 110, 30)
const PINK = combineRgb(220, 60, 140)
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const DARK_BG = combineRgb(20, 20, 20)

type DeckUiSlot = DeckLetter | 'active'
const DECK_UI_SLOTS: readonly DeckUiSlot[] = [...DECK_LETTERS, 'active']

function deckLabel(slot: DeckUiSlot): string {
	return slot === 'active' ? 'ACT' : slot.toUpperCase()
}

function deckFullLabel(slot: DeckUiSlot): string {
	return slot === 'active' ? 'Active' : `Deck ${slot.toUpperCase()}`
}

function baseStyle(text: string, bgcolor: number, color: number = WHITE, icon?: string): CompanionButtonStyleProps {
	const style: CompanionButtonStyleProps = {
		text,
		size: 'auto',
		color,
		bgcolor,
		show_topbar: false,
	}
	const png = icon ? tryLoadIcon(icon) : undefined
	if (png) {
		style.png64 = png
		style.alignment = 'center:bottom'
		style.pngalignment = 'center:top'
	}
	return style
}

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const structure: CompanionPresetSection[] = []

	// ─── Recording ─────────────────────────────────────────────────────────
	// Live duration as the label: empty while idle (so the icon stands alone)
	// and ticks up while recording (with the red pulse overlaid by feedback).
	presets['rec_toggle'] = {
		type: 'simple',
		name: 'Record: Toggle (flashes red while recording, shows live duration)',
		style: baseStyle('$(cuecapture:recording_duration)', DARK_BG, WHITE, 'record-dot'),
		steps: [
			{
				down: [{ actionId: 'recording_verb', options: { verb: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'recording_flash',
				options: { colorOn: RED, colorOff: DARK_RED, periodMs: 1000 },
			},
		],
	}

	presets['rec_start'] = {
		type: 'simple',
		name: 'Record: Start',
		style: baseStyle('START\\nREC', RED, WHITE, 'record-dot'),
		steps: [{ down: [{ actionId: 'recording_verb', options: { verb: 'start' } }], up: [] }],
		feedbacks: [],
	}

	presets['rec_stop'] = {
		type: 'simple',
		name: 'Record: Stop',
		style: baseStyle('STOP', NEUTRAL, WHITE, 'stop'),
		steps: [{ down: [{ actionId: 'recording_verb', options: { verb: 'stop' } }], up: [] }],
		feedbacks: [
			{
				feedbackId: 'recording_state',
				options: { state: 'recording' },
				style: { bgcolor: RED_BRIGHT, color: WHITE },
			},
		],
	}

	presets['rec_snapshot'] = {
		type: 'simple',
		name: 'Record: Take snapshot (live frame grab, with overlays)',
		style: baseStyle('SNAP', CYAN, WHITE, 'camera'),
		steps: [{ down: [{ actionId: 'recording_snapshot', options: { mode: 'overlay' } }], up: [] }],
		feedbacks: [],
	}

	presets['identify'] = {
		type: 'simple',
		name: 'Identify (flash app title bar + pull state snapshot)',
		style: baseStyle('ID', NEUTRAL, WHITE),
		steps: [{ down: [{ actionId: 'identify', options: {} }], up: [] }],
		feedbacks: [],
	}

	structure.push({
		id: 'recording',
		name: 'Recording',
		definitions: [
			{
				id: 'recording-main',
				name: 'Main',
				description:
					'Record start / stop / toggle, live frame-grab snapshot, identify, and the flashing REC indicator.',
				type: 'simple',
				presets: ['rec_toggle', 'rec_start', 'rec_stop', 'rec_snapshot', 'identify'],
			},
		],
	})

	// ─── Views ─────────────────────────────────────────────────────────────
	// Dark default; feedback lights the button when its view is active.
	presets['view_record'] = {
		type: 'simple',
		name: 'Switch to Record view',
		style: baseStyle('RECORD', BLACK, WHITE, 'camera'),
		steps: [{ down: [{ actionId: 'view', options: { view: 'record' } }], up: [] }],
		feedbacks: [
			{
				feedbackId: 'view_is',
				options: { view: 'record' },
				style: { bgcolor: combineRgb(60, 140, 220), color: WHITE },
			},
		],
	}

	presets['view_playback'] = {
		type: 'simple',
		name: 'Switch to Playback view',
		style: baseStyle('PLAYBACK', BLACK, WHITE, 'cuesheet'),
		steps: [{ down: [{ actionId: 'view', options: { view: 'playback' } }], up: [] }],
		feedbacks: [
			{
				feedbackId: 'view_is',
				options: { view: 'playback' },
				style: { bgcolor: combineRgb(120, 90, 220), color: WHITE },
			},
		],
	}

	structure.push({
		id: 'views',
		name: 'Views',
		definitions: [
			{
				id: 'view-switch',
				name: 'Switch view',
				type: 'simple',
				presets: ['view_record', 'view_playback'],
			},
		],
	})

	// ─── Per-deck presets ──────────────────────────────────────────────────
	for (const slot of DECK_UI_SLOTS) {
		const tag = slot // 'a' | 'b' | 'c' | 'd' | 'active'
		const label = deckLabel(slot)
		const full = deckFullLabel(slot)

		presets[`deck_${tag}_play`] = {
			type: 'simple',
			name: `${full}: Play`,
			style: baseStyle(`${label}\\nPLAY`, GREEN, BLACK, 'play'),
			steps: [
				{
					down: [{ actionId: 'deck_transport', options: { deck: slot, verb: 'play' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_transport_is',
					options: { deck: slot, state: 'playing' },
					style: { bgcolor: GREEN_BRIGHT, color: BLACK },
				},
			],
		}

		presets[`deck_${tag}_pause`] = {
			type: 'simple',
			name: `${full}: Pause`,
			style: baseStyle(`${label}\\nPAUSE`, AMBER, BLACK, 'pause'),
			steps: [
				{
					down: [{ actionId: 'deck_transport', options: { deck: slot, verb: 'pause' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_transport_is',
					options: { deck: slot, state: 'paused' },
					style: { bgcolor: combineRgb(240, 180, 30), color: BLACK },
				},
			],
		}

		presets[`deck_${tag}_toggle`] = {
			type: 'simple',
			name: `${full}: Play / Pause toggle`,
			style: baseStyle(`${label}\\nTGL`, NEUTRAL_LIT, WHITE, 'toggle'),
			steps: [
				{
					down: [{ actionId: 'deck_transport', options: { deck: slot, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_transport_is',
					options: { deck: slot, state: 'playing' },
					style: { bgcolor: GREEN, color: BLACK },
				},
				{
					feedbackId: 'deck_transport_is',
					options: { deck: slot, state: 'paused' },
					style: { bgcolor: AMBER, color: BLACK },
				},
			],
		}

		presets[`deck_${tag}_chapter_next`] = {
			type: 'simple',
			name: `${full}: Next chapter`,
			style: baseStyle(`${label}\\nNEXT`, NEUTRAL_LIT, WHITE, 'next'),
			steps: [
				{
					down: [{ actionId: 'deck_chapter', options: { deck: slot, verb: 'next' } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[`deck_${tag}_chapter_prev`] = {
			type: 'simple',
			name: `${full}: Previous chapter`,
			style: baseStyle(`${label}\\nPREV`, NEUTRAL_LIT, WHITE, 'prev'),
			steps: [
				{
					down: [{ actionId: 'deck_chapter', options: { deck: slot, verb: 'previous' } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Cue-END navigation — mirrors the chapter (cue-START) buttons above but
		// targets the END (start + fade) of each cue.
		presets[`deck_${tag}_chapter_end_next`] = {
			type: 'simple',
			name: `${full}: Next cue END`,
			style: baseStyle(`${label}\\nEND ►`, NEUTRAL_LIT, WHITE, 'next'),
			steps: [
				{
					down: [{ actionId: 'deck_chapter_end', options: { deck: slot, verb: 'next' } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[`deck_${tag}_chapter_end_prev`] = {
			type: 'simple',
			name: `${full}: Previous cue END`,
			style: baseStyle(`${label}\\n◄ END`, NEUTRAL_LIT, WHITE, 'prev'),
			steps: [
				{
					down: [{ actionId: 'deck_chapter_end', options: { deck: slot, verb: 'previous' } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Scrub to the last-fired cue: START (cue/current) and END (cue/end "current").
		presets[`deck_${tag}_cue_current`] = {
			type: 'simple',
			name: `${full}: Scrub to last-fired cue START`,
			style: baseStyle(`${label}\\nCUE ST`, NEUTRAL_LIT, WHITE, 'cuesheet'),
			steps: [
				{
					down: [{ actionId: 'deck_cue_current', options: { deck: slot } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[`deck_${tag}_cue_end_current`] = {
			type: 'simple',
			name: `${full}: Scrub to last-fired cue END`,
			style: baseStyle(`${label}\\nCUE END`, NEUTRAL_LIT, WHITE, 'cuesheet'),
			steps: [
				{
					down: [{ actionId: 'deck_cue_end', options: { deck: slot, cue: 'current' } }],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets[`deck_${tag}_theatre_toggle`] = {
			type: 'simple',
			name: `${full}: Theatre toggle`,
			style: baseStyle(`${label}\\nTHTR`, ORANGE, WHITE, 'theatre'),
			steps: [
				{
					down: [{ actionId: 'deck_theatre', options: { deck: slot, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'theatre_deck_is',
					options: { deck: slot },
					style: { bgcolor: combineRgb(255, 140, 30), color: WHITE },
				},
			],
		}

		presets[`deck_${tag}_fullscreen_toggle`] = {
			type: 'simple',
			name: `${full}: Fullscreen toggle`,
			style: baseStyle(`${label}\\nFULL`, PINK, WHITE, 'fullscreen'),
			steps: [
				{
					down: [{ actionId: 'deck_fullscreen', options: { deck: slot, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'fullscreen_deck_is',
					options: { deck: slot },
					style: { bgcolor: combineRgb(240, 100, 180), color: WHITE },
				},
			],
		}

		presets[`deck_${tag}_mix_toggle`] = {
			type: 'simple',
			name: `${full}: Mix toggle`,
			style: baseStyle(`${label}\\nGHST`, NEUTRAL, CYAN, 'mix'),
			steps: [
				{
					down: [
						{
							actionId: 'deck_mix_visibility',
							options: { deck: slot, verb: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_mix_on',
					options: { deck: slot },
					style: { bgcolor: CYAN, color: BLACK },
				},
			],
		}

		if (slot !== 'active') {
			presets[`deck_${tag}_activate`] = {
				type: 'simple',
				name: `${full}: Make active`,
				style: baseStyle(`${label}\\nACT`, PURPLE, WHITE),
				steps: [
					{
						down: [{ actionId: 'deck_activate', options: { deck: slot } }],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'active_deck_is',
						options: { deck: slot },
						style: { bgcolor: combineRgb(160, 110, 240), color: WHITE },
					},
				],
			}
		}
	}

	// Deck sections in the browser
	for (const slot of DECK_UI_SLOTS) {
		const full = deckFullLabel(slot)
		const ids = [
			`deck_${slot}_play`,
			`deck_${slot}_pause`,
			`deck_${slot}_toggle`,
			`deck_${slot}_chapter_next`,
			`deck_${slot}_chapter_prev`,
			`deck_${slot}_chapter_end_next`,
			`deck_${slot}_chapter_end_prev`,
			`deck_${slot}_cue_current`,
			`deck_${slot}_cue_end_current`,
			`deck_${slot}_theatre_toggle`,
			`deck_${slot}_fullscreen_toggle`,
			`deck_${slot}_mix_toggle`,
		]
		if (slot !== 'active') ids.push(`deck_${slot}_activate`)
		structure.push({
			id: `deck-${slot}`,
			name: full,
			definitions: [
				{
					id: `deck-${slot}-main`,
					name: 'Transport + view',
					type: 'simple',
					presets: ids,
				},
			],
		})
	}

	// ─── Active deck nav ───────────────────────────────────────────────────
	presets['active_next'] = {
		type: 'simple',
		name: 'Active deck: next',
		style: baseStyle('NEXT\\nACT', NEUTRAL_LIT, WHITE, 'next'),
		steps: [{ down: [{ actionId: 'active_deck_nav', options: { verb: 'next' } }], up: [] }],
		feedbacks: [],
	}
	presets['active_prev'] = {
		type: 'simple',
		name: 'Active deck: previous',
		style: baseStyle('PREV\\nACT', NEUTRAL_LIT, WHITE, 'prev'),
		steps: [{ down: [{ actionId: 'active_deck_nav', options: { verb: 'previous' } }], up: [] }],
		feedbacks: [],
	}

	structure.push({
		id: 'active-deck-nav',
		name: 'Active deck nav',
		definitions: [
			{
				id: 'active-nav',
				name: 'Cycle active deck',
				type: 'simple',
				presets: ['active_next', 'active_prev'],
			},
		],
	})

	// ─── Panels ────────────────────────────────────────────────────────────
	for (const panel of ['cuelist', 'files', 'timeline'] as const) {
		presets[`panel_${panel}_toggle`] = {
			type: 'simple',
			name: `Panel: ${panel} toggle`,
			style: baseStyle(panel.toUpperCase(), NEUTRAL, WHITE),
			steps: [{ down: [{ actionId: 'panel', options: { panel, verb: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'panel_is',
					options: { panel, state: 'expanded' },
					style: { bgcolor: NEUTRAL_LIT, color: WHITE },
				},
			],
		}
	}

	structure.push({
		id: 'panels',
		name: 'Playback panels',
		definitions: [
			{
				id: 'panel-toggles',
				name: 'Show/hide playback panels',
				type: 'simple',
				presets: ['panel_cuelist_toggle', 'panel_files_toggle', 'panel_timeline_toggle'],
			},
		],
	})

	// ─── Cue list display filters ──────────────────────────────────────────
	// Seven toggles for the cue-list panel display checkboxes. The 5 field
	// filters (number/label/time/console-tc/fade-bar) only have visible effect
	// while `cues` is shown — but they still track state independently, so the
	// feedback lights even when the cues filter is off.
	const CUELIST_FILTER_NAMES_PRESET = ['scenes', 'cues', 'number', 'label', 'time', 'console-tc', 'fade-bar'] as const
	const cuelistFilterIds: string[] = []
	for (const name of CUELIST_FILTER_NAMES_PRESET) {
		const id = `cuelist_filter_${name.replace(/-/g, '_')}_toggle`
		cuelistFilterIds.push(id)
		// Label kept short and uppercase; the user customizes if they want more.
		const labelText = name.replace(/-/g, '\\n').toUpperCase()
		presets[id] = {
			type: 'simple',
			name: `Cue list filter: ${name} toggle (lit grey when shown)`,
			style: baseStyle(labelText, BLACK, WHITE),
			steps: [
				{
					down: [{ actionId: 'cuelist_filter', options: { name, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'cuelist_filter_is',
					options: { name, state: 'shown' },
					style: { bgcolor: NEUTRAL_LIT, color: WHITE },
				},
			],
		}
	}
	structure.push({
		id: 'cuelist-filters',
		name: 'Cue list filters',
		definitions: [
			{
				id: 'cuelist-filter-toggles',
				name: 'Display column toggles',
				description:
					'Toggles the cue-list panel display checkboxes. The 5 field filters only have visible effect while `cues` is shown.',
				type: 'simple',
				presets: cuelistFilterIds,
			},
		],
	})

	// ─── Settings ──────────────────────────────────────────────────────────
	presets['counter_reset'] = {
		type: 'simple',
		name: 'Counter: reset to CounterStart',
		style: baseStyle('CTR\\nRESET', NEUTRAL, WHITE),
		steps: [{ down: [{ actionId: 'settings_counter_reset', options: {} }], up: [] }],
		feedbacks: [],
	}

	structure.push({
		id: 'settings',
		name: 'Settings',
		definitions: [
			{
				id: 'settings-basic',
				name: 'Settings shortcuts',
				type: 'simple',
				presets: ['counter_reset'],
			},
		],
	})

	// ─── Shutdown ──────────────────────────────────────────────────────────
	presets['shutdown_app'] = {
		type: 'simple',
		name: 'Quit CueCapture app',
		style: baseStyle('QUIT\\nAPP', combineRgb(120, 0, 0), WHITE),
		steps: [{ down: [{ actionId: 'shutdown_app', options: {} }], up: [] }],
		feedbacks: [],
	}

	structure.push({
		id: 'shutdown',
		name: 'Shutdown',
		definitions: [
			{
				id: 'shutdown-basic',
				name: 'App shutdown',
				type: 'simple',
				presets: ['shutdown_app'],
			},
		],
	})

	// ─── Variable readouts ─────────────────────────────────────────────────
	presets['readout_recording_status'] = {
		type: 'simple',
		name: 'Recording status + duration',
		style: {
			text: '$(cuecapture:recording_state)\\n$(cuecapture:recording_duration)',
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'recording_state',
				options: { state: 'recording' },
				style: { bgcolor: RED, color: WHITE },
			},
			{
				feedbackId: 'recording_state',
				options: { state: 'fault' },
				style: { bgcolor: combineRgb(180, 30, 200), color: WHITE },
			},
		],
	}

	// Active-deck readouts drop the redundant "ACT $(active_deck)" prefix —
	// the button is already dedicated to the active deck. Live transport state
	// rendered as the top line so the user can see playing/paused at a glance.
	presets['readout_active_deck_position'] = {
		type: 'simple',
		name: 'Active deck: state + position (lit green when playing)',
		style: {
			text: '$(cuecapture:active_deck_state)\\n$(cuecapture:active_deck_position)',
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [
			{
				feedbackId: 'deck_transport_is',
				options: { deck: 'active', state: 'playing' },
				style: { bgcolor: combineRgb(30, 120, 30), color: WHITE },
			},
		],
	}

	presets['readout_active_cue_title'] = {
		type: 'simple',
		name: 'Active deck: current cue title',
		style: {
			text: '$(cuecapture:active_deck_cue_title)',
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [],
	}

	presets['readout_last_recording_path'] = {
		type: 'simple',
		name: 'Last recording: filename',
		style: {
			text: 'LAST\\n$(cuecapture:last_recording_path)',
			size: 'auto',
			color: WHITE,
			bgcolor: DARK_BG,
			show_topbar: false,
		},
		steps: [],
		feedbacks: [],
	}

	structure.push({
		id: 'readouts',
		name: 'Readouts',
		definitions: [
			{
				id: 'readouts-main',
				name: 'Live readout buttons',
				type: 'simple',
				presets: [
					'readout_recording_status',
					'readout_active_deck_position',
					'readout_active_cue_title',
					'readout_last_recording_path',
				],
			},
		],
	})

	// ─── Rotary knobs ──────────────────────────────────────────────────────
	// One row of presets per deck slot covering the standard rotary verbs.
	// Each uses Stream-Deck-style three-action wiring: rotate_left + rotate_right
	// fire fixed step/cycle deltas (CueCapture clamps server-side); the press
	// (down) resets or toggles the related value.
	for (const slot of DECK_UI_SLOTS) {
		const tag = slot
		const label = deckLabel(slot)
		const full = deckFullLabel(slot)

		// Active-slot rotaries replace the static label with the live value —
		// matches the dedicated-to-active button pattern. Per-deck (a/b/c/d)
		// stays label-based since those buttons usually live as a row of siblings
		// where the deck letter is the at-a-glance identifier.
		const opacityText = slot === 'active' ? '$(cuecapture:active_deck_mix_opacity)' : `${label}\\nOPACITY`

		presets[`rotary_${tag}_mix_opacity`] = {
			type: 'simple',
			name: `${full}: ROTARY mix opacity (press = toggle mix on/off)`,
			style: baseStyle(opacityText, BLACK, CYAN, 'mix'),
			steps: [
				{
					down: [
						{
							actionId: 'deck_mix_visibility',
							options: { deck: slot, verb: 'toggle' },
						},
					],
					up: [],
					rotate_left: [
						{
							actionId: 'deck_mix_opacity_step',
							options: { deck: slot, delta: -0.05 },
						},
					],
					rotate_right: [
						{
							actionId: 'deck_mix_opacity_step',
							options: { deck: slot, delta: 0.05 },
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_mix_on',
					options: { deck: slot },
					style: { bgcolor: CYAN, color: BLACK },
				},
			],
		}

		const gainText = slot === 'active' ? '$(cuecapture:active_deck_mix_gain)' : `${label}\\nGAIN`
		presets[`rotary_${tag}_mix_gain`] = {
			type: 'simple',
			name: `${full}: ROTARY mix gain (press = reset to 1.0)`,
			style: baseStyle(gainText, BLACK, CYAN, 'mix'),
			steps: [
				{
					down: [{ actionId: 'deck_mix_gain', options: { deck: slot, value: 1 } }],
					up: [],
					rotate_left: [{ actionId: 'deck_mix_gain_step', options: { deck: slot, delta: -0.1 } }],
					rotate_right: [{ actionId: 'deck_mix_gain_step', options: { deck: slot, delta: 0.1 } }],
				},
			],
			feedbacks: [],
		}

		const thresholdText = slot === 'active' ? '$(cuecapture:active_deck_mix_threshold)' : `${label}\\nTHRSH`
		presets[`rotary_${tag}_mix_threshold`] = {
			type: 'simple',
			name: `${full}: ROTARY mix threshold (press = reset to 0)`,
			style: baseStyle(thresholdText, BLACK, CYAN, 'mix'),
			steps: [
				{
					down: [{ actionId: 'deck_mix_threshold', options: { deck: slot, value: 0 } }],
					up: [],
					rotate_left: [
						{
							actionId: 'deck_mix_threshold_step',
							options: { deck: slot, delta: -0.05 },
						},
					],
					rotate_right: [
						{
							actionId: 'deck_mix_threshold_step',
							options: { deck: slot, delta: 0.05 },
						},
					],
				},
			],
			feedbacks: [],
		}

		const blendText = slot === 'active' ? '$(cuecapture:active_deck_mix_blend)' : `${label}\\nBLEND`
		presets[`rotary_${tag}_mix_blend`] = {
			type: 'simple',
			name: `${full}: ROTARY mix blend cycle (press = reset to normal)`,
			style: baseStyle(blendText, BLACK, CYAN, 'mix'),
			steps: [
				{
					down: [
						{
							actionId: 'deck_mix_blend',
							options: { deck: slot, blend: 'normal' },
						},
					],
					up: [],
					rotate_left: [
						{
							actionId: 'deck_mix_blend_cycle',
							options: { deck: slot, direction: -1 },
						},
					],
					rotate_right: [
						{
							actionId: 'deck_mix_blend_cycle',
							options: { deck: slot, direction: 1 },
						},
					],
				},
			],
			feedbacks: [],
		}

		const rateText = slot === 'active' ? '$(cuecapture:active_deck_rate)' : `${label}\\nRATE`
		presets[`rotary_${tag}_rate`] = {
			type: 'simple',
			name: `${full}: ROTARY playback rate (press = reset to 1.0)`,
			style: baseStyle(rateText, BLACK, GREEN, 'play'),
			steps: [
				{
					down: [{ actionId: 'deck_rate', options: { deck: slot, rate: 1 } }],
					up: [],
					rotate_left: [{ actionId: 'deck_rate_step', options: { deck: slot, delta: -0.05 } }],
					rotate_right: [{ actionId: 'deck_rate_step', options: { deck: slot, delta: 0.05 } }],
				},
			],
			feedbacks: [],
		}

		// JOG: ±1 s feels better on a knob than ±5; the chapter-next icon doesn't
		// semantically fit a jog wheel so it's dropped here.
		presets[`rotary_${tag}_scrub`] = {
			type: 'simple',
			name: `${full}: ROTARY jog ±1s (press = play/pause toggle)`,
			style: baseStyle(`${label}\\nJOG`, combineRgb(36, 36, 36), WHITE),
			steps: [
				{
					down: [
						{
							actionId: 'deck_transport',
							options: { deck: slot, verb: 'toggle' },
						},
					],
					up: [],
					rotate_left: [{ actionId: 'deck_seek_step', options: { deck: slot, deltaSeconds: -1 } }],
					rotate_right: [{ actionId: 'deck_seek_step', options: { deck: slot, deltaSeconds: 1 } }],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_transport_is',
					options: { deck: slot, state: 'playing' },
					style: { bgcolor: GREEN, color: BLACK },
				},
			],
		}

		presets[`rotary_${tag}_cue_nav`] = {
			type: 'simple',
			name: `${full}: ROTARY cue prev/next (press = no-op)`,
			style: baseStyle(`${label}\\nCUE`, combineRgb(51, 0, 51), WHITE, 'cuesheet'),
			steps: [
				{
					down: [],
					up: [],
					rotate_left: [{ actionId: 'deck_chapter', options: { deck: slot, verb: 'previous' } }],
					rotate_right: [{ actionId: 'deck_chapter', options: { deck: slot, verb: 'next' } }],
				},
			],
			feedbacks: [],
		}

		// Timeline zoom rotary: rotate to step ±1.0×, press to fit. CueCapture
		// clamps to [1.0, 100.0]. Pan/zoom are not TX'd so no feedback to wire.
		presets[`rotary_${tag}_timeline_zoom`] = {
			type: 'simple',
			name: `${full}: ROTARY timeline zoom ±1× (press = fit)`,
			style: baseStyle(`${label}\\nZOOM`, combineRgb(20, 40, 50), WHITE),
			steps: [
				{
					down: [{ actionId: 'deck_timeline_zoom_fit', options: { deck: slot } }],
					up: [],
					rotate_left: [{ actionId: 'deck_timeline_zoom_step', options: { deck: slot, delta: -1 } }],
					rotate_right: [{ actionId: 'deck_timeline_zoom_step', options: { deck: slot, delta: 1 } }],
				},
			],
			feedbacks: [],
		}

		// Timeline pan rotary: rotate to scroll ±5s. Press = pan to start (0s).
		presets[`rotary_${tag}_timeline_pan`] = {
			type: 'simple',
			name: `${full}: ROTARY timeline pan ±5s (press = pan to start)`,
			style: baseStyle(`${label}\\nPAN`, combineRgb(20, 40, 50), WHITE),
			steps: [
				{
					down: [{ actionId: 'deck_timeline_pan', options: { deck: slot, seconds: 0 } }],
					up: [],
					rotate_left: [{ actionId: 'deck_timeline_pan_step', options: { deck: slot, deltaSeconds: -5 } }],
					rotate_right: [{ actionId: 'deck_timeline_pan_step', options: { deck: slot, deltaSeconds: 5 } }],
				},
			],
			feedbacks: [],
		}
	}

	// ─── Follow Console (per deck) ─────────────────────────────────────────
	// One section per deck-slot containing: follow on/off toggle, out-of-sync
	// toggle, mode start/end picks (with feedback), and source picks (native/
	// default/custom, with feedback). Follow source/mode are presented as
	// dedicated buttons rather than cycling rotaries because CueCapture doesn't
	// expose a step/cycle verb for them and a typed dropdown stays cleaner.
	const followDefinitions: CompanionPresetGroup<ModuleSchema>[] = []
	for (const slot of DECK_UI_SLOTS) {
		const tag = slot
		const label = deckLabel(slot)
		const full = deckFullLabel(slot)
		// Active-slot variants drop the prefix and use the live variable for text.
		const followText = slot === 'active' ? '$(cuecapture:active_deck_follow_state)' : `${label}\\nFLW`
		const outOfSyncText = slot === 'active' ? 'OOS\\n$(cuecapture:active_deck_follow_out_of_sync)' : `${label}\\nOOS`

		presets[`deck_${tag}_follow_toggle`] = {
			type: 'simple',
			name: `${full}: Follow Console toggle (lit blue when on)`,
			style: baseStyle(followText, BLACK, WHITE),
			steps: [
				{
					down: [{ actionId: 'deck_follow_visibility', options: { deck: slot, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_follow_on',
					options: { deck: slot },
					style: { bgcolor: combineRgb(40, 140, 220), color: WHITE },
				},
			],
		}

		presets[`deck_${tag}_follow_out_of_sync_toggle`] = {
			type: 'simple',
			name: `${full}: Follow Console out-of-sync fallback toggle (lit amber when on)`,
			style: baseStyle(outOfSyncText, BLACK, WHITE),
			steps: [
				{
					down: [{ actionId: 'deck_follow_out_of_sync', options: { deck: slot, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'deck_follow_out_of_sync_on',
					options: { deck: slot },
					style: { bgcolor: combineRgb(180, 100, 40), color: WHITE },
				},
			],
		}

		const followIds = [`deck_${tag}_follow_toggle`, `deck_${tag}_follow_out_of_sync_toggle`]

		// Mode start/end and source native/default/custom — only for the 'active'
		// slot to keep the preset list manageable. The user can pick a deck-targeted
		// action manually if they need to set mode/source for a specific deck.
		if (slot === 'active') {
			for (const mode of ['start', 'end'] as const) {
				presets[`deck_active_follow_mode_${mode}`] = {
					type: 'simple',
					name: `Active: Follow mode = ${mode}`,
					style: baseStyle(`MODE\\n${mode.toUpperCase()}`, BLACK, WHITE),
					steps: [{ down: [{ actionId: 'deck_follow_mode', options: { deck: slot, mode } }], up: [] }],
					feedbacks: [
						{
							feedbackId: 'deck_follow_mode_is',
							options: { deck: slot, mode },
							style: { bgcolor: combineRgb(30, 110, 180), color: WHITE },
						},
					],
				}
				followIds.push(`deck_active_follow_mode_${mode}`)
			}
			for (const source of ['native', 'default', 'custom'] as const) {
				presets[`deck_active_follow_source_${source}`] = {
					type: 'simple',
					name: `Active: Follow source = ${source}`,
					style: baseStyle(`SRC\\n${source.toUpperCase()}`, BLACK, WHITE),
					steps: [{ down: [{ actionId: 'deck_follow_source', options: { deck: slot, source } }], up: [] }],
					feedbacks: [
						{
							feedbackId: 'deck_follow_source_is',
							options: { deck: slot, source },
							style: { bgcolor: combineRgb(30, 110, 180), color: WHITE },
						},
					],
				}
				followIds.push(`deck_active_follow_source_${source}`)
			}
		}

		followDefinitions.push({
			id: `follow-${slot}`,
			name: full,
			description:
				slot === 'active'
					? 'Follow toggle, OOS toggle, mode picks, and source picks for whichever deck is currently active.'
					: 'Follow toggle and out-of-sync fallback toggle for this deck.',
			type: 'simple',
			presets: followIds,
		})
	}
	structure.push({ id: 'follow', name: 'Follow Console', definitions: followDefinitions })

	// ─── Mixer ─────────────────────────────────────────────────────────────
	// Per-output volume rotary + mute toggle for the most common output
	// range (1..8). User can drop the generic variants and edit the output
	// number for outputs 9..64. Volume range is 0..2 (unity = 1.0 = 0 dB).
	const MIXER_PRESET_CHANNELS = 8
	for (let ch = 1; ch <= MIXER_PRESET_CHANNELS; ch++) {
		const chs = String(ch)
		presets[`mixer_${chs}_volume_rotary`] = {
			type: 'simple',
			name: `Mixer Out ${ch}: ROTARY volume (press = mute toggle, lit red when muted)`,
			style: baseStyle(`OUT ${ch}\\nVOL`, NEUTRAL, WHITE),
			steps: [
				{
					down: [{ actionId: 'mixer_mute', options: { channel: ch, verb: 'toggle' } }],
					up: [],
					rotate_left: [{ actionId: 'mixer_volume_step', options: { channel: ch, delta: -0.05 } }],
					rotate_right: [{ actionId: 'mixer_volume_step', options: { channel: ch, delta: 0.05 } }],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mixer_channel_mute_is',
					options: { channel: ch, state: 'on' },
					style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
				},
			],
		}

		presets[`mixer_${chs}_mute_toggle`] = {
			type: 'simple',
			name: `Mixer Out ${ch}: mute toggle (lit red when muted)`,
			style: baseStyle(`OUT ${ch}\\nMUTE`, NEUTRAL, WHITE),
			steps: [
				{
					down: [{ actionId: 'mixer_mute', options: { channel: ch, verb: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mixer_channel_mute_is',
					options: { channel: ch, state: 'on' },
					style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
				},
			],
		}
	}

	// Main (master) fader = channel 0. Always present regardless of the loaded
	// file's output count. Same shape as a numbered output, hard-wired to 0.
	presets['mixer_main_volume_rotary'] = {
		type: 'simple',
		name: 'Mixer MAIN: ROTARY volume (press = mute toggle, lit red when muted)',
		style: baseStyle('MAIN\\nVOL', NEUTRAL, WHITE),
		steps: [
			{
				down: [{ actionId: 'mixer_main_mute', options: { verb: 'toggle' } }],
				up: [],
				rotate_left: [{ actionId: 'mixer_main_volume_step', options: { delta: -0.05 } }],
				rotate_right: [{ actionId: 'mixer_main_volume_step', options: { delta: 0.05 } }],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mixer_main_mute_is',
				options: { state: 'on' },
				style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
			},
		],
	}

	presets['mixer_main_mute_toggle'] = {
		type: 'simple',
		name: 'Mixer MAIN: mute toggle (lit red when muted)',
		style: baseStyle('MAIN\\nMUTE', NEUTRAL, WHITE),
		steps: [
			{
				down: [{ actionId: 'mixer_main_mute', options: { verb: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mixer_main_mute_is',
				options: { state: 'on' },
				style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
			},
		],
	}

	// Generic mixer presets — drop and edit the output number for outputs > 8.
	presets['mixer_any_volume_rotary'] = {
		type: 'simple',
		name: 'Mixer (any output): ROTARY volume — edit output after drop',
		style: baseStyle('OUT ?\\nVOL', NEUTRAL, WHITE),
		steps: [
			{
				down: [{ actionId: 'mixer_mute', options: { channel: 1, verb: 'toggle' } }],
				up: [],
				rotate_left: [{ actionId: 'mixer_volume_step', options: { channel: 1, delta: -0.05 } }],
				rotate_right: [{ actionId: 'mixer_volume_step', options: { channel: 1, delta: 0.05 } }],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mixer_channel_mute_is',
				options: { channel: 1, state: 'on' },
				style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
			},
		],
	}

	presets['mixer_any_mute_toggle'] = {
		type: 'simple',
		name: 'Mixer (any output): mute toggle — edit output after drop',
		style: baseStyle('OUT ?\\nMUTE', NEUTRAL, WHITE),
		steps: [
			{
				down: [{ actionId: 'mixer_mute', options: { channel: 1, verb: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mixer_channel_mute_is',
				options: { channel: 1, state: 'on' },
				style: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
			},
		],
	}

	// One browser group per output + a Main group + a Generic group.
	// Single "Mixer" section.
	const mixerDefinitions: CompanionPresetGroup<ModuleSchema>[] = []
	mixerDefinitions.push({
		id: 'mixer-main',
		name: 'Main (master fader)',
		description: 'Channel 0 — always present, independent of the loaded file.',
		type: 'simple',
		presets: ['mixer_main_volume_rotary', 'mixer_main_mute_toggle'],
	})
	for (let ch = 1; ch <= MIXER_PRESET_CHANNELS; ch++) {
		mixerDefinitions.push({
			id: `mixer-ch-${ch}`,
			name: `Output ${ch}`,
			type: 'simple',
			presets: [`mixer_${ch}_volume_rotary`, `mixer_${ch}_mute_toggle`],
		})
	}
	mixerDefinitions.push({
		id: 'mixer-generic',
		name: 'Generic (edit output after drop)',
		description: "Defaults to Out 1; edit the dropped button's output field for outputs 9..64.",
		type: 'simple',
		presets: ['mixer_any_volume_rotary', 'mixer_any_mute_toggle'],
	})
	structure.push({
		id: 'mixer',
		name: 'Mixer',
		definitions: mixerDefinitions,
	})

	// ─── Custom OSC escape-hatch ───────────────────────────────────────────
	// One-button starter that fires an arbitrary CueCapture OSC address.
	// Defaults to recording/toggle so a drop-and-press just works; edit the
	// action's `address` + `args` fields to point at whatever verb you need.
	presets['send_custom_osc'] = {
		type: 'simple',
		name: 'Custom: send arbitrary OSC (escape hatch)',
		style: baseStyle('CUSTOM\\nOSC', combineRgb(40, 40, 40), WHITE),
		steps: [
			{
				down: [
					{
						actionId: 'send_custom',
						options: {
							address: 'recording/toggle',
							prependInstanceId: true,
							args: '',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	structure.push({
		id: 'custom',
		name: 'Custom',
		definitions: [
			{
				id: 'custom-main',
				name: 'Escape hatch',
				description:
					'For OSC verbs not covered by a typed action above. Edit the dropped button\'s "address" + "args" fields.',
				type: 'simple',
				presets: ['send_custom_osc'],
			},
		],
	})

	// Global rotary presets
	presets['rotary_active_deck_cycle'] = {
		type: 'simple',
		name: 'ROTARY active deck cycle (press = identify)',
		style: baseStyle('ACTIVE\\nDECK', PURPLE, WHITE),
		steps: [
			{
				down: [{ actionId: 'identify', options: {} }],
				up: [],
				rotate_left: [{ actionId: 'active_deck_nav', options: { verb: 'previous' } }],
				rotate_right: [{ actionId: 'active_deck_nav', options: { verb: 'next' } }],
			},
		],
		feedbacks: [],
	}

	presets['rotary_counter'] = {
		type: 'simple',
		name: 'ROTARY file counter (press = reset)',
		style: {
			text: 'CTR\\n$(cuecapture:counter)',
			size: 'auto',
			color: WHITE,
			bgcolor: NEUTRAL,
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'settings_counter_reset', options: {} }],
				up: [],
				rotate_left: [{ actionId: 'settings_counter_step', options: { delta: -1 } }],
				rotate_right: [{ actionId: 'settings_counter_step', options: { delta: 1 } }],
			},
		],
		feedbacks: [],
	}

	// Rotary browser sections — one section per deck + a Global section.
	for (const slot of DECK_UI_SLOTS) {
		const full = deckFullLabel(slot)
		structure.push({
			id: `rotary-${slot}`,
			name: `Rotary: ${full}`,
			definitions: [
				{
					id: `rotary-${slot}-main`,
					name: 'Rotary knobs',
					description: 'Stream Deck + / Loupedeck-style rotary controls. Rotate to step, press to reset or toggle.',
					type: 'simple',
					presets: [
						`rotary_${slot}_mix_opacity`,
						`rotary_${slot}_mix_gain`,
						`rotary_${slot}_mix_threshold`,
						`rotary_${slot}_mix_blend`,
						`rotary_${slot}_rate`,
						`rotary_${slot}_scrub`,
						`rotary_${slot}_cue_nav`,
						`rotary_${slot}_timeline_zoom`,
						`rotary_${slot}_timeline_pan`,
					],
				},
			],
		})
	}
	structure.push({
		id: 'rotary-global',
		name: 'Rotary: Global',
		definitions: [
			{
				id: 'rotary-global-main',
				name: 'Global rotary knobs',
				type: 'simple',
				presets: ['rotary_active_deck_cycle', 'rotary_counter'],
			},
		],
	})

	self.setPresetDefinitions(structure, presets)
}
