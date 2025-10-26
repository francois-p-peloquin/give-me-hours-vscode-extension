const {
    execSync
} = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

class Summary {
    constructor(options = {}) {
        this.maxWords = options.maxWords || 50;
    }

    sanitizeMessage(message) {
        // Sanitize Merge/PR names
        message = message.replace(/Merge pull request #\d+ from \w+\//, '');
        message = message.replace(/Merge branch '\w+' of .*/, '');

        // Replace hyphens and underscores with spaces
        message = message.replace(/[-_]/g, ' ');

        // Remove unnecessary words
        const stopWords = ['ditto', 'almost there', 'stable', 'ready'];
        const words = message.split(' ');
        const filteredWords = words.filter(word => !stopWords.includes(word.toLowerCase()));
        message = filteredWords.join(' ');

        return message.trim();
    }

    generateSummary(commitsOutput) {
        const lines = commitsOutput.split('\n').filter(line => line.trim());
        const messages = [];
        const mergeCommits = [];

        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 3) {
                let message = parts[2].trim();
                message = this.sanitizeMessage(message);
                if (message && !messages.includes(message)) {
                    if (message.startsWith('Merge pull request') || message.startsWith('Merge branch')) {
                        mergeCommits.push(message);
                    } else {
                        messages.push(message);
                    }
                }
            }
        }

        // Prioritize merge commits
        const prioritizedMessages = [...mergeCommits, ...messages];

        // Join messages with semicolons and limit by word count
        const summary = prioritizedMessages.join('; ');
        const words = summary.split(' ');

        if (words.length > this.maxWords) {
            return words.slice(0, this.maxWords).join(' ') + '...';
        }

        return summary;
    }
}

module.exports = Summary;
