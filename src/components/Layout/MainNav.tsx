import { motion } from 'framer-motion';
import { NavLink } from 'react-router';
import { NAV_ROUTES } from '../../routes';
import { cn } from '../../utils/cn';

/** Onglets de navigation dans l'en-tête (écrans moyens et larges). */
export function DesktopNav() {
  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="flex items-center gap-1 rounded-2xl bg-black/20 p-1 ring-1 ring-white/[0.06]">
        {NAV_ROUTES.map(({ path, label, icon: Icon, preload }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              title={label}
              onPointerEnter={() => void preload?.()}
              onFocus={() => void preload?.()}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill-desktop"
                      className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className="relative size-4" aria-hidden />
                  <span className="relative sr-only lg:not-sr-only">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Barre de navigation fixée en bas de l'écran (mobile). */
export function MobileNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-ink-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ROUTES.map(({ path, shortLabel, icon: Icon, preload }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={path === '/'}
              onTouchStart={() => void preload?.()}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 px-2 pb-2 pt-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-white' : 'text-zinc-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill-mobile"
                      className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gradient-to-r from-rose-400 to-violet-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className="size-5" aria-hidden />
                  {shortLabel}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
