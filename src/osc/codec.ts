// Minimal OSC 1.0 encoder/decoder. Handles the subset CueCapture uses:
// type tags s (string), i (int32), f (float32), d (float64), T (true), F (false), N (nil).
// Bundles ("#bundle") are unwrapped recursively. No blob/timetag/array support.

export type OscArg =
	| string
	| number
	| boolean
	| { readonly type: 'int'; readonly value: number }
	| { readonly type: 'float'; readonly value: number }
	| { readonly type: 'double'; readonly value: number }

export type OscValue = string | number | boolean | null

export interface OscMessage {
	readonly address: string
	readonly args: readonly OscValue[]
}

function writeString(value: string): Buffer {
	const bytes = Buffer.from(value, 'utf8')
	// OSC strings are null-terminated and padded to a 4-byte boundary.
	const totalLength = Math.ceil((bytes.length + 1) / 4) * 4
	const out = Buffer.alloc(totalLength)
	bytes.copy(out, 0)
	return out
}

function readString(buf: Buffer, offset: number): { value: string; newOffset: number } | null {
	let end = offset
	while (end < buf.length && buf[end] !== 0) end++
	if (end >= buf.length) return null
	const value = buf.toString('utf8', offset, end)
	const consumed = Math.ceil((end - offset + 1) / 4) * 4
	return { value, newOffset: offset + consumed }
}

export function encodeMessage(address: string, args: readonly OscArg[]): Buffer {
	const parts: Buffer[] = [writeString(address)]
	let typeTag = ','
	const argBufs: Buffer[] = []

	for (const arg of args) {
		if (typeof arg === 'string') {
			typeTag += 's'
			argBufs.push(writeString(arg))
		} else if (typeof arg === 'boolean') {
			typeTag += arg ? 'T' : 'F'
		} else if (typeof arg === 'number') {
			// Untagged numbers default to float32 to match common OSC sender behavior.
			typeTag += 'f'
			const b = Buffer.alloc(4)
			b.writeFloatBE(arg, 0)
			argBufs.push(b)
		} else if (arg.type === 'int') {
			typeTag += 'i'
			const b = Buffer.alloc(4)
			b.writeInt32BE(arg.value, 0)
			argBufs.push(b)
		} else if (arg.type === 'float') {
			typeTag += 'f'
			const b = Buffer.alloc(4)
			b.writeFloatBE(arg.value, 0)
			argBufs.push(b)
		} else {
			typeTag += 'd'
			const b = Buffer.alloc(8)
			b.writeDoubleBE(arg.value, 0)
			argBufs.push(b)
		}
	}

	parts.push(writeString(typeTag))
	for (const b of argBufs) parts.push(b)
	return Buffer.concat(parts)
}

function decodeMessage(buf: Buffer): OscMessage | null {
	const addr = readString(buf, 0)
	if (!addr) return null
	if (addr.newOffset >= buf.length) {
		return { address: addr.value, args: [] }
	}
	const tag = readString(buf, addr.newOffset)
	if (!tag || !tag.value.startsWith(',')) return null

	const args: OscValue[] = []
	let offset = tag.newOffset
	const tagChars = tag.value.slice(1)

	for (const t of tagChars) {
		if (t === 's') {
			const s = readString(buf, offset)
			if (!s) return null
			args.push(s.value)
			offset = s.newOffset
		} else if (t === 'i') {
			if (offset + 4 > buf.length) return null
			args.push(buf.readInt32BE(offset))
			offset += 4
		} else if (t === 'f') {
			if (offset + 4 > buf.length) return null
			args.push(buf.readFloatBE(offset))
			offset += 4
		} else if (t === 'd') {
			if (offset + 8 > buf.length) return null
			args.push(buf.readDoubleBE(offset))
			offset += 8
		} else if (t === 'T') {
			args.push(true)
		} else if (t === 'F') {
			args.push(false)
		} else if (t === 'N') {
			args.push(null)
		} else {
			// Unknown type tag — bail rather than misread the rest of the packet.
			return { address: addr.value, args }
		}
	}
	return { address: addr.value, args }
}

export function decodePacket(buf: Buffer): readonly OscMessage[] {
	if (buf.length >= 16 && buf.toString('utf8', 0, 7) === '#bundle') {
		const messages: OscMessage[] = []
		// Skip "#bundle\0" (8 bytes) + 8-byte timetag.
		let offset = 16
		while (offset + 4 <= buf.length) {
			const size = buf.readInt32BE(offset)
			offset += 4
			if (size <= 0 || offset + size > buf.length) break
			const sub = buf.subarray(offset, offset + size)
			for (const m of decodePacket(sub)) messages.push(m)
			offset += size
		}
		return messages
	}
	const msg = decodeMessage(buf)
	return msg ? [msg] : []
}
