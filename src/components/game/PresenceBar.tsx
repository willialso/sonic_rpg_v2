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
  const count = presentNpcs.length;
  return (
    <section className="presence-bar presence-markers" aria-label="Nearby people">
      <p className="presence-caption">
        {count > 0 ? `Characters in this location (${count}) — tap to talk` : "No characters visible. Move or search for clues."}
      </p>
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
    </section>
  );
}
