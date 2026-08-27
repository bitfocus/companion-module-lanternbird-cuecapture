import { DECK_LETTERS, type DeckLetter } from './osc/address.js'

export type RecordingState = 'recording' | 'stopped' | 'fault' | 'idle' | null
export type DeckTransportState = 'playing' | 'paused' | 'stopped' | null
export type ViewState = 'record' | 'playback' | null
export type PanelState = 'expanded' | 'collapsed' | null
export type MixState = 'on' | 'off' | null
export type MixBlend = 'normal' | 'screen' | 'lighten' | 'difference' | null
export type LastRecordingState = 'stopped' | 'fault' | null
export type MixerMuteState = 'on' | 'off' | null
export type FollowState = 'on' | 'off' | null
export type FollowSource = 'native' | 'default' | 'custom' | null
export type FollowMode = 'start' | 'end' | null
export type FollowOutOfSyncState = 'on' | 'off' | null

/** Cue-list panel display filters — these are global (not deck-scoped). */
export const CUELIST_FILTER_NAMES = ['scenes', 'cues', 'number', 'label', 'time', 'console-tc', 'fade-bar'] as const
export type CuelistFilterName = (typeof CUELIST_FILTER_NAMES)[number]
export type CuelistFilterState = 'shown' | 'hidden' | null

/** Maximum mixer channel number we pre-declare variables/feedbacks for.
 *  CueCapture's dispatcher constrains [1, 64]; most theatrical mixes are
 *  ≤ 16 channels, so 24 covers virtually all real work with reasonable
 *  headroom while keeping the variable list manageable. Higher channels
 *  remain reachable via the send_custom action. */
export const MIXER_MAX_CHANNELS = 24

/** Channel 0 is the playback mixer's MAIN (master) fader. It is addressed on
 *  the wire exactly like a numbered mixer channel but with N=0, and — unlike
 *  channels 1..N which mirror the loaded file's source channels — it always
 *  exists regardless of the loaded file's channel count. We pre-declare its
 *  variables/feedbacks alongside the numbered channels. */
export const MIXER_MAIN_CHANNEL = 0

export interface MixerChannelState {
	volume: number | null
	mute: MixerMuteState
}

export interface DeckState {
	state: DeckTransportState
	rate: number | null
	position: string
	positionSeconds: number | null
	filename: string
	cueTitle: string
	cueIndex: number | null
	mixState: MixState
	mixOpacity: number | null
	mixGain: number | null
	mixThreshold: number | null
	mixBlend: MixBlend
	/** "Follow console" — when on, the deck auto-scrubs to match the live
	 *  console as cues fire. The whole follow group is null until CueCapture
	 *  emits a value (which it does on connect / state snapshot). */
	followState: FollowState
	followSource: FollowSource
	followMode: FollowMode
	followOutOfSync: FollowOutOfSyncState
	/** Custom-list number (empty string when unset). Arg-only on the wire —
	 *  CueCapture doesn't emit a path-form sibling for this one. */
	followList: string
}

export interface AppState {
	identifyId: number | null
	identifyVersion: string
	view: ViewState
	recordingState: RecordingState
	recordingDuration: string
	recordingDurationSeconds: number | null
	lastRecordingState: LastRecordingState
	lastRecordingPath: string
	lastRecordingDuration: string
	lastRecordingDurationSeconds: number | null
	decks: Record<DeckLetter, DeckState>
	activeDeck: DeckLetter | null
	theatreDeck: DeckLetter | null
	fullscreenDeck: DeckLetter | null
	panelCuelist: PanelState
	panelFiles: PanelState
	panelTimeline: PanelState
	showname: string
	counter: number | null
	logLevel: string
	shutdownComputerAllowed: boolean | null
	/** Keyed by 1-based channel number. Sparse — only channels CueCapture has
	 *  emitted state for are present. */
	mixerChannels: Record<number, MixerChannelState>
	/** Global cue-list panel display filters (scenes/cues/number/…/fade-bar).
	 *  Each entry is null until CueCapture emits its initial value. */
	cuelistFilters: Record<CuelistFilterName, CuelistFilterState>
}

export function createInitialMixerChannelState(): MixerChannelState {
	return { volume: null, mute: null }
}

export function createInitialDeckState(): DeckState {
	return {
		state: null,
		rate: null,
		position: '',
		positionSeconds: null,
		filename: '',
		cueTitle: '',
		cueIndex: null,
		mixState: null,
		mixOpacity: null,
		mixGain: null,
		mixThreshold: null,
		mixBlend: null,
		followState: null,
		followSource: null,
		followMode: null,
		followOutOfSync: null,
		followList: '',
	}
}

function createInitialCuelistFilters(): Record<CuelistFilterName, CuelistFilterState> {
	return Object.fromEntries(CUELIST_FILTER_NAMES.map((n) => [n, null])) as Record<CuelistFilterName, CuelistFilterState>
}

export function createInitialState(): AppState {
	const decks = Object.fromEntries(DECK_LETTERS.map((l) => [l, createInitialDeckState()])) as Record<
		DeckLetter,
		DeckState
	>
	return {
		identifyId: null,
		identifyVersion: '',
		view: null,
		recordingState: null,
		recordingDuration: '',
		recordingDurationSeconds: null,
		lastRecordingState: null,
		lastRecordingPath: '',
		lastRecordingDuration: '',
		lastRecordingDurationSeconds: null,
		decks,
		activeDeck: null,
		theatreDeck: null,
		fullscreenDeck: null,
		panelCuelist: null,
		panelFiles: null,
		panelTimeline: null,
		showname: '',
		counter: null,
		logLevel: '',
		shutdownComputerAllowed: null,
		mixerChannels: {},
		cuelistFilters: createInitialCuelistFilters(),
	}
}

/**
 * Resolves a deck slot id ('a'..'d' or 'active') to the underlying letter.
 * Returns null when 'active' is asked for and no active deck is known.
 */
export function resolveDeck(state: AppState, slot: DeckLetter | 'active'): DeckLetter | null {
	if (slot === 'active') return state.activeDeck
	return slot
}
