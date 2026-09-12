# Learning application confirmation modals

User clarification on 2026-09-12: confirmations must use an application modal, rather than native browser `window.confirm`. This supersedes the earlier native-dialog automation blocker; it is a requested UI change, not a waiver of acceptance cases.

Implementation uses the existing Base UI Dialog and translated VI/EN labels through `useLearningConfirm`. Cancel receives initial focus. Cancel, dismissal and unmount resolve false; mutations await approval. Concurrent prompts do not queue destructive actions. Dialog width is constrained on desktop and fits the shared mobile gutter.

Converted consumers: lesson recovery/format/starter warning/dirty close; code reset and builder mode switch; question recovery/generation/dirty close; section/new-lesson close; course/lesson archive, restore and delete; sponsor/partner removal; credential configuration navigation/deactivation. Existing routes and feature permissions are unchanged. Browser-owned reload/tab-close `beforeunload` protection remains: browsers cannot await an application modal after unloading the document.

Automated verification: 874 tests in 128 files, lint and production-neutral local build. Logs: `/tmp/corelia-modal-full-tests.log`, `/tmp/corelia-modal-lint.log`, `/tmp/corelia-modal-build.log`. Hook tests explicitly fail if native confirm runs and verify Cancel/Confirm and pending cancellation on unmount. LessonEditor recovery tests now interact with modal decisions.

Browser checks on the local QA build, using DOM controls only:

| Case | Observation |
| --- | --- |
| EN dirty lesson close | Cancel opened `Confirm action`; its Cancel retained `QA modal unsaved draft`; reopening and Confirm closed the editor without Save. |
| EN restore/archive | Cancel retained the archived lesson; Confirm restored it as draft. Archive Confirm returned the fixture to archived state. |
| VI code fill reset | Entered `mut`; `Đặt lại` opened `Xác nhận thao tác`. Hủy retained `mut`; Xác nhận cleared the input. No completion action submitted. |

Final-build smoke repeated VI code reset: modal width approximately 512px at 1745px viewport, initial focus Hủy, Escape retained mut, then Confirm reset the input.

These checks do not close the entire browser matrix. Recovery with raw malformed data through Save, starter warning, all navigation/keyboard/mobile cases and final diff review remain tracked in `acceptance-status.md`. Earlier native automation failures are historical evidence, not current product failures or passes.
