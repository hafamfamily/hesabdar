import { AlertTriangle, CheckCircle2, CloudOff, CloudUpload, KeyRound, Loader2, Smartphone } from 'lucide-react'
import { useSync } from '../app/sync-context'
import { toFaDigits } from '../lib/digits'
import { Badge } from './ui'

/** نشانگر وضعیت همگام‌سازی در سرصفحه */
export function SyncBadge({ onClick }: { onClick?: () => void }) {
  const s = useSync()
  const content = (() => {
    if (s.state === 'unpaired') return <Badge><Smartphone size={13} /> فقط روی دستگاه</Badge>
    if (s.conflicts > 0) return <Badge tone="amber"><AlertTriangle size={13} /> {toFaDigits(s.conflicts)} تعارض</Badge>
    if (s.state === 'syncing') return <Badge tone="brand"><Loader2 size={13} className="animate-spin" /> همگام‌سازی…</Badge>
    if (s.state === 'auth') return <Badge tone="amber"><KeyRound size={13} /> اتصال دوباره</Badge>
    if (s.pending > 0) return <Badge tone="amber">{s.state === 'offline' ? <CloudOff size={13} /> : <CloudUpload size={13} />} {toFaDigits(s.pending)} در صف</Badge>
    if (s.state === 'offline') return <Badge><CloudOff size={13} /> سرور در دسترس نیست</Badge>
    return <Badge tone="brand"><CheckCircle2 size={13} /> همگام</Badge>
  })()
  return onClick ? (
    <button type="button" onClick={onClick} aria-label="وضعیت همگام‌سازی">
      {content}
    </button>
  ) : (
    content
  )
}
