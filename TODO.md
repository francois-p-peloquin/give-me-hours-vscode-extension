# TODO

* Actionable:
  * For the commits summaries function `getCommitSummaryForFolder`, I would like the PR/Merge names sanitized and moved to top priority in the messages.
    * Steps:
      1. Move Summary library into its own NodeJS file.
      1. When summarizing commits, prioritize Merge/PR titles over the commits beneath them.
        1. Sort these to the top of the list, add subcommits back in if messages not too much for summary length.
      1. Sanitize Merge/PR names
        * Split Merge names (`Merge pull request *** featured/PR-description` becomes `PR description`).
      1. Remove unnecessary words in commits.
        * Examples: Ditto, almost there, stable, ready.
* Pre next launch:
  * Correct day highlighting.
  * Investigate hours bleeding over into other days (try --local flag for Git).
  * Generate actually summary via endpoint/summary library.
  * Footer bar hours update every X based on saved settings.
* Nice to haves:
  * New TOTALS column totaling hours for each project.
