export const calculateWorkingHours = (commits, duration = 3600, minCommitTime = 0.5) => {
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

    return totalSeconds;
};