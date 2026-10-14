import { useEffect, useState } from 'react'

export type Route = 'home' | 'transactions' | 'reports' | 'settings'
const ROUTES: Route[] = ['home', 'transactions', 'reports', 'settings']

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home'
}

/** مسیریاب سادهٔ مبتنی بر hash — بدون وابستگی و سازگار با حالت آفلاین و PWA */
export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (r: Route) => {
    location.hash = r === 'home' ? '/' : `/${r}`
  }
  return [route, go]
}
