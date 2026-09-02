import { useState } from "react";
import { request } from "../api";

export default function LoginForm({ onSuccess }) {
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
        Login
      </p>
      <h2 className="mt-3 text-2xl font-bold text-slate-900">
        Access your account
      </h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Phone number
          </label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white"
        >
          Login
        </button>
      </form>
    </section>
  );
}
