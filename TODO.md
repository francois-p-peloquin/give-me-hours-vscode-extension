# TODO
* [x] Create a [Get Work Summary] button in each table cell of the ResultsTable.js.
  * Steps:
    1. Adding the button.
      * Add this button as a separate react component. Please pass to the component the folder + the date.
      * Add the component to the table cell, and pass it the appropriate arguments fron the results variable.
      * On click, this button should comminicate with the back end of the VSCode extension, and make a request with the folder name and the date.
      * Make sure there is a loading and success state for the button that says "Coppied!" for 3 seconds.
    1. VSCode extension changes:
      * When the button requests the folder + date info from the back-end, run the give-me-hours.js buildGitCommand function in the appropriate folder.
      * The only return for the request should be the entire set of commit messages joined with a semicolon.

