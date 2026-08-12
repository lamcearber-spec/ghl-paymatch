"use client";

import { useEffect } from "react";

export function ClearScanMarker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("scan") && !url.searchParams.has("connected")) {
      return;
    }
    url.searchParams.delete("scan");
    url.searchParams.delete("connected");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return null;
}
