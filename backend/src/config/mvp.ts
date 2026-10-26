// MVP backend flags — mirror of frontend/src/config/mvp.ts for the server-side
// guards. Hide/limit, never delete. Flip to false to restore full behavior.
export const MVP = {
  // Template sends are allowed only to the company's own WhatsApp number
  // (operator self-test) until the P0-A customer-template flow is ready.
  lockTemplateToSelf: true,
};
