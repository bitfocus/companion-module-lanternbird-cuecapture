import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, parseInstanceId, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, updateVariablesFromState, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, ALL_FEEDBACK_IDS, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { OscSender } from './osc/sender.js'
import { OscReceiver } from './osc/receiver.js'
import { dispatchOscMessage } from './osc/dispatcher.js'
import { buildRxAddress, type InstanceId } from './osc/address.js'
import { createInitialState, type AppState } from './state.js'
import type { OscArg, OscMessage } from './osc/codec.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

const FLASH_TICK_MS = 250

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	state: AppState = createInitialState()
	private sender: OscSender | null = null
	private receiver: OscReceiver | null = null
	private flashTimer: NodeJS.Timeout | null = null
	/** Resolved from config.instanceIdRaw; `null` while the field is invalid. */
	private resolvedInstanceId: InstanceId | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.state = createInitialState()
		this.log('info', 'CueCapture module starting')

		this.sender = new OscSender({ log: (lvl, msg) => this.log(lvl, msg) }, config.host, config.txPort)
		this.receiver = new OscReceiver({ log: (lvl, msg) => this.log(lvl, msg) }, config.rxPort, (msg) =>
			this.handleIncoming(msg),
		)

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		updateVariablesFromState(this, this.state)

		if (this.applyInstanceId(config)) {
			try {
				await this.receiver.start()
				this.updateStatus(InstanceStatus.Ok)
			} catch (err) {
				const m = err instanceof Error ? err.message : String(err)
				this.updateStatus(InstanceStatus.ConnectionFailure, `RX bind failed: ${m}`)
			}
			this.sendIdentify()
		}
		this.startFlashTimer()
	}

	async destroy(): Promise<void> {
		this.stopFlashTimer()
		this.sender?.destroy()
		this.receiver?.destroy()
		this.sender = null
		this.receiver = null
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.state = createInitialState()
		updateVariablesFromState(this, this.state)

		this.refreshAllFeedbacks()

		this.sender?.updateTarget(config.host, config.txPort)
		if (!this.applyInstanceId(config)) {
			// No valid id → nothing we could correctly filter for. Stop listening
			// until the user fixes the field.
			this.receiver?.destroy()
			return
		}
		try {
			await this.receiver?.restart(config.rxPort)
			this.updateStatus(InstanceStatus.Ok)
		} catch (err) {
			const m = err instanceof Error ? err.message : String(err)
			this.updateStatus(InstanceStatus.ConnectionFailure, `RX bind failed: ${m}`)
		}
		this.sendIdentify()
	}

	/**
	 * Resolve the Instance ID field. An unparseable value is a config error and
	 * is reported as BadConfig — it is NOT silently widened to broadcast.
	 * Returns true when the id is usable.
	 */
	private applyInstanceId(config: ModuleConfig): boolean {
		this.resolvedInstanceId = parseInstanceId(config.instanceIdRaw)
		if (this.resolvedInstanceId === null) {
			this.updateStatus(
				InstanceStatus.BadConfig,
				`Instance ID "${config.instanceIdRaw}" is not valid — use a whole number from 1 to 99, or "broadcast"`,
			)
			return false
		}
		return true
	}

	private refreshAllFeedbacks(): void {
		// Spread the readonly tuple — checkFeedbacks requires ≥1 id, which ALL_FEEDBACK_IDS guarantees.
		this.checkFeedbacks(...ALL_FEEDBACK_IDS)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	/**
	 * Build a `/cuecapture/{id}/...` address from path segments and fire it
	 * with the supplied OSC args. Use empty `args` for verb-only commands.
	 */
	sendToApp(segments: readonly string[], args: readonly OscArg[] = []): void {
		const id = this.resolvedInstanceId
		if (id === null) {
			this.log('warn', `Dropped /${segments.join('/')} — Instance ID config is invalid`)
			return
		}
		const addr = buildRxAddress(id, segments)
		this.sender?.send(addr, args)
	}

	sendIdentify(): void {
		this.sendToApp(['identify'])
	}

	/**
	 * Send a raw OSC address with no prefix transformations — used by the
	 * `send_custom` escape-hatch action when the user wants full control over
	 * the address string (e.g. an absolute `/cuecapture/...` they built
	 * themselves, or a non-CueCapture address they're aiming at the same host).
	 */
	sendRawAddress(address: string, args: readonly OscArg[] = []): void {
		// Raw sends don't use the id, but the module is inert while its config
		// is invalid — same rule as sendToApp, so behaviour matches HELP.md.
		if (this.resolvedInstanceId === null) {
			this.log('warn', `Dropped ${address} — Instance ID config is invalid`)
			return
		}
		this.sender?.send(address, args)
	}

	private handleIncoming(msg: OscMessage): void {
		const id = this.resolvedInstanceId
		// Receiver is torn down while the id is invalid, so this is belt-and-braces.
		if (id === null) return
		const handled = dispatchOscMessage(this.state, msg, id)
		// Surface every received TX message at debug level so users can verify
		// the wire flow without an external OSC monitor. (handled=false → either
		// wrong instance id, or an address category we don't parse yet.)
		this.log('debug', `RX ${handled ? '✓' : '✗'} ${msg.address} args=${JSON.stringify(msg.args)}`)
		if (handled) {
			updateVariablesFromState(this, this.state)
			this.refreshAllFeedbacks()
		}
	}

	private startFlashTimer(): void {
		this.stopFlashTimer()
		// Always-on tick. @companion-module/base v2 dropped the per-feedback `subscribe` hook
		// so we can't refcount placements; cost of one no-op checkFeedbacks every 250 ms is
		// negligible when no recording_flash instances are placed.
		this.flashTimer = setInterval(() => {
			this.checkFeedbacks('recording_flash')
		}, FLASH_TICK_MS)
	}

	private stopFlashTimer(): void {
		if (this.flashTimer) {
			clearInterval(this.flashTimer)
			this.flashTimer = null
		}
	}
}
