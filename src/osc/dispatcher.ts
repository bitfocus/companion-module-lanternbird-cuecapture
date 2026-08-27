import { DECK_LETTERS, parseTxAddress, type DeckLetter, type InstanceId } from './address.js'
import type { OscMessage, OscValue } from './codec.js'
import {
	CUELIST_FILTER_NAMES,
	createInitialMixerChannelState,
	type AppState,
	type CuelistFilterName,
	type CuelistFilterState,
	type DeckTransportState,
	type FollowMode,
	type FollowOutOfSyncState,
	type FollowSource,
	type FollowState,
	type MixBlend,
	type MixState,
	type LastRecordingState,
	type MixerMuteState,
	type PanelState,
	type RecordingState,
	type ViewState,
} from '../state.js'

function asString(args: readonly OscValue[]): string {
	const v = args[0]
	return typeof v === 'string' ? v : ''
}

function asNumber(args: readonly OscValue[]): number | null {
	const v = args[0]
	return typeof v === 'number' ? v : null
}

function asBool(args: readonly OscValue[]): boolean | null {
	const v = args[0]
	if (typeof v === 'boolean') return v
	if (typeof v === 'string') {
		const lower = v.toLowerCase()
		if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes') return true
		if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no') return false
	}
	return null
}

function asDeckLetter(value: string): DeckLetter | null {
	return DECK_LETTERS.includes(value as DeckLetter) ? (value as DeckLetter) : null
}

const RECORDING_STATES = new Set(['recording', 'stopped', 'fault', 'idle'])
const DECK_TRANSPORT_STATES = new Set(['playing', 'paused', 'stopped'])
const PANEL_STATES = new Set(['expanded', 'collapsed'])
const MIX_BLENDS = new Set(['normal', 'screen', 'lighten', 'difference'])
const FOLLOW_SOURCES = new Set(['native', 'default', 'custom'])
const FOLLOW_MODES = new Set(['start', 'end'])
const SHOWN_HIDDEN = new Set(['shown', 'hidden'])
const CUELIST_FILTER_NAME_SET = new Set<string>(CUELIST_FILTER_NAMES)

/**
 * Mutates `state` based on an inbound `/cuecapture/{id}/out/...` message.
 * Returns true if the message was handled (state may or may not have actually
 * changed value — caller should refresh variables/feedbacks either way; we
 * skew toward over-refreshing rather than missing an update).
 *
 * Both forms of the dual-emit pair update state — arg-form (e.g.
 * `/out/recording "recording"`) AND path-form (`/out/recording/recording` with
 * no args). The arg-form is the documented canonical source, but if a sender
 * only emits the path form we still want correct state. Both forms always
 * express the same value, so the writes are idempotent when both arrive.
 */
export function dispatchOscMessage(state: AppState, msg: OscMessage, wantedId: InstanceId): boolean {
	const parsed = parseTxAddress(msg.address, wantedId)
	if (!parsed) return false
	const tail = parsed.tail
	const t0 = tail[0]
	const t1 = tail[1]
	const t2 = tail[2]
	const t3 = tail[3]
	const t4 = tail[4]
	const t5 = tail[5]

	// /out/identify  args: int id, string version
	if (tail.length === 1 && t0 === 'identify') {
		state.identifyId = typeof msg.args[0] === 'number' ? msg.args[0] : null
		state.identifyVersion = typeof msg.args[1] === 'string' ? msg.args[1] : ''
		return true
	}

	// /out/view  (both arg-form and path-form update state so we're resilient
	// when CueCapture sends only one of the dual-emit pair)
	if (tail.length === 1 && t0 === 'view') {
		const v = asString(msg.args) as ViewState
		if (v === 'record' || v === 'playback') state.view = v
		return true
	}
	if (tail.length === 2 && t0 === 'view' && (t1 === 'record' || t1 === 'playback')) {
		state.view = t1
		return true
	}

	// /out/recording, /out/recording/duration[/seconds], /out/recording/last/...
	if (t0 === 'recording') {
		if (tail.length === 1) {
			const v = asString(msg.args) as RecordingState
			if (v && RECORDING_STATES.has(v)) state.recordingState = v
			return true
		}
		// Path-form sibling — also update state for resilience.
		if (tail.length === 2 && t1 !== undefined && RECORDING_STATES.has(t1)) {
			state.recordingState = t1 as RecordingState
			return true
		}
		if (t1 === 'duration') {
			if (tail.length === 2) {
				state.recordingDuration = asString(msg.args)
				return true
			}
			if (tail.length === 3 && t2 === 'seconds') {
				state.recordingDurationSeconds = asNumber(msg.args)
				return true
			}
		}
		if (t1 === 'last') {
			if (t2 === 'state') {
				if (tail.length === 3) {
					const v = asString(msg.args) as LastRecordingState
					if (v === 'stopped' || v === 'fault') state.lastRecordingState = v
					return true
				}
				if (tail.length === 4 && (t3 === 'stopped' || t3 === 'fault')) {
					state.lastRecordingState = t3
					return true
				}
			}
			if (t2 === 'path' && tail.length === 3) {
				state.lastRecordingPath = asString(msg.args)
				return true
			}
			if (t2 === 'duration') {
				if (tail.length === 3) {
					state.lastRecordingDuration = asString(msg.args)
					return true
				}
				if (tail.length === 4 && t3 === 'seconds') {
					state.lastRecordingDurationSeconds = asNumber(msg.args)
					return true
				}
			}
		}
	}

	// /out/playback/...
	if (t0 === 'playback') {
		if (t1 === 'deck' && typeof t2 === 'string') {
			const letter = asDeckLetter(t2)
			if (!letter) return false
			const deck = state.decks[letter]

			// /out/playback/deck/{letter}  arg-form transport state
			if (tail.length === 3) {
				const v = asString(msg.args) as DeckTransportState
				if (v && DECK_TRANSPORT_STATES.has(v)) deck.state = v
				return true
			}
			// Path-form sibling — also update state for resilience.
			if (tail.length === 4 && t3 !== undefined && DECK_TRANSPORT_STATES.has(t3)) {
				deck.state = t3 as DeckTransportState
				return true
			}

			if (t3 === 'rate' && tail.length === 4) {
				deck.rate = asNumber(msg.args)
				return true
			}
			if (t3 === 'cue' && tail.length === 4) {
				const title = msg.args[0]
				const index = msg.args[1]
				deck.cueTitle = typeof title === 'string' ? title : ''
				deck.cueIndex = typeof index === 'number' ? index : null
				return true
			}
			if (t3 === 'position') {
				if (tail.length === 4) {
					deck.position = asString(msg.args)
					return true
				}
				if (tail.length === 5 && t4 === 'seconds') {
					deck.positionSeconds = asNumber(msg.args)
					return true
				}
			}
			if (t3 === 'filename' && tail.length === 4) {
				deck.filename = asString(msg.args)
				return true
			}
			if (t3 === 'mix') {
				if (tail.length === 4) {
					const v = asString(msg.args) as MixState
					if (v === 'on' || v === 'off') deck.mixState = v
					return true
				}
				if (tail.length === 5 && (t4 === 'on' || t4 === 'off')) {
					deck.mixState = t4
					return true
				}
				if (tail.length === 5) {
					if (t4 === 'opacity') {
						deck.mixOpacity = asNumber(msg.args)
						return true
					}
					if (t4 === 'gain') {
						deck.mixGain = asNumber(msg.args)
						return true
					}
					if (t4 === 'threshold') {
						deck.mixThreshold = asNumber(msg.args)
						return true
					}
					if (t4 === 'blend') {
						const v = asString(msg.args) as MixBlend
						if (v && MIX_BLENDS.has(v)) deck.mixBlend = v
						return true
					}
				}
			}

			// /out/playback/deck/{letter}/follow[/...]  — "Follow console" state.
			// Arg-form is canonical; path-form siblings also set state for resilience
			// (same pattern as recording / mix above).
			if (t3 === 'follow') {
				// /follow  → "on"|"off"
				if (tail.length === 4) {
					const v = asString(msg.args) as FollowState
					if (v === 'on' || v === 'off') deck.followState = v
					return true
				}
				if (tail.length === 5) {
					// /follow/on, /follow/off — path-form sibling
					if (t4 === 'on' || t4 === 'off') {
						deck.followState = t4
						return true
					}
					if (t4 === 'source') {
						const v = asString(msg.args) as FollowSource
						if (v && FOLLOW_SOURCES.has(v)) deck.followSource = v
						return true
					}
					if (t4 === 'mode') {
						const v = asString(msg.args) as FollowMode
						if (v && FOLLOW_MODES.has(v)) deck.followMode = v
						return true
					}
					if (t4 === 'out-of-sync') {
						const v = asString(msg.args) as FollowOutOfSyncState
						if (v === 'on' || v === 'off') deck.followOutOfSync = v
						return true
					}
					if (t4 === 'list') {
						// Arg-only on the wire. CueCapture documents a string ("" when unset),
						// but coerce numeric args to string too — defensive against a sender
						// drifting to int — so the variable readout never silently blanks.
						const a = msg.args[0]
						deck.followList = typeof a === 'string' ? a : typeof a === 'number' ? String(a) : ''
						return true
					}
				}
				if (tail.length === 6) {
					// Path-form siblings for the enum-valued sub-keys.
					if (t4 === 'source' && typeof t5 === 'string' && FOLLOW_SOURCES.has(t5)) {
						deck.followSource = t5 as FollowSource
						return true
					}
					if (t4 === 'mode' && typeof t5 === 'string' && FOLLOW_MODES.has(t5)) {
						deck.followMode = t5 as FollowMode
						return true
					}
					if (t4 === 'out-of-sync' && (t5 === 'on' || t5 === 'off')) {
						deck.followOutOfSync = t5
						return true
					}
				}
			}
			return false
		}

		// /out/playback/active-deck | theatre | fullscreen
		if ((t1 === 'active-deck' || t1 === 'theatre' || t1 === 'fullscreen') && tail.length === 2) {
			const raw = asString(msg.args)
			const letter = raw === '' ? null : asDeckLetter(raw)
			if (t1 === 'active-deck') state.activeDeck = letter
			else if (t1 === 'theatre') state.theatreDeck = letter
			else state.fullscreenDeck = letter
			return true
		}

		if (t1 === 'panel' && typeof t2 === 'string') {
			if (tail.length === 3) {
				const v = asString(msg.args) as PanelState
				if (v && PANEL_STATES.has(v)) {
					if (t2 === 'cuelist') state.panelCuelist = v
					else if (t2 === 'files') state.panelFiles = v
					else if (t2 === 'timeline') state.panelTimeline = v
				}
				return true
			}
			// Path-form sibling — also update state for resilience.
			if (tail.length === 4 && t3 !== undefined && PANEL_STATES.has(t3)) {
				const v = t3 as PanelState
				if (t2 === 'cuelist') state.panelCuelist = v
				else if (t2 === 'files') state.panelFiles = v
				else if (t2 === 'timeline') state.panelTimeline = v
				return true
			}
		}

		// /out/playback/cuelist/filter/{name}  — global panel display filters.
		//   arg-form:  /filter/scenes  "shown"|"hidden"
		//   path-form: /filter/scenes/shown   (no args)
		if (t1 === 'cuelist' && t2 === 'filter' && typeof t3 === 'string' && CUELIST_FILTER_NAME_SET.has(t3)) {
			const name = t3 as CuelistFilterName
			if (tail.length === 4) {
				const v = asString(msg.args) as CuelistFilterState
				if (v && SHOWN_HIDDEN.has(v)) state.cuelistFilters[name] = v
				return true
			}
			if (tail.length === 5 && (t4 === 'shown' || t4 === 'hidden')) {
				state.cuelistFilters[name] = t4
				return true
			}
		}

		// /out/playback/mixer/channel/{N}/{volume|mute}
		//   - /volume               → float arg (set absolute value in state)
		//   - /mute                  → "on"|"off" arg (set state)
		//   - /mute/on, /mute/off    → path-form siblings (also set state for resilience)
		if (t1 === 'mixer' && t2 === 'channel' && typeof t3 === 'string') {
			const ch = Number(t3)
			// Channel 0 = main/master fader; 1..N = the loaded file's source channels.
			if (!Number.isInteger(ch) || ch < 0) return false
			const channel = state.mixerChannels[ch] ?? createInitialMixerChannelState()
			state.mixerChannels[ch] = channel
			if (t4 === 'volume' && tail.length === 5) {
				channel.volume = asNumber(msg.args)
				return true
			}
			if (t4 === 'mute') {
				if (tail.length === 5) {
					const v = asString(msg.args) as MixerMuteState
					if (v === 'on' || v === 'off') channel.mute = v
					return true
				}
				if (tail.length === 6) {
					const sub = tail[5]
					if (sub === 'on' || sub === 'off') {
						channel.mute = sub
						return true
					}
				}
			}
		}
	}

	// /out/settings/...
	if (t0 === 'settings') {
		if (t1 === 'showname' && tail.length === 2) {
			state.showname = asString(msg.args)
			return true
		}
		if (t1 === 'counter' && tail.length === 2) {
			state.counter = asNumber(msg.args)
			return true
		}
		if (t1 === 'log-level' && tail.length === 2) {
			state.logLevel = asString(msg.args)
			return true
		}
	}

	// /out/shutdown/computer-allowed  arg "true" | "false"
	if (t0 === 'shutdown' && t1 === 'computer-allowed' && tail.length === 2) {
		state.shutdownComputerAllowed = asBool(msg.args)
		return true
	}

	return false
}
