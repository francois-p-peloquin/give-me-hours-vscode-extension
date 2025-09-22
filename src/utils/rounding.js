export function calculateRoundedSeconds(seconds, config) {
    let roundedSeconds = seconds;
    if (seconds > 0) {
        if (config.hoursRounding > 0) {
            const hoursDecimal = roundedSeconds / 3600;
            const roundedHours = Math.ceil(hoursDecimal / config.hoursRounding) * config.hoursRounding;
            roundedSeconds = Math.floor(roundedHours * 3600);
        }
        if (config.projectStartupTime > 0) {
            const startupSeconds = Math.floor(config.projectStartupTime * 3600);
            roundedSeconds += startupSeconds;
        }
    }
    return roundedSeconds;
}

export function formatTime(seconds, useDecimal = false) {
    if (useDecimal) {
        const hours = seconds / 3600;
        return hours.toFixed(2);
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        } else if (minutes > 0) {
            return `0:${minutes.toString().padStart(2, '0')}`;
        } else {
            return '0:00';
        }
    }
}
