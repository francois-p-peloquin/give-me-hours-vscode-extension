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
        message = message.indexOf('Merge pull request') == 0 ? message.split('/').pop().trim() : message;
        // message = message.replace(/Merge branch '\w+' of .*/, '');

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
        const lines = [...commitsOutput];
        const allCommits = [];

        for (const line in lines) {
            let message = lines[line];
            const isMergeCommit = message.indexOf('Merge') == 0;
            const sanitizedMessage = this.sanitizeMessage(message);
            if (sanitizedMessage && sanitizedMessage.length > 0) {
                allCommits.push({ message: sanitizedMessage, isMergeCommit });
            }
        }

        const mergeCommitMessages = allCommits
            .filter(commit => commit.isMergeCommit)
            .map(commit => commit.message);

        const subCommits = allCommits.filter(commit => !commit.isMergeCommit);

        let summaryMessages = [...mergeCommitMessages];

        let wordCount = summaryMessages.join(' ').split(' ').length;

        // TODO: Actual summary service. For now, just concatenates messages until maxWords is reached.
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
