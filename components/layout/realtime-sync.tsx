"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function RealtimeSync() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    try {
      const supabase = createSupabaseBrowserClient();
      void supabase.auth.getUser().then(({ data }) => {
        if (cancelled || !data.user) return;
        channel = supabase
          .channel(`finance-${data.user.id}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${data.user.id}`
          }, () => router.refresh())
          .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${data.user.id}`
          }, () => router.refresh())
          .subscribe((status) => { if (!cancelled) setConnected(status === "SUBSCRIBED"); });
      }).catch(() => undefined);
    } catch { /* Missing client configuration is handled by the sign-in screen. */ }

    return () => {
      cancelled = true;
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [router]);

  return (
    <span className={`sync-status${connected ? " sync-connected" : ""}`} role="status" aria-label={connected ? "Live updates connected" : "Live updates reconnecting"}>
      <span className="sync-dot" aria-hidden="true" />
      <span>{connected ? "Live" : "Connecting"}</span>
    </span>
  );
}
