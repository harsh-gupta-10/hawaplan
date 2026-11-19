/**
 * @file auth.ts
 * Cloudflare D1 authentication service with PBKDF2 password hashing,
 * constant-time credential comparison, secure session issuance, and rate limiting.
 */

export interface AuthEnv {
  DB: D1Database;
}
export interface AuthUser {
  id: string;
  username: string;
}

const cookieName = "hawaplan_session";
const sessionSeconds = 60 * 60 * 24 * 30;
// Cloudflare WebCrypto accepts at most 100,000 PBKDF2 iterations.
const iterations = 100_000;
const encoder = new TextEncoder();

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const unhex = (value: string): Uint8Array<ArrayBuffer> => {
  const matches = value.match(/.{2}/g) ?? [];
  const buffer = new ArrayBuffer(matches.length);
  const view = new Uint8Array(buffer);
  matches.forEach((part, index) => {
    view[index] = Number.parseInt(part, 16);
  });
  return view;
};

/**
 * Computes SHA-256 digest hex string.
 */
async function digest(value: string): Promise<string> {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}

/**
 * Derives salted PBKDF2 password hash.
 */
async function passwordHash(
  password: string,
  saltHex: string,
): Promise<string> {
  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations },
    base,
    256,
  );
  return hex(new Uint8Array(bits));
}

/**
 * Constant-time hex string comparison preventing timing side-channel attacks.
 */
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function cookie(request: Request): string | null {
  return (
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? null
  );
}

function cookieHeader(
  token: string,
  request: Request,
  maxAge = sessionSeconds,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function json(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(self)",
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

async function readCredentials(
  request: Request,
): Promise<{ username: string; password: string } | null> {
  const text = await request.text();
  if (text.length > 1024) return null;
  try {
    const body = JSON.parse(text) as { username?: unknown; password?: unknown };
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !/^[a-z0-9_]{3,24}$/.test(username) ||
      password.length < 12 ||
      password.length > 128
    )
      return null;
    return { username, password };
  } catch {
    return null;
  }
}

async function attemptKey(request: Request, label: string): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  return digest(`${label}:${ip}`);
}

async function isLimited(
  db: D1Database,
  key: string,
  maximum: number,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT attempts, reset_at FROM auth_attempts WHERE key = ?")
    .bind(key)
    .first<{ attempts: number; reset_at: number }>();
  return Boolean(row && row.reset_at > Date.now() && row.attempts >= maximum);
}

async function recordAttempt(
  db: D1Database,
  key: string,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO auth_attempts (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END",
    )
    .bind(key, now + windowMs, now, now)
    .run();
}

async function issueSession(
  db: D1Database,
  user: AuthUser,
  request: Request,
): Promise<Response> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(
      await digest(token),
      user.id,
      Date.now() + sessionSeconds * 1000,
      Date.now(),
    )
    .run();
  return json({ user }, 200, cookieHeader(token, request));
}

/**
 * Resolves the authenticated user from the session cookie in D1 database.
 */
export async function currentUser(
  request: Request,
  db: D1Database,
): Promise<AuthUser | null> {
  const token = cookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db
    .prepare(
      "SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
    )
    .bind(await digest(token), Date.now())
    .first<AuthUser>();
  return row ?? null;
}

/**
 * Dispatches authentication subroutes (/api/auth/me, signup, login, logout, account).
 */
export async function handleAuth(
  request: Request,
  db: D1Database,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/me" && request.method === "GET")
    return json({ user: await currentUser(request, db) });
  if (path === "/api/auth/signup" && request.method === "POST") {
    const credentials = await readCredentials(request);
    if (!credentials)
      return json(
        {
          error:
            "Use a 3–24 character username and a password of at least 12 characters.",
        },
        400,
      );
    const key = await attemptKey(request, "signup");
    if (await isLimited(db, key, 5))
      return json(
        { error: "Too many sign-up attempts. Try again later." },
        429,
      );
    await recordAttempt(db, key, 60 * 60 * 1000);
    const existing = await db
      .prepare("SELECT id FROM users WHERE username = ?")
      .bind(credentials.username)
      .first();
    if (existing)
      return json({ error: "That username is already taken." }, 409);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const user = { id: crypto.randomUUID(), username: credentials.username };
    await db
      .prepare(
        "INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        user.id,
        user.username,
        await passwordHash(credentials.password, salt),
        salt,
        Date.now(),
      )
      .run();
    return issueSession(db, user, request);
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    const credentials = await readCredentials(request);
    if (!credentials)
      return json({ error: "Check your username and password." }, 400);
    const key = await attemptKey(request, `login:${credentials.username}`);
    if (await isLimited(db, key, 8))
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    const user = await db
      .prepare(
        "SELECT id, username, password_hash, salt FROM users WHERE username = ?",
      )
      .bind(credentials.username)
      .first<AuthUser & { password_hash: string; salt: string }>();
    const valid =
      user &&
      equalHex(
        await passwordHash(credentials.password, user.salt),
        user.password_hash,
      );
    if (!valid || !user) {
      await recordAttempt(db, key, 15 * 60 * 1000);
      return json({ error: "Check your username and password." }, 401);
    }
    return issueSession(db, { id: user.id, username: user.username }, request);
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = cookie(request);
    if (token)
      await db
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(await digest(token))
        .run();
    return json({ ok: true }, 200, cookieHeader("", request, 0));
  }
  if (path === "/api/auth/account" && request.method === "DELETE") {
    const user = await currentUser(request, db);
    if (!user) return json({ error: "Sign in first." }, 401);
    const text = await request.text();
    if (text.length > 300) return json({ error: "Invalid request." }, 400);
    let password = "";
    try {
      password = (JSON.parse(text) as { password?: string }).password ?? "";
    } catch {
      /* Invalid JSON. */
    }
    const row = await db
      .prepare("SELECT password_hash, salt FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ password_hash: string; salt: string }>();
    if (
      !row ||
      !equalHex(await passwordHash(password, row.salt), row.password_hash)
    )
      return json({ error: "Password did not match." }, 401);
    await db.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
    return json({ ok: true }, 200, cookieHeader("", request, 0));
  }
  return json({ error: "Not found." }, 404);
}
