import { useEffect, useState } from "react";
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
  popupTyping: boolean;
  engagedNpc: NpcId | null;
  playerInput: string;
  isAwaitingNpcReply: boolean;
  isResolved: boolean;
  titleCase: (input: string) => string;
  onPlayerInputChange: (value: string) => void;
  onSubmitDialogue: (action: { type: "SUBMIT_DIALOGUE"; npcId: NpcId; input: string }) => Promise<ActionResult>;
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
    popupTyping,
    engagedNpc,
    playerInput,
    isAwaitingNpcReply,
    isResolved,
    titleCase,
    onPlayerInputChange,
    onSubmitDialogue
  } = props;
  const [loadedBackground, setLoadedBackground] = useState(sceneBackgroundImage);
  useEffect(() => {
    if (!sceneBackgroundImage) return;
    if (sceneBackgroundImage === loadedBackground) return;
    const img = new Image();
    img.onload = () => setLoadedBackground(sceneBackgroundImage);
    img.src = sceneBackgroundImage;
  }, [loadedBackground, sceneBackgroundImage]);
  return (
    <section className={`scene scene-${locationId}`}>
      <div className="scene-bg-image-layer" style={{ backgroundImage: `url("${loadedBackground || sceneBackgroundImage}")` }} />
      {shouldShowDialoguePopup && (
        <div className={`scene-character-stage scene-character-stage-${scenePopupPlacement}`} aria-live="polite">
          <div className="scene-character-stage-dim" />
          <article className={`scene-character-stage-card scene-character-stage-text-${scenePopupTextPosition}`}>
            <div className="scene-character-stage-portrait-wrap">
              {popupCharacterImage ? (
                <img
                  src={popupCharacterImage}
                  alt={`${popupDisplaySpeaker} portrait`}
                  className={`scene-character-stage-portrait ${engagedNpc === "thunderhead" ? "scene-character-stage-portrait-thunderhead" : ""}`}
                />
              ) : (
                <div className="scene-character-stage-portrait scene-character-stage-portrait-fallback" aria-hidden="true">
                  <span>{popupDisplaySpeaker ? popupDisplaySpeaker.charAt(0).toUpperCase() : "?"}</span>
                </div>
              )}
            </div>
            <div className="scene-character-stage-text-wrap">
              <p className="bubble bubble-npc scene-character-stage-text">
                <strong>
                  {popupDisplaySpeaker}
                  {popupTyping && <span className="typing-wave" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>}
                </strong>{" "}
                {popupDialogueText}
              </p>
            </div>
          </article>
        </div>
      )}

      <div className="scene-footer">
        {engagedNpc && (
          <>
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
