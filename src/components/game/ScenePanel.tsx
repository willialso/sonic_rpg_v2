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
  const [activeBackground, setActiveBackground] = useState(sceneBackgroundImage);
  const [previousBackground, setPreviousBackground] = useState("");
  const [isBackgroundTransitioning, setIsBackgroundTransitioning] = useState(false);
  const [selectedTone, setSelectedTone] = useState<DialogueTone | null>(null);

  useEffect(() => {
    if (!sceneBackgroundImage) return;
    if (sceneBackgroundImage === activeBackground) return;
    const img = new Image();
    img.onload = () => {
      setPreviousBackground(activeBackground);
      setActiveBackground(sceneBackgroundImage);
      setIsBackgroundTransitioning(true);
    };
    img.src = sceneBackgroundImage;
  }, [activeBackground, sceneBackgroundImage]);

  useEffect(() => {
    if (!isBackgroundTransitioning) return;
    const id = window.setTimeout(() => {
      setIsBackgroundTransitioning(false);
      setPreviousBackground("");
    }, 220);
    return () => window.clearTimeout(id);
  }, [isBackgroundTransitioning]);

  useEffect(() => {
    setSelectedTone(null);
  }, [engagedNpc]);

  return (
    <section className={`scene scene-${locationId}`}>
      {previousBackground && (
        <div
          className={`scene-bg-image-layer scene-bg-image-prev ${isBackgroundTransitioning ? "is-transitioning" : ""}`}
          style={{ backgroundImage: `url("${previousBackground}")` }}
        />
      )}
      <div
        className={`scene-bg-image-layer scene-bg-image-active ${isBackgroundTransitioning ? "is-transitioning" : ""}`}
        style={{ backgroundImage: `url("${activeBackground || sceneBackgroundImage}")` }}
      />
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
            <p className="dialogue-tone-current">
              Current tone: <strong>{selectedTone ? dialogueQuickReplies.find((reply) => reply.id === selectedTone)?.tone ?? "None" : "None"}</strong>
            </p>
            <div className="quick-reply-row" aria-label="Dialogue tone choices">
              {dialogueQuickReplies.map((reply) => (
                <button
                  key={reply.id}
                  className={`quick-reply-btn quick-reply-btn-${reply.id} ${selectedTone === reply.id ? "quick-reply-btn-active" : ""}`}
                  title={reply.text}
                  disabled={isAwaitingNpcReply || isResolved}
                  onClick={async () => {
                    setSelectedTone(reply.id);
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
