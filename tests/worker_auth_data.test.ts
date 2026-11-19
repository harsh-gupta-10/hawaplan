import { describe, expect, it } from "vitest";
import { handleAuth } from "../src/worker/auth";
import { handleData } from "../src/worker/data";
import { emptyData } from "../src/shared/saved";

function createMockD1(): D1Database {
  const users = new Map<
    string,
    {
      id: string;
      username: string;
      password_hash: string;
      salt: string;
      created_at: number;
    }
  >();
  const sessions = new Map<
    string,
    {
      token_hash: string;
      user_id: string;
      expires_at: number;
      created_at: number;
    }
  >();
  const attempts = new Map<
    string,
    { key: string; attempts: number; reset_at: number }
  >();
  const userData = new Map<
    string,
    { user_id: string; payload: string; updated_at: number }
  >();

  const db = {
    prepare(query: string) {
      let boundArgs: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return statement;
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          if (query.includes("FROM users WHERE username = ?")) {
            const username = String(boundArgs[0]);
            for (const u of users.values()) {
              if (u.username === username) return u as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM users WHERE id = ?")) {
            const id = String(boundArgs[0]);
            return (users.get(id) ?? null) as unknown as T;
          }
          if (query.includes("FROM sessions JOIN users")) {
            const tokenHash = String(boundArgs[0]);
            const now = Number(boundArgs[1]);
            const s = sessions.get(tokenHash);
            if (s && s.expires_at > now) {
              const u = users.get(s.user_id);
              if (u) return { id: u.id, username: u.username } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM auth_attempts WHERE key = ?")) {
            const key = String(boundArgs[0]);
            return (attempts.get(key) ?? null) as unknown as T;
          }
          if (query.includes("FROM user_data WHERE user_id = ?")) {
            const userId = String(boundArgs[0]);
            return (userData.get(userId) ?? null) as unknown as T;
          }
          return null;
        },
        async run() {
          if (query.includes("INSERT INTO users")) {
            const [id, username, password_hash, salt, created_at] =
              boundArgs as [string, string, string, string, number];
            users.set(id, { id, username, password_hash, salt, created_at });
          } else if (query.includes("INSERT INTO sessions")) {
            const [token_hash, user_id, expires_at, created_at] = boundArgs as [
              string,
              string,
              number,
              number,
            ];
            sessions.set(token_hash, {
              token_hash,
              user_id,
              expires_at,
              created_at,
            });
          } else if (query.includes("INSERT INTO auth_attempts")) {
            const [key, expires_at] = boundArgs as [string, number];
            const existing = attempts.get(key);
            attempts.set(key, {
              key,
              attempts: (existing?.attempts ?? 0) + 1,
              reset_at: expires_at,
            });
          } else if (
            query.includes("DELETE FROM sessions WHERE token_hash = ?")
          ) {
            const tokenHash = String(boundArgs[0]);
            sessions.delete(tokenHash);
          } else if (query.includes("DELETE FROM users WHERE id = ?")) {
            const id = String(boundArgs[0]);
            users.delete(id);
          } else if (query.includes("INSERT INTO user_data")) {
            const [userId, payload, updatedAt] = boundArgs as [
              string,
              string,
              number,
            ];
            userData.set(userId, {
              user_id: userId,
              payload,
              updated_at: updatedAt,
            });
          }
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return db;
}

describe("Worker authentication and Cloudflare D1 data sync", () => {
  it("rejects signup with invalid username or password constraints", async () => {
    const db = createMockD1();

    const shortUser = await handleAuth(
      new Request("https://hawaplan.example/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username: "ab", password: "ValidPassword123" }),
      }),
      db,
    );
    expect(shortUser.status).toBe(400);

    const shortPass = await handleAuth(
      new Request("https://hawaplan.example/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username: "validuser", password: "short" }),
      }),
      db,
    );
    expect(shortPass.status).toBe(400);
  });

  it("handles user signup, duplicate detection, and login flow", async () => {
    const db = createMockD1();

    // Successful signup
    const signup = await handleAuth(
      new Request("https://hawaplan.example/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "testparent",
          password: "SecurePassword123",
        }),
      }),
      db,
    );
    expect(signup.status).toBe(200);
    const cookie = signup.headers.get("Set-Cookie");
    expect(cookie).toContain("hawaplan_session=");
    expect(cookie).toContain("HttpOnly");

    // Duplicate username
    const dup = await handleAuth(
      new Request("https://hawaplan.example/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "testparent",
          password: "AnotherPassword123",
        }),
      }),
      db,
    );
    expect(dup.status).toBe(409);

    // Login wrong password
    const badLogin = await handleAuth(
      new Request("https://hawaplan.example/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "testparent",
          password: "WrongPassword123",
        }),
      }),
      db,
    );
    expect(badLogin.status).toBe(401);

    // Login correct password
    const goodLogin = await handleAuth(
      new Request("https://hawaplan.example/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "testparent",
          password: "SecurePassword123",
        }),
      }),
      db,
    );
    expect(goodLogin.status).toBe(200);

    // Check /api/auth/me with session
    const me = await handleAuth(
      new Request("https://hawaplan.example/api/auth/me", {
        method: "GET",
        headers: { Cookie: cookie ?? "" },
      }),
      db,
    );
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { user: { username: string } };
    expect(meBody.user.username).toBe("testparent");

    // Sync user data
    const syncRes = await handleData(
      new Request("https://hawaplan.example/api/data", {
        method: "PUT",
        headers: {
          Cookie: cookie ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emptyData()),
      }),
      db,
    );
    expect(syncRes.status).toBe(200);

    // Fetch user data
    const fetchRes = await handleData(
      new Request("https://hawaplan.example/api/data", {
        method: "GET",
        headers: { Cookie: cookie ?? "" },
      }),
      db,
    );
    expect(fetchRes.status).toBe(200);

    // Reject oversized payload
    const oversizedRes = await handleData(
      new Request("https://hawaplan.example/api/data", {
        method: "PUT",
        headers: { Cookie: cookie ?? "" },
        body: "x".repeat(160_000),
      }),
      db,
    );
    expect(oversizedRes.status).toBe(413);

    // Account deletion with wrong password
    const delFail = await handleAuth(
      new Request("https://hawaplan.example/api/auth/account", {
        method: "DELETE",
        headers: { Cookie: cookie ?? "" },
        body: JSON.stringify({ password: "WrongPassword" }),
      }),
      db,
    );
    expect(delFail.status).toBe(401);

    // Account deletion with correct password
    const delRes = await handleAuth(
      new Request("https://hawaplan.example/api/auth/account", {
        method: "DELETE",
        headers: { Cookie: cookie ?? "" },
        body: JSON.stringify({ password: "SecurePassword123" }),
      }),
      db,
    );
    expect(delRes.status).toBe(200);

    // After account deletion, session is gone
    const afterDel = await handleAuth(
      new Request("https://hawaplan.example/api/auth/me", {
        method: "GET",
        headers: { Cookie: cookie ?? "" },
      }),
      db,
    );
    expect(afterDel.status).toBe(200);
    expect((await afterDel.json()) as { user: unknown }).toEqual({
      user: null,
    });
  });

  it("guards /api/data against unauthenticated requests", async () => {
    const db = createMockD1();
    const res = await handleData(
      new Request("https://hawaplan.example/api/data", { method: "GET" }),
      db,
    );
    expect(res.status).toBe(401);
  });

  it("terminates sessions upon logout", async () => {
    const db = createMockD1();
    const signup = await handleAuth(
      new Request("https://hawaplan.example/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "logoutuser",
          password: "SecurePassword123",
        }),
      }),
      db,
    );
    const cookie = signup.headers.get("Set-Cookie");
    expect(cookie).toContain("hawaplan_session=");

    const logout = await handleAuth(
      new Request("https://hawaplan.example/api/auth/logout", {
        method: "POST",
        headers: { Cookie: cookie ?? "" },
      }),
      db,
    );
    expect(logout.status).toBe(200);

    const meAfterLogout = await handleAuth(
      new Request("https://hawaplan.example/api/auth/me", {
        method: "GET",
        headers: { Cookie: cookie ?? "" },
      }),
      db,
    );
    expect(meAfterLogout.status).toBe(200);
    expect((await meAfterLogout.json()) as { user: unknown }).toEqual({
      user: null,
    });
  });
});
