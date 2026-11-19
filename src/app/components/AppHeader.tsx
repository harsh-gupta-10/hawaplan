import type { ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CloudOff,
  MapPin,
  Menu,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import type { Place } from "../../shared/saved";
import type { Account, SyncStatus } from "../useAppState";

interface AppHeaderProps {
  place: Place;
  account: Account | null;
  syncStatus: SyncStatus;
  mobileNav: boolean;
  cityOpen: boolean;
  accountOpen: boolean;
  onToggleMobileNav: () => void;
  onToggleCity: () => void;
  onToggleAccount: () => void;
  childrenCityPopover?: ReactNode;
  childrenAccountPopover?: ReactNode;
}

export default function AppHeader({
  place,
  account,
  syncStatus,
  mobileNav,
  cityOpen,
  accountOpen,
  onToggleMobileNav,
  onToggleCity,
  onToggleAccount,
  childrenCityPopover,
  childrenAccountPopover,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        aria-label={
          mobileNav ? "Close navigation menu" : "Open navigation menu"
        }
        aria-expanded={mobileNav}
        onClick={onToggleMobileNav}
        type="button"
      >
        {mobileNav ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="topbar-context">
        <span className="live-dot" aria-hidden="true" />
        <span>PLAN YOUR AIR</span>
      </div>

      <div className="topbar-actions">
        <span
          className={`sync-pill ${syncStatus}`}
          title={account ? "Account sync status" : "Saved in this browser"}
          role="status"
          aria-live="polite"
        >
          {syncStatus === "saving" ? (
            <RefreshCw size={14} className="spin" aria-hidden="true" />
          ) : syncStatus === "offline" ? (
            <CloudOff size={14} aria-hidden="true" />
          ) : (
            <Check size={14} aria-hidden="true" />
          )}
          <span>
            {syncStatus === "saving"
              ? "Saving"
              : syncStatus === "saved"
                ? "Synced"
                : "On this device"}
          </span>
        </span>

        <div className="city-picker">
          <button
            className="city-button"
            onClick={onToggleCity}
            aria-expanded={cityOpen}
            aria-haspopup="dialog"
            aria-label={`Selected location: ${place.name}${place.country ? `, ${place.country}` : ""}. Change location`}
            type="button"
          >
            <MapPin size={17} aria-hidden="true" />
            <span>
              {place.name}
              {place.country ? `, ${place.country}` : ""}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {cityOpen && childrenCityPopover}
        </div>

        <div className="account-picker">
          <button
            className="account-button"
            aria-label={
              account
                ? `Account menu for @${account.username}`
                : "Sign in or create account"
            }
            onClick={onToggleAccount}
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            type="button"
          >
            <UserRound size={16} aria-hidden="true" />
            <span>{account ? account.username : "Sign in"}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {accountOpen && childrenAccountPopover}
        </div>
      </div>
    </header>
  );
}
