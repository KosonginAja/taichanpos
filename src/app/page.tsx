"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      <span className="text-sm font-medium">Mengalihkan ke Dashboard...</span>
    </div>
  );
}
