import * as dgram from 'node:dgram'
import { decodePacket, type OscMessage } from './codec.js'

export interface ReceiverLogger {
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

export type MessageHandler = (msg: OscMessage) => void

/**
 * Listens on a UDP port for incoming OSC messages and hands each decoded
 * message to the handler. The instance id filter is applied downstream by the
 * caller (parseTxAddress) so we keep this transport-only.
 */
export class OscReceiver {
	private socket: dgram.Socket | null = null

	constructor(
		private readonly logger: ReceiverLogger,
		private port: number,
		private readonly onMessage: MessageHandler,
	) {}

	async start(): Promise<void> {
		await this.bind(this.port)
	}

	async restart(port: number): Promise<void> {
		this.destroy()
		this.port = port
		await this.bind(port)
	}

	destroy(): void {
		if (this.socket) {
			try {
				this.socket.close()
			} catch {
				/* may already be closed */
			}
			this.socket = null
		}
	}

	private async bind(port: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
			sock.on('error', (err) => {
				this.logger.log('warn', `OSC receive socket error: ${err.message}`)
			})
			sock.on('message', (buf) => {
				for (const msg of decodePacket(buf)) {
					try {
						this.onMessage(msg)
					} catch (err) {
						const m = err instanceof Error ? err.message : String(err)
						this.logger.log('warn', `OSC handler threw for ${msg.address}: ${m}`)
					}
				}
			})
			const onceError = (err: Error): void => {
				sock.removeListener('listening', onceListening)
				try {
					sock.close()
				} catch {
					/* may already be torn down */
				}
				reject(err)
			}
			const onceListening = (): void => {
				sock.removeListener('error', onceError)
				this.socket = sock
				resolve()
			}
			sock.once('error', onceError)
			sock.once('listening', onceListening)
			sock.bind(port, '0.0.0.0')
		})
	}
}
