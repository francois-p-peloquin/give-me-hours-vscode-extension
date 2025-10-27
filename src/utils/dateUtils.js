export const getFormattedLocalDate = () => {
  const today = new Date();
  return formatToYYYYMMDD(today);
};

export const createDate = (...args) => {
  if (args.length === 1 && args[0] instanceof Date) {
    return new Date(args[0]);
  } else if (args.length === 1 && typeof args[0] === 'string') {
    // Assuming dateInput is in YYYY-MM-DD format for consistency
    // This will create a date in the local timezone without time component issues
    const [year, month, day] = args[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  } else if (args.length === 0) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else {
    // Handle cases like createDate(year, month, day, ...)
    return new Date(...args);
  }
};

export const formatToYYYYMMDD = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getWeekDates = (date) => {
  const weekDates = [];
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date);
  }

  return weekDates;
};
