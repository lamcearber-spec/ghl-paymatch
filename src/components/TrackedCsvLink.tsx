"use client";

type TrackedCsvLinkProps = {
  href: string;
  download: string;
  session?: string;
  className?: string;
  children: React.ReactNode;
};

export function TrackedCsvLink({ href, download, session, className, children }: TrackedCsvLinkProps) {
  function recordExport() {
    if (!session) {
      return;
    }
    void fetch("/api/events/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, exportName: download }),
      keepalive: true
    }).catch(() => undefined);
  }

  return (
    <a className={className} href={href} download={download} onClick={recordExport}>
      {children}
    </a>
  );
}
