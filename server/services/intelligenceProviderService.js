// Provider boundary: no provider is enabled in this project yet. Keeping this
// isolated prevents keys, prompts, and raw operational records reaching client code.
export const getIntelligenceProviderStatus = () => ({ available: false, provider: null, reason: "No AI provider is configured; deterministic evidence is shown instead." });

export const generateExplanation = async () => null;
