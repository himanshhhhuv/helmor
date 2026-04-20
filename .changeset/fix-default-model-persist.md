---
"helmor": patch
---

Fix the default model setting being silently overwritten on app restart:
- The startup model-validation hook no longer replaces a user-saved default model when the model catalog is still partially loaded or when the saved model belongs to a provider that hasn't responded yet.
