"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus, ShieldAlert, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login fields
  const [identifier, setIdentifier] = useState(""); // bisa username atau email
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");

      setSuccess("Login berhasil! Mengalihkan...");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 800);
    } catch (err: any) {
      setError(err.message || "Username/email atau password salah.");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          email,
          password: registerPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pendaftaran gagal");

      setSuccess(
        `Pendaftaran berhasil! Akun ${data.user.name} (@${data.user.username}) menunggu persetujuan Admin sebelum bisa login.`,
      );
      setIsRegisterMode(false);
      setRegisterPassword("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Gagal mendaftar.");
      setLoading(false);
    }
  };

  const switchToRegister = () => {
    resetMessages();
    setIsRegisterMode(true);
  };

  const switchToLogin = () => {
    resetMessages();
    setIsRegisterMode(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-8 transition-all duration-300">
        {/* Brand header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-orange-500">
            Gweh Food POS
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Aplikasi HPP, Gudang, Pesanan & Struk untuk UMKM
          </p>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-white border border-orange-200 text-orange-600 text-sm flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {!isRegisterMode ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Username atau Email
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                placeholder="kasir01 atau kasir@gwehfood.com"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3.5 font-semibold shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
            >
              <LogIn className="w-5 h-5" />
              {loading ? "Menghubungkan..." : "Masuk ke Sistem"}
            </button>

            <div className="text-center mt-6 text-sm text-slate-500">
              Belum punya akun?{" "}
              <button
                type="button"
                onClick={switchToRegister}
                className="text-orange-500 hover:underline font-medium"
              >
                Daftar Akun Baru
              </button>
            </div>
          </form>
        ) : (
          /* ── REGISTER FORM ── */
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                placeholder="Budi Setiawan"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Username{" "}
                <span className="normal-case text-slate-600 font-normal">
                  (huruf kecil, angka, underscore, min. 3 karakter)
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold select-none">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                  placeholder="kasir01"
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                placeholder="budi@gwehfood.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400"
                placeholder="Min. 6 karakter"
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div className="p-3.5 bg-white border border-orange-200 rounded-xl text-orange-600 text-xs flex gap-2">
              <span className="shrink-0 mt-0.5"><ShieldAlert className="w-4 h-4"/></span>
              <span>
                Akun baru perlu persetujuan Admin sebelum bisa digunakan untuk
                login.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3.5 font-semibold shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
            >
              <UserPlus className="w-5 h-5" />
              {loading ? "Mendaftarkan..." : "Daftar Akun"}
            </button>

            <div className="text-center mt-6 text-sm text-slate-500">
              Sudah punya akun?{" "}
              <button
                type="button"
                onClick={switchToLogin}
                className="text-orange-500 hover:underline font-medium"
              >
                Masuk Di Sini
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
