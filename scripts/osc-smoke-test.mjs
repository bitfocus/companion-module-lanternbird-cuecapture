/* eslint-disable n/no-process-exit */
// End-to-end smoke test for the module's OSC layer.
// Run AFTER `yarn build` (or just `yarn test:osc` which builds first).
//
// Verifies:
//   - Address builder (broadcast vs targeted, deep paths)
//   - Codec roundtrips (string / int / float / utf8 with special chars)
//   - Dispatcher → AppState (every TX address category from the manual)
//   - Path-form sibling messages don't clobber state from their arg-form parent
//   - Instance-id filter rejects messages for other instances
//   - Config Instance ID parsing (empty/broadcast → broadcast, 1–99 → id, else invalid)
//   - Recording pause/resume: verbs reach the wire, `paused` state drives feedbacks
//   - Show ID: actions reach the wire, /out/settings/showid drives the variable
//   - Overlay layouts: the select action sends the arg form, /out/overlay/layout
//     (+ its lossy path twin) and /out/overlay/layouts drive state, the
//     feedback, the variables and the list-order presets

import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const distUrl = (sub) => pathToFileURL(resolve(HERE, '..', 'dist', sub)).href

const { encodeMessage, decodePacket } = await import(distUrl('osc/codec.js'))
const { buildRxAddress } = await import(distUrl('osc/address.js'))
const { dispatchOscMessage } = await import(distUrl('osc/dispatcher.js'))
const { createInitialState } = await import(distUrl('state.js'))
const { parseInstanceId } = await import(distUrl('config.js'))
const { UpdateActions } = await import(distUrl('actions.js'))
const { UpdateFeedbacks } = await import(distUrl('feedbacks.js'))
const { UpdatePresets } = await import(distUrl('presets.js'))
const { updateVariablesFromState, UpdateVariableDefinitions } = await import(distUrl('variables.js'))

let failures = 0
function expect(name, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	console.log(`${ok ? '  ✓' : '  ✗'} ${name}`)
	if (!ok) {
		console.log(`     expected: ${JSON.stringify(expected)}`)
		console.log(`     actual:   ${JSON.stringify(actual)}`)
		failures++
	}
}

console.log('--- Instance ID parsing ---')
expect('empty → broadcast', parseInstanceId(''), 'broadcast')
expect('undefined → broadcast', parseInstanceId(undefined), 'broadcast')
expect('whitespace-only → broadcast', parseInstanceId('   '), 'broadcast')
expect('"broadcast" mixed case + padding → broadcast', parseInstanceId('  BroadCast '), 'broadcast')
expect('"1" → 1', parseInstanceId('1'), 1)
expect('" 99 " → 99', parseInstanceId(' 99 '), 99)
expect('"07" → 7', parseInstanceId('07'), 7)
expect('"0" → invalid', parseInstanceId('0'), null)
expect('"100" → invalid', parseInstanceId('100'), null)
expect('"-1" → invalid', parseInstanceId('-1'), null)
expect('"1.5" → invalid', parseInstanceId('1.5'), null)
expect('"1.0" → invalid', parseInstanceId('1.0'), null)
expect('"0x1" → invalid', parseInstanceId('0x1'), null)
expect('"1e0" → invalid', parseInstanceId('1e0'), null)
expect('"abc" → invalid', parseInstanceId('abc'), null)
expect('"broadcast1" → invalid', parseInstanceId('broadcast1'), null)

console.log('--- Address builder ---')
expect('broadcast addr', buildRxAddress('broadcast', ['recording', 'start']), '/cuecapture/recording/start')
expect('targeted addr', buildRxAddress(1, ['recording', 'start']), '/cuecapture/1/recording/start')
expect(
	'deck slot deep addr',
	buildRxAddress(7, ['playback', 'deck', 'a', 'mix', 'opacity']),
	'/cuecapture/7/playback/deck/a/mix/opacity',
)
expect(
	'deck cue/current addr',
	buildRxAddress(1, ['playback', 'deck', 'active', 'cue', 'current']),
	'/cuecapture/1/playback/deck/active/cue/current',
)
expect(
	'deck cue/end addr (arg form)',
	buildRxAddress(1, ['playback', 'deck', 'b', 'cue', 'end']),
	'/cuecapture/1/playback/deck/b/cue/end',
)
expect(
	'deck chapter/end/next addr',
	buildRxAddress(1, ['playback', 'deck', 'a', 'chapter', 'end', 'next']),
	'/cuecapture/1/playback/deck/a/chapter/end/next',
)

console.log('\n--- Codec roundtrip ---')
{
	const buf = encodeMessage('/cuecapture/1/recording/start', [])
	const [msg] = decodePacket(buf)
	expect('verb-only roundtrip address', msg.address, '/cuecapture/1/recording/start')
	expect('verb-only roundtrip args', [...msg.args], [])
}
{
	const buf = encodeMessage('/cuecapture/1/settings/set/counter', [{ type: 'int', value: 42 }])
	const [msg] = decodePacket(buf)
	expect(
		'int arg roundtrip',
		{ addr: msg.address, args: [...msg.args] },
		{ addr: '/cuecapture/1/settings/set/counter', args: [42] },
	)
}
{
	const buf = encodeMessage('/cuecapture/1/playback/deck/a/seek', [{ type: 'float', value: 90.5 }])
	const [msg] = decodePacket(buf)
	expect('float arg roundtrip (approx)', Math.abs(msg.args[0] - 90.5) < 0.001, true)
}
{
	const buf = encodeMessage('/cuecapture/1/settings/set/showname', ['Hello World — café'])
	const [msg] = decodePacket(buf)
	expect(
		'utf8 string arg roundtrip',
		{ addr: msg.address, args: [...msg.args] },
		{ addr: '/cuecapture/1/settings/set/showname', args: ['Hello World — café'] },
	)
}

console.log('\n--- TX dispatcher → AppState ---')
const state = createInitialState()
const dispatch = (addr, args) => {
	const buf = encodeMessage(addr, args)
	const [msg] = decodePacket(buf)
	dispatchOscMessage(state, msg, 'broadcast')
}

dispatch('/cuecapture/1/out/identify', [{ type: 'int', value: 1 }, '0.42.0'])
expect('identify id', state.identifyId, 1)
expect('identify version', state.identifyVersion, '0.42.0')

dispatch('/cuecapture/1/out/view', ['playback'])
expect('view set to playback', state.view, 'playback')

dispatch('/cuecapture/1/out/recording', ['recording'])
expect('recording state set', state.recordingState, 'recording')

dispatch('/cuecapture/1/out/recording/duration', ['00:01:23'])
dispatch('/cuecapture/1/out/recording/duration/seconds', [{ type: 'float', value: 83.0 }])
expect('recording duration display', state.recordingDuration, '00:01:23')
expect('recording duration seconds', Math.abs(state.recordingDurationSeconds - 83.0) < 0.001, true)

dispatch('/cuecapture/1/out/playback/deck/a', ['playing'])
dispatch('/cuecapture/1/out/playback/deck/a/position', ['00:02:15:00'])
dispatch('/cuecapture/1/out/playback/deck/a/cue', ['Bridge Out', { type: 'int', value: 7 }])
dispatch('/cuecapture/1/out/playback/deck/a/mix', ['on'])
dispatch('/cuecapture/1/out/playback/deck/a/mix/opacity', [{ type: 'float', value: 0.6 }])
dispatch('/cuecapture/1/out/playback/deck/a/mix/blend', ['screen'])
expect('deck a state', state.decks.a.state, 'playing')
expect('deck a position', state.decks.a.position, '00:02:15:00')
expect('deck a cue title', state.decks.a.cueTitle, 'Bridge Out')
expect('deck a cue index', state.decks.a.cueIndex, 7)
expect('deck a mix on', state.decks.a.mixState, 'on')
expect('deck a mix opacity', Math.abs(state.decks.a.mixOpacity - 0.6) < 0.001, true)
expect('deck a mix blend', state.decks.a.mixBlend, 'screen')

dispatch('/cuecapture/1/out/playback/active-deck', ['a'])
dispatch('/cuecapture/1/out/playback/theatre', ['b'])
dispatch('/cuecapture/1/out/playback/fullscreen', [''])
expect('active deck', state.activeDeck, 'a')
expect('theatre deck', state.theatreDeck, 'b')
expect('fullscreen deck cleared', state.fullscreenDeck, null)

dispatch('/cuecapture/1/out/playback/panel/cuelist', ['expanded'])
dispatch('/cuecapture/1/out/playback/panel/files', ['collapsed'])
expect('panel cuelist', state.panelCuelist, 'expanded')
expect('panel files', state.panelFiles, 'collapsed')

dispatch('/cuecapture/1/out/settings/showname', ['King Lear'])
dispatch('/cuecapture/1/out/settings/counter', [{ type: 'int', value: 12 }])
dispatch('/cuecapture/1/out/shutdown/computer-allowed', ['true'])
expect('showname', state.showname, 'King Lear')
expect('counter', state.counter, 12)
dispatch('/cuecapture/1/out/settings/showid', [{ type: 'int', value: 3 }])
expect('show id', state.showId, 3)
expect('shutdown allowed', state.shutdownComputerAllowed, true)

// Mixer channels — per-channel volume + mute (arg-form sets state; path-form
// /mute/on, /mute/off also set state for resilience).
dispatch('/cuecapture/1/out/playback/mixer/channel/3/volume', [{ type: 'float', value: 0.75 }])
dispatch('/cuecapture/1/out/playback/mixer/channel/3/mute', ['on'])
expect('mixer ch 3 volume', Math.abs(state.mixerChannels[3].volume - 0.75) < 0.001, true)
expect('mixer ch 3 mute (arg-form)', state.mixerChannels[3].mute, 'on')
dispatch('/cuecapture/1/out/playback/mixer/channel/3/mute/off', [])
expect('mixer ch 3 mute (path-form override)', state.mixerChannels[3].mute, 'off')
dispatch('/cuecapture/1/out/playback/mixer/channel/24/volume', [{ type: 'float', value: 1.5 }])
expect('mixer ch 24 volume (high channel)', Math.abs(state.mixerChannels[24].volume - 1.5) < 0.001, true)
// Channel 0 = MAIN (master) fader — same wire shape, always present.
dispatch('/cuecapture/1/out/playback/mixer/channel/0/volume', [{ type: 'float', value: 1.25 }])
dispatch('/cuecapture/1/out/playback/mixer/channel/0/mute', ['on'])
expect('mixer MAIN volume', Math.abs(state.mixerChannels[0].volume - 1.25) < 0.001, true)
expect('mixer MAIN mute (arg-form)', state.mixerChannels[0].mute, 'on')
dispatch('/cuecapture/1/out/playback/mixer/channel/0/mute/off', [])
expect('mixer MAIN mute (path-form override)', state.mixerChannels[0].mute, 'off')

// Follow Console — per-deck state from TX dispatcher.
dispatch('/cuecapture/1/out/playback/deck/a/follow', ['on'])
expect('deck a follow on (arg-form)', state.decks.a.followState, 'on')
dispatch('/cuecapture/1/out/playback/deck/a/follow/off', [])
expect('deck a follow off (path-form sibling)', state.decks.a.followState, 'off')
dispatch('/cuecapture/1/out/playback/deck/a/follow/source', ['custom'])
expect('deck a follow source (arg-form)', state.decks.a.followSource, 'custom')
dispatch('/cuecapture/1/out/playback/deck/a/follow/source/default', [])
expect('deck a follow source (path-form sibling)', state.decks.a.followSource, 'default')
dispatch('/cuecapture/1/out/playback/deck/a/follow/mode', ['end'])
expect('deck a follow mode (arg-form)', state.decks.a.followMode, 'end')
dispatch('/cuecapture/1/out/playback/deck/a/follow/mode/start', [])
expect('deck a follow mode (path-form sibling)', state.decks.a.followMode, 'start')
dispatch('/cuecapture/1/out/playback/deck/a/follow/out-of-sync', ['on'])
expect('deck a follow OOS on (arg-form)', state.decks.a.followOutOfSync, 'on')
dispatch('/cuecapture/1/out/playback/deck/a/follow/out-of-sync/off', [])
expect('deck a follow OOS off (path-form sibling)', state.decks.a.followOutOfSync, 'off')
dispatch('/cuecapture/1/out/playback/deck/a/follow/list', ['7'])
expect('deck a follow custom list # (arg-only, string)', state.decks.a.followList, '7')
// Defensive: if a sender ever ships an int instead of the documented string,
// coerce so the variable readout doesn't silently blank.
dispatch('/cuecapture/1/out/playback/deck/a/follow/list', [{ type: 'int', value: 12 }])
expect('deck a follow custom list # (numeric arg coerced)', state.decks.a.followList, '12')
dispatch('/cuecapture/1/out/playback/deck/a/follow/list', [''])
expect('deck a follow custom list # (cleared via empty string)', state.decks.a.followList, '')

// Cue list filters — global panel display flags.
dispatch('/cuecapture/1/out/playback/cuelist/filter/scenes', ['shown'])
expect('cuelist filter scenes (arg-form)', state.cuelistFilters.scenes, 'shown')
dispatch('/cuecapture/1/out/playback/cuelist/filter/cues/hidden', [])
expect('cuelist filter cues (path-form sibling)', state.cuelistFilters.cues, 'hidden')
dispatch('/cuecapture/1/out/playback/cuelist/filter/console-tc', ['shown'])
expect('cuelist filter console-tc (hyphenated name)', state.cuelistFilters['console-tc'], 'shown')
dispatch('/cuecapture/1/out/playback/cuelist/filter/fade-bar/hidden', [])
expect('cuelist filter fade-bar (path-form, hyphenated)', state.cuelistFilters['fade-bar'], 'hidden')

// Path-form sibling should NOT clobber state set by its arg-form parent.
dispatch('/cuecapture/1/out/recording/recording', [])
expect('path-form sibling preserves recording state', state.recordingState, 'recording')

// Pause / resume — `paused` is a real state, not dropped by the allow-list.
dispatch('/cuecapture/1/out/recording', ['paused'])
expect('recording paused (arg-form)', state.recordingState, 'paused')
dispatch('/cuecapture/1/out/recording/paused', [])
expect('path-form sibling preserves paused state', state.recordingState, 'paused')
dispatch('/cuecapture/1/out/recording/recording', [])
expect('path-form recording sibling (resume)', state.recordingState, 'recording')
dispatch('/cuecapture/1/out/recording/paused', [])
expect('path-form paused sibling alone', state.recordingState, 'paused')
dispatch('/cuecapture/1/out/recording', ['bogus'])
expect('unknown recording state still dropped', state.recordingState, 'paused')

// /identify replay — CueCapture answers /identify with a full state snapshot,
// so a fresh connection to a paused take must come up paused.
{
	const replay = createInitialState()
	for (const [addr, args] of [
		['/cuecapture/1/out/identify', [{ type: 'int', value: 1 }, '0.43.0']],
		['/cuecapture/1/out/recording', ['paused']],
		['/cuecapture/1/out/recording/paused', []],
		['/cuecapture/1/out/recording/duration', ['00:12:05']],
		['/cuecapture/1/out/recording/duration/seconds', [{ type: 'float', value: 725.0 }]],
		// 1 Hz ticks keep arriving while paused, carrying the frozen value.
		['/cuecapture/1/out/recording/duration', ['00:12:05']],
		['/cuecapture/1/out/recording/duration/seconds', [{ type: 'float', value: 725.0 }]],
	]) {
		const [msg] = decodePacket(encodeMessage(addr, args))
		dispatchOscMessage(replay, msg, 1)
	}
	expect('identify replay → paused', replay.recordingState, 'paused')
	expect('identify replay → frozen duration', replay.recordingDuration, '00:12:05')
	expect('identify replay → frozen duration seconds', replay.recordingDurationSeconds, 725)
}

// Instance filter
const state2 = createInitialState()
const buf2 = encodeMessage('/cuecapture/5/out/recording', ['recording'])
const [msg2] = decodePacket(buf2)
const handled = dispatchOscMessage(state2, msg2, 7)
expect('wrong instance id rejected', handled, false)
expect('wrong instance id no state change', state2.recordingState, null)

// Stand-in for ModuleInstance with just the members these modules touch.
// sendToApp goes through the real address builder + codec, as main.ts does.
function makeInstance() {
	const inst = {
		state: createInitialState(),
		sent: [],
		actions: null,
		feedbacks: null,
		variableDefs: null,
		variables: null,
		presets: null,
		sections: null,
		sendToApp(segments, args = []) {
			inst.sent.push(encodeMessage(buildRxAddress(1, segments), args))
		},
		setActionDefinitions(defs) {
			inst.actions = defs
		},
		setFeedbackDefinitions(defs) {
			inst.feedbacks = defs
		},
		setVariableDefinitions(defs) {
			inst.variableDefs = defs
		},
		setVariableValues(vals) {
			inst.variables = vals
		},
		setPresetDefinitions(structure, presets) {
			inst.sections = structure
			inst.presets = presets
		},
	}
	return inst
}

console.log('\n--- Pause / resume + show ID (actions, feedbacks, variables, presets) ---')
{
	const inst = makeInstance()
	UpdateActions(inst)
	UpdateFeedbacks(inst)
	UpdatePresets(inst)

	expect(
		'recording verb choices',
		inst.actions.recording_verb.options[0].choices.map((c) => [c.id, c.label]),
		[
			['start', 'Start'],
			['stop', 'Stop'],
			['toggle', 'Toggle'],
			['pause', 'Pause'],
			['resume', 'Resume'],
			['togglepause', 'Pause / Resume'],
		],
	)
	for (const verb of ['pause', 'resume', 'togglepause']) {
		inst.sent.length = 0
		await inst.actions.recording_verb.callback({ options: { verb } })
		const [msg] = decodePacket(inst.sent[0])
		expect(
			`recording_verb ${verb} → wire`,
			{ addr: msg.address, args: [...msg.args] },
			{ addr: `/cuecapture/1/recording/${verb}`, args: [] },
		)
	}

	const fb = inst.feedbacks
	const flashOpts = { options: { colorOn: 0xff0000, colorOff: 0x330000, periodMs: 1000 } }
	expect(
		'recording_state offers Paused',
		fb.recording_state.options[0].choices.some((c) => c.id === 'paused' && c.label === 'Paused'),
		true,
	)
	const feed = (addr, args) => dispatchOscMessage(inst.state, decodePacket(encodeMessage(addr, args))[0], 1)
	feed('/cuecapture/1/out/recording', ['recording'])
	expect('flash pulses while recording', 'bgcolor' in fb.recording_flash.callback(flashOpts), true)
	feed('/cuecapture/1/out/recording', ['paused'])
	expect('state matches Paused while paused', fb.recording_state.callback({ options: { state: 'paused' } }), true)
	expect(
		'state matches Recording false while paused',
		fb.recording_state.callback({ options: { state: 'recording' } }),
		false,
	)
	expect('flash stays dark while paused', fb.recording_flash.callback(flashOpts), {})

	feed('/cuecapture/1/out/recording/duration', ['00:12:05'])
	feed('/cuecapture/1/out/recording/duration/seconds', [{ type: 'float', value: 725.0 }])
	updateVariablesFromState(inst, inst.state)
	expect(
		'variables while paused',
		[inst.variables.recording_state, inst.variables.recording_duration, inst.variables.recording_duration_seconds],
		['paused', '00:12:05', 725],
	)

	const p = inst.presets
	const verbOf = (id) => p[id].steps[0].down[0].options.verb
	const lightsOn = (id, state) =>
		p[id].feedbacks.some((f) => f.feedbackId === 'recording_state' && f.options.state === state)
	expect('pause/resume preset verbs', ['rec_pause', 'rec_resume', 'rec_togglepause'].map(verbOf), [
		'pause',
		'resume',
		'togglepause',
	])
	expect(
		'presets lit while paused',
		['rec_toggle', 'rec_pause', 'rec_togglepause', 'readout_recording_status'].map((id) => lightsOn(id, 'paused')),
		[true, true, true, true],
	)
	expect(
		'presets lit while recording',
		['rec_resume', 'rec_togglepause'].map((id) => lightsOn(id, 'recording')),
		[true, true],
	)
	const recSection = inst.sections.find((s) => s.id === 'recording').definitions[0].presets
	expect(
		'recording section lists pause/resume presets',
		['rec_pause', 'rec_resume', 'rec_togglepause'].every((id) => recSection.includes(id)),
		true,
	)

	// Show ID
	const wire = async (actionId, options) => {
		inst.sent.length = 0
		await inst.actions[actionId].callback({ options })
		const [msg] = decodePacket(inst.sent[0])
		// Type-tag string — catches an int arg silently becoming a float.
		const tags = inst.sent[0].toString('latin1').match(/,[a-zA-Z]*/)[0]
		return { addr: msg.address, args: [...msg.args], tags }
	}
	expect('settings_showid → wire', await wire('settings_showid', { value: 5 }), {
		addr: '/cuecapture/1/settings/set/showid',
		args: [5],
		tags: ',i',
	})
	expect('settings_showid_step → wire', await wire('settings_showid_step', { delta: -1 }), {
		addr: '/cuecapture/1/settings/showid/step',
		args: [-1],
		tags: ',i',
	})
	expect('settings_showid_reset → wire', await wire('settings_showid_reset', {}), {
		addr: '/cuecapture/1/settings/showid/reset',
		args: [],
		tags: ',',
	})
	feed('/cuecapture/1/out/settings/showid', [{ type: 'int', value: 7 }])
	updateVariablesFromState(inst, inst.state)
	expect('show_id variable', inst.variables.show_id, 7)
	expect('next-show preset steps +1', p['showid_next'].steps[0].down[0], {
		actionId: 'settings_showid_step',
		options: { delta: 1 },
	})
	const knob = p['rotary_showid'].steps[0]
	expect(
		'show ID knob: turn steps ±1, press resets',
		[knob.rotate_left[0], knob.rotate_right[0], knob.down[0].actionId],
		[
			{ actionId: 'settings_showid_step', options: { delta: -1 } },
			{ actionId: 'settings_showid_step', options: { delta: 1 } },
			'settings_showid_reset',
		],
	)
	const sectionPresets = (id) => inst.sections.find((s) => s.id === id).definitions[0].presets
	expect(
		'show ID presets listed',
		[sectionPresets('settings').includes('showid_next'), sectionPresets('rotary-global').includes('rotary_showid')],
		[true, true],
	)
}

console.log('\n--- Overlay layouts (action, dispatcher, feedback, variables, presets) ---')
{
	const inst = makeInstance()
	UpdateActions(inst)
	UpdateFeedbacks(inst)
	UpdatePresets(inst)
	UpdateVariableDefinitions(inst)
	const feed = (addr, args) => dispatchOscMessage(inst.state, decodePacket(encodeMessage(addr, args))[0], 1)
	// A space and a slash: only the arg form can carry this name losslessly.
	const NAME = 'Act Two / Finale'
	// CueCapture's path-twin spelling of NAME: whitespace and `/` folded to `_`.
	const TOKEN = 'Act_Two___Finale'

	// Action — the ARG form, one string arg; never the /overlay/layout/{Name} path form.
	const select = async (name) => {
		inst.sent.length = 0
		await inst.actions.overlay_layout_select.callback({ options: { name } })
		return inst.sent.map((buf) => {
			const [msg] = decodePacket(buf)
			return { addr: msg.address, args: [...msg.args], tags: buf.toString('latin1').match(/,[a-zA-Z]*/)[0] }
		})
	}
	expect('overlay_layout_select → arg form, name as one string arg', await select(NAME), [
		{ addr: '/cuecapture/1/overlay/layout', args: [NAME], tags: ',s' },
	])
	expect('overlay_layout_select sends underscores verbatim', await select('Act_Two'), [
		{ addr: '/cuecapture/1/overlay/layout', args: ['Act_Two'], tags: ',s' },
	])
	expect('overlay_layout_select sends nothing for a blank name', await select('   '), [])
	expect(
		'overlay_layout_select takes only a name (no fade option)',
		inst.actions.overlay_layout_select.options.map((o) => o.id),
		['name'],
	)

	// Dispatcher — /out/overlay/layout (+ path twin) and /out/overlay/layouts.
	expect('overlay layout unknown before TX', [inst.state.overlayLayout, inst.state.overlayLayouts], [null, null])
	expect('path twin alone is handled', feed(`/cuecapture/1/out/overlay/layout/${TOKEN}`, []), true)
	expect('path twin alone sets nothing (lossy)', inst.state.overlayLayout, null)
	// The pair in CueCapture's send order: arg form, then the path twin.
	expect('/out/overlay/layout handled', feed('/cuecapture/1/out/overlay/layout', [NAME]), true)
	feed(`/cuecapture/1/out/overlay/layout/${TOKEN}`, [])
	expect('arg form sets the exact name; path twin does not fold it', inst.state.overlayLayout, NAME)
	feed('/cuecapture/1/out/overlay/layout', [{ type: 'int', value: 2 }])
	expect('non-string layout arg ignored', inst.state.overlayLayout, NAME)
	const LIST = ['Layout 1', NAME, 'Act_Two', 'Act Two', 'Big Finale']
	expect('/out/overlay/layouts handled', feed('/cuecapture/1/out/overlay/layouts', LIST), true)
	expect('layout list kept in operator order', inst.state.overlayLayouts, LIST)
	expect(
		'layout for another instance rejected',
		dispatchOscMessage(inst.state, decodePacket(encodeMessage('/cuecapture/2/out/overlay/layout', ['Layout 1']))[0], 1),
		false,
	)
	expect('other instance leaves the name alone', inst.state.overlayLayout, NAME)

	// Feedback — trimmed, case-insensitive (CueCapture's OrdinalIgnoreCase), and
	// literal: no `_`-as-space fold, since the list may be cut short.
	const active = (name) => inst.feedbacks.overlay_layout_active.callback({ options: { name } })
	expect('feedback: exact name with space and slash', active(NAME), true)
	expect('feedback: case-insensitive and trimmed', active('  act two / FINALE '), true)
	expect('feedback: another layout', active('Layout 1'), false)
	expect('feedback: blank name never matches', active(''), false)
	feed('/cuecapture/1/out/overlay/layout', ['Act Two'])
	expect('feedback: Act Two', active('Act Two'), true)
	expect('feedback: Act_Two is a different layout name', active('Act_Two'), false)
	// A truncated or unknown list must not make `_` read as a space either.
	feed('/cuecapture/1/out/overlay/layouts', [])
	expect('feedback: no `_` fold with an empty (truncated) list', active('Act_Two'), false)
	// Per-character case folding, as .NET does: ß does not expand to SS.
	feed('/cuecapture/1/out/overlay/layout', ['Straße'])
	expect('feedback: Straße matches straße (UTF-8 through the codec)', active('straße'), true)
	expect('feedback: Straße does not match STRASSE', active('STRASSE'), false)
	feed('/cuecapture/1/out/overlay/layout', ['Kırmızı ᾀ'])
	expect(
		'feedback: .NET ordinal casing — dotless ı stays distinct, ᾀ folds with ᾈ',
		[active('kırmızı ᾈ'), active('Kirmizi ᾀ')],
		[true, false],
	)
	expect(
		'action and feedback names parse Companion variables',
		[
			inst.actions.overlay_layout_select.options[0].useVariables,
			inst.feedbacks.overlay_layout_active.options[0].useVariables,
		],
		[true, true],
	)
	feed('/cuecapture/1/out/overlay/layouts', LIST)
	feed('/cuecapture/1/out/overlay/layout', ['Act Two'])

	// Variables.
	updateVariablesFromState(inst, inst.state)
	const v = () => inst.variables
	expect(
		'overlay layout variables',
		[v().overlay_layout, v().overlay_layout_count, v().overlay_layout_1, v().overlay_layout_2, v().overlay_layout_5],
		['Act Two', 5, 'Layout 1', NAME, 'Big Finale'],
	)
	expect('overlay_layout_N past the end of the list is blank', [v().overlay_layout_6, v().overlay_layout_8], ['', ''])
	expect(
		'overlay_layout_1..8 declared, no 9th',
		[...Array(8).keys()].every((i) => `overlay_layout_${i + 1}` in inst.variableDefs) &&
			!('overlay_layout_9' in inst.variableDefs) &&
			'overlay_layout' in inst.variableDefs &&
			'overlay_layout_count' in inst.variableDefs,
		true,
	)
	// CueCapture sends the list with no args when not even the first name fits
	// one datagram — a real (empty) list, not "unknown".
	feed('/cuecapture/1/out/overlay/layouts', [])
	updateVariablesFromState(inst, inst.state)
	expect('empty layout list → count 0, slots blank', [v().overlay_layout_count, v().overlay_layout_1], [0, ''])
	const fresh = makeInstance()
	updateVariablesFromState(fresh, fresh.state)
	expect(
		'before any TX: name and count blank',
		[fresh.variables.overlay_layout, fresh.variables.overlay_layout_count],
		['', ''],
	)

	// Presets.
	const p = inst.presets
	const slot = p['overlay_layout_slot_3']
	expect(
		'list preset: label, action and feedback all follow overlay_layout_3',
		[slot.style.text, slot.steps[0].down[0], slot.feedbacks[0].feedbackId, slot.feedbacks[0].options],
		[
			'$(cuecapture:overlay_layout_3)',
			{ actionId: 'overlay_layout_select', options: { name: '$(cuecapture:overlay_layout_3)' } },
			'overlay_layout_active',
			{ name: '$(cuecapture:overlay_layout_3)' },
		],
	)
	const byName = p['overlay_layout_by_name']
	expect(
		'by-name preset: action and feedback name the same layout',
		[byName.steps[0].down[0].options.name, byName.feedbacks[0].options.name],
		['Layout 1', 'Layout 1'],
	)
	const listed = inst.sections.find((s) => s.id === 'overlay-layouts').definitions.flatMap((d) => d.presets)
	expect('overlay layouts section lists the 8 list presets, by-name and readout', listed, [
		...[...Array(8).keys()].map((i) => `overlay_layout_slot_${i + 1}`),
		'overlay_layout_by_name',
		'overlay_layout_readout',
	])
	expect(
		'every listed overlay layout preset is defined',
		listed.every((id) => id in p),
		true,
	)
}

console.log(`\n${failures === 0 ? '✅ All OSC roundtrips and dispatcher cases pass' : `❌ ${failures} failure(s)`}`)
process.exit(failures === 0 ? 0 : 1)
