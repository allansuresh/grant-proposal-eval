// PUBLIC_DEMO=true on the live site, where the demo accounts are shared with
// strangers. It switches off actions that would let one visitor affect others,
// such as creating accounts.
export const isPublicDemo = () => process.env.PUBLIC_DEMO === "true";
