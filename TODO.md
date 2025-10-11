# TODO:
* Context: This VSCode Extension gets Git commits from a folder and will display it in a table on the front end of the app in a VSCode Reacy interface.
* Actionables:
  * [x] Step 1: Create the options above the table display.
    * Context: Use AppOld.js as the example for components and parts, but ignore most of its functionality.
    * There should be a simple header bar at the top with flex wrap display, top aligned. I want it to have a number of options fields.
    * Options fields:
      * Display:
        * Options: Day (default), Week
      * Date: A calendar picker. This will eventually trigger getting more data from the VSCode back end, but for now, just have changing it run setDate.
        * Recommendation: use VSCodeTextField with a calendar widget like AppOld.
      * Hours format:
        * Options: Chrono, Decimal (default)
        * Recommendations: use VSCodeDropdown
      * A "Refresh" button
      * An "Open settings" button
    * A boolean toggle/checkmark field for "Round hours"
  * Step 2: Create the table
    * This will be populated by the data that returns in the `results` constant.
    * If the "Display" field is set to "Day", populate the table with rows where the left column is folder and the next column shows the calendar date chosen in the Date field.
