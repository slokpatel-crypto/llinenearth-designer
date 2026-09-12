# Phase 3 — Context Consultation

## Goal
Turn the confirmed fabric profile into a compact, editable design brief without forcing the customer through a long form.

## Implemented
- Progressive one-question-at-a-time consultation
- Occasion, venue, time, environment, formality, impression, fit and aesthetic fields
- Live design-brief summary with edit controls
- Back-navigation without losing answers
- Fabric profile carried forward from Phase 2
- Session persistence through `sessionStorage`
- Final structured `ContextProfile` object ready for the Designer Engine

## Acceptance intent
1. User reaches a complete brief without a giant questionnaire.
2. Answers remain editable.
3. Fabric and context state survive page refresh within the session.
4. The final brief uses typed structured fields.
5. Phase 4 can consume the brief without re-parsing UI text.
