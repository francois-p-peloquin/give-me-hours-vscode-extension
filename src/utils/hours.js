export const calculateWorkingHours = (commits, roundHours, config) => {
    const { duration, minCommitTime, hoursRounding, projectStartupTime } = config;
    let totalSeconds = 0;
    let prevTimestamp = null;

    if (commits.length === 1) {
        totalSeconds += minCommitTime * 3600;
    } else {
        for (const commit of commits) {
            const currentTimestamp = new Date(commit.timestamp).getTime() / 1000;

            if (prevTimestamp !== null) {
                const interval = currentTimestamp - prevTimestamp;

                if (interval <= duration) {
                    totalSeconds += interval;
                } else {
                    totalSeconds += minCommitTime * 3600;
                }
            }

            prevTimestamp = currentTimestamp;
        }
    }

    if (roundHours && totalSeconds > 0) {
        if (hoursRounding > 0) {
            const hoursDecimal = totalSeconds / 3600;
            const roundedHours = Math.ceil(hoursDecimal / hoursRounding) * hoursRounding;
            totalSeconds = Math.floor(roundedHours * 3600);
        }
        if (projectStartupTime > 0) {
            const startupSeconds = Math.floor(projectStartupTime * 3600);
            totalSeconds += startupSeconds;
        }
    }

    return totalSeconds;
};