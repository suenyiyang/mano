import { type FC, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { authToken } from "../services/auth-token.js";

export const OAuthCallbackPage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");

    if (token && refreshToken) {
      authToken.set(token, refreshToken);
      navigate("/app", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="text-sm text-[var(--fg-muted)]">Signing in...</p>
    </div>
  );
};
