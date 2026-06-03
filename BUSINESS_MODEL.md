# Business Model

Engram is, and will remain, **MIT-licensed open source**. Free forever, in every meaningful sense of that phrase. This document exists so contributors, users, and integrators know exactly what to expect.

## The short version

- **License:** MIT. Every line of code in this repository, every release on npm, every binary in the desktop installer. No dual licensing, no "source-available," no commercial license.
- **Pricing:** Free. There are no paid tiers, no usage caps, no per-seat plans, no "Team Edition coming soon," no licensing keys.
- **Feature parity:** Every feature ships in the OSS package. There is no premium fork, no closed-source addon, no feature gate.
- **Telemetry:** None. Engram runs entirely on your machine; it makes no network calls beyond the one-time embedding-model download on first use.

If any of those change, this file will be rewritten honestly and in advance. They are commitments, not aspirations.

## Why this model

A few competing models exist in the agent-memory category — cloud SaaS (Mem0), self-hosted-plus-paid-features (open-core), dual-license. Engram chose pure OSS for three reasons:

1. **The category is forming.** A paywall this early would slow adoption at the exact moment when the technical category is still being defined. Adoption is the asset.
2. **Solo maintainership.** A small team running a paid offering carries support, billing, and compliance overhead that competes with shipping. Pure OSS keeps the maintainer's focus on the code.
3. **Acquirer-clean codebase.** Engram has no commercial-license entanglements, no proprietary modules, no "premium fork" debt. Whatever direction the project takes long-term — staying solo, joining a larger org, or being adopted by an existing platform — the codebase is portable. Pure MIT keeps that optionality.

## How the project is sustained

Engram is currently maintained by [Henry Barefoot](https://github.com/HBarefoot) as an open-source project, in parallel with other work. Sustaining it relies on:

- **GitHub Sponsors** ([`.github/FUNDING.yml`](.github/FUNDING.yml)) — optional, low-pressure way for users and companies to support continued development. No tier-locked features; just support if Engram is useful to you.
- **Contributor PRs** — see [`CONTRIBUTING.md`](CONTRIBUTING.md). External contributions will eventually require a one-time Contributor License Agreement (CLA) to keep the copyright assignment clean for the project's long-term flexibility.
- **Partnership integrations** — if you build a product that benefits from embedded agent memory and want to integrate Engram first-class, we're interested. Open an issue or reach out via the GitHub Discussions.

There are no investors, no outside capital, no time-bound commitments to deliver paid features. The project is sustained by interest, contributions, and sponsorships.

## What we won't do

To be explicit, since the OSS world has been burned by license changes:

- **We will not relicense to a non-OSI-approved license.** The MIT license here today is the MIT license tomorrow.
- **We will not "open-core" Engram.** New features land in the OSS repository, not in a parallel paid offering.
- **We will not introduce telemetry without opt-in consent and a clear off switch.**
- **We will not introduce usage caps, license keys, or feature gates in the OSS package.**

If the project ever needs to change shape — for instance, if it grows to a point where solo maintenance is no longer viable — the change will be announced openly, with the rationale and the alternatives, with enough lead time for downstream users to plan.

## Acquisitions and adoption by a larger entity

Engram is openly designed to be the kind of focused, well-engineered library that any company building agent infrastructure could productively adopt or integrate. If a strategic adopter — an AI platform company, a database vendor, a developer-tools company — wanted to deepen their partnership or formally adopt the project, that conversation is welcome.

What that would *not* mean for users:

- It would not mean the OSS package goes away. The MIT-licensed code stays MIT-licensed; no one can revoke that.
- It would not mean introducing paid tiers retroactively. Whatever the model on day N, the existing OSS package keeps shipping under the existing license.
- It would not happen as a surprise. Any change to Engram's maintainership or scope would be announced openly here and in the repository.

## License audit

Engram's runtime dependencies are vetted to be acquirer-clean and OSS-redistributable:

- All runtime dependencies are under permissive licenses (MIT, ISC, Apache 2.0, BSD).
- No GPL/AGPL/SSPL in the runtime path.
- License inventory is verifiable via `npx license-checker --summary` from a fresh clone.

If you spot a dependency that violates this, please open an issue — it's a bug.

---

*Last updated: 2026-06-03. This document is part of the [Engram repository](https://github.com/HBarefoot/engram) and is itself MIT-licensed.*
