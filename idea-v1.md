# content format of an idea's CID

This document defines the JSON that is pinned to IPFS and whose **CID** is passed to `IdeaRegistry.submit(cid)`.

## Why it matters

An idea's CID is **not just council metadata**: when the council approves it, `resolve` sets `config.description == idea.cid` on the on-chain proposal (contract guardrail). In other words, **the same CID becomes, verbatim, the `description` of the votable proposal**. And that `description` is what the citizen app resolves (CID → `title` + `questions[].variants`) to render the ballot.

Consequence: **an idea JSON is, at the same time, the proposal's content document**. That is why its content part has to follow exactly the shape the app SDK expects.

Two consumers of the same CID:
- **Citizen app (SDK):** reads `title` and `acceptedOptions[].variants`. Ignores any field it does not know.
- **Council frontend:** reads everything (including `voting` and `contact`) to render the detail view and derive the `ProposalConfig`.

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
| `title` | string | **yes** | Proposal title. Empty = invalid. |
| `description` | string | no | Explanatory text. Shown in the app and in the detail view. |
| `imageCid` | string | no | CID of a cover image (or `""`). |
| `rankingBased` | bool | no | `false` = single-option vote (default). |
| `acceptedOptions` | array | **yes** | Ballot questions. Minimum 1. |
| `acceptedOptions[].title` | string | **yes** | Question statement. |
| `acceptedOptions[].description` | string | no | Question help text. |
| `acceptedOptions[].variants` | string[] | **yes** | Vote options. **Minimum 2.** E.g. `["Yes","No","Blank"]`. |

### `voting`

| Field | Type | Req. | Description |
|---|---|:--:|---|
| `voting` | object | **yes¹** | Parameters to build the `ProposalConfig`. **Its absence is the only thing that blocks promotion** (triggers the "missing voting parameters" warning). |
| `voting.durationDays` | number | **yes** | Days the vote stays open. > 0. |
| `voting.eligibility` | object | no | Voter restrictions. Absent/empty = no restriction. |
| `voting.eligibility.citizenship` | string[] | no | Allowed country codes (ISO 3, e.g. `["ESP"]`). **`[]` = any nationality.** |

¹ Required to be able to **promote** the idea. An idea without `voting` can be published and viewed, but the council cannot derive its `ProposalConfig` → the detail view marks it as incomplete.

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
| `votingWhitelist` | `[BioPassportVoting]` |
| `votingWhitelistData` | encoded from `voting.eligibility` (`citizenship` + selector) |
| `startTimestamp` | **NOT from the CID.** The council sets it on approval (≈ `block.timestamp`), so `duration` counts from approval. The contract requires `> 0`. |

Because the whole config is derived deterministically from the CID, anyone can rebuild the calldata and verify that the `safeTxHash` matches the approved one. Integrity is guaranteed by the Safe's approved hash, not by `IdeaRegistry`.

## Validation

- `schema` equals `"idea/v1"`.
- `title` not empty.
- `acceptedOptions[0].title` not empty.
- `acceptedOptions[0].variants` with ≥ 2 elements.
- `voting.durationDays` > 0.
- **Only warning that blocks promotion:** the `voting` block is missing. Any other absence (description, contact, image…) blocks nothing.
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
  "voting": { "durationDays": 90, "eligibility": { "citizenship": [] } }
}
```

### Restricted to a single nationality

```json
{
  "schema": "idea/v1",
  "title": "Local consultation (residents with an ES passport only)",
  "acceptedOptions": [
    { "title": "In favour?", "variants": ["Yes", "No", "Blank"] }
  ],
  "voting": { "durationDays": 30, "eligibility": { "citizenship": ["ESP"] } }
}
```

> Note: a nationality-restricted proposal is valid at the config level, but it is only votable if the target ZK voting rail supports registering documents of that nationality. Config validity does not guarantee voter-side eligibility.
