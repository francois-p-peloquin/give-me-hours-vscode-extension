const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

class GiveMeHours {
    constructor(options = {}) {
        this.duration = options.duration || 3600; // 1 hour in seconds
        this.minCommitTime = options.minCommitTime || 0.5;
        this.debug = options.debug || false;
        this.showSummary = options.showSummary !== undefined ? options.showSummary : true;
        this.maxWords = options.maxWords || 50;
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

    buildGitCommand(fromDate, toDate, author) {
        let cmd = "git log --pretty=format:'%at|%an|%s' --reverse --date=local";
        const formatTimestamp = (date) => {
            return Math.floor(date.getTime() / 1000);
        };
        const since = formatTimestamp(fromDate);
        const until = formatTimestamp(toDate);
        cmd += ` --since=${since} --until=${until} `;

        if (author) {
            cmd += ` --author=\"${author}"`;
        }

        return cmd;
    }

    getGitCommits(fromDate, toDate, author) {
        try {
            const cmd = this.buildGitCommand(fromDate, toDate, author);
            if (this.debug) {
                console.log(`Running: ${cmd}`);
            }
            return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            if (this.debug) {
                console.error(`Error executing git command: ${error.message}`);
                throw error; // Re-throw the error in debug mode
            }
            return '';
        }
    }

    getHoursForRepo(fromDate, toDate, author, repoPath = '.') {
        const originalCwd = process.cwd();

        const defaultReturn = { commits: [] };

        try {
            process.chdir(repoPath);

            // Check if we're in a git repository
            try {
                execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            } catch (error) {
                return defaultReturn;
            }

            const commitsOutput = this.getGitCommits(fromDate, toDate, author);
            if (!commitsOutput) {
                return defaultReturn;
            }

            const processedCommits = commitsOutput.split('\n')
                .filter(line => line.trim())
                .map(line => line.split('|'))
                .map(line => {
                    const commitTimestamp = parseInt(line[0]);
                    const commitDate = new Date(commitTimestamp * 1000);
                    const year = commitDate.getFullYear();
                    const month = String(commitDate.getMonth() + 1).padStart(2, '0');
                    const day = String(commitDate.getDate()).padStart(2, '0');
                    const formattedCommitDate = `${year}-${month}-${day}`;
                    return {
                        timestamp: commitTimestamp,
                        commitDate: formattedCommitDate,
                        author: line[1],
                        message: line[2],
                    };
                });

            return {
                commits: processedCommits,
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    getDateRange(dateArg = 'today') {
        const now = new Date();
        let startDate, endDate;
        const dates = [];

        if (dateArg.includes(':')) {
            const [startStr, endStr] = dateArg.split(':');
            startDate = new Date(startStr);
            endDate = new Date(endStr);
        } else {
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
        }

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return {
            start: startDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            end: endDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
            dates: dates
        };
    }

    processDate(arg = 'today') {
        const now = new Date();
        switch (arg) {
            case 'today':
                    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
                case 'yesterday':
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                default:
                    // Assume YYYY-MM-DD format
                    const dateMatch = dateArg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (dateMatch) {
                        const year = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
                        const day = parseInt(dateMatch[3]);
                        return new Date(year, month, day);
                    } else {
                        console.warn('Invalid date format. Please use YYYY-MM-DD');
                        return now;
                    }
        }
    }

    async getHoursForDirectory(directoryPath, dateArg = 'today') {
        const gitUsername = this.getGitUsername();

        const initialDate = this.processDate(dateArg);
        const day = initialDate.getDay();
        const diff = initialDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday

        const startOfWeek = new Date(initialDate);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        const results = [];
        const folderData = {};

        try {
            // First, check if the directoryPath itself is a git repository
            const isGitRepo = (dir) => {
                try {
                    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'ignore' });
                    return true;
                } catch (e) {
                    return false;
                }
            };

            if (isGitRepo(directoryPath)) {
                if (this.debug) {
                    console.log(`\nChecking git repository: ${directoryPath}`);
                }
                const result = this.getHoursForRepo(startOfWeek, endOfWeek, gitUsername, directoryPath);
                if (result.commits.length) {
                    folderData[path.basename(directoryPath)] = { folder: path.basename(directoryPath), data: [result] };
                }
            }

            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const subDir = path.join(directoryPath, entry.name);
                    if (isGitRepo(subDir)) {
                        if (this.debug) {
                            console.log(`\nChecking git repository: ${subDir}`);
                        }

                        if (!folderData[entry.name]) {
                            folderData[entry.name] = { folder: entry.name, data: [] };
                        }

                        const result = this.getHoursForRepo(startOfWeek, endOfWeek, gitUsername, subDir);

                        if (result.commits.length) {
                            folderData[entry.name].data.push(result);
                        }
                    }
                }
            }

            for (const folderName in folderData) {
                if (folderData[folderName].data.length > 0) {
                    results.push(folderData[folderName]);
                }
            }

            console.log(results);

        } catch (error) {
            throw new Error(`Error reading directory ${directoryPath}: ${error.message}`);
        }

        return {
            results,
            dateRange: { startOfWeek, endOfWeek },
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
                ${JSON.stringify(result, null, 2)}
---

Results for ${result.dateRange.start} to ${result.dateRange.end} ---
`);
            console.log(`Git Username: ${result.gitUsername}
`);

            if (result.results.length > 0) {
                result.results.forEach(res => {
                    console.log(`- ${res.folder}: ${res.hours} (${res.hours})`);
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
