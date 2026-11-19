import {
  ArrowRight,
  CloudFog,
  History,
  House,
  Leaf,
  UsersRound,
  Wind,
} from "lucide-react";
import type { Account } from "../useAppState";

export type Tab = "today" | "plans" | "indoors" | "community";

interface AppSidebarProps {
  tab: Tab;
  planCount: number;
  account: Account | null;
  mobileNav: boolean;
  onNavigate: (tab: Tab) => void;
}

export default function AppSidebar({
  tab,
  planCount,
  account,
  mobileNav,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside
      className={`sidebar ${mobileNav ? "open" : ""}`}
      aria-label="Sidebar navigation"
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Wind size={27} strokeWidth={2.5} />
        </div>
        <div>
          <strong>
            hawa<span>plan</span>
          </strong>
          <small>Find your clearer path.</small>
        </div>
      </div>

      <div className="nav-label" id="workspace-nav-label">
        YOUR WORKSPACE
      </div>

      <nav aria-labelledby="workspace-nav-label">
        <button
          className={`nav-item ${tab === "today" ? "active" : ""}`}
          aria-current={tab === "today" ? "page" : undefined}
          onClick={() => onNavigate("today")}
          type="button"
        >
          <CloudFog size={19} aria-hidden="true" />
          <span>Today’s plan</span>
          <ArrowRight className="nav-arrow" size={16} aria-hidden="true" />
        </button>

        <button
          className={`nav-item ${tab === "plans" ? "active" : ""}`}
          aria-current={tab === "plans" ? "page" : undefined}
          onClick={() => onNavigate("plans")}
          type="button"
        >
          <History size={19} aria-hidden="true" />
          <span>Saved plans</span>
          <span className="nav-count" aria-label={`${planCount} saved plans`}>
            {planCount}
          </span>
        </button>

        <button
          className={`nav-item ${tab === "indoors" ? "active" : ""}`}
          aria-current={tab === "indoors" ? "page" : undefined}
          onClick={() => onNavigate("indoors")}
          type="button"
        >
          <House size={19} aria-hidden="true" />
          <span>Indoor air guide</span>
          <ArrowRight className="nav-arrow" size={16} aria-hidden="true" />
        </button>

        <button
          className={`nav-item ${tab === "community" ? "active" : ""}`}
          aria-current={tab === "community" ? "page" : undefined}
          onClick={() => onNavigate("community")}
          type="button"
        >
          <UsersRound size={19} aria-hidden="true" />
          <span>Community note</span>
          <ArrowRight className="nav-arrow" size={16} aria-hidden="true" />
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <div className="tip-icon" aria-hidden="true">
            <Leaf size={20} />
          </div>
          <strong>Your day, remembered.</strong>
          <p>
            {account
              ? "Plans and chats sync to your account."
              : "Plans and chats stay on this device until you sign in."}
          </p>
        </div>

        <div className="sidebar-foot">
          {account ? `@${account.username}` : "Guest mode"}{" "}
          <span aria-hidden="true">✳</span>
        </div>
      </div>
    </aside>
  );
}
