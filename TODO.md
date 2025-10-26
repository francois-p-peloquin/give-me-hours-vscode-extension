# TODO

* Actionable:
  * [x] For the commits summaries function `getCommitSummaryForFolder`, I would like the PR/Merge names sanitized and moved to top priority in the messages.
  * [x] Correct day highlighting.
  * Footer bar hours update every X based on saved settings.
    * Context: For now, I've just hidden the zero results. It needs to use the calculateWorkingHours from the front end roundng.
* Pre next launch:
  * Investigate hours bleeding over into other days (try --local flag for Git).
  * Generate actually summary via endpoint/summary library.
* Nice to haves:
  * [x] New TOTALS column totaling hours for each project.
  * Exclude folders: like give-me-hours-vscode-extension
