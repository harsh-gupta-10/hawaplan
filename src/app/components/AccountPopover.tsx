import { useEffect } from "react";
import type { Account, SyncStatus } from "../useAppState";
import type { AuthMode } from "../AuthDialog";

interface AccountPopoverProps {
  account: Account | null;
  syncStatus: SyncStatus;
  onSignOut: () => void;
  onOpenAuth: (mode: AuthMode) => void;
  onClose: () => void;
}

export default function AccountPopover({
  account,
  syncStatus,
  onSignOut,
  onOpenAuth,
  onClose,
}: AccountPopoverProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="account-popover" role="dialog" aria-label="Account options">
      {account ? (
        <>
          <div className="account-pop-head">
            <strong>@{account.username}</strong>
            <small>
              {syncStatus === "saved"
                ? "Your data is synced"
                : "Your data is on this device"}
            </small>
          </div>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
          <button
            type="button"
            className="danger-text"
            onClick={() => {
              onClose();
              onOpenAuth("delete");
            }}
          >
            Delete account & data
          </button>
        </>
      ) : (
        <>
          <p>Keep your plans and chats across devices.</p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth("login");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth("signup");
            }}
          >
            Create account
          </button>
        </>
      )}
    </div>
  );
}
