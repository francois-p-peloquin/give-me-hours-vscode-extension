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
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else { // Decimal
        return (totalSeconds / 3600).toFixed(2);
    }
};
