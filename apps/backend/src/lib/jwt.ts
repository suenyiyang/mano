import * as jose from "jose";
import { getEnv } from "../env.js";

interface TokenPayload {
  userId: string;
  email: string | null;
  tier: string;
}

const getSecrets = () => {
  const env = getEnv();
  return {
    access: new TextEncoder().encode(env.JWT_SECRET),
    refresh: new TextEncoder().encode(env.JWT_REFRESH_SECRET),
  };
};

export const signAccessToken = async (payload: TokenPayload) => {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecrets().access);
};

export const signRefreshToken = async (payload: TokenPayload) => {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecrets().refresh);
};

export const verifyAccessToken = async (token: string) => {
  const { payload } = await jose.jwtVerify(token, getSecrets().access);
  return payload as jose.JWTPayload & TokenPayload;
};

export const verifyRefreshToken = async (token: string) => {
  const { payload } = await jose.jwtVerify(token, getSecrets().refresh);
  return payload as jose.JWTPayload & TokenPayload;
};
