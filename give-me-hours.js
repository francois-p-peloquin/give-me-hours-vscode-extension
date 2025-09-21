const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

class GiveMeHours {
    constructor(options = {}) {
        this.duration = options.duration || 3600; // 1 hour in seconds
        this.hoursRounding = options.hoursRounding || 0.25;
        this.projectStartupTime = options.projectStartupTime || 0.5;
        this.debug = options.debug || false;
        this.showSummary = options.showSummary !== undefined ? options.showSummary : true;
        this.maxWords = options.maxWords || 50;
    }

    parseDuration(durationStr) {
        const match = durationStr.match(/^([0-9]*\.?[0-9]+)([hms]?)$/);
        if (!match) return 3600; // default to 1 hour

        const value = parseFloat(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'h':
            case '':
                return Math.floor(value * 3600);
            case 'm':
                return Math.floor(value * 60);
            case 's':
                return Math.floor(value);
            default:
                return 3600;
        }
    }

    roundHours(seconds, rounding) {
        const hoursDecimal = seconds / 3600;
        const roundedHours = Math.ceil(hoursDecimal / rounding) * rounding;
        return Math.floor(roundedHours * 3600);
    }

    addProjectStartupTime(seconds, startupTimeHours) {
        const startupSeconds = Math.floor(startupTimeHours * 3600);
        return seconds + startupSeconds;
    }

    formatDuration(seconds) {
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

    generateSummary(commitsOutput) {
        const lines = commitsOutput.split('\n').filter(line => line.trim());
        const messages = [];

        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 3) {
                const message = parts[2].trim();
                if (message && !messages.includes(message)) {
                    messages.push(message);
                }
            }
        }

        // Join messages with semicolons and limit by word count
        const summary = messages.join('; ');
        const words = summary.split(' ');

        if (words.length > this.maxWords) {
            return words.slice(0, this.maxWords).join(' ') + '...';
        }

        return summary;
    }

    getGitUsername() {
        try {
            return execSync('git config --global user.name', { encoding: 'utf8' }).trim();
        } catch (error) {
            throw new Error('Git global username is not set. Set it with: git config --global user.name "Your Name"');
        }
    }

    buildGitCommand(since, before, author) {
        let cmd = "git log --pretty=format:'%at|%an|%s' --reverse";
        cmd += ` --since="${since}" --before="${before}"`;

        if (author) {
            cmd += ` --author="${author}"`;
        }

        return cmd;
    }

    getGitCommits(since, before, author) {
        try {
            const cmd = this.buildGitCommand(since, before, author);
            if (this.debug) {
                console.log(`Running: ${cmd}`);
            }
            return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            if (this.debug) {
                console.error(`Error executing git command: ${error}`);
            }
            return '';
        }
    }

    calculateWorkingHours(commitsOutput, minSecondsWorked = 30 * 60) {
        let totalSeconds = 0;
        let prevTimestamp = null;
        const lines = commitsOutput.split('\n').filter(line => line.trim());

        if (lines.length === 1) { // Only one commit
            totalSeconds += minSecondsWorked;
        }
        else { // Multiple commits
            for (const line of lines) {
                const [timestamp, author, message] = line.split('|');
                if (!timestamp) continue;

                const currentTimestamp = parseInt(timestamp);

                if (prevTimestamp !== null) {
                    const interval = currentTimestamp - prevTimestamp;

                    if (this.debug) {
                        console.log(`${new Date(prevTimestamp * 1000).toISOString()} ${author} ${message}`);
                        console.log(`${this.formatDuration(interval)} >`);
                    }

                    // If working time is less than our specified duration
                    if (interval <= this.duration) {
                        totalSeconds += interval;
                    }
                    // Otherwise, just add the minimum time worked per commit
                    else {
                        totalSeconds += minSecondsWorked;
                    }
                }

                prevTimestamp = currentTimestamp;
            }
        }

        return totalSeconds;
    }

    getHoursForRepo(since, before, author, repoPath = '.') {
        const originalCwd = process.cwd();

        try {
            process.chdir(repoPath);

            // Check if we're in a git repository
            try {
                execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            } catch (error) {
                return { seconds: 0, summary: '' };
            }

            const commitsOutput = this.getGitCommits(since, before, author);
            if (!commitsOutput) {
                return { seconds: 0, summary: '' };
            }

            let totalSeconds = this.calculateWorkingHours(commitsOutput, this.projectStartupTime * 3600);
            const summary = this.showSummary ? this.generateSummary(commitsOutput) : '';

            let totalSecondsRounded = totalSeconds;

            // Apply rounding and project startup time if time was worked
            if (totalSeconds > 0) {
                if (this.hoursRounding > 0) {
                    totalSecondsRounded = this.roundHours(totalSeconds, this.hoursRounding);
                }
                if (this.projectStartupTime > 0) {
                    totalSecondsRounded = this.addProjectStartupTime(totalSeconds, this.projectStartupTime);
                }
            }

            return {
                seconds: totalSeconds,
                secondsRounded: totalSecondsRounded,
                summary
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    getDateRange(dateArg = 'today') {
        const now = new Date();
        let startDate, endDate;

        switch (dateArg) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
                break;
            default:
                // Assume YYYY-MM-DD format
                const dateMatch = dateArg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (dateMatch) {
                    const year = parseInt(dateMatch[1]);
                    const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
                    const day = parseInt(dateMatch[3]);
                    startDate = new Date(year, month, day);
                    endDate = new Date(year, month, day, 23, 59, 59);
                } else {
                    throw new Error('Invalid date format. Please use YYYY-MM-DD');
                }
        }

        return {
            start: startDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            end: endDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
        };
    }

    async getHoursForDirectory(directoryPath, dateArg = 'today') {
        const gitUsername = this.getGitUsername();
        const { start, end } = this.getDateRange(dateArg);

        const results = [];
        let totalHoursSeconds = 0;

        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const subDir = path.join(directoryPath, entry.name);
                    const gitDir = path.join(subDir, '.git');

                    if (fs.existsSync(gitDir)) {
                        if (this.debug) {
                            console.log(`\nChecking git repository: ${subDir}`);
                        }
                        const result = this.getHoursForRepo(start, end, gitUsername, subDir);

                        if (result.seconds > 0) {
                            const hoursFormatted = this.formatDuration(result.seconds);
                            totalHoursSeconds += result.seconds;

                            results.push({
                                folder: entry.name,
                                hours: hoursFormatted,
                                seconds: result.seconds,
                                summary: result.summary
                            });
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Error reading directory ${directoryPath}: ${error.message}`);
        }

        const totalFormatted = this.formatDuration(totalHoursSeconds);

        return {
            results,
            total: {
                formatted: totalFormatted,
                seconds: totalHoursSeconds
            },
            dateRange: { start, end },
            gitUsername
        };
    }
}

module.exports = GiveMeHours;

// This block allows the script to be run directly from the command line
if (require.main === module) {
    async function main() {
        try {
            // Get directory from command line arguments, or use current directory
            const directoryPath = process.argv[2] || process.cwd();
            const dateArg = process.argv[3] || 'today';

            console.log(`Calculating hours for "${directoryPath}" for "${dateArg}"...`);

            const giveMeHours = new GiveMeHours({
                duration: 3600,      // Default: 1 hour
                hoursRounding: 0.25, // Default: 15 minutes
                projectStartupTime: 0.5, // Default: 30 minutes
                showSummary: true,
                maxWords: 50,
                debug: true       // Enable debug mode
            });

            const result = await giveMeHours.getHoursForDirectory(directoryPath, dateArg);


            console.log(`
---

Results for ${result.dateRange.start} to ${result.dateRange.end} ---
`);
            console.log(`Git Username: ${result.gitUsername}
`);

            if (result.results.length > 0) {
                result.results.forEach(res => {
                    console.log(`- ${res.folder}: ${res.hours}`);
                    if (res.summary) {
                        console.log(`  Summary: ${res.summary}`);
                    }
                });
                console.log(`
Total: ${result.total.formatted}`);
            } else {
                console.log('No activity found for the specified period.');
            }

        } catch (error) {
            console.error(`
Error: ${error.message}`);
            process.exit(1);
        }
    }

    main();
}
