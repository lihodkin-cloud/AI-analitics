# Bounded scheduler phases

Prepared on 2026-11-26. The owner reported production source installation and trigger setup completed on 2026-11-26. The revised generation, mail and dashboard phases have now completed successfully in an isolated Apps Script project.

## Problem

An isolated Apps Script run reached the six-minute execution limit after saving a report. Full dashboard rendering was called synchronously by saveAIReport_ and setAIReportEmailStatus_. This repeated the expensive operation for report saving and for each SENDING/SENT update. Rendering between SENDING and MailApp could leave delivery ambiguous even before MailApp was reached.

## Change

- Saves and email status writes only mark AI_DASHBOARD_DIRTY. They perform no dashboard rendering.
- runAIScheduler first handles at most two eligible queued emails. If it attempted delivery, it logs EMAIL_PHASE_FINISHED and returns. Generation is deferred to a later invocation. A quota check that prevents sending is an exception: generation may proceed so mail quota does not block report creation.
- With no eligible queued email, generation attempts at most one report. It never starts email delivery after generation in the same invocation.
- runDailyAIScheduler also generates at most one report.
- Generation, mail and API entry use a shared 180-second soft budget with start reserves. An in-flight Google or API request cannot be cancelled; the budget is a scheduling guard, not a hard request timeout.
- Empty source date/shift pairs bypass full report-package construction. Source rows and the source date/shift index are cached only within a lock-protected invocation, then discarded so late data is visible on the next run.
- The validated report sheet object is reused within an invocation.
- runAIDashboardRefresh renders a dirty dashboard in a separate lock-protected invocation. The dirty flag is cleared only after success.
- installAISchedulerTrigger removes duplicates of the old daily/master/dashboard handlers. It installs the master at the existing configured interval and dashboard refresh every ten minutes. It leaves unrelated triggers untouched.
- Interrupted SENDING, REVIEW, legacy ERROR and SENT rows remain excluded from automatic delivery. An operator must reconcile an interrupted send before explicit requeue; this change does not reset those statuses.

## Isolated retest

1. Update AIClient, AIAutomation, AIReliability, AIEmail, AIReportStore and DataReader from this branch in the test project. Preserve its test Config and existing Script Properties. Logger is unchanged by this fix.
2. Keep test triggers disabled and wait until any previous execution has ended.
3. Inspect SENDING rows and reconcile receipt before resetting any status. A report may have been saved even when the overall execution timed out.
4. Run runAIScheduler manually. If mail was pending, expect EMAIL_PHASE_FINISHED without dashboard output or AI generation. Otherwise expect at most one generated report and FINISHED. Newly generated report mail waits for the next run.
5. Run runAIScheduler again to verify the next phase. Existing SENT/SENDING rows must not be resent.
6. Run runAIDashboardRefresh separately. It should render once and clear the dirty flag. A second run without changes should do no rendering.
7. After successful real retests, update the production project and install the revised trigger arrangement. The revised phases have been retested successfully. Production installation was subsequently reported complete; verification of the first scheduled executions remains pending.

## Validation

Run node --test tests/reliability.test.cjs from the repository root.

48 tests pass locally. New regression coverage verifies no dashboard rendering during saves or SENDING/MAIL/SENT ordering, separate generation/mail phases, bounded email batches, standalone dirty-dashboard refresh, one source read per invocation, fresh reads across invocations, empty-shift prefiltering, budget guards before new API/email work, and generation despite mail quota exhaustion. Original API error, deduplication, schedule and recovery tests continue to pass. These tests use mocks; real Apps Script phase checks are recorded below.

## Apps Script acceptance, 2026-11-26

Confirmed in an isolated copied project:

- Daily and weekly schedule previews produced the expected due periods.
- Missing daily reports were generated and saved as OK; successive runs resumed the backlog without duplicating existing successful keys.
- A stored report was delivered successfully; a repeated explicit send returned ALREADY_SENT without another message.
- A synthetic retryable failure produced an ERROR record, retry timing and an administrator notification. Its immediate repeated attempt was suppressed. This was an injected failure, not a real HTTP outage.
- After the timeout correction, a master invocation delivered two queued reports, persisted SENT and logged EMAIL_PHASE_FINISHED. The recipient confirmed receipt of both messages.
- A separate dashboard invocation completed and logged REFRESHED. The user confirmed both shift cards were visible.
- A subsequent master invocation generated one missing report, saved it as OK/PENDING, logged SAVED and FINISHED, and completed without inline dashboard rendering or mail delivery.

Automated HTTP error and cooldown cases are covered by the 48-test suite; real HTTP failure injection was not performed. The owner subsequently reported installing the code and both triggers in production. A manual production generation run was independently verified in the report store and control log; scheduled executions are not yet verified. The generic acceptance record deliberately omits internal source links, report identifiers and recipient addresses.

## Production installation, 2026-11-26

The owner reported transferring the reviewed source into the production project, configuring the administrator property, confirming the existing API-key and report-recipient properties, and running installAISchedulerTrigger. The intended trigger intervals are the existing thirty-minute master scheduler and ten-minute dashboard refresh.

A manual production master invocation was verified to save a missing report with OK/PENDING and log SAVED and FINISHED. Trigger configuration is based on the owner's confirmation, not a direct trigger inventory. The first scheduled master execution, queued production delivery and scheduled dashboard execution remain unverified. The source branch remains separate from main while the pull request is open.
