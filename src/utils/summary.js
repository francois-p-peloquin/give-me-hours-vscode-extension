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

        const rawSummaryGroups = []; // Stores groups as strings, without truncation yet

        const formatBranchName = (branchName) => {
            if (!branchName || branchName === 'other') return '';
            // hotfix/my-feature -> Hotfix - my feature
            return branchName.split(/[-/]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' - ') + ':';
        };

        // Prepare merge commits group
        if (mergeCommitMessages.length > 0) {
            rawSummaryGroups.push(mergeCommitMessages.join('; '));
        }

        // Prepare other branch groups
        for (const branch in commitsByBranch) {
            const branchGroupParts = [];
            if (branch !== 'master' && branch !== 'dev' && branch !== 'staging' && branch !== 'other') {
                branchGroupParts.push(formatBranchName(branch));
            }

            const commitMessages = commitsByBranch[branch].map(c => c.message);
            branchGroupParts.push(commitMessages.join('; '));
            
            rawSummaryGroups.push(branchGroupParts.join(' '));
        }

        const finalSummaryGroups = [];
        let cumulativeWordCount = 0;

        for (let i = 0; i < rawSummaryGroups.length; i++) {
            const group = rawSummaryGroups[i];
            const groupWords = group.split(/\s+/).filter(Boolean);
            
            // Add words for the separator if it's not the first group
            const separatorWords = finalSummaryGroups.length > 0 ? 1 : 0; // Represents the "\n\n" as one "word" for counting purposes

            if (cumulativeWordCount + separatorWords + groupWords.length > this.maxWords) {
                const remainingWords = this.maxWords - (cumulativeWordCount + separatorWords);
                
                if (remainingWords > 0) {
                    finalSummaryGroups.push(groupWords.slice(0, remainingWords).join(' ') + '...');
                } else if (finalSummaryGroups.length > 0) {
                    // If no space for current group, and previous groups filled space, just add '...' to the last group
                    if (!finalSummaryGroups[finalSummaryGroups.length - 1].endsWith('...')) {
                        finalSummaryGroups[finalSummaryGroups.length - 1] += '...';
                    }
                } else {
                    // If even the first group doesn't fit, just an ellipsis
                    finalSummaryGroups.push('...');
                }
                cumulativeWordCount = this.maxWords; // Mark as full
                break; 
            } else {
                finalSummaryGroups.push(group);
                cumulativeWordCount += groupWords.length + separatorWords;
            }
        }
        
        return finalSummaryGroups.join('\n\n');
    }
}

module.exports = Summary;
