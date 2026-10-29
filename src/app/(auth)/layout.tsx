export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-sidebar-active text-lg font-bold text-sidebar">DCC</div>
          <div>
            <p className="text-lg font-semibold text-white">Damdei Christian College</p>
            <p className="text-sm text-sidebar-muted">Manipur, India</p>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-white">Education Portal</h1>
          <p className="max-w-md text-sidebar-muted">
            Admissions, attendance, examinations, results and fees for Higher Secondary, FYUP and Postgraduate programmes.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">© Damdei Christian College. Authorised users only.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
