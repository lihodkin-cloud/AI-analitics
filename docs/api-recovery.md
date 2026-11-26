# API failure control and seven-day recovery

Prepared and tested on 2026-11-26 (Europe/Kyiv). Production source installation and trigger setup were reported completed by the owner on 2026-11-26; a manual production generation run was verified. The first scheduled executions remain unverified.

## Latest revision

The initial combined Apps Script run timed out. See [Bounded scheduler phases](timeout-fix.md) for the correction and completed isolated Apps Script phase checks. Production installation is complete as reported by the owner; scheduled execution verification remains pending.

## Behavior

- The master scheduler and legacy automatic entry points use one script lock for report generation and email delivery.
- Daily recovery scans the previous seven calendar dates plus today's first shift once due. Shift 1 is due at 17:00 Kyiv; shift 2 at 07:00 the next day. Missing source data creates no AI report and is checked again on later runs.
- Weekly reports retain Monday–Saturday periods and Saturday 17:00 scheduling. Monthly reports retain first-day 08:00 scheduling. Recovery includes periods whose scheduled date falls within the seven-day window; it does not shorten their reporting period.
- A stored report is complete only when status is OK and aiText is nonempty. Recovery updates the existing key and preserves createdAt and all email history.
- Generation attempts at most one report per invocation. A shared 180-second soft budget reserves time before starting expensive work. Mail is a separate phase, at most two emails per invocation, before any generation; an invocation that attempts mail then returns. Dashboard rendering runs separately. See timeout-fix.md.
- API responses must be completed, contain no error and have nonempty text. Incomplete responses, including output-token truncation, cannot be saved as OK.
- There is one API request per attempt, without sleep or immediate retries. A persistent API circuit pauses all reports for 30 minutes after transient HTTP 408/429/5xx errors. Authentication, billing quota, malformed/incomplete output, transport and configuration errors pause for six hours.
- Per-report retry delays grow from 30 minutes to at most six hours. Technical retry records older than eight days are pruned. Fixing credentials/quota does not bypass the cooldown automatically.
- AI_LOG records controlled error codes, HTTP status, retry metadata and saved reports. Prompts, provider bodies, raw exception messages and API keys are excluded from new control records. Existing deterministic KPI logs remain separate.
- AI_ADMIN_EMAILS is a new Script Property: semicolon/comma-separated administrator addresses. It is independent of AI_REPORT_EMAILS. No addresses are hardcoded or inferred. Missing configuration and mail quota shortages are logged. Administrator mail is limited to one attempt per six hours; ambiguous sends require review.
- Report emails are marked SENDING before MailApp is called, SENT only after return, and REVIEW after an ambiguous exception. SENDING, REVIEW and legacy ERROR are excluded from automatic resend. Existing SENT reports are not resent. PENDING and WAITING_QUOTA remain eligible.
- Source/report/log headers are checked before dependent access. A changed layout stops the dependent operation; AI_REPORTS headers are no longer silently overwritten.

## Validation

Run from the repository root:

    node --test tests/reliability.test.cjs

48 tests passed locally on 2026-11-26. Coverage includes HTTP/auth/quota errors, malformed JSON, incomplete/empty responses, sanitized diagnostics, persistent cooldown, administrator throttling/quota/ambiguous sends, Kyiv schedule boundaries, DST, seven-day recovery, monthly/weekly due dates, lock release, work limits, empty data, duplicate keys, preservation of SENT history, changed headers and syntax parsing of repository JavaScript. Timeout regression checks are detailed in timeout-fix.md.

Tests use isolated mocks for Apps Script services. They do not call OpenAI, send mail, change production spreadsheets or install triggers. GitHub Actions runs the same suite on pushes and pull requests.

## Production rollout

1. Export the current live Apps Script and compare it with the repository base commit 45b22113bc01328926935b9f9b7045dd1e23a078. GitHub is a code snapshot; equality with the live script has not been verified. Preserve any newer live changes.
2. Test in a separate Apps Script project with a copied spreadsheet. Configure its spreadsheet ID, test-only AI_REPORT_EMAILS and AI_ADMIN_EMAILS, and an approved test API key. Keep automatic triggers disabled until testing finishes.
3. Verify a completed report is saved once, email is sent once, API errors reach AI_LOG/admin mail, a second run respects cooldown, and missed eligible periods recover without duplicates. Check dashboard rendering and execution duration against the larger seven-day scan.
4. Install the reviewed files, including AIReliability.js, in production only after the isolated Apps Script test. The existing Tests.js still contains the repository's analyzeMonthlyReport_ implementation and must remain available. The new tests/docs/workflow are excluded by .claspignore.
5. Set AI_ADMIN_EMAILS to the administrator's confirmed address. Verify OPENAI_API_KEY and the existing AI_REPORT_EMAILS without logging their values. Run installAISchedulerTrigger once if trigger installation is necessary; it removes duplicate daily/master triggers and creates one master trigger plus a separate dashboard refresh trigger every ten minutes.
6. Monitor AI_CONTROL records in AI_LOG and PENDING/SENT/REVIEW status in AI_REPORTS. An operator must reconcile ambiguous MailApp delivery before explicitly requeuing a report.

Rollback: disable the master trigger, restore the exported source, preserve AI_REPORTS/email statuses, then reinstall the previous trigger. Do not clear SENT, SENDING or REVIEW to force a resend. Persistent AI_API_CIRCUIT and AI_RETRY|... properties can be inspected and cleared by an operator after the underlying fault is fixed.

