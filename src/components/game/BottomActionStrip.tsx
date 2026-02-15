type Props = {
  engagedNpc: string | null;
  playerInput: string;
  isResolved: boolean;
  clockText: string;
  onOpenActions: () => void;
  onOpenMenu: () => void;
};

export function BottomActionStrip({
  engagedNpc,
  playerInput,
  isResolved,
  clockText,
  onOpenActions,
  onOpenMenu
}: Props) {
  return (
    <section className={`action-strip action-strip-float ${(engagedNpc && playerInput.trim().length > 0) ? "action-strip-dim" : ""}`}>
      <div className="button-grid bottom-actions-grid">
        <button className="ghost actions-primary-btn actions-btn" onClick={onOpenActions} disabled={isResolved}>
          <span aria-hidden="true">⚡</span>
          <span>Actions</span>
        </button>
        <button className="ghost actions-primary-btn menu-btn" onClick={onOpenMenu} disabled={isResolved}>
          <span aria-hidden="true">☰</span>
          <span>Menu</span>
        </button>
        <div className="actions-primary-btn clock-pill" aria-label="Game clock">
          <span aria-hidden="true">⏱</span>
          <span>{clockText}</span>
        </div>
      </div>
    </section>
  );
}
