# PawClock

Predict your pet's sleep, pee, and poop cycles using Bayesian probabilistic models. A privacy-first PWA that runs entirely in the browser — no accounts, no backend, no data leaving your device.

**Live app:** [pawclock.netlify.app](https://pawclock.netlify.app)

## What it does

PawClock learns your pet's biological rhythms from manually logged events and predicts when the next sleep, bathroom, or digestive window is likely to occur. The prediction engine improves over time as more data is logged.

- Predicts sleep, pee, and poop timing windows with confidence scores
- 24-hour probability river timeline visualization
- Supports cats and dogs with breed-specific population priors
- Anomaly detection flags unusual patterns worth mentioning to a vet
- Installable as a PWA on any device

## How predictions work

The engine combines three statistical models:

1. **Gamma renewal process** for inter-event timing (increasing hazard models biological pressure buildup)
2. **Dirichlet-Multinomial** with 48 half-hour bins for circadian rhythm patterns
3. **Additive Gaussian kernel** for meal-to-defecation coupling

Cold-start priors are drawn from veterinary population data (virtual sample size = 5), so predictions are reasonable from day one and sharpen as events are logged. Model confidence is tracked per cycle type.

## Tech stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS v4
- Zustand (session state) + IndexedDB via idb-keyval (persistence)
- PWA via vite-plugin-pwa
- No backend — all computation is client-side

## Getting started

```bash
git clone https://github.com/ronit111/pawclock.git
cd pawclock
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Walk through the onboarding flow to set up a pet profile, then start logging events.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
├── engine/       Prediction engine (Gamma + Dirichlet-Multinomial + meal coupling)
├── data/         Population priors (veterinary lookup tables by breed/species)
├── store/        Zustand stores + IndexedDB persistence layer
├── components/   React UI components
│   ├── onboarding/   6-step pet setup flow
│   ├── dashboard/    Hero card, metrics, timeline, predicted windows
│   ├── log/          Quick event logging panel
│   ├── history/      Event history with filters
│   ├── settings/     Profile, notifications, data export
│   └── shared/       Bottom nav, confidence indicator
├── hooks/        Custom React hooks
├── types/        TypeScript type definitions
└── utils/        Math functions, time helpers
```

## Design

The UI follows a "Warm Light" design language: warm cream backgrounds, glass-like surface cards, and a coral accent palette. Typography pairs Instrument Serif (display/data) with DM Sans (body). Staggered entrance animations and grain texture overlays add depth.

See `CLAUDE.md` for the full design system reference including color tokens, component classes, and architectural decisions.

## Privacy

All data stays in your browser's IndexedDB. No network requests are made beyond loading the app itself. There is no analytics, no tracking, no cloud sync. You can export your data as JSON from the Settings page.

## Contributing

Contributions are welcome. Fork the repo, make your changes, and open a pull request. A few notes:

- The prediction engine lives in `src/engine/` — changes there should preserve the existing probabilistic model interface
- The design system is defined in `src/index.css` using CSS cascade layers (`@layer base`, `@layer components`) with Tailwind v4 utilities on top
- All state is managed through Zustand stores in `src/store/` with IndexedDB persistence

## Disclaimer

PawClock uses statistical patterns to estimate likely biological cycles. It is not a substitute for veterinary care or diagnosis. If your pet shows signs of illness, consult a veterinarian.

## License

[MIT](LICENSE)
