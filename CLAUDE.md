# PawClock

Pet biological cycle prediction PWA. Predicts sleep, urination, and defecation timing for cats and dogs using Bayesian probabilistic models with manual event logging.

## Stack
- React 19 + TypeScript + Vite 6
- Tailwind CSS v4
- Zustand (session state) + IndexedDB via idb-keyval (persistence)
- PWA via vite-plugin-pwa
- No backend. All computation client-side.

## Architecture
- `src/engine/` — Prediction engine (Gamma renewal process + Dirichlet-Multinomial circadian + meal coupling)
- `src/data/` — Population priors (static veterinary data lookup tables)
- `src/store/` — Zustand stores + IndexedDB persistence
- `src/components/` — React UI components
- `src/hooks/` — Custom React hooks
- `src/types/` — TypeScript type definitions
- `src/utils/` — Shared utilities (math functions, time helpers)

## Key Design Decisions
- Gamma distribution for inter-event times (increasing hazard = pressure buildup)
- Dirichlet-Multinomial with 48 half-hour bins for circadian patterns
- Additive Gaussian kernel for meal-defecation coupling
- 288 five-minute bins for 24-hour prediction output
- Virtual sample size = 5 for cold-start priors
- Anomaly detection via predictive surprise (rolling 7-day average)

## Design Language: "Warm Light"
- Background: #fffaf4 → #f5ede5 gradient (warm cream)
- Surface cards: white glass with warm tints, layered shadows
- Text primary: #231c17, secondary: #65594f, muted: #8f8275
- Sleep: #6e93a5 (steel blue)
- Pee: #d9a44b (golden amber)
- Poop: #916344 (warm brown)
- Accent: #eb7d62 (coral)
- Fonts: Instrument Serif (data/display), DM Sans (UI body)
- Design system: surface-card, surface-card-hero, metric-card, eyebrow-pill, info-pill, filter-chip utility classes
- Grain overlay + radial gradient atmosphere on body
- Staggered entrance animations (fadeSlideUp with animation-delay)
