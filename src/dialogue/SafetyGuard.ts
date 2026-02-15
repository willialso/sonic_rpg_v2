export class SafetyGuard {
  private readonly blockedTerms: string[];

  constructor(blockedTerms: string[]) {
    this.blockedTerms = blockedTerms;
  }

  shouldAbort(input: string): boolean {
    const lower = input.toLowerCase();
    return this.blockedTerms.some((term) => lower.includes(term.toLowerCase()));
  }
}
