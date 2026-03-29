import { type FC, type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { useAuthLogic } from "../hooks/use-auth.js";

export const RegisterPage: FC = () => {
  const { registerMutation } = useAuthLogic();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ email, password, displayName });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center">
          <h1 className="text-[22px] font-[650] tracking-[-0.03em] text-[var(--fg)]">Mano</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {registerMutation.error && (
            <p className="text-sm text-red-500">Registration failed. Please try again.</p>
          )}
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg)] px-2 text-[var(--fg-faint)]">or continue with</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = "/api/auth/github";
            }}
          >
            GitHub
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = "/api/auth/google";
            }}
          >
            Google
          </Button>
        </div>

        <p className="text-center text-sm text-[var(--fg-muted)]">
          Already have an account?{" "}
          <Link to="/login" className="text-[var(--fg)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
