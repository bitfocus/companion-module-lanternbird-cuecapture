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

import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const distUrl = (sub) => pathToFileURL(resolve(HERE, '..', 'dist', sub)).href

const { encodeMessage, decodePacket } = await import(distUrl('osc/codec.js'))
const { buildRxAddress } = await import(distUrl('osc/address.js'))
const { dispatchOscMessage } = await import(distUrl('osc/dispatcher.js'))
const { createInitialState } = await import(distUrl('state.js'))

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

// Instance filter
const state2 = createInitialState()
const buf2 = encodeMessage('/cuecapture/5/out/recording', ['recording'])
const [msg2] = decodePacket(buf2)
const handled = dispatchOscMessage(state2, msg2, 7)
expect('wrong instance id rejected', handled, false)
expect('wrong instance id no state change', state2.recordingState, null)

console.log(`\n${failures === 0 ? '✅ All OSC roundtrips and dispatcher cases pass' : `❌ ${failures} failure(s)`}`)
process.exit(failures === 0 ? 0 : 1)
