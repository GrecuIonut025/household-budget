#!/usr/bin/env node
// Docker-free stand-in for Supabase GoTrue + the API gateway, for local verification only.
//   /auth/v1/*  minimal password auth issuing HS256 JWTs that PostgREST accepts
//   /rest/v1/*  proxied to PostgREST
// NOT a security boundary and NOT for production. Use `supabase start` when Docker is available.
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? "http://127.0.0.1:54381";
const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-only-jwt-secret-at-least-32-characters";
const DB_URL = process.env.DB_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/household_budget_dev";

const users = new Map(); // email -> { id, email, password, meta, created_at }
const refreshTokens = new Map(); // token -> user id

const b64 = (input) => Buffer.from(input).toString("base64url");
function sign(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [head, body, sig] = (token ?? "").split(".");
  if (!sig) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}

const userJson = (u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
  email_confirmed_at: u.created_at, phone: "", confirmed_at: u.created_at,
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.meta,
  identities: [], created_at: u.created_at, updated_at: u.created_at, is_anonymous: false,
});

function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({
    aud: "authenticated", role: "authenticated", sub: u.id, email: u.email,
    iat: now, exp: now + 3600, session_id: randomUUID(), app_metadata: { provider: "email" }, user_metadata: u.meta,
  });
  const refresh = randomUUID();
  refreshTokens.set(refresh, u.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}

function sql(query) {
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", query], { stdio: "pipe" });
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { resolve({}); }
    });
  });
}
const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*",
    });
    return res.end();
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const headers = { ...req.headers, host: new URL(POSTGREST).host };
    // supabase-js sends the anon key as a bearer token when signed out; PostgREST would reject it as a JWT.
    if (!verify((headers.authorization ?? "").replace(/^Bearer /, ""))) delete headers.authorization;
    const proxied = http.request(
      POSTGREST + url.pathname.replace("/rest/v1", "") + url.search,
      { method: req.method, headers },
      (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); },
    );
    proxied.on("error", () => send(res, 502, { message: "PostgREST unreachable" }));
    return req.pipe(proxied);
  }

  if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
    const { email, password, data } = await readBody(req);
    if (!email || !password || password.length < 8) return send(res, 422, { code: 422, error_code: "weak_password", msg: "Password should be at least 8 characters." });
    const key = String(email).toLowerCase();
    if (users.has(key)) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    const user = { id: randomUUID(), email: key, password, meta: data ?? {}, created_at: new Date().toISOString() };
    sql(`insert into auth.users (id, email, raw_user_meta_data) values (${lit(user.id)}, ${lit(user.email)}, ${lit(JSON.stringify(user.meta))}::jsonb)`);
    users.set(key, user);
    return send(res, 200, session(user));
  }

  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const body = await readBody(req);
    if (grant === "password") {
      const user = users.get(String(body.email ?? "").toLowerCase());
      if (!user || user.password !== body.password) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(res, 200, session(user));
    }
    if (grant === "refresh_token") {
      const id = refreshTokens.get(body.refresh_token);
      const user = [...users.values()].find((u) => u.id === id);
      if (!user) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, session(user));
    }
    return send(res, 400, { code: 400, msg: "unsupported grant" });
  }

  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const payload = verify((req.headers.authorization ?? "").replace(/^Bearer /, ""));
    const user = payload && [...users.values()].find((u) => u.id === payload.sub);
    if (!user) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    return send(res, 200, userJson(user));
  }

  if (url.pathname === "/auth/v1/logout") return send(res, 204);
  send(res, 404, { message: "not implemented in mock-auth" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock gateway on http://127.0.0.1:${PORT}`));
