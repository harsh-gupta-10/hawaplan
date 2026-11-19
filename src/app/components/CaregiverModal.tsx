import { useEffect, useRef, useState } from "react";
import { Check, Copy, Printer, ShieldCheck, X } from "lucide-react";
import { caregiverSummaryText } from "../../shared/schedule";
import type { Place } from "../../shared/saved";

interface CaregiverModalProps {
  place: Place;
  activity: string;
  date: string;
  timeWindow: string;
  summary: string;
  careAction?: string | null;
  emissionAction?: string;
  indoorAction?: string;
  onClose: () => void;
}

export default function CaregiverModal({
  place,
  activity,
  date,
  timeWindow,
  summary,
  careAction,
  emissionAction,
  indoorAction,
  onClose,
}: CaregiverModalProps) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const briefText = caregiverSummaryText({
    place,
    activity,
    date,
    timeWindow,
    summary,
    careAction,
    emissionAction,
    indoorAction,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Fallback handling */
    }
  };

  const printBrief = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop">
      <button
        type="button"
        className="modal-overlay-dismiss"
        onClick={onClose}
        aria-label="Close care brief"
      />
      <div
        ref={modalRef}
        className="auth-dialog caregiver-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="caregiver-modal-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
        <div className="auth-emblem">
          <ShieldCheck size={24} />
        </div>
        <span className="eyebrow">FAMILY & CAREGIVER BRIEF</span>
        <h2 id="caregiver-modal-title">Ready-to-share care note</h2>
        <p className="auth-intro">
          Copy or print this structured summary for teachers, grandparents, or
          babysitters before the outing.
        </p>

        <div className="caregiver-brief-box">
          <pre>{briefText}</pre>
        </div>

        <div className="caregiver-modal-actions">
          <button className="save-plan-button" onClick={copyBrief}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied to clipboard" : "Copy brief"}
          </button>
          <button className="calendar-link" onClick={printBrief}>
            <Printer size={16} /> Print brief
          </button>
        </div>
      </div>
    </div>
  );
}
