import type { ActionResult, LocationId, NpcId } from "../../types/game";

type Props = {
  locationId: LocationId;
  sceneBackgroundImage: string;
  shouldShowDialoguePopup: boolean;
  scenePopupPlacement: "upper" | "lower";
  scenePopupTextPosition: "above" | "below";
  popupCharacterImage: string;
  popupDisplaySpeaker: string;
  popupDialogueText: string;
  engagedNpc: NpcId | null;
  playerInput: string;
  isAwaitingNpcReply: boolean;
  isResolved: boolean;
  titleCase: (input: string) => string;
  onPlayerInputChange: (value: string) => void;
  onSubmitDialogue: (action: { type: "SUBMIT_DIALOGUE"; npcId: NpcId; input: string }) => Promise<ActionResult>;
  onDismissConversation: () => void;
};

export function ScenePanel(props: Props) {
  const {
    locationId,
    sceneBackgroundImage,
    shouldShowDialoguePopup,
    scenePopupPlacement,
    scenePopupTextPosition,
    popupCharacterImage,
    popupDisplaySpeaker,
    popupDialogueText,
    engagedNpc,
    playerInput,
    isAwaitingNpcReply,
    isResolved,
    titleCase,
    onPlayerInputChange,
    onSubmitDialogue,
    onDismissConversation
  } = props;
  return (
    <section className={`scene scene-${locationId}`}>
      <div className="scene-bg-image-layer" style={{ backgroundImage: `url("${sceneBackgroundImage}")` }} />
      {shouldShowDialoguePopup && (
        <div className={`scene-character-stage scene-character-stage-${scenePopupPlacement}`} aria-live="polite">
          <div className="scene-character-stage-dim" />
          <article className={`scene-character-stage-card scene-character-stage-text-${scenePopupTextPosition}`}>
            <div className="scene-character-stage-portrait-wrap">
              {popupCharacterImage ? (
                <img
                  src={popupCharacterImage}
                  alt={`${popupDisplaySpeaker} portrait`}
                  className="scene-character-stage-portrait"
                />
              ) : (
                <div className="scene-character-stage-portrait scene-character-stage-portrait-fallback" aria-hidden="true">
                  <span>{popupDisplaySpeaker ? popupDisplaySpeaker.charAt(0).toUpperCase() : "?"}</span>
                </div>
              )}
            </div>
            <div className="scene-character-stage-text-wrap">
              <p className="bubble bubble-npc scene-character-stage-text">
                <strong>{popupDisplaySpeaker}:</strong> {popupDialogueText}
              </p>
            </div>
          </article>
        </div>
      )}

      <div className="scene-footer">
        {engagedNpc && (
          <>
            <p className="active-speaker-badge">
              Talking to {titleCase(engagedNpc)}
              <button className="ghost dialogue-dismiss-btn" onClick={onDismissConversation} aria-label="Stop talking">x</button>
            </p>
            <div className="dialogue-box">
              <input
                value={playerInput}
                onChange={(e) => onPlayerInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (!playerInput.trim() || isResolved || isAwaitingNpcReply) return;
                  e.preventDefault();
                  void onSubmitDialogue({ type: "SUBMIT_DIALOGUE", npcId: engagedNpc, input: playerInput }).then(() => {
                    onPlayerInputChange("");
                  });
                }}
                placeholder={`Talk to ${titleCase(engagedNpc)}...`}
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                disabled={isAwaitingNpcReply || isResolved}
              />
              <button
                disabled={!playerInput.trim() || isResolved || isAwaitingNpcReply}
                onClick={async () => {
                  await onSubmitDialogue({ type: "SUBMIT_DIALOGUE", npcId: engagedNpc, input: playerInput });
                  onPlayerInputChange("");
                }}
              >
                {isAwaitingNpcReply ? "Typing..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
