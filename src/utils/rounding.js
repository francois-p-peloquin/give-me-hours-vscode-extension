export const calculateRoundedSeconds = (seconds, config) => {
    const { hoursRounding } = config;
    if (hoursRounding > 0) {
        const hoursDecimal = seconds / 3600;
        const roundedHours = Math.ceil(hoursDecimal / hoursRounding) * hoursRounding;
        return Math.floor(roundedHours * 3600);
    }
    return seconds;
};

export const formatTime = (totalSeconds, timeFormat) => {
    if (timeFormat == 'Chrono') {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
        console.log(`Formatted as Chrono: ${formattedTime}`);
        return formattedTime;
    } else { // Decimal
        const formattedTime = (totalSeconds / 3600).toFixed(2);
        console.log(`Formatted as Decimal: ${formattedTime}`);
        return formattedTime;
    }
};
