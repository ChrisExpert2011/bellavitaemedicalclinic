import { Link } from "@tanstack/react-router";
import { Menu, Phone, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC_ADDRESS, CLINIC_NAME } from "@/lib/clinic";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/appointments", label: "Appointments" },
  { to: "/news", label: "News" },
  { to: "/community", label: "Community" },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
          <span className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" /> +250 788 275 617 · Open every day 07:00 – 23:00
          </span>
          <span className="hidden sm:inline">{CLINIC_ADDRESS}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt={`${CLINIC_NAME} logo`} width={48} height={48} className="h-12 w-12" />
            <span className="text-lg font-semibold leading-tight text-primary">
              Bella Vitae
              <span className="block text-[11px] font-normal uppercase tracking-widest text-muted-foreground">
                Medical Clinic
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
            {isStaff ? (
              <Link to="/admin" className="text-sm font-medium text-primary hover:underline">
                {isAdmin ? "Admin" : "Staff"}
              </Link>
            ) : null}
            {user ? (
              <>
                <Link to="/account" className="text-sm font-medium text-foreground/80 hover:text-primary">
                  My account
                </Link>
                <button
                  onClick={() => signOut()}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/appointments"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Book now
            </Link>
          </nav>

          <button
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open ? (
          <nav className="flex flex-col gap-1 border-t border-border bg-card px-4 py-3 md:hidden">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 text-sm">
                {l.label}
              </Link>
            ))}
            {isStaff ? (
              <Link to="/admin" onClick={() => setOpen(false)} className="py-2 text-sm text-primary">
                {isAdmin ? "Admin" : "Staff"}
              </Link>
            ) : null}
            {user ? (
              <>
                <Link to="/account" onClick={() => setOpen(false)} className="py-2 text-sm">
                  My account
                </Link>
                <button onClick={() => signOut()} className="py-2 text-left text-sm">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="py-2 text-sm">
                Sign in
              </Link>
            )}
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <h3 className="text-base font-semibold">{CLINIC_NAME}</h3>
            <p className="mt-2 text-sm opacity-80">{CLINIC_ADDRESS}</p>
            <p className="mt-1 text-sm opacity-80">Kinyarwanda & English spoken</p>
          </div>
          <div>
            <h3 className="text-base font-semibold">Opening hours</h3>
            <p className="mt-2 text-sm opacity-80">Monday to Sunday, 07:00 – 23:00</p>
          </div>
          <div>
            <h3 className="text-base font-semibold">Contact</h3>
            <p className="mt-2 text-sm opacity-80">+250 788 275 617 · nibellasheja@gmail.com</p>
            <p className="text-sm opacity-80">+250 788 515 358 · ntakiruchris@yahoo.fr</p>
          </div>
        </div>
        <div className="border-t border-primary-foreground/15 px-4 py-4 text-center text-xs opacity-70">
          © {new Date().getFullYear()} {CLINIC_NAME}. Website by Chris Expert — mucyochristhecla@gmail.com
        </div>
      </footer>
    </div>
  );
}