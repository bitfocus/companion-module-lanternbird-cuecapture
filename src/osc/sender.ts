import * as dgram from 'node:dgram'
import { encodeMessage, type OscArg } from './codec.js'

export interface SenderLogger {
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

/**
 * Fire-and-forget UDP OSC sender. CueCapture's RX is fire-and-forget too —
 * we don't expect replies on the send path.
 */
export class OscSender {
	private socket: dgram.Socket | null = null

	constructor(
		private readonly logger: SenderLogger,
		private host: string,
		private port: number,
	) {
		this.openSocket()
	}

	updateTarget(host: string, port: number): void {
		this.host = host
		this.port = port
	}

	send(address: string, args: readonly OscArg[] = []): void {
		const sock = this.socket
		if (!sock) {
			this.logger.log('warn', `OSC send while socket closed: ${address}`)
			return
		}
		try {
			const buf = encodeMessage(address, args)
			sock.send(buf, this.port, this.host, (err) => {
				if (err) this.logger.log('warn', `OSC send failed: ${address}: ${err.message}`)
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			this.logger.log('warn', `OSC encode failed for ${address}: ${message}`)
		}
	}

	destroy(): void {
		if (this.socket) {
			try {
				this.socket.close()
			} catch {
				/* socket may already be closed */
			}
			this.socket = null
		}
	}

	private openSocket(): void {
		const sock = dgram.createSocket('udp4')
		sock.on('error', (err) => {
			this.logger.log('warn', `OSC send socket error: ${err.message}`)
		})
		this.socket = sock
	}
}
