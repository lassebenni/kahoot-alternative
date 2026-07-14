import { useQRCode } from 'next-qrcode'
import { useEffect, useState } from 'react'

// Shared join QR + URL block. Used on the pre-start lobby screen and inside
// the mid-quiz rejoin panel so a dropped student always sees the same code.
export default function JoinQr({ gameId }: { gameId: string }) {
  const { Canvas } = useQRCode()
  // Read window.location.origin only after mount so SSR and the first CSR
  // render agree on the value (both empty), avoiding a hydration warning.
  const [playerUrl, setPlayerUrl] = useState<string>('')
  useEffect(() => {
    setPlayerUrl(`${window.location.origin}/game/${gameId}`)
  }, [gameId])

  if (!playerUrl) return null

  return (
    <div>
      <Canvas
        text={playerUrl}
        options={{
          errorCorrectionLevel: 'M',
          margin: 3,
          scale: 4,
          width: 400,
        }}
      />
      <p className="text-white text-center mt-2 break-all text-sm">{playerUrl}</p>
    </div>
  )
}
