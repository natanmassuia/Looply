// MVP backend flags — mirror of frontend/src/config/mvp.ts for the server-side
// guards. Hide/limit, never delete. Flip to false to restore full behavior.
export const MVP = {
  // Template sends are allowed to customer numbers (P0-A customer-template flow).
  // Flip to true to restrict sends to the company's own number only.
  lockTemplateToSelf: false,
};
