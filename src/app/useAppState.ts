import { useCallback, useEffect, useState } from "react";
import {
  emptyData,
  isPlace,
  isPlanOptions,
  mergeData,
  type AppData,
  type ChatMessage,
  type Place,
  type SavedPlan,
} from "../shared/saved";
import { normalizeData } from "../shared/normalize";
import type { PlanOptions } from "../shared/planner";

export interface Account {
  id: string;
  username: string;
}
export type SyncStatus = "local" | "saving" | "saved" | "offline";

const guestKey = "hawaplan-guest-v2";
const accountKey = (username: string) => `hawaplan-account-v2:${username}`;

function writeLocal(key: string, data: AppData) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function removeLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable in a private session. */
  }
}

function readLocal(key: string): AppData | null {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    /* Ignore an invalid cache. */
  }
  return null;
}

function readGuest(): AppData {
  const saved = readLocal(guestKey);
  if (saved) return saved;
  try {
    const legacy = JSON.parse(
      localStorage.getItem("hawaplan-preferences-v1") ?? "null",
    ) as { place?: Place; options?: PlanOptions } | null;
    if (isPlace(legacy?.place) && isPlanOptions(legacy?.options))
      return {
        ...emptyData(),
        place: legacy.place,
        options: legacy.options,
        preferencesUpdatedAt: 1,
      };
  } catch {
    /* Use default. */
  }
  return emptyData();
}

async function requestData(): Promise<AppData> {
  const response = await fetch("/api/data", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Account data is unavailable.");
  const body = (await response.json()) as { data: AppData };
  return body.data;
}

export function useAppState() {
  const [data, setData] = useState<AppData>(readGuest);
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await response.json()) as { user: Account | null };
        if (!active) return;
        if (body.user) {
          let merged = mergeData(
            readGuest(),
            readLocal(accountKey(body.user.username)) ?? emptyData(),
          );
          try {
            merged = mergeData(merged, await requestData());
          } catch {
            setSyncStatus("offline");
          }
          if (!active) return;
          setSyncStatus("saving");
          setAccount(body.user);
          setData(merged);
          removeLocal(guestKey);
        }
      } catch {
        /* Continue with local guest data. */
      }
      if (active) setAuthReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const locallySaved = writeLocal(
      account ? accountKey(account.username) : guestKey,
      data,
    );
    if (!locallySaved && !account) return;
    if (!account) return;
    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/data", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Sync failed");
        setSyncStatus("saved");
      } catch {
        setSyncStatus("offline");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data, account, authReady]);

  const updatePreferences = useCallback(
    (place: Place, options: PlanOptions) =>
      setData((previous) => ({
        ...previous,
        place,
        options,
        preferencesUpdatedAt: Date.now(),
      })),
    [],
  );
  const updateSchedule = (startDate: string, spanDays: 1 | 7 | 30) =>
    setData((previous) => ({
      ...previous,
      startDate,
      spanDays,
      preferencesUpdatedAt: Date.now(),
    }));
  const updateWeekdaysOnly = (weekdaysOnly: boolean) =>
    setData((previous) => ({
      ...previous,
      weekdaysOnly,
      preferencesUpdatedAt: Date.now(),
    }));
  const addMessage = (
    role: ChatMessage["role"],
    content: string,
    city: string,
  ) =>
    setData((previous) => ({
      ...previous,
      messages: [
        ...previous.messages,
        {
          id: crypto.randomUUID(),
          role,
          content,
          city,
          at: Math.max(Date.now(), previous.chatClearedAt + 1),
        },
      ].slice(-100),
    }));
  const clearChat = () =>
    setData((previous) => ({
      ...previous,
      messages: [],
      chatClearedAt: Date.now(),
    }));
  const savePlan = (plan: SavedPlan) =>
    setData((previous) => ({
      ...previous,
      plans: [plan, ...previous.plans].slice(0, 30),
    }));
  const removePlan = (id: string) =>
    setData((previous) => ({
      ...previous,
      plans: previous.plans.filter((plan) => plan.id !== id),
      removedPlanIds: [...(previous.removedPlanIds ?? []), id].slice(-100),
    }));

  const authenticate = async (
    mode: "signup" | "login",
    username: string,
    password: string,
  ) => {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json()) as { user?: Account; error?: string };
    if (!response.ok || !body.user)
      throw new Error(body.error ?? "Could not sign in.");
    let remote = emptyData();
    try {
      remote = await requestData();
    } catch {
      setSyncStatus("offline");
    }
    const merged = mergeData(
      data,
      mergeData(
        readLocal(accountKey(body.user.username)) ?? emptyData(),
        remote,
      ),
    );
    setAccount(body.user);
    setSyncStatus("saving");
    setData(merged);
    removeLocal(guestKey);
    setAuthReady(true);
  };

  const signOut = async () => {
    if (account) {
      const saved = await fetch("/api/data", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!saved.ok)
        throw new Error(
          "Save your changes before signing out. Please try again when online.",
        );
    }
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    if (account) removeLocal(accountKey(account.username));
    setAccount(null);
    setData(emptyData());
    removeLocal(guestKey);
  };

  const deleteAccount = async (password: string) => {
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok)
      throw new Error(body.error ?? "Could not delete account.");
    if (account) removeLocal(accountKey(account.username));
    setAccount(null);
    setData(emptyData());
    removeLocal(guestKey);
  };

  return {
    data,
    account,
    authReady,
    syncStatus: account ? syncStatus : "local",
    updatePreferences,
    updateSchedule,
    updateWeekdaysOnly,
    addMessage,
    clearChat,
    savePlan,
    removePlan,
    authenticate,
    signOut,
    deleteAccount,
  };
}
