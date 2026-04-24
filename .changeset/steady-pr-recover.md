---
"helmor": patch
---

Tighten up a handful of transient failure paths so they stop surfacing as errors:
- Retry the slash-command popup once when the Claude SDK tears down its query mid-request, so the `/` menu loads instead of flashing an error.
- Retry GitHub PR actions (show / merge / close) once on transient TLS and connect errors with a short backoff, so a flaky network doesn't bounce the user out of a commit flow.
- Stop raising an error when a session is deleted while its title is still being generated in the background.
