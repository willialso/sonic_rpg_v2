import type { NpcId } from "../../types/game";

type Props = {
  presentNpcs: NpcId[];
  engagedNpc: NpcId | null;
  isResolved: boolean;
  titleCase: (input: string) => string;
  npcToneClass: (npc: NpcId) => string;
  onFocusNpc: (npc: NpcId) => void;
};

export function PresenceBar({
  presentNpcs,
  engagedNpc,
  isResolved,
  titleCase,
  npcToneClass,
  onFocusNpc
}: Props) {
  return (
    <section className="presence-bar" aria-label="Location presence">
      <span className="presence-label">Here now:</span>
      {presentNpcs.length > 0 && (
        <div className="presence-chips">
          {presentNpcs.map((npc) => (
            <button
              key={`chip-${npc}`}
              className={engagedNpc === npc ? "presence-chip active-talk-btn" : "presence-chip"}
              onClick={() => onFocusNpc(npc)}
              disabled={isResolved}
            >
              <span className={`npc-dot ${npcToneClass(npc)}`} aria-hidden="true" />
              {titleCase(npc)}
            </button>
          ))}
        </div>
      )}
      {presentNpcs.length === 0 && <span className="presence-empty">No one here</span>}
    </section>
  );
}
