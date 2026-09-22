import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import type { InstanceId } from './osc/address.js'

export type ModuleConfig = {
	host: string
	txPort: number
	rxPort: number
	instanceIdRaw: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'CueCapture connection',
			value:
				'In CueCapture: Settings → Integrations → OSC. Enable inbound OSC; for state feedback (variables + button lights) also enable TX with the destination matching the Module RX port below.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Host IP',
			width: 6,
			regex: Regex.IP,
			default: '127.0.0.1',
		},
		{
			type: 'number',
			id: 'txPort',
			label: 'CueCapture RX port (we send to)',
			width: 3,
			min: 1024,
			max: 65535,
			default: 8001,
		},
		{
			type: 'number',
			id: 'rxPort',
			label: 'Module RX port (we listen on)',
			width: 3,
			min: 1024,
			max: 65535,
			default: 8002,
		},
		{
			type: 'textinput',
			id: 'instanceIdRaw',
			label: 'Instance ID (1–99) or "broadcast"',
			width: 4,
			default: '1',
			tooltip: 'Numeric ID matches CueCapture\'s OSC ID setting. Use "broadcast" to target / listen to every instance.',
		},
	]
}

/**
 * Resolve the Instance ID config field.
 *
 *  - empty / `broadcast` (case-insensitive, whitespace-tolerant) → `'broadcast'`
 *  - a whole number 1–99 → that id
 *  - anything else → `null`
 *
 * `null` means the field is invalid. Callers must surface that as a config
 * error rather than widening to broadcast — a typo should never silently make
 * the module talk to (and listen to) every CueCapture instance on the network.
 */
export function parseInstanceId(raw: string | undefined): InstanceId | null {
	const trimmed = (raw ?? '').trim().toLowerCase()
	if (trimmed === 'broadcast' || trimmed === '') return 'broadcast'
	// Strict decimal digits only — rejects '1.0', '0x1', '1e0', '-1', etc.
	if (!/^\d{1,2}$/.test(trimmed)) return null
	const n = Number(trimmed)
	return n >= 1 && n <= 99 ? n : null
}
