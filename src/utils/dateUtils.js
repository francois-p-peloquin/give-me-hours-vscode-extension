export const getFormattedLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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