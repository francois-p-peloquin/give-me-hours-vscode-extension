# TODO:
* On load, in the `getHoursForDirectory` function of `give-me-hours.js`, please always grab a full week's worth of data. No matter what the initial date passed is, please get a `startOfWeek` and `endOfWeek` variable (from start of Monday to end of Sunday) and use that to get the data that we will return to the App.js.
* In the `App.js`, please only request further data from the `extension.js` file when the `App.js` does not have access to the the current date loaded.
