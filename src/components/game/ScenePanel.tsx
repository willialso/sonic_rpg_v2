import { useEffect, useState } from "react";
import type { ActionResult, LocationId, NpcId, ReplyTone } from "../../types/game";
import { canonicalizeDisplaySpeaker, stripLeadingSpeakerPrefix } from "../../app/actions/dialogueActions";

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
  selectedReplyTone: ReplyTone | null;
  playerInput: string;
  isAwaitingNpcReply: boolean;
  isResolved: boolean;
  titleCase: (input: string) => string;
  onReplyToneChange: (tone: ReplyTone | null) => void;
  onPlayerInputChange: (value: string) => void;
  onSubmitDialogue: (action: { type: "SUBMIT_DIALOGUE"; npcId: NpcId; input: string; tone?: ReplyTone | null }) => Promise<ActionResult>;
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
    selectedReplyTone,
    playerInput,
    isAwaitingNpcReply,
    isResolved,
    titleCase,
    onReplyToneChange,
    onPlayerInputChange,
    onSubmitDialogue
  } = props;
  const renderedSpeaker = engagedNpc
    ? (canonicalizeDisplaySpeaker(engagedNpc, popupDisplaySpeaker) ?? popupDisplaySpeaker)
    : popupDisplaySpeaker;
  const renderedDialogueText = popupTyping
    ? ""
    : (engagedNpc ? stripLeadingSpeakerPrefix(engagedNpc, popupDialogueText, renderedSpeaker) : popupDialogueText);
  const toneOptions: Array<{ key: ReplyTone; label: string }> = [
    { key: "informative", label: "Informative" },
    { key: "sarcastic", label: "Sarcastic" },
    { key: "neutral", label: "Neutral" }
  ];
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
                  alt={`${renderedSpeaker || (engagedNpc ? titleCase(engagedNpc) : "NPC")} portrait`}
                  className={`scene-character-stage-portrait ${engagedNpc === "thunderhead" ? "scene-character-stage-portrait-thunderhead" : ""}`}
                />
              ) : (
                <div className="scene-character-stage-portrait scene-character-stage-portrait-fallback" aria-hidden="true">
                  <span>{renderedSpeaker ? renderedSpeaker.charAt(0).toUpperCase() : "?"}</span>
                </div>
              )}
            </div>
            <div className="scene-character-stage-text-wrap">
              <p className="bubble bubble-npc scene-character-stage-text">
                <strong>
                  {(renderedSpeaker || (engagedNpc ? titleCase(engagedNpc) : "NPC"))}:
                </strong>{" "}
                {renderedDialogueText}
                {popupTyping && <span className="typing-wave" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>}
              </p>
            </div>
          </article>
        </div>
      )}

      <div className="scene-footer">
        {engagedNpc && (
          <>
            <div className="quick-reply-row" role="group" aria-label="Reply tone">
              {toneOptions.map((tone) => (
                <button
                  key={`tone-${tone.key}`}
                  type="button"
                  className={`quick-reply-btn quick-reply-btn-tone-${tone.key} ${selectedReplyTone === tone.key ? "quick-reply-btn-active" : ""}`}
                  aria-pressed={selectedReplyTone === tone.key}
                  onClick={() => onReplyToneChange(selectedReplyTone === tone.key ? null : tone.key)}
                  disabled={isAwaitingNpcReply || isResolved}
                >
                  {tone.label}
                </button>
              ))}
            </div>
            <div className="dialogue-box">
              <input
                value={playerInput}
                onChange={(e) => onPlayerInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (!playerInput.trim() || isResolved || isAwaitingNpcReply) return;
                  e.preventDefault();
                  void onSubmitDialogue({ type: "SUBMIT_DIALOGUE", npcId: engagedNpc, input: playerInput, tone: selectedReplyTone }).then(() => {
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
                  await onSubmitDialogue({ type: "SUBMIT_DIALOGUE", npcId: engagedNpc, input: playerInput, tone: selectedReplyTone });
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
