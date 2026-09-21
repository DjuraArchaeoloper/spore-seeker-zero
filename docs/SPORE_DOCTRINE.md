# SPORE: Seeker Zero - Project Doctrine

## 1. What We Are Building

SPORE is a tiny, premium Solana Seeker mobile app built around one mechanic:

> A digital species spreads from one verified Seeker to another.

The species begins with one unique organism:

**Seeker Zero - Organism #000000 - Generation 0**

Every future organism must descend from Seeker Zero.

A user receives an organism when another Seeker releases a spore and they claim it.

The new organism:

- becomes a child of the parent organism
- inherits the parent's genome
- mutates exactly one gene
- becomes part of a permanent family tree
- receives a non-transferable Metaplex Core NFT as its birth certificate
- can immediately reproduce itself

Core phrase:

> **It started with Seeker Zero.**

The product should create the feeling:

> **“I want to see what mine looks like.”**

---

# 2. Permanent Product Doctrine

SPORE must remain:

- SUPER SIMPLE
- SECURE AS FUCK
- visually exceptional
- premium
- weird
- memorable
- mobile-first
- fast to understand
- easy to use

We are building a **killer mini-app**, not a platform.

Before adding any:

- feature
- screen
- dependency
- abstraction
- service
- database field
- API
- blockchain account
- settings option

ask:

> Does the locked SPORE experience require this right now?

If not:

**DO NOT BUILD IT.**

Exceptional execution is more important than feature count.

---

# 3. Locked Core Loop

The core loop is:

**Own organism**
→ **Release spore**
→ **Another Seeker scans**
→ **Accept life**
→ **Child is born**
→ **Genome mutates**
→ **Non-transferable NFT is created**
→ **Bloodline grows**
→ **Parent's next spore regenerates after 2 hours**

Nothing should dilute this loop.

---

# 4. Organism vs Spore

These are different things.

## Organism

The living digital creature owned by the Seeker.

It has:

- organism number
- parent
- generation
- genome
- birth timestamp
- SGT identity
- Core NFT
- spore availability

## Spore

A temporary reproductive seed produced by an organism.

The spore is NOT an NFT.

The spore is NOT the creature.

Visually:

> organism → releases small spore → recipient claims it → spore develops into child organism

---

# 5. Spore Rules - LOCKED

Each organism:

- can hold exactly **1 ready spore**
- newly born organisms start with their spore ready immediately
- successful reproduction consumes the ready spore
- next spore regenerates after exactly **2 hours**
- spores cannot be stockpiled
- spores cannot be bought
- spores cannot be earned
- regeneration cannot be accelerated

Releasing a spore does NOT consume it.

A released spore offer:

- expires after **120 seconds**
- may be regenerated/re-released freely if nobody claims it
- only one active offer may exist at once

When the 2-hour regeneration completes:

> **Your spore is ready.**

The mobile app should schedule a local notification.

---

# 6. Reproduction Flow

Parent:

**RELEASE SPORE**

Mobile creates a cryptographically random secret.

Solana stores only:

`SHA256(secret)`

The displayed QR contains:

- parent organism reference
- secret

Recipient scans.

Recipient sees a minimal claim experience:

**ACCEPT LIFE**

Recipient signs.

The SPORE program verifies everything and creates the child atomically.

The parent does NOT need to remain present/sign during the claim.

---

# 7. Identity - LOCKED

SPORE authentication is wallet-only.

NO:

- email
- password
- Google login
- account registration

Authentication:

Mobile Wallet Adapter
→ Sign In With Solana
→ server verification
→ SGT verification
→ SPORE session

Permanent SPORE identity:

> **Seeker Genesis Token mint address**

NOT the wallet address.

Rule:

> **One valid SGT = one organism maximum.**

Wallet address is only the current signing authority.

---

# 8. Solana's Role

Solana is NOT decorative.

The SPORE program defines the laws of the species.

Solana is canonical for:

- organism existence
- organism identity
- parentage
- generation
- genome
- reproduction
- cooldown
- Seeker Zero
- birth fee

The server cannot fabricate legitimate organisms or rewrite ancestry.

Core principle:

> **We put the laws of the species on Solana.**

MongoDB is only derived/indexed state.

If Mongo and Solana disagree:

> **Solana wins.**

---

# 9. Solana Program Architecture

Canonical Species PDA:

`["species"]`

Canonical organism PDA:

`["organism", sgt_mint]`

Core NFT PDA:

`["core_asset", sgt_mint]`

## Species

Minimal state includes:

- authority
- treasury
- birth fee
- metadata base URI
- next organism number
- Seeker Zero organism
- total organism count

## Organism

Minimal state includes:

- organism number
- SGT mint
- parent organism
- generation
- genome `[u8; 16]`
- born timestamp
- next spore timestamp
- active spore commitment
- active spore expiry

NO:

- child arrays
- descendant arrays
- XP
- names
- rarity
- image URL
- social data

---

# 10. Seeker Zero - LOCKED

Seeker Zero is:

- a real organism
- tied to a real verified SGT
- Organism #000000
- Generation 0
- root of the species
- no parent
- immediate spore availability

Canonical genome:

`53 50 4F 52 45 00 00 00 53 45 45 4B 45 52 00 00`

Only Seeker Zero may be authority-created.

> **Every other organism must be born.**

No admin organism minting backdoor.

---

# 11. Genome - LOCKED

Genome size:

**16 bytes**

Every normal birth:

- copies all 16 bytes from parent
- mutates exactly 1 byte
- mutation must change that byte's value

No rarity system.

No VRF.

No gambling mechanics.

The mutation system is deterministic cosmetic evolution.

## Gene Map

0 - Body form  
1 - Body proportion  
2 - Membrane shape  
3 - Membrane density  
4 - Pigment  
5 - Bioluminescence  
6 - Nucleus / internal core  
7 - Sensory nodes  
8 - Appendage / wing family  
9 - Appendage expression  
10 - Surface pattern  
11 - Surface density  
12 - Internal filaments  
13 - External halo  
14 - Motion / pulse  
15 - Asymmetry

Rule:

> **Genome is canonical. Phenotype is derived.**

Phenotype must never need to be stored separately on-chain.

---

# 12. Creature Visual Direction - CRITICAL

The current highest-priority work is the creature visual system.

Previous pure procedural Skia creatures were REJECTED because they looked like:

- blobs
- cysts
- eggs
- sacks
- generic procedural graphics
- vibe-coded prototypes

DO NOT return to that direction.

## Approved Direction

Creature inspiration:

- sea angels
- comb jellies
- translucent deep-sea life
- pelagic organisms
- fictional microscopic alien biology

The creature should feel:

- alive
- cinematic
- translucent
- elegant
- alien
- biological
- premium
- slightly eerie
- collectible

Think:

> **premium macro photography of a fictional species**

NOT:

- Pokémon
- Tamagotchi
- cartoon monster
- generic jellyfish
- Web3 neon mascot
- procedural blob

The organism should have:

- coherent body orientation
- central biological body/core
- large elegant wing/fin/parapodia structures
- visible internal anatomy
- luminous organelle/core
- fine vascular/filament structures
- trailing tendrils
- translucent membranes
- restrained bioluminescence
- subtle asymmetric anatomy

The creature is the visual hero of the application.

---

# 13. Creature Rendering Strategy - LOCKED DIRECTION

DO NOT ask Codex to invent final creature artwork procedurally from Bézier curves alone.

Use a hybrid:

> **premium art assets + genome logic + React Native Skia**

We will create a small **SPORE Creature Art Kit**.

Likely asset families:

- body/membrane bases
- wing/fin families
- internal cores
- tendrils/appendages
- filament/internal-detail overlays
- surface overlays
- glow/effect layers
- moustache

Assets should:

- use transparent backgrounds
- share consistent alignment/canvas geometry
- belong to one coherent species
- be modular enough for deterministic genome assembly

Skia will:

- select layers
- tint
- scale
- warp/transform
- mask
- change opacity
- animate
- composite
- add subtle particles/glow

The same genome must always produce the same organism.

Parent and child must visibly look related because only one gene changes.

---

# 14. Current Approved Creature Families

From concept exploration, preferred anatomy directions were:

**1, 3, 4, and 6**

These references should guide the Creature Art Kit.

Do NOT generate more complete app screens when working on the Art Kit.

We need isolated reusable creature assets/components.

---

# 15. Moustache - LOCKED

Every organism has a tiny black moustache by default.

This is intentionally absurd.

The moustache is:

- cosmetic only
- NOT part of genome
- NOT an NFT trait
- NOT rare
- NOT biological
- NOT user customization

Implementation:

`SHOW_MOUSTACHE = true`

It must be globally removable with one config change.

Visual direction:

- black
- elegant
- unmistakably moustache-shaped
- two tapered lobes
- slight handlebar/vintage character
- tiny
- never read as a mouth
- never turn the organism into a cartoon face

Target:

> **A completely serious alien organism inexplicably wearing an immaculate miniature moustache.**

---

# 16. NFT - LOCKED

Every organism receives exactly one:

**Metaplex Core NFT**

NOT Bubblegum/cNFT.

The NFT is:

> the organism's permanent birth certificate / collectible representation

The NFT is NOT the biological source of truth.

The Organism PDA remains canonical.

## NFT behavior

- owned by recipient wallet at birth
- deterministic relationship to SGT
- created during successful birth
- frozen at creation
- `PermanentFreezeDelegate`
- Species PDA controls freeze authority
- SPORE exposes NO thaw path
- no transfer path
- no marketplace
- no royalties
- no staking
- no NFT economy

Later mainnet hardening may make the SPORE program immutable for stronger trustlessness.

---

# 17. Birth Fee - LOCKED

Releasing a spore:

**FREE**

Claiming/birth:

recipient pays:

- Solana/Core NFT costs
- tiny SPORE protocol fee

Fee paid to fixed treasury.

Maximum protocol fee:

`0.01 SOL`

Actual launch fee should be much smaller.

The program enforces:

`MAX_BIRTH_FEE_LAMPORTS = 10_000_000`

No:

- oracle
- USD conversion
- dynamic pricing system
- SPL token
- USDC requirement

SPORE makes money when the species grows.

---

# 18. Future Monetization Direction

Do not build this during core MVP unless necessary.

Interesting future model:

**sponsored evolutionary events**

Example:

During Breakpoint, a temporary environmental event allows new organisms to develop a special inheritable visual trait.

The trait can persist through descendants forever.

This turns historical events into evolutionary eras.

Do not monetize:

- better mutations
- faster spore regeneration
- paid spores
- XP
- pay-to-win biology

---

# 19. Family Tree - LOCKED, SIMPLE

Bloodline is important but must remain minimal.

Each organism only stores its parent on-chain.

Mongo derives:

- ancestors
- direct children
- total descendants

User should be able to see:

> Seeker Zero → ... → parent → YOU → children

Do NOT render a giant 50,000-node tree.

Bloodline response should remain:

- organism
- ancestors
- directChildren
- totalDescendants

User can navigate into individual descendants/children.

---

# 20. Mobile Screens - LOCKED

Only three core surfaces:

## Specimen

Your living organism.

Main content:

- small `GEN X · #XXXXXX`
- HUGE creature
- organism identity/name
- spore ready/cooldown status
- **RELEASE SPORE**

The organism dominates the screen.

## Bloodline

Minimal genealogy:

- ancestry to Seeker Zero
- direct children
- descendant count

## Species

Minimal global organism state:

- population
- deepest generation
- Seeker Zero

Do NOT add:

- feed
- map
- leaderboard
- activity stream
- discovery tab
- social graph

unless explicitly decided later.

---

# 21. UX / UI Doctrine

Airbnb-level discipline, NOT Airbnb visual imitation.

Required:

- extremely obvious navigation
- one dominant action
- excellent spacing
- excellent typography
- very low cognitive load
- dark theme
- premium restraint
- deliberate hierarchy
- minimal text
- no unnecessary UI chrome

Avoid:

- dashboard cards
- generic Web3 aesthetics
- glassmorphism
- random gradients
- excessive borders
- random radii
- overdesigned navigation
- giant headers
- generic component-library look
- “vibe coded” appearance

The app should feel almost **object-like** in its simplicity.

---

# 22. Security Doctrine

Both API and Solana program should assume hostile input.

## Solana

Validate:

- canonical PDAs
- signer authority
- Token-2022 ownership
- legitimate SGT extensions/constants
- one SGT = one organism
- parent identity
- recipient identity
- spore secret
- cooldown
- expiry
- replay/double claim
- counters/overflow
- treasury
- fee
- Core program ID
- Core Asset derivation

Never trust mobile input.

No admin organism-creation bypass.

## API

Use:

- SIWS
- single-use expiring nonce
- mainnet chain binding
- server-side signature verification
- server-side SGT verification
- opaque sessions
- SHA-256 session-token hashes
- SecureStore on mobile
- strict input validation
- sanitized errors
- webhook authentication
- idempotent indexing

No secrets in mobile code.

---

# 23. Backend Architecture

API:

**Next.js + TypeScript**

Database:

**MongoDB + Mongoose**

RPC/indexing:

**Helius**

Mongo is only a fast read/index layer.

Do NOT introduce:

- Redis
- queues
- cron infrastructure
- GraphQL
- microservices
- Kubernetes
- large event-processing systems

unless absolutely required later.

---

# 24. Mongo Organism Index

Minimal indexed fields:

- organismPda
- organismNumber
- sgtMint
- parentOrganismPda
- generation
- genome
- bornAt
- coreAsset
- transactionSignature
- ancestorNumbers
- indexedAt

Unique:

- organismPda
- organismNumber
- sgtMint
- coreAsset

`organismNumber` is stored as decimal string to preserve Solana `u64`.

---

# 25. Current API Endpoints

Authentication:

- `POST /api/auth/nonce`
- `POST /api/auth/verify`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Organisms:

- `GET /api/organisms/me`
- `GET /api/organisms/[organismNumber]`

Species:

- `GET /api/species`

Indexing:

- `POST /api/webhooks/helius`

Keep API surface small.

---

# 26. Repository

```text
spore/
├── apps/
│   ├── mobile/
│   └── api/
├── programs/
│   └── spore/
├── packages/
│   └── shared/
└── docs/
Package manager:
npm
Mobile:
Expo + React Native + TypeScript
API:
Next.js
Database:
MongoDB
Program:
Rust + Anchor
27. Deployment Model
Monorepo does NOT mean one deployment.
Mobile:
apps/mobile
→ Expo EAS
→ Android APK/AAB
→ Solana dApp Store
API:
apps/api
→ Vercel
Database:
MongoDB Atlas
Program:
programs/spore
→ Solana devnet
→ Solana mainnet
Shared:
packages/shared
→ imported only, not deployed independently
28. Visual Preview Mode
Because current development is on Windows + iPhone and MWA is Android-native:
Mobile supports:
EXPO_PUBLIC_SPORE_VISUAL_PREVIEW=true
This exists ONLY for Expo Go visual QA.
It:
- bypasses auth
- does not create fake identity
- does not create sessions
- does not call blockchain
- displays static Seeker Zero UI
Production Seeker behavior remains unchanged.
29. STRICT NOT-BUILDING LIST
Do NOT add unless explicitly unlocked later:
- token
- marketplace
- NFT trading
- NFT royalties
- NFT staking
- pet feeding
- health bars
- XP
- levels
- quests
- battles
- chat
- social feed
- friends
- profiles
- email login
- passwords
- Google login
- AI personalities
- LLM features
- user-designed creatures
- creature cosmetics marketplace
- paid mutations
- paid spore regeneration
- multiple spores
- inventory
- precise GPS
- map
- giant global genealogy graph
- complicated SKR features
- complicated admin dashboard
- microservices
- Redis
- queues
- overengineered infrastructure
30. Codex Prompt Doctrine
Every Codex prompt must reinforce:
Build the smallest secure production-quality implementation required by SPORE.

And:
Do not add speculative future architecture.

And:
Spend disproportionate care on security, UX consistency, and creature visual quality.

During active implementation, unless explicitly requested:
Do NOT run:
- builds
- tests
- lint
- typecheck
- dev servers
- deployments
- expensive verification commands
Make source changes only and report what changed.
31. CURRENT PROJECT STATUS
Completed / established
- monorepo foundation
- minimal mobile design foundation
- wallet-only auth architecture
- SIWS
- SGT verification
- opaque session design
- Species PDA
- Organism state
- Seeker Zero genesis
- release_spore
- claim_spore
- 2-hour cooldown
- secure spore commitment
- 16-byte mutation system
- Metaplex Core NFT birth
- non-transferability/freeze model
- protocol birth fee
- fee hard cap
- Mongo organism index
- Helius birth indexing
- ancestry derivation
- organism/species read APIs
- Expo Go visual preview mode
Rejected
The existing procedural creature renderer / current Specimen visual output.
It looks too procedural, blob-like, and vibe-coded.
Do not treat it as final art.
CURRENT HIGHEST PRIORITY
Build the SPORE Creature Art Kit and replace the weak procedural creature art.

Do NOT continue adding product features until the creature system is visually excellent.
32. Immediate Next Task
Create reusable transparent creature assets based on the approved visual direction.
Preferred anatomy families:
1, 3, 4, 6
Create a small coherent art kit:
- body/membrane bases
- wings/fins
- internal cores
- tendrils
- filaments/details
- surface overlays
- effects
- black moustache
Then Codex integrates those approved assets into the existing:
genome → phenotype → renderer
pipeline.
Goal:
Parents and children visibly resemble each other, but each mutation produces a beautiful, meaningful visual difference.

The renderer must make users want to reproduce creatures simply to see what comes next.
33. Final Quality Bar
SPORE should be able to win because one brilliantly executed mechanic simultaneously provides:
- gameplay
- distribution
- virality
- blockchain necessity
- social interaction
- retention
- collectible identity
- hackathon demo
The test is simple:
If we have to explain why SPORE is interesting for three minutes, we failed.

The product should be understood after seeing:
one beautiful creature → release spore → scan → child is born mutated → family tree updates.
That is SPORE.

I would attach this **once and treat it as law**. In future chats, you can simply say:

> **Read the SPORE project doctrine and continue from the current state.**

Then we should not need to re-litigate the core product every time.

# SPØR Social Doctrine — LOCKED

SPØR social output must meet the same quality bar as the product.

Every post must be:
- sharp
- memorable
- premium
- strange in a deliberate way
- concise
- unmistakably SPØR

Voice:
- confident
- restrained
- biological
- slightly mysterious
- never corporate
- never generic startup marketing
- never generic crypto/Web3 hype
- never engagement bait
- avoid unnecessary hashtags
- avoid unnecessary emojis
- avoid buzzwords
- avoid unnecessary exclamation marks
- never sound AI-generated

Core principle:

SHOW > EXPLAIN.

Prefer:
- organism reveals
- mutation
- reproduction
- bloodlines
- Seeker Zero
- strange observations about the species
- meaningful real development milestones
- concise lore grounded in actual SPØR mechanics

Never invent:
- features
- statistics
- users
- partnerships
- launches
- achievements
- blockchain claims

One post = one strong idea.

Before a post enters the publishing queue:
- generate multiple candidate versions
- remove generic wording
- remove overexplaining
- verify every factual claim
- compare against recent posts to avoid repetition
- choose only the strongest version
- if nothing is genuinely good, do not queue a post

Quality > posting frequency.

Core anchor:

"It started with Seeker Zero."

Do not mechanically repeat that phrase.