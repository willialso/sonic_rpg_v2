import type { NpcId } from "../../types/game";

type Props = {
  presentNpcs: NpcId[];
  engagedNpc: NpcId | null;
  isResolved: boolean;
  titleCase: (input: string) => string;
  resolveNpcImage: (npc: NpcId) => string;
  onFocusNpc: (npc: NpcId) => void;
};

export function PresenceBar({
  presentNpcs,
  engagedNpc,
  isResolved,
  titleCase,
  resolveNpcImage,
  onFocusNpc
}: Props) {
  return (
    <section className="presence-bar presence-markers" aria-label="Nearby people">
      {presentNpcs.length > 0 && (
        <div className="presence-marker-row">
          {presentNpcs.map((npc, idx) => (
            <button
              key={`chip-${npc}`}
              className={engagedNpc === npc ? "presence-marker active-talk-btn" : "presence-marker"}
              onClick={() => onFocusNpc(npc)}
              disabled={isResolved}
              title={`Tap to talk: ${titleCase(npc)}`}
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <span className="presence-pin" aria-hidden="true">●</span>
              <img src={resolveNpcImage(npc)} alt="" className="presence-avatar" />
              <span className="presence-marker-name">{titleCase(npc)}</span>
              <span className="presence-marker-tip">Tap to talk</span>
            </button>
          ))}
        </div>
      )}
      {presentNpcs.length === 0 && <span className="presence-empty">No one in sight. Move or search for clues.</span>}
    </section>
  );
}
