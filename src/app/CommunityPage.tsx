import { Check, Copy, UsersRound } from "lucide-react";

interface CommunityPageProps {
  shareText: string;
  copied: boolean;
  onCopyPlan: () => void;
}

export default function CommunityPage({
  shareText,
  copied,
  onCopyPlan,
}: CommunityPageProps) {
  return (
    <div className="page-content secondary-page">
      <div className="breadcrumb">
        BETTER TOGETHER <span>/</span> COMMUNITY
      </div>
      <h1>
        Share a plan. <em>Start a habit.</em>
      </h1>
      <p className="page-intro">
        Turn your family’s plan into a simple note for a school group,
        neighbour, or community chat.
      </p>
      <div className="community-layout">
        <div className="community-main">
          <div className="community-banner">
            <div className="community-banner-icon">
              <UsersRound size={30} />
            </div>
            <span className="eyebrow">SMALL ACTION, SHARED IMPACT</span>
            <h2>A calmer pickup starts with one message.</h2>
            <p>
              Share a lower forecast window where timing is flexible, and
              suggest combining necessary trips or avoiding idling near
              entrances.
            </p>
          </div>
          <div className="community-steps">
            <div>
              <span>01</span>
              <p>Make a plan on the Today page.</p>
            </div>
            <div>
              <span>02</span>
              <p>Check that the timing works for your group.</p>
            </div>
            <div>
              <span>03</span>
              <p>Copy the note and share it yourself.</p>
            </div>
          </div>
        </div>
        <div className="share-card">
          <span className="eyebrow">READY TO SHARE</span>
          <h3>Community note</h3>
          <p>{shareText}</p>
          <button onClick={onCopyPlan}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy message"}
          </button>
          <small>We do not post this message for you.</small>
        </div>
      </div>
    </div>
  );
}
