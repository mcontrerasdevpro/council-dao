# content format of an idea's CID

This document defines the JSON that is pinned to IPFS and whose **CID** is passed to `IdeaRegistry.submit(cid)`.

## Why it matters

An idea's CID is **not just council metadata**: when the council approves it, `resolve` sets `config.description == idea.cid` on the on-chain proposal (contract guardrail). In other words, **the same CID becomes, verbatim, the `description` of the votable proposal**. And that `description` is what the citizen app resolves (CID → `title` + `questions[].variants`) to render the ballot.

Consequence: **an idea JSON is, at the same time, the proposal's content document**. That is why its content part has to follow exactly the shape the app SDK expects.

Two consumers of the same CID:
- **Citizen app (SDK):** reads the top-level `title` + `description`, and each `acceptedOptions[].title` + `variants`. Ignores any field it does not know.
- **Council frontend:** reads everything (including `voting` and `contact`) to render the detail view and derive the `ProposalConfig`.

### Two levels of `title` / `description`

There are two independent pairs, shown in different places by the app:

- **Top-level `title` + `description`** → the proposal card in the **list view** (its heading and blurb).
- **`acceptedOptions[0].title`** → the **question statement** shown on the ballot. This is the *only* per-question text the app renders.
- **`acceptedOptions[0].description`** → **unused**: shown nowhere, not in the app and not in the council. Leave it empty if you want.

> ⚠️ WARNING ⚠️: The CID is **public and permanent** (IPFS + on-chain, immutable, forever). Do not put personal data (names, email, phone). See [Hard rules](#hard-rules).

## Full structure

```json
{
  "schema": "idea/v1",

  "title": "Continuous bike lane on the main avenue",
  "description": "Explanatory text of the idea, shown in the app and in the council detail view.",
  "imageCid": "",
  "rankingBased": false,

  "acceptedOptions": [
    {
      "title": "Build a segregated, continuous bike lane on the main avenue?",
      "description": "Pick one option.",
      "variants": ["Yes", "No", "Blank"]
    }
  ],

  "voting": {
    "document": "passport",
    "durationDays": 90,
    "eligibility": {
      "citizenship": []
    }
  },

  "contact": {
    "label": "Forum discussion",
    "url": "https://forum.example.org/t/bike-lane"
  }
}
```

## Field reference

### Content

| Field | Type | Req. | Description |
|---|---|:--:|---|
| `schema` | string | **YES** | Version marker: `"idea/v1"`. Read by the validator; ignored by the SDK. |
| `title` | string | **yes** | Proposal title: heading on the **list-view card**. |
| `description` | string | no | Proposal blurb: shown under the title on the **list-view card**. |
| `imageCid` | string | no | CID of a cover image (or `""`). |
| `rankingBased` | bool | no | `false` = single-option vote (default). **Ignored by the council** (config is today single-choice). |
| `acceptedOptions` | array | **yes** | Ballot questions. Minimum 1: but only `[0]` is used (see mapping). |
| `acceptedOptions[].title` | string | **yes** | Question statement: the **only** per-question text the app shows on the ballot. |
| `acceptedOptions[].description` | string | no | **Unused · shown nowhere** (neither the app nor the council). Leave empty if you want. |
| `acceptedOptions[].variants` | string[] | **yes** | Vote options. **Minimum 2.** E.g. `["Yes","No","Blank"]`. |

### `voting`

| Field | Type | Req. | Description |
|---|---|:--:|---|
| `voting` | object | **yes¹** | Parameters to build the `ProposalConfig`. **Its absence is the only thing that blocks promotion** (triggers the "missing voting parameters" warning). |
| `voting.durationDays` | number | **yes** | Days the vote stays open. > 0. |
| `voting.document` | string | **yes** | Which document type may vote: `"passport"` (TD3) or `"dni"` (TD1, Spanish ID card). **Selects the voting contract**: `passport` → `BioPassportVoting`, `dni` → `IDCardVoting`. **One or the other, never both.** No default: a missing or invalid value blocks promotion (`buildProposalConfig` throws; the detail view disables approve button). |
| `voting.eligibility` | object | no | Voter restrictions. Absent/empty = no restriction. |
| `voting.eligibility.citizenship` | string[] | no | **WHO may vote, by nationality: the proposer's explicit choice.** Absent or `[]` = **all nationalities**. A non-empty list of ISO 3166-1 alpha-3 codes restricts voting to those countries, e.g. `["ESP"]` = **Spaniards only**. **Enforced on-chain:** the vote proof reveals the document's real nationality and the voting contract (`BioPassportVoting` for passports, `IDCardVoting` for DNI) rejects any voter outside the list. |
| `voting.cera` | bool | no | `true` adds a **geo dimension**: a on-chain variants (`inside`/`outside` the country) that the app fills from device location, letting the tally separate residents-abroad votes. **when enabled, that proposal requires location permission to vote** (the contract forces the geo answer). Default `false`. |

¹ Required to be able to **promote** the idea. An idea without `voting` can be published and viewed, but the council cannot derive its `ProposalConfig` → the detail view marks it as incomplete.

> **Two independent eligibility knobs.** `citizenship` decides **who** votes (nationality gate); `cera` decides how the tally is **split by where** the voter is (inside/outside Spain).

### `contact` (optional)

| Field | Type | Req. | Description |
|---|---|:--:|---|
| `contact` | object | no | Contact/discussion point. Absent = fine, no warning. |
| `contact.url` | string | no² | Link (forum, page, ENS…). **Never PII.** |
| `contact.label` | string | no | Link text. If missing, the URL is shown. |

² If `contact` is present, it is rendered **only** when it carries a `url`.

## Mapping to `ProposalConfig`

What the council assembles on approval (deterministic from the CID):

| On-chain field | Source |
|---|---|
| `description` | **the CID itself** (forced by the contract) |
| `duration` | `voting.durationDays` × 86400 |
| `multichoice` | `0` (single vote) |
| `acceptedOptions` | **derived** from `variants.length`: `[(1 << n) - 1]` → 3 variants = `[7]` |
| `votingWhitelist` | **`[BioPassportVoting]`** if `voting.document === "passport"`, **`[IDCardVoting]`** if `=== "dni"`. The proposal is passport-only or DNI-only. |
| `votingWhitelistData` | `ProposalRules` encoded from `voting.eligibility`: `citizenshipWhitelist` = each ISO-3 code packed ASCII big-endian (`"ESP"` → `0x455350`). `selector` always carries bit 0 (nullifier) + bit 15 (age ≥ 18) + bit 12 (not-expired) = `36865`; the citizenship-reveal bit 5 is added when the list is non-empty → `36897`. Plus `birthDateUpperbound` = today−18y and `expirationDateLowerBound` = today. |
| `startTimestamp` | **NOT from the CID.** The council sets it on approval (≈ `block.timestamp`), so `duration` counts from approval. The contract requires `> 0`. |

Because the whole config is derived deterministically from the CID, anyone can rebuild the calldata and verify that the `safeTxHash` matches the approved one. Integrity is guaranteed by the Safe's approved hash, not by `IdeaRegistry`.

### What the council does NOT take from the CID

`buildProposalConfig` is deliberately minimal. The following are **fixed**, so declaring them in the CID has no effect:

- **`multichoice` is always `0`** (single-choice). `rankingBased` in the CID is **ignored**.
- **Only the first question is used**: `acceptedOptions[0].variants`, plus the synthetic CERA question when `voting.cera` is on. Any extra entries in `acceptedOptions[]` are **ignored**: one real question per proposal.
- **Age (≥ 18) and passport-not-expired are ALWAYS enforced** (not CID-driven, applied to every proposal). The selector carries bit 15 (age) and bit 12 (expiry); `birthDateUpperbound` is set to *today − 18 years* and `expirationDateLowerBound` to *today*, both at approval time. These are real circuit constraints, not reveals, so **age and expiry never leak on-chain**. `sex` and the birth-date *lower* bound stay `0` (no sex filter, no upper age limit).
- `identityCreationTimestampUpperBound` (year 2100) and `identityCounterUpperBound` (2³²−1) are wide-open constants.
- **`startTimestamp` is sent as `0`**; `IdeaRegistry.resolve` overwrites it with `block.timestamp` at approval, so `duration` always counts from the approval moment.

So the only CID-driven knobs today are **`document` (passport/dni), `durationDays`, the first question's `variants`, `voting.cera`, and `voting.eligibility.citizenship`** (plus `description`, which is forced to be the CID).

## Validation

- `schema` equals `"idea/v1"`.
- `title` not empty.
- `acceptedOptions[0].title` not empty.
- `acceptedOptions[0].variants` with ≥ 2 elements.
- `voting.durationDays` > 0.
- `voting.document` is `"passport"` or `"dni"` (mandatory).
- **Two things block promotion:** the `voting` block is missing, or `voting.document` is missing/invalid. Any other absence (description, contact, image…) blocks nothing.
- If `contact` has PII (name/email/phone), **IT IS ENTIRELY YOUR RESPONSIBILITY; PLEASE REVIEW IT BEFORE SUBMITTING AND DON'T MAKE ANY DECISIONS YOU'LL REGRET**.

## Hard rules

- **Public and permanent**: The CID lives on IPFS and remains as the on-chain `description` forever. There is no "edit" or "delete".
- **Zero personal identity**: Not in `contact`, not in `description`, not in any field. Contact is an **opt-in link** (forum/page), never personal data. The proposer is already pseudonymous through their wallet.
- **The content is what gets voted**: The council cannot rewrite it: it approves that exact text or rejects it.

## Examples

### Minimal valid and promotable

```json
{
  "schema": "idea/v1",
  "title": "Pedestrianise the main square?",
  "acceptedOptions": [
    { "title": "Pedestrianise the main square?", "variants": ["Yes", "No", "Blank"] }
  ],
  "voting": { "document": "passport", "durationDays": 90, "eligibility": { "citizenship": [] } }
}
```

### Restricted to a single nationality

```json
{
  "schema": "idea/v1",
  "title": "Local consultation (Spanish nationals only)",
  "acceptedOptions": [
    { "title": "In favour?", "variants": ["Yes", "No", "Blank"] }
  ],
  "voting": { "document": "dni", "durationDays": 30, "eligibility": { "citizenship": ["ESP"] } }
}
```

> Note: the restriction is **enforced on-chain** so the contract rejects any voter whose nationality is not in the list. Both **ES passports (TD3) and the Spanish DNI (TD1)** can register and vote today, so `["ESP"]` gives a working Spaniards-only vote with either document.

### Tagged by residence: CERA

Spanish nationals worldwide, with each vote tagged inside / outside the country so the tally can separate the resident-abroad (CERA) vote.

```json
{
  "schema": "idea/v1",
  "title": "Consultation for citizens abroad",
  "acceptedOptions": [
    { "title": "In favour?", "variants": ["Yes", "No", "Blank"] }
  ],
  "voting": {
    "document": "dni",
    "durationDays": 30,
    "eligibility": { "citizenship": ["ESP"] },
> Note: a nationality-restricted proposal is valid at the config level, but it is only votable if the target ZK voting rail supports registering documents of that nationality. Config validity does not guarantee voter-side eligibility.
