// Address construction + parsing for /cuecapture/{id}/... addresses.
// Instance id is either "broadcast" (omit segment) or 1–99 (insert as segment).

export type InstanceId = 'broadcast' | number

export type DeckSlot = 'a' | 'b' | 'c' | 'd' | 'active'
export const DECK_LETTERS = ['a', 'b', 'c', 'd'] as const
export type DeckLetter = (typeof DECK_LETTERS)[number]

export const DECK_SLOT_CHOICES: ReadonlyArray<{ id: DeckSlot; label: string }> = [
	{ id: 'a', label: 'Deck A' },
	{ id: 'b', label: 'Deck B' },
	{ id: 'c', label: 'Deck C' },
	{ id: 'd', label: 'Deck D' },
	{ id: 'active', label: 'Active deck' },
]

export function buildRxAddress(id: InstanceId, segments: readonly string[]): string {
	const parts = ['/cuecapture']
	if (id !== 'broadcast') parts.push(String(id))
	for (const s of segments) {
		if (s.length === 0) continue
		parts.push(s)
	}
	return parts.join('/')
}

/**
 * Parses a TX address ("/cuecapture/{id}/out/...") into the instance id and the
 * remaining path after `/out/`. Returns null if the address isn't a CueCapture
 * TX message or doesn't match the configured filter.
 */
export function parseTxAddress(
	address: string,
	wantedId: InstanceId,
): { tail: readonly string[]; instanceId: number } | null {
	if (!address.startsWith('/cuecapture/')) return null
	const segs = address.slice(1).split('/')
	if (segs[0] !== 'cuecapture') return null
	if (segs.length < 3) return null

	// TX is always addressed with the instance id; `{id}` is never omitted on outbound.
	const idSeg = segs[1]
	if (idSeg === undefined) return null
	const id = Number(idSeg)
	if (!Number.isInteger(id) || id < 1 || id > 99) return null

	if (wantedId !== 'broadcast' && wantedId !== id) return null
	if (segs[2] !== 'out') return null

	return { tail: segs.slice(3), instanceId: id }
}
