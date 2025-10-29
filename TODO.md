# TODO

* Actionable:
  * Actually use a summary service. Right now, it's just concatenating the letters.
  * Summary grabbing data from the wrong days. See Monday, October 27. It's grabbing messages from Sunday's commits.
  * Summary doesn't work on "day" view. Only works on "week" view. Think new Date() is fucking it up.
  * Investigate hours bleeding over into other days (try --local flag for Git).
  * Generate actually summary via endpoint/summary library.
  * Footer bar hours update every X based on saved settings.
    * Context: For now, I've just hidden the zero results. It needs to use the calculateWorkingHours from the front end roundng.
  * [x] IMPORTANT: Date, when switched out of current calendar week, doesn't refresh data. Needs to.
    * Send refresh call if startOfWeek/endOfWeek change.
    * Pass startOfWeek/endOfWeek to front end on load.
  * Duration variable formatting. Right now, 3600 format confusing, should be hours like the rest.
  * [x] For the commits summaries function `getCommitSummaryForFolder`, I would like the PR/Merge names sanitized and moved to top priority in the messages.
  * [x] Correct day highlighting.
* Nice to haves:
  * [x] New TOTALS column totaling hours for each project.
  * Exclude folders: like give-me-hours-vscode-extension
