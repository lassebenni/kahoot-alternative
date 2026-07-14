import { Participant } from '@/types/types'
import JoinQr from './join-qr'

// Floating button + modal shown on the host's Quiz and Results screens, so a
// student who got disconnected mid-quiz can rescan the join QR, and the host
// can see at a glance who is currently connected.
export function RejoinButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute left-4 top-4 z-40 px-4 py-2 rounded text-sm font-semibold shadow bg-white/90 text-black hover:bg-white"
      title="Show the join QR code and who is currently connected"
    >
      📱 Show join QR
    </button>
  )
}

export function RejoinPanel({
  gameId,
  participants,
  presentIds,
  onClose,
}: {
  gameId: string
  participants: Participant[]
  presentIds: Set<string>
  onClose: () => void
}) {
  const sorted = [...participants].sort((a, b) => {
    const aOnline = presentIds.has(a.id) ? 0 : 1
    const bOnline = presentIds.has(b.id) ? 0 : 1
    return aOnline - bOnline
  })

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-black rounded-2xl p-8 max-w-2xl w-full shadow-2xl flex gap-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1">
          <h2 className="text-white text-xl font-bold mb-4">
            Dropped? Scan again to rejoin
          </h2>
          <JoinQr gameId={gameId} />
        </div>
        <div className="flex-1">
          <h3 className="text-white/70 text-sm font-semibold mb-2">
            Players ({presentIds.size} online / {participants.length} total)
          </h3>
          <div className="flex flex-col gap-1 max-h-96 overflow-auto">
            {sorted.map((p) => {
              const online = presentIds.has(p.id)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-white/10 text-white text-sm"
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      online ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                  />
                  <span className={online ? '' : 'text-white/40'}>{p.nickname}</span>
                  {!online && <span className="ml-auto text-xs text-white/40">offline</span>}
                </div>
              )
            })}
            {sorted.length === 0 && (
              <p className="text-white/40 text-sm italic">No players yet.</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white text-xl"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
