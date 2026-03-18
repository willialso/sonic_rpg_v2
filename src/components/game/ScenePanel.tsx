import { useEffect, useState } from "react";
import type { LocationId, NpcId } from "../../types/game";
import type { DialogueTone } from "../../dialogue/types";

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
  isAwaitingNpcReply: boolean;
  isResolved: boolean;
  dialogueQuickReplies: Array<{ id: DialogueTone; tone: string; text: string }>;
  onSubmitQuickReply: (text: string, tone: DialogueTone) => Promise<void>;
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
    isAwaitingNpcReply,
    isResolved,
    dialogueQuickReplies,
    onSubmitQuickReply
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
          <div className="dialogue-choice-panel">
            <p className="dialogue-choice-label">Choose your tone:</p>
            <div className="quick-reply-row" aria-label="Dialogue tone choices">
              {dialogueQuickReplies.map((reply) => (
                <button
                  key={reply.id}
                  className={`quick-reply-btn quick-reply-btn-${reply.id}`}
                  title={reply.text}
                  disabled={isAwaitingNpcReply || isResolved}
                  onClick={async () => {
                    await onSubmitQuickReply(reply.text, reply.id);
                  }}
                >
                  {reply.tone}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
