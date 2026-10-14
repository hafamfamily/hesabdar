import { Smartphone } from 'lucide-react'
import { Badge } from './ui'

/** نشانگر وضعیت ذخیره/همگام‌سازی — در مرحلهٔ چهارم به وضعیت واقعی همگام‌سازی متصل می‌شود */
export function SyncBadge() {
  return (
    <Badge>
      <Smartphone size={13} />
      ذخیره روی دستگاه
    </Badge>
  )
}
