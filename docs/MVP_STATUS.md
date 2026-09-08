# Afterlight — Sellable MVP Status

This document is the launch contract for Afterlight. A feature is not considered complete until it works in production and is verified on desktop and mobile.

## Product promise

**Afterlight — somewhere else, for a while.**

A collection of illustrated listening places for focus, reading, unwinding and sleep. The user chooses a place rather than a playlist; the visual environment, story and sound identity change together.

## Current MVP implementation

### Experience
- [x] 12 distinct room identities
- [x] Editorial home/discovery surface
- [x] Clean shareable room routes
- [x] Native browser audio playback
- [x] Previous/next track and room navigation
- [x] Mobile-responsive player
- [x] Favorites persisted locally
- [x] Share action
- [x] 15/30/60 minute listening timers
- [x] Free vs premium room presentation
- [x] Afterlight+ pricing surface

### Free tier
The free tier currently exposes:
- Rooftop
- The window seat
- Pizzeria Roma

The remaining nine rooms route into the Afterlight+ upgrade surface.

### Pricing UX
Current launch pricing presentation:
- Monthly: **$2.99/month**
- Founding annual: **$19.99 first year**

These are UI/product decisions only until Stripe is connected and end-to-end checkout is verified.

## Must complete before charging customers

### P0 — launch blockers
- [ ] Replace generated demo loops with production-grade original or commercially licensed audio content
- [ ] Stripe Checkout for monthly and annual plans
- [ ] Stripe webhook verification and subscription lifecycle handling
- [ ] Authentication / account recovery
- [ ] Server-side entitlement checks for Afterlight+
- [ ] Cross-device favorites and listening preferences
- [ ] Customer billing portal / cancellation flow
- [ ] Privacy Policy
- [ ] Terms of Use
- [ ] Refund/support policy
- [ ] Production analytics
- [ ] Production error monitoring
- [ ] Cloudflare production deployment verified
- [ ] iPhone Safari audio certification
- [ ] Android Chrome audio certification
- [ ] Desktop Safari/Chrome/Firefox certification
- [ ] End-to-end paid checkout test

### P1 — conversion and retention
- [ ] Better scene-specific artwork for every room
- [ ] 30–60 minutes of non-obvious repetition per premium room
- [ ] Seamless track crossfades
- [ ] Recently played
- [ ] New-room release mechanism
- [ ] Email receipt / welcome flow
- [ ] Lightweight onboarding for first visit
- [ ] SEO / Open Graph share cards
- [ ] Installable PWA shell

### Not required for sellable V1
- Native iOS/Android apps
- Social feed
- AI chatbot
- Creator marketplace
- Complex recommendation engine
- Enterprise plan
- Credits/token system
- Large admin dashboard

## Design rules

The interface should feel editorial and cinematic, not like a generic SaaS dashboard.

1. The room is the product; controls remain secondary.
2. Use typography, negative space and atmosphere before cards and gradients.
3. No KPI/dashboard visual language in the listening experience.
4. Premium cues should be quiet and confident, not aggressive paywall banners.
5. Avoid excessive rounded cards, glowing borders, neon gradients and generic AI-generated copy.
6. Every room should eventually have its own visual composition, not only a palette swap.
7. Mobile is a first-class listening surface.

## Definition of sellable MVP

Afterlight is sellable only when a new visitor can:

1. Land on the site and understand the product in under 10 seconds.
2. Enter a free room without creating an account.
3. Hear high-quality audio after one explicit Play tap on iPhone Safari.
4. Discover a premium room and understand why it is locked.
5. Purchase Afterlight+ through Stripe.
6. Return from checkout with premium access immediately active.
7. Sign in on another device and retain premium access and saved places.
8. Cancel or manage billing without support intervention.
9. Use the product without console/runtime errors across the supported browser matrix.

Until all nine are verified in production, the repository should be described as an MVP-in-progress rather than a sellable release.
