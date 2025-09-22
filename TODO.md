* Feature requests
  * Description: I want to move the rounding logic to the front end to increase the speed of the VSCode extension. I also want to implement a week view/day view tab option.
  * Steps:
    1. [x] Move rounding logic to the front end.
      * Back end (NodeJS) should simply pass objects back like the following:
        * Folder
        * Commit timestamps
        * Summary
      * Back end data should be returned in an array of objects, each object of which will consist of one folder with an array of dates (Eg. `[{ folder: 'give-me-hours', data: [{ date: '2025-09-20', ...data }, { date: '2025-09-21', ...data }] }]`)
        * Make sure I can see this data easily in the console log.
    2. [x] Enable returning data for multiple dates. This is why we made the data structured by folder and then an array of dates. This is also for the future calendar feature.
      * By default, return one date, but also allow multiple dates to return.
    3. [x] Move rounding logic (hoursRounding, projectStartupTime, minCommitTime) into front-end JS on hours-pannel.html (or better, a separate file).
    4. Reactify front end
      * Requirements:
        * Use @vscode/webview-ui-toolkit library or alternate React framework
        * React code should live in /src folder
        * TSX optional, but acceptable.
<!--
    4. Create a day view and a week view.
      * If
  * Rework
    * Get current week (current date argument, get all days in week)
    * Get entire week data in Git
    * Run in each current working directory
    * Keep all data in memory
  * Rework
    * Do rounding on display side, no need to re-get data evey time we toggle stuff
    * Consider: Sliders to increase/decrease rounding, etc
    * Week view, day view
    * Notes on startup time, etc...graphs? -->
