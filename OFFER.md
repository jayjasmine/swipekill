# Offer card — SwipeKill

Working #1. Charge this week. One job.

## Idea

| Field | Copy |
| --- | --- |
| **Name** | SwipeKill — Photo Autopsy |
| **Wound** | He has 0–3 matches. Friends lie. Photo 1 is killing the stack. |
| **Hook (H1)** | Which of your 6 photos is killing your matches? |
| **Promise** | Upload 6 photos. In 60 seconds we stamp the kill shot, tell you what goes first, and give 3 fixes. |
| **Avatar** | Men 21–35 on dating apps, dead or near-dead stack |
| **Charge** | $19 USD one-time. Hard paywall before scores. No waitlist. No subscription first. No account (email for Stripe receipt only). |
| **One job** | Autopsy the 4–6 photo stack. Rank. KILL. Put this first. Bury max 2. Three fixes: light, crop, expression. |
| **Tone** | Dark, blunt, locker-room honest. Not cute. Not a kids site. Not a 12-feature SaaS landing. |
| **Complexity** | 2 |

## Do not build

AI generator, bio writer, chat coach, weekly habit, waitlist, App Store binary.

## Nearby money (do not invent more)

- Photofeeler — $9–$79 credits, ~2M users
- ROAST — $6.99 / $39/mo
- RMH — $20–$150

## Stripe product to create

Create this exactly. One-time. Not a subscription.

| Stripe field | Value |
| --- | --- |
| **Product name** | SwipeKill Photo Autopsy |
| **Description** | One-time dating-photo autopsy: kill shot, first-photo pick, bury list, three fixes. 21+. |
| **Price** | `1900` cents |
| **Currency** | USD |
| **Type** | One-time (not recurring) |
| **Payment Link** | Yes — after-completion redirect to `https://YOUR-DOMAIN/success.html` |

Then paste the Payment Link URL into `js/config.js` → `STRIPE_PAYMENT_LINK`.

Until that field is filled, Pay must not fake a successful live payment. Test unlock is `?unlocked=1` only.
