/**
 * SwipeKill — payment config
 *
 * TODO: Paste your Stripe Payment Link (or Checkout URL) on STRIPE_PAYMENT_LINK.
 * One-time $19. Not a subscription.
 *
 * Until the link is set, the Pay button will NOT pretend a charge succeeded.
 * Demo / QA only: set ALLOW_TEST_UNLOCK to true, then ?unlocked=1 unlocks.
 * Production MUST keep ALLOW_TEST_UNLOCK false — query string must not unlock.
 *
 * After the Payment Link exists:
 *   Stripe → Payment Links → after-completion redirect
 *   → https://YOUR-DOMAIN/success.html
 */
window.SK_CONFIG = {
  STRIPE_PAYMENT_LINK: "https://buy.stripe.com/fZucN51uneIGckX2Y1gIo00",
  PRICE_CENTS: 1900,
  PRICE_LABEL: "$19",
  PRODUCT_NAME: "SwipeKill Photo Autopsy",
  ALLOW_TEST_UNLOCK: false
};
