import {
  Briefcase, Car, CircleEllipsis, Coins, Film, Gift, GraduationCap, HeartPulse, Home, PartyPopper,
  Plane, Receipt, Shirt, ShoppingBasket, Smartphone, Sparkles, Utensils, Wallet, Coffee, Dumbbell,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  basket: ShoppingBasket,
  car: Car,
  receipt: Receipt,
  heart: HeartPulse,
  graduation: GraduationCap,
  shirt: Shirt,
  party: PartyPopper,
  dots: CircleEllipsis,
  briefcase: Briefcase,
  coins: Coins,
  gift: Gift,
  home: Home,
  film: Film,
  plane: Plane,
  phone: Smartphone,
  sparkles: Sparkles,
  wallet: Wallet,
  coffee: Coffee,
  gym: Dumbbell,
}

export function CategoryIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = CATEGORY_ICONS[icon] ?? CircleEllipsis
  const box = size === 'sm' ? 'size-8 rounded-xl' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-2xl'
  const ic = size === 'sm' ? 16 : size === 'lg' ? 22 : 19
  return (
    <span className={`${box} grid shrink-0 place-items-center`} style={{ backgroundColor: `${color}1F`, color }}>
      <Icon size={ic} strokeWidth={2} />
    </span>
  )
}
