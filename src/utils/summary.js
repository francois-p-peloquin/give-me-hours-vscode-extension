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

    generateSummary(commits) {
        const allCommits = commits.map(commit => {
            return {
                ...commit,
                message: this.sanitizeMessage(commit.message),
                isMergeCommit: commit.message.indexOf('Merge') === 0
            };
        }).filter(commit => commit.message.length > 0);

        const mergeCommitMessages = allCommits
            .filter(commit => commit.isMergeCommit)
            .map(commit => commit.message);

        const subCommits = allCommits.filter(commit => !commit.isMergeCommit);

        // Group commits by branch
        const commitsByBranch = subCommits.reduce((acc, commit) => {
            const branch = commit.branch || 'other';
            if (!acc[branch]) {
                acc[branch] = [];
            }
            acc[branch].push(commit);
            return acc;
        }, {});

        const summaryGroups = [];
        if (mergeCommitMessages.length > 0) {
            summaryGroups.push(mergeCommitMessages.join('; '));
        }

        const formatBranchName = (branchName) => {
            if (!branchName || branchName === 'other') return '';
            // hotfix/my-feature -> Hotfix - my feature
            return branchName.split(/[-/]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' - ') + ':';
        };

        for (const branch in commitsByBranch) {
            const branchGroup = [];
            if (branch !== 'master' && branch !== 'dev' && branch !== 'staging' && branch !== 'other') {
                branchGroup.push(formatBranchName(branch));
            }

            const commitMessages = commitsByBranch[branch].map(c => c.message);
            branchGroup.push(commitMessages.join('; '));

            summaryGroups.push(branchGroup.join(' '));
        }
        
        let summary = summaryGroups.join('\n\n');
        const words = summary.split(/\s+/);
        if (words.length > this.maxWords) {
            summary = words.slice(0, this.maxWords).join(' ') + '...';
        }

        return summary;
    }
}

module.exports = Summary;
