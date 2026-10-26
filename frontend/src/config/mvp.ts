// MVP surface flags — hide (never delete) what isn't part of the atendimento
// loop (WhatsApp + IA + agenda + clientes + demandas). Flip a flag to false to
// bring the feature back; all the code stays in place.
export const MVP = {
  // Onboarding creates a LOCAL_BUSINESS workspace only (profile picker hidden).
  forceLocalBusinessOnboarding: true,
  // Appearance presets/colors hidden; theme stays at its saved default.
  hideAppearanceTab: true,
  // Publication / editorial fields hidden on demand creation.
  hideEditorialFields: true,
  // Approval entry points outside the demand screen (e.g. dashboard) hidden.
  hideApprovalOutsideDemand: true,
  // Template sending is locked to the company's own number until P0-A.
  lockTemplateToSelf: true,
};
