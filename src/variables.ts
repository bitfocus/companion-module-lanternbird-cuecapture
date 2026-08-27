import { DECK_LETTERS, type DeckLetter } from './osc/address.js'
import type ModuleInstance from './main.js'
import { CUELIST_FILTER_NAMES, MIXER_MAIN_CHANNEL, MIXER_MAX_CHANNELS, type AppState, type DeckState } from './state.js'
import type { CompanionVariableDefinitions } from '@companion-module/base'

type GlobalVarNames =
	| 'recording_state'
	| 'recording_duration'
	| 'recording_duration_seconds'
	| 'view'
	| 'active_deck'
	| 'theatre_deck'
	| 'fullscreen_deck'
	| 'showname'
	| 'counter'
	| 'log_level'
	| 'last_recording_path'
	| 'last_recording_duration'
	| 'last_recording_state'
	| 'identify_id'
	| 'identify_version'
	| 'active_deck_position'
	| 'active_deck_position_seconds'
	| 'active_deck_position_hh'
	| 'active_deck_position_mm'
	| 'active_deck_position_ss'
	| 'active_deck_position_ff'
	| 'active_deck_cue_title'
	| 'active_deck_cue_index'
	| 'active_deck_filename'
	| 'active_deck_state'
	| 'active_deck_mix_state'
	| 'active_deck_mix_opacity'
	| 'active_deck_mix_gain'
	| 'active_deck_mix_threshold'
	| 'active_deck_mix_blend'
	| 'active_deck_follow_state'
	| 'active_deck_follow_source'
	| 'active_deck_follow_mode'
	| 'active_deck_follow_out_of_sync'
	| 'active_deck_follow_list'

type DeckVarNames<L extends DeckLetter> =
	| `deck_${L}_state`
	| `deck_${L}_position`
	| `deck_${L}_position_seconds`
	| `deck_${L}_position_hh`
	| `deck_${L}_position_mm`
	| `deck_${L}_position_ss`
	| `deck_${L}_position_ff`
	| `deck_${L}_filename`
	| `deck_${L}_cue_title`
	| `deck_${L}_cue_index`
	| `deck_${L}_rate`
	| `deck_${L}_mix_state`
	| `deck_${L}_mix_opacity`
	| `deck_${L}_mix_gain`
	| `deck_${L}_mix_threshold`
	| `deck_${L}_mix_blend`
	| `deck_${L}_follow_state`
	| `deck_${L}_follow_source`
	| `deck_${L}_follow_mode`
	| `deck_${L}_follow_out_of_sync`
	| `deck_${L}_follow_list`

// Numeric variables (e.g. recording_duration_seconds, deck_*_position_seconds) are sent as
// JS numbers when known and empty strings when unknown — so the schema type is the union.
// Mixer channel variable names are generated dynamically for channels 1..MIXER_MAX_CHANNELS.
// TS template-literal types can't iterate a numeric range cleanly, so we widen with a string suffix.
type MixerVarNames = `mixer_channel_${number}_volume` | `mixer_channel_${number}_mute`

// Cue-list filter variable names — one per filter (scenes, cues, …, fade-bar).
// Hyphenated filter names (`console-tc`, `fade-bar`) become underscored variable
// keys (Companion variable names can't contain hyphens).
type CuelistFilterVarNames = `cuelist_filter_${string}`

export type VariablesSchema = Record<
	GlobalVarNames | DeckVarNames<DeckLetter> | MixerVarNames | CuelistFilterVarNames,
	string | number
>

const GLOBAL_DEFS: Record<GlobalVarNames, string> = {
	recording_state: 'Recording state',
	recording_duration: 'Recording duration (hh:mm:ss)',
	recording_duration_seconds: 'Recording duration (seconds)',
	view: 'Current view (record / playback)',
	active_deck: 'Active deck (a/b/c/d)',
	theatre_deck: 'Deck currently in theatre (or empty)',
	fullscreen_deck: 'Deck currently fullscreen (or empty)',
	showname: 'Show name',
	counter: 'File-naming counter',
	log_level: 'Log level',
	last_recording_path: 'Last recording: file path',
	last_recording_duration: 'Last recording: duration (hh:mm:ss)',
	last_recording_state: 'Last recording: terminal state',
	identify_id: 'Identify: instance id',
	identify_version: 'Identify: app version',
	active_deck_position: 'Active deck mirror: position (hh:mm:ss:ff)',
	active_deck_position_seconds: 'Active deck mirror: position (seconds)',
	active_deck_position_hh: 'Active deck mirror: position — hours part',
	active_deck_position_mm: 'Active deck mirror: position — minutes part',
	active_deck_position_ss: 'Active deck mirror: position — seconds part',
	active_deck_position_ff: 'Active deck mirror: position — frames part',
	active_deck_cue_title: 'Active deck mirror: current cue title',
	active_deck_cue_index: 'Active deck mirror: current cue index',
	active_deck_filename: 'Active deck mirror: filename',
	active_deck_state: 'Active deck mirror: transport state',
	active_deck_mix_state: 'Active deck mirror: mix on/off',
	active_deck_mix_opacity: 'Active deck mirror: mix opacity',
	active_deck_mix_gain: 'Active deck mirror: mix gain',
	active_deck_mix_threshold: 'Active deck mirror: mix threshold',
	active_deck_mix_blend: 'Active deck mirror: mix blend',
	active_deck_follow_state: 'Active deck mirror: Follow Console on/off',
	active_deck_follow_source: 'Active deck mirror: Follow Console source',
	active_deck_follow_mode: 'Active deck mirror: Follow Console mode (start/end)',
	active_deck_follow_out_of_sync: 'Active deck mirror: Follow Console out-of-sync fallback on/off',
	active_deck_follow_list: 'Active deck mirror: Follow Console custom list # (empty when unset)',
}

function deckDefs(letter: DeckLetter): Record<string, string> {
	const upper = letter.toUpperCase()
	return {
		[`deck_${letter}_state`]: `Deck ${upper}: transport state`,
		[`deck_${letter}_position`]: `Deck ${upper}: position (hh:mm:ss:ff)`,
		[`deck_${letter}_position_seconds`]: `Deck ${upper}: position (seconds)`,
		[`deck_${letter}_position_hh`]: `Deck ${upper}: position — hours part`,
		[`deck_${letter}_position_mm`]: `Deck ${upper}: position — minutes part`,
		[`deck_${letter}_position_ss`]: `Deck ${upper}: position — seconds part`,
		[`deck_${letter}_position_ff`]: `Deck ${upper}: position — frames part`,
		[`deck_${letter}_filename`]: `Deck ${upper}: filename`,
		[`deck_${letter}_cue_title`]: `Deck ${upper}: current cue title`,
		[`deck_${letter}_cue_index`]: `Deck ${upper}: current cue index`,
		[`deck_${letter}_rate`]: `Deck ${upper}: playback rate`,
		[`deck_${letter}_mix_state`]: `Deck ${upper}: mix on/off`,
		[`deck_${letter}_mix_opacity`]: `Deck ${upper}: mix opacity`,
		[`deck_${letter}_mix_gain`]: `Deck ${upper}: mix gain`,
		[`deck_${letter}_mix_threshold`]: `Deck ${upper}: mix threshold`,
		[`deck_${letter}_mix_blend`]: `Deck ${upper}: mix blend`,
		[`deck_${letter}_follow_state`]: `Deck ${upper}: Follow Console on/off`,
		[`deck_${letter}_follow_source`]: `Deck ${upper}: Follow Console source`,
		[`deck_${letter}_follow_mode`]: `Deck ${upper}: Follow Console mode (start/end)`,
		[`deck_${letter}_follow_out_of_sync`]: `Deck ${upper}: Follow Console out-of-sync fallback on/off`,
		[`deck_${letter}_follow_list`]: `Deck ${upper}: Follow Console custom list # (empty when unset)`,
	}
}

/** Companion variable names can't contain hyphens, so `console-tc` → `console_tc`,
 *  `fade-bar` → `fade_bar`. The rest are unchanged. */
function filterVarKey(name: string): string {
	return `cuelist_filter_${name.replace(/-/g, '_')}`
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: Record<string, { name: string }> = {}
	for (const [id, name] of Object.entries(GLOBAL_DEFS)) {
		defs[id] = { name }
	}
	for (const letter of DECK_LETTERS) {
		for (const [id, name] of Object.entries(deckDefs(letter))) {
			defs[id] = { name }
		}
	}
	// Channel 0 = main/master fader (always present, independent of the loaded
	// file's output count); 1..N = the playback mixer's physical outputs.
	for (let ch = MIXER_MAIN_CHANNEL; ch <= MIXER_MAX_CHANNELS; ch++) {
		const label = ch === MIXER_MAIN_CHANNEL ? 'Main' : `Out ${ch}`
		defs[`mixer_channel_${ch}_volume`] = { name: `Mixer ${label}: volume (% — 100% = unity)` }
		defs[`mixer_channel_${ch}_mute`] = { name: `Mixer ${label}: mute (on/off)` }
	}
	for (const name of CUELIST_FILTER_NAMES) {
		defs[filterVarKey(name)] = { name: `Cue list filter "${name}" (shown/hidden)` }
	}
	self.setVariableDefinitions(defs as unknown as CompanionVariableDefinitions<VariablesSchema>)
}

/**
 * Formats a mix-knob float (opacity / gain / threshold) for display.
 * Always renders 2 decimal places — so `0.6` shows as `0.60`, keeping the
 * column width stable across changes. Companion's expression engine still
 * coerces the string back to a number for math. Returns '' for null so
 * unloaded decks render empty.
 */
function round2(n: number | null | undefined): string {
	if (n == null) return ''
	return n.toFixed(2)
}

/**
 * Formats a mixer volume float (0..2 where 1.0 = unity = 0 dB) as a
 * percentage string for display — "100%" at unity, "50%" at half, "200%"
 * at max. Returns '' for null. Companion expressions can still parse the
 * leading number if needed (it'll stop at the % sign).
 */
function formatVolumePercent(n: number | null | undefined): string {
	if (n == null) return ''
	return `${Math.round(n * 100)}%`
}

/**
 * Parses CueCapture's `hh:mm:ss:ff` position string into its 4 zero-padded
 * components. Returns empty strings for every part when the input is empty or
 * malformed — we'd rather hide a partial readout than show garbage.
 */
function parsePositionParts(position: string): {
	hh: string
	mm: string
	ss: string
	ff: string
} {
	const parts = position.split(':')
	if (parts.length !== 4) return { hh: '', mm: '', ss: '', ff: '' }
	const [hh, mm, ss, ff] = parts as [string, string, string, string]
	return { hh, mm, ss, ff }
}

function deckValues(letter: DeckLetter, deck: DeckState): Record<string, string | number> {
	const parts = parsePositionParts(deck.position)
	return {
		[`deck_${letter}_state`]: deck.state ?? '',
		[`deck_${letter}_position`]: deck.position,
		[`deck_${letter}_position_seconds`]: deck.positionSeconds ?? '',
		[`deck_${letter}_position_hh`]: parts.hh,
		[`deck_${letter}_position_mm`]: parts.mm,
		[`deck_${letter}_position_ss`]: parts.ss,
		[`deck_${letter}_position_ff`]: parts.ff,
		[`deck_${letter}_filename`]: deck.filename,
		[`deck_${letter}_cue_title`]: deck.cueTitle,
		[`deck_${letter}_cue_index`]: deck.cueIndex ?? '',
		[`deck_${letter}_rate`]: deck.rate ?? '',
		[`deck_${letter}_mix_state`]: deck.mixState ?? '',
		[`deck_${letter}_mix_opacity`]: round2(deck.mixOpacity),
		[`deck_${letter}_mix_gain`]: round2(deck.mixGain),
		[`deck_${letter}_mix_threshold`]: round2(deck.mixThreshold),
		[`deck_${letter}_mix_blend`]: deck.mixBlend ?? '',
		[`deck_${letter}_follow_state`]: deck.followState ?? '',
		[`deck_${letter}_follow_source`]: deck.followSource ?? '',
		[`deck_${letter}_follow_mode`]: deck.followMode ?? '',
		[`deck_${letter}_follow_out_of_sync`]: deck.followOutOfSync ?? '',
		[`deck_${letter}_follow_list`]: deck.followList,
	}
}

export function updateVariablesFromState(self: ModuleInstance, state: AppState): void {
	const activeDeck = state.activeDeck ? state.decks[state.activeDeck] : null
	const vals: Record<string, string | number> = {
		recording_state: state.recordingState ?? '',
		recording_duration: state.recordingDuration,
		recording_duration_seconds: state.recordingDurationSeconds ?? '',
		view: state.view ?? '',
		active_deck: state.activeDeck ?? '',
		theatre_deck: state.theatreDeck ?? '',
		fullscreen_deck: state.fullscreenDeck ?? '',
		showname: state.showname,
		counter: state.counter ?? '',
		log_level: state.logLevel,
		last_recording_path: state.lastRecordingPath,
		last_recording_duration: state.lastRecordingDuration,
		last_recording_state: state.lastRecordingState ?? '',
		identify_id: state.identifyId ?? '',
		identify_version: state.identifyVersion,
		active_deck_position: activeDeck?.position ?? '',
		active_deck_position_seconds: activeDeck?.positionSeconds ?? '',
		active_deck_position_hh: parsePositionParts(activeDeck?.position ?? '').hh,
		active_deck_position_mm: parsePositionParts(activeDeck?.position ?? '').mm,
		active_deck_position_ss: parsePositionParts(activeDeck?.position ?? '').ss,
		active_deck_position_ff: parsePositionParts(activeDeck?.position ?? '').ff,
		active_deck_cue_title: activeDeck?.cueTitle ?? '',
		active_deck_cue_index: activeDeck?.cueIndex ?? '',
		active_deck_filename: activeDeck?.filename ?? '',
		active_deck_state: activeDeck?.state ?? '',
		active_deck_mix_state: activeDeck?.mixState ?? '',
		active_deck_mix_opacity: round2(activeDeck?.mixOpacity),
		active_deck_mix_gain: round2(activeDeck?.mixGain),
		active_deck_mix_threshold: round2(activeDeck?.mixThreshold),
		active_deck_mix_blend: activeDeck?.mixBlend ?? '',
		active_deck_follow_state: activeDeck?.followState ?? '',
		active_deck_follow_source: activeDeck?.followSource ?? '',
		active_deck_follow_mode: activeDeck?.followMode ?? '',
		active_deck_follow_out_of_sync: activeDeck?.followOutOfSync ?? '',
		active_deck_follow_list: activeDeck?.followList ?? '',
	}
	for (const letter of DECK_LETTERS) {
		Object.assign(vals, deckValues(letter, state.decks[letter]))
	}
	for (let ch = MIXER_MAIN_CHANNEL; ch <= MIXER_MAX_CHANNELS; ch++) {
		const mc = state.mixerChannels[ch]
		vals[`mixer_channel_${ch}_volume`] = formatVolumePercent(mc?.volume)
		vals[`mixer_channel_${ch}_mute`] = mc?.mute ?? ''
	}
	for (const name of CUELIST_FILTER_NAMES) {
		vals[filterVarKey(name)] = state.cuelistFilters[name] ?? ''
	}
	self.setVariableValues(vals)
}
