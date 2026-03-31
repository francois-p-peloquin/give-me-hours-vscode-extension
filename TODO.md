# TODO

* Actionable:
  * [x] Get hours from both remotes + and local (in case we have stash branches)
  * [x] Actually use a summary service. Right now, it's just concatenating the letters.
  * [x] Summary grabbing data from the wrong days. See Monday, October 27. It's grabbing messages from Sunday's commits.
  * [x] Summary doesn't work on "day" view. Only works on "week" view. Think new Date() is fucking it up.
  * Investigate hours bleeding over into other days (try --local flag for Git).
  * Generate actually summary via endpoint/summary library.
  * [x] Duration variable formatting. Right now, 3600 format confusing, should be hours like the rest. priority in the messages.
* Nice to haves:
  * Exclude folders: like give-me-hours-vscode-extension
