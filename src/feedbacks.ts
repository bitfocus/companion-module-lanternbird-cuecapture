import type ModuleInstance from './main.js'
import type {
	CompanionAdvancedFeedbackDefinition,
	CompanionBooleanFeedbackDefinition,
	CompanionFeedbackDefinitions,
} from '@companion-module/base'
import { combineRgb } from '@companion-module/base'
import { DECK_LETTERS, DECK_SLOT_CHOICES, type DeckLetter, type DeckSlot } from './osc/address.js'
import { CUELIST_FILTER_NAMES, resolveDeck, type CuelistFilterName } from './state.js'

type RecState = 'recording' | 'stopped' | 'fault' | 'idle'
type LastRecState = 'stopped' | 'fault'
type ViewName = 'record' | 'playback'
type TransportState = 'playing' | 'paused' | 'stopped'
type PanelName = 'cuelist' | 'files' | 'timeline'
type PanelState = 'expanded' | 'collapsed'
type MixBlendName = 'normal' | 'screen' | 'lighten' | 'difference'
type SingletonDeck = DeckLetter | 'none' | 'active'
type ShutdownAllowed = 'true' | 'false' | 'unknown'
type FollowSourceName = 'native' | 'default' | 'custom'
type FollowModeName = 'start' | 'end'
type CuelistFilterStateName = 'shown' | 'hidden'

export type FeedbacksSchema = {
	recording_state: { type: 'boolean'; options: { state: RecState } }
	view_is: { type: 'boolean'; options: { view: ViewName } }
	deck_transport_is: { type: 'boolean'; options: { deck: DeckSlot; state: TransportState } }
	deck_mix_on: { type: 'boolean'; options: { deck: DeckSlot } }
	deck_mix_blend_is: { type: 'boolean'; options: { deck: DeckSlot; blend: MixBlendName } }
	active_deck_is: { type: 'boolean'; options: { deck: DeckLetter } }
	theatre_deck_is: { type: 'boolean'; options: { deck: SingletonDeck } }
	fullscreen_deck_is: { type: 'boolean'; options: { deck: SingletonDeck } }
	panel_is: { type: 'boolean'; options: { panel: PanelName; state: PanelState } }
	shutdown_computer_allowed: { type: 'boolean'; options: { value: ShutdownAllowed } }
	last_recording_state_is: { type: 'boolean'; options: { state: LastRecState } }
	mixer_channel_mute_is: { type: 'boolean'; options: { channel: number; state: 'on' | 'off' } }
	mixer_main_mute_is: { type: 'boolean'; options: { state: 'on' | 'off' } }
	deck_follow_on: { type: 'boolean'; options: { deck: DeckSlot } }
	deck_follow_source_is: { type: 'boolean'; options: { deck: DeckSlot; source: FollowSourceName } }
	deck_follow_mode_is: { type: 'boolean'; options: { deck: DeckSlot; mode: FollowModeName } }
	deck_follow_out_of_sync_on: { type: 'boolean'; options: { deck: DeckSlot } }
	cuelist_filter_is: {
		type: 'boolean'
		options: { name: CuelistFilterName; state: CuelistFilterStateName }
	}
	recording_flash: {
		type: 'advanced'
		options: { colorOn: number; colorOff: number; periodMs: number }
	}
}

const RED = combineRgb(220, 30, 30)
const DARK_RED = combineRgb(60, 0, 0)
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

const REC_STATE_CHOICES = [
	{ id: 'recording', label: 'Recording' },
	{ id: 'stopped', label: 'Stopped' },
	{ id: 'fault', label: 'Fault' },
	{ id: 'idle', label: 'Idle' },
] as const

const LAST_REC_STATE_CHOICES = [
	{ id: 'stopped', label: 'Stopped' },
	{ id: 'fault', label: 'Fault' },
] as const

const VIEW_CHOICES = [
	{ id: 'record', label: 'Record' },
	{ id: 'playback', label: 'Playback' },
] as const

const TRANSPORT_CHOICES = [
	{ id: 'playing', label: 'Playing' },
	{ id: 'paused', label: 'Paused' },
	{ id: 'stopped', label: 'Stopped' },
] as const

const PANEL_CHOICES = [
	{ id: 'cuelist', label: 'Cue list' },
	{ id: 'files', label: 'Files' },
	{ id: 'timeline', label: 'Timeline + Mixer' },
] as const

const PANEL_STATE_CHOICES = [
	{ id: 'expanded', label: 'Expanded' },
	{ id: 'collapsed', label: 'Collapsed' },
] as const

const MIX_BLEND_CHOICES = [
	{ id: 'normal', label: 'Normal' },
	{ id: 'screen', label: 'Screen' },
	{ id: 'lighten', label: 'Lighten' },
	{ id: 'difference', label: 'Difference' },
] as const

const SINGLETON_DECK_CHOICES = [
	{ id: 'a', label: 'Deck A' },
	{ id: 'b', label: 'Deck B' },
	{ id: 'c', label: 'Deck C' },
	{ id: 'd', label: 'Deck D' },
	{ id: 'active', label: 'Currently active deck' },
	{ id: 'none', label: 'None (no deck)' },
] as const

const DECK_LETTER_CHOICES = DECK_LETTERS.map((l) => ({ id: l, label: `Deck ${l.toUpperCase()}` }))

/**
 * Resolves the special 'active' choice for theatre/fullscreen feedbacks:
 * 'active' matches iff the singleton deck equals the current active deck (and an active deck exists).
 * 'none' matches iff the singleton is unset.
 * 'a'..'d' matches literally.
 */
function singletonDeckMatches(
	singleton: DeckLetter | null,
	activeDeck: DeckLetter | null,
	want: 'a' | 'b' | 'c' | 'd' | 'none' | 'active',
): boolean {
	if (want === 'none') return singleton === null
	if (want === 'active') return activeDeck !== null && singleton === activeDeck
	return singleton === want
}

const SHUTDOWN_ALLOWED_CHOICES = [
	{ id: 'true', label: 'Allowed' },
	{ id: 'false', label: 'Not allowed' },
	{ id: 'unknown', label: 'Unknown (no TX yet)' },
] as const

const FOLLOW_SOURCE_CHOICES = [
	{ id: 'native', label: 'Native' },
	{ id: 'default', label: 'Default' },
	{ id: 'custom', label: 'Custom' },
] as const

const FOLLOW_MODE_CHOICES = [
	{ id: 'start', label: 'Cue start' },
	{ id: 'end', label: 'Cue end' },
] as const

const CUELIST_FILTER_CHOICES = CUELIST_FILTER_NAMES.map((n) => ({ id: n, label: n }))

const CUELIST_FILTER_STATE_CHOICES = [
	{ id: 'shown', label: 'Shown' },
	{ id: 'hidden', label: 'Hidden' },
] as const

export function UpdateFeedbacks(self: ModuleInstance): void {
	const deckSlotField = {
		id: 'deck',
		type: 'dropdown' as const,
		label: 'Deck',
		default: 'a',
		choices: DECK_SLOT_CHOICES.map((c) => ({ ...c })),
	}

	const recordingState: CompanionBooleanFeedbackDefinition = {
		name: 'Recording: state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: RED, color: WHITE },
		options: [
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'recording',
				choices: REC_STATE_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => self.state.recordingState === (feedback.options['state'] as RecState),
	}

	const viewIs: CompanionBooleanFeedbackDefinition = {
		name: 'View: matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(40, 100, 180), color: WHITE },
		options: [
			{
				id: 'view',
				type: 'dropdown',
				label: 'View',
				default: 'record',
				choices: VIEW_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => self.state.view === (feedback.options['view'] as ViewName),
	}

	const deckTransportIs: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: transport state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(0, 180, 60), color: BLACK },
		options: [
			deckSlotField,
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'playing',
				choices: TRANSPORT_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].state === (feedback.options['state'] as TransportState)
		},
	}

	const deckMixOn: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: mix is on',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(0, 180, 200), color: BLACK },
		options: [deckSlotField],
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].mixState === 'on'
		},
	}

	const deckMixBlendIs: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: mix blend matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(0, 120, 140), color: WHITE },
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
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].mixBlend === (feedback.options['blend'] as MixBlendName)
		},
	}

	const activeDeckIs: CompanionBooleanFeedbackDefinition = {
		name: 'Active deck: matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(80, 60, 160), color: WHITE },
		options: [
			{
				id: 'deck',
				type: 'dropdown',
				label: 'Deck',
				default: 'a',
				choices: DECK_LETTER_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => self.state.activeDeck === (feedback.options['deck'] as DeckLetter),
	}

	const theatreDeckIs: CompanionBooleanFeedbackDefinition = {
		name: 'Theatre deck: matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(160, 90, 0), color: WHITE },
		options: [
			{
				id: 'deck',
				type: 'dropdown',
				label: 'Deck',
				default: 'a',
				choices: SINGLETON_DECK_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const want = feedback.options['deck'] as SingletonDeck
			return singletonDeckMatches(self.state.theatreDeck, self.state.activeDeck, want)
		},
	}

	const fullscreenDeckIs: CompanionBooleanFeedbackDefinition = {
		name: 'Fullscreen deck: matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(160, 60, 120), color: WHITE },
		options: [
			{
				id: 'deck',
				type: 'dropdown',
				label: 'Deck',
				default: 'a',
				choices: SINGLETON_DECK_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const want = feedback.options['deck'] as SingletonDeck
			return singletonDeckMatches(self.state.fullscreenDeck, self.state.activeDeck, want)
		},
	}

	const panelIs: CompanionBooleanFeedbackDefinition = {
		name: 'Panel: state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(60, 60, 60), color: WHITE },
		options: [
			{
				id: 'panel',
				type: 'dropdown',
				label: 'Panel',
				default: 'cuelist',
				choices: PANEL_CHOICES.map((c) => ({ ...c })),
			},
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'expanded',
				choices: PANEL_STATE_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const panel = feedback.options['panel'] as PanelName
			const want = feedback.options['state'] as PanelState
			const current =
				panel === 'cuelist'
					? self.state.panelCuelist
					: panel === 'files'
						? self.state.panelFiles
						: self.state.panelTimeline
			return current === want
		},
	}

	const shutdownComputerAllowed: CompanionBooleanFeedbackDefinition = {
		name: 'Shutdown: computer-shutdown allowed flag',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(120, 0, 0), color: WHITE },
		options: [
			{
				id: 'value',
				type: 'dropdown',
				label: 'Value',
				default: 'true',
				choices: SHUTDOWN_ALLOWED_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const want = feedback.options['value'] as ShutdownAllowed
			const v = self.state.shutdownComputerAllowed
			if (want === 'unknown') return v === null
			return v === (want === 'true')
		},
	}

	const lastRecordingStateIs: CompanionBooleanFeedbackDefinition = {
		name: 'Last recording: terminal state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(100, 100, 0), color: BLACK },
		options: [
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'stopped',
				choices: LAST_REC_STATE_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => self.state.lastRecordingState === (feedback.options['state'] as LastRecState),
	}

	const mixerChannelMuteIs: CompanionBooleanFeedbackDefinition = {
		name: 'Mixer: output mute state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
		options: [
			{ id: 'channel', type: 'number', label: 'Output (1..64)', default: 1, min: 1, max: 64 },
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'on',
				choices: [
					{ id: 'on', label: 'Muted (on)' },
					{ id: 'off', label: 'Unmuted (off)' },
				],
			},
		],
		callback: (feedback) => {
			const ch = Math.floor(Number(feedback.options['channel'] ?? 1))
			const want = feedback.options['state'] as 'on' | 'off'
			return self.state.mixerChannels[ch]?.mute === want
		},
	}

	const mixerMainMuteIs: CompanionBooleanFeedbackDefinition = {
		name: 'Mixer: MAIN (master) mute state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(180, 30, 30), color: WHITE },
		options: [
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'on',
				choices: [
					{ id: 'on', label: 'Muted (on)' },
					{ id: 'off', label: 'Unmuted (off)' },
				],
			},
		],
		callback: (feedback) => {
			const want = feedback.options['state'] as 'on' | 'off'
			return self.state.mixerChannels[0]?.mute === want
		},
	}

	const deckFollowOn: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: Follow Console is on',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(40, 140, 220), color: WHITE },
		options: [deckSlotField],
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].followState === 'on'
		},
	}

	const deckFollowSourceIs: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: Follow Console source matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(30, 110, 180), color: WHITE },
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
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].followSource === (feedback.options['source'] as FollowSourceName)
		},
	}

	const deckFollowModeIs: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: Follow Console mode matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(30, 110, 180), color: WHITE },
		options: [
			deckSlotField,
			{
				id: 'mode',
				type: 'dropdown',
				label: 'Mode',
				default: 'start',
				choices: FOLLOW_MODE_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].followMode === (feedback.options['mode'] as FollowModeName)
		},
	}

	const deckFollowOutOfSyncOn: CompanionBooleanFeedbackDefinition = {
		name: 'Deck: Follow Console out-of-sync fallback is on',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(180, 100, 40), color: WHITE },
		options: [deckSlotField],
		callback: (feedback) => {
			const letter = resolveDeck(self.state, feedback.options['deck'] as DeckSlot)
			if (!letter) return false
			return self.state.decks[letter].followOutOfSync === 'on'
		},
	}

	const cuelistFilterIs: CompanionBooleanFeedbackDefinition = {
		name: 'Cue list filter: state matches',
		type: 'boolean',
		defaultStyle: { bgcolor: combineRgb(60, 60, 60), color: WHITE },
		options: [
			{
				id: 'name',
				type: 'dropdown',
				label: 'Filter',
				default: 'cues',
				choices: CUELIST_FILTER_CHOICES.map((c) => ({ ...c })),
			},
			{
				id: 'state',
				type: 'dropdown',
				label: 'State',
				default: 'shown',
				choices: CUELIST_FILTER_STATE_CHOICES.map((c) => ({ ...c })),
			},
		],
		callback: (feedback) => {
			const name = feedback.options['name'] as CuelistFilterName
			const want = feedback.options['state'] as CuelistFilterStateName
			return self.state.cuelistFilters[name] === want
		},
	}

	const recordingFlash: CompanionAdvancedFeedbackDefinition = {
		name: 'Recording: pulse (advanced — flashing background)',
		type: 'advanced',
		options: [
			{ id: 'colorOn', type: 'colorpicker', label: 'On color', default: RED },
			{ id: 'colorOff', type: 'colorpicker', label: 'Off color', default: DARK_RED },
			{
				id: 'periodMs',
				type: 'number',
				label: 'Period (ms)',
				default: 1000,
				min: 200,
				max: 5000,
				step: 50,
			},
		],
		callback: (feedback) => {
			if (self.state.recordingState !== 'recording') return {}
			const colorOn = Number(feedback.options['colorOn'] ?? RED)
			const colorOff = Number(feedback.options['colorOff'] ?? DARK_RED)
			const period = Math.max(200, Number(feedback.options['periodMs'] ?? 1000))
			const phaseOn = Date.now() % period < period / 2
			return { bgcolor: phaseOn ? colorOn : colorOff }
		},
	}

	const defs = {
		recording_state: recordingState,
		view_is: viewIs,
		deck_transport_is: deckTransportIs,
		deck_mix_on: deckMixOn,
		deck_mix_blend_is: deckMixBlendIs,
		active_deck_is: activeDeckIs,
		theatre_deck_is: theatreDeckIs,
		fullscreen_deck_is: fullscreenDeckIs,
		panel_is: panelIs,
		shutdown_computer_allowed: shutdownComputerAllowed,
		last_recording_state_is: lastRecordingStateIs,
		mixer_channel_mute_is: mixerChannelMuteIs,
		mixer_main_mute_is: mixerMainMuteIs,
		deck_follow_on: deckFollowOn,
		deck_follow_source_is: deckFollowSourceIs,
		deck_follow_mode_is: deckFollowModeIs,
		deck_follow_out_of_sync_on: deckFollowOutOfSyncOn,
		cuelist_filter_is: cuelistFilterIs,
		recording_flash: recordingFlash,
	}
	self.setFeedbackDefinitions(defs as unknown as CompanionFeedbackDefinitions<FeedbacksSchema>)
}

/** All feedback ids — used by main.ts to refresh-all on state changes. */
export const ALL_FEEDBACK_IDS = [
	'recording_state',
	'view_is',
	'deck_transport_is',
	'deck_mix_on',
	'deck_mix_blend_is',
	'active_deck_is',
	'theatre_deck_is',
	'fullscreen_deck_is',
	'panel_is',
	'shutdown_computer_allowed',
	'last_recording_state_is',
	'mixer_channel_mute_is',
	'mixer_main_mute_is',
	'deck_follow_on',
	'deck_follow_source_is',
	'deck_follow_mode_is',
	'deck_follow_out_of_sync_on',
	'cuelist_filter_is',
	'recording_flash',
] as const satisfies ReadonlyArray<keyof FeedbacksSchema>
