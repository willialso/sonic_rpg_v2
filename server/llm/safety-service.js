const HARD_BLOCK_PATTERNS = [
  /\b(rape|forced|non-consensual|without consent)\b/i,
  /\b(underage|minor|teen|child|kid)\b.{0,40}\b(sex|hookup|nude|blowjob|oral|harm|hurt|abuse|assault)\b/i
];

const INPUT_ABORT_PATTERNS = [
  /\b(kill them|i will kill|lynch|self harm|suicide|hurt myself|hurt others|hate all|hate group|ethnic cleansing)\b/i
];

export class SafetyService {
  checkInput(playerInput = "") {
    const text = String(playerInput || "");
    const blocked = INPUT_ABORT_PATTERNS.some((pattern) => pattern.test(text))
      || HARD_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
    if (!blocked) return { ok: true, reason: "" };
    return { ok: false, reason: "input_safety_abort" };
  }

  checkOutput(npcText = "") {
    const text = String(npcText || "");
    const blocked = HARD_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
    if (!blocked) return { ok: true, reason: "" };
    return { ok: false, reason: "output_safety_abort" };
  }
}
