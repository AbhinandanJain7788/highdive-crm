"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotClicked, setForgotClicked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onLoginClick = async () => {
    if (!email || !password) {
      setError("Enter both email and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Incorrect email or password.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F5F8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 400,
          background: "#FFFFFF",
          border: "1px solid #E7E9EE",
          borderRadius: 10,
          padding: "36px 32px",
          boxShadow: "0 1px 3px rgba(20,24,38,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#FF5C35", letterSpacing: -0.5 }}>
            High Dive
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>
          Sign in to manage candidates, recruiters and calls.
        </div>
        {error && (
          <div
            style={{
              background: "#FDECEC",
              color: "#C0392B",
              fontSize: 13,
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>
            Email
          </div>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #D9DCE3",
              borderRadius: 6,
              fontSize: 14,
              color: "#1D2433",
              outline: "none",
            }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>
            Password
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #D9DCE3",
              borderRadius: 6,
              fontSize: 14,
              color: "#1D2433",
              outline: "none",
            }}
          />
        </div>
        <div style={{ textAlign: "right", marginBottom: 22 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setForgotClicked(true);
            }}
            style={{ fontSize: 12 }}
          >
            Forgot password?
          </a>
        </div>
        {forgotClicked && (
          <div
            style={{
              fontSize: 12,
              color: "#1E7F43",
              background: "#E6F4EA",
              padding: "8px 10px",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            If an account exists for that email, a reset link has been sent.
          </div>
        )}
        <button
          onClick={onLoginClick}
          disabled={submitting}
          style={{
            width: "100%",
            background: "#FF5C35",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 6,
            padding: "11px 0",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <div style={{ textAlign: "center", fontSize: 12, color: "#9AA1AC", marginTop: 18 }}>
          Super Admin · Recruitment Manager · Recruiter access
        </div>
      </div>
    </div>
  );
}
