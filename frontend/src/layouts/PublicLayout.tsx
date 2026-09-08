import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, X, MapPin, Phone, Mail } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
      <header className="sticky top-0 z-50 bg-navy-600 shadow-md shadow-navy-900/20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center">
            <BrandLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'text-sm font-medium transition-colors duration-300',
                  pathname === link.to
                    ? 'text-gold-400'
                    : 'text-white/80 hover:text-gold-300',
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/login">
              <Button variant="gold" size="sm">
                Sign In
              </Button>
            </Link>
          </nav>

          <button
            className="flex items-center justify-center rounded-lg p-2 text-white/90 hover:bg-white/10"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <nav className="border-t border-white/10 bg-navy-700 px-4 pb-4 pt-2 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-300',
                  pathname === link.to
                    ? 'bg-white/10 text-gold-400'
                    : 'text-white/80 hover:bg-white/10 hover:text-gold-300',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-white/10 pt-2">
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="gold" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-navy-950 text-white/70">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <BrandLogo size="sm" />
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
                Dharkeynley, Mogadishu — empowering students through quality education and nurturing
                knowledge, discipline, and excellence in every learner.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-400">
                Quick Links
              </h4>
              <ul className="space-y-3 text-sm">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-white/70 transition-colors duration-300 hover:text-gold-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-400">
                Contact
              </h4>
              <ul className="space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                  Dharkeynley, Mogadishu, Somalia
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                  +252 6X XXX XXXX
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                  info@somalistaracademy.so
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-center text-xs text-white/50 sm:flex-row sm:text-left">
            <p>&copy; {new Date().getFullYear()} Somali Star Academy. All rights reserved.</p>
            <p>
              Empowering Students Through <span className="text-gold-400">Quality Education</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
