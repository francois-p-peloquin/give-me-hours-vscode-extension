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

        // Remove ending punctuation
        return message.trim().replace(/[.,;:?!]$/, '');
    }

    generateSummary(commitsOutput) {
        const lines = commitsOutput.split('\n').filter(line => line.trim());
        const allCommits = [];

        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 3) {
                let message = parts[2].trim();
                const isMergeCommit = message.startsWith('Merge pull request') || message.startsWith('Merge branch');
                message = this.sanitizeMessage(message);
                if (message && message.length > 0) {
                    allCommits.push({ message, isMergeCommit });
                }
            }
        }

        const mergeCommitMessages = allCommits
            .filter(commit => commit.isMergeCommit)
            .map(commit => commit.message);

        const subCommits = allCommits.filter(commit => !commit.isMergeCommit);

        let summaryMessages = [...mergeCommitMessages];

        let wordCount = summaryMessages.join(' ').split(' ').length;

        for (const commit of subCommits) {
            const message = commit.message;
            const messageWordCount = message.split(' ').length;

            if (wordCount + messageWordCount > this.maxWords) {
                summaryMessages.push('...');
                break;
            }
            summaryMessages.push(message);
            wordCount += messageWordCount;
        }

        return summaryMessages.join('; ');
    }
}

module.exports = Summary;
