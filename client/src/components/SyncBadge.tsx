import { FlaskConical } from 'lucide-react'
import { Badge } from './ui'

/** نشانگر وضعیت همگام‌سازی — در مرحلهٔ چهارم به وضعیت واقعی متصل می‌شود */
export function SyncBadge() {
  return (
    <Badge tone="amber">
      <FlaskConical size={13} />
      پیش‌نمایش
    </Badge>
  )
}
