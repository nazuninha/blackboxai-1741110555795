const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class Database {
    /**
     * Read data from a JSON file
     * @param {string} filePath - Path to the JSON file
     * @returns {Promise<Object>} Parsed JSON data
     */
    static async read(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, return empty object
                return {};
            }
            logger.error(`Error reading file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Write data to a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {Object} data - Data to write
     * @returns {Promise<void>}
     */
    static async write(filePath, data) {
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // Write data
            await fs.writeFile(
                filePath,
                JSON.stringify(data, null, 2),
                'utf8'
            );
        } catch (error) {
            logger.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Check if a file exists
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} True if file exists
     */
    static async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Add an item to an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayKey - Key of the array in the JSON object
     * @param {Object} item - Item to add
     * @returns {Promise<void>}
     */
    static async addToArray(filePath, arrayKey, item) {
        const data = await this.read(filePath);
        if (!data[arrayKey]) {
            data[arrayKey] = [];
        }
        data[arrayKey].push(item);
        await this.write(filePath, data);
    }

    /**
     * Update items in an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayKey - Key of the array in the JSON object
     * @param {Function} predicate - Function to find items to update
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    static async updateInArray(filePath, arrayKey, predicate, updates) {
        const data = await this.read(filePath);
        if (!data[arrayKey]) {
            data[arrayKey] = [];
        }
        data[arrayKey] = data[arrayKey].map(item => 
            predicate(item) ? { ...item, ...updates } : item
        );
        await this.write(filePath, data);
    }

    /**
     * Remove items from an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayKey - Key of the array in the JSON object
     * @param {Function} predicate - Function to find items to remove
     * @returns {Promise<void>}
     */
    static async removeFromArray(filePath, arrayKey, predicate) {
        const data = await this.read(filePath);
        if (!data[arrayKey]) {
            data[arrayKey] = [];
        }
        data[arrayKey] = data[arrayKey].filter(item => !predicate(item));
        await this.write(filePath, data);
    }

    /**
     * Find items in an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayKey - Key of the array in the JSON object
     * @param {Function} predicate - Function to find items
     * @returns {Promise<Array>} Found items
     */
    static async findInArray(filePath, arrayKey, predicate) {
        const data = await this.read(filePath);
        if (!data[arrayKey]) {
            return [];
        }
        return data[arrayKey].filter(predicate);
    }

    /**
     * Find one item in an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayKey - Key of the array in the JSON object
     * @param {Function} predicate - Function to find the item
     * @returns {Promise<Object|null>} Found item or null
     */
    static async findOneInArray(filePath, arrayKey, predicate) {
        const data = await this.read(filePath);
        if (!data[arrayKey]) {
            return null;
        }
        return data[arrayKey].find(predicate) || null;
    }

    /**
     * Backup a JSON file
     * @param {string} filePath - Path to the JSON file
     * @returns {Promise<string>} Backup file path
     */
    static async backup(filePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}.${timestamp}.backup`;
            
            await fs.copyFile(filePath, backupPath);
            logger.info(`Created backup: ${backupPath}`);
            
            return backupPath;
        } catch (error) {
            logger.error(`Error creating backup for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Restore from a backup file
     * @param {string} backupPath - Path to the backup file
     * @param {string} targetPath - Path to restore to
     * @returns {Promise<void>}
     */
    static async restore(backupPath, targetPath) {
        try {
            await fs.copyFile(backupPath, targetPath);
            logger.info(`Restored from backup: ${backupPath}`);
        } catch (error) {
            logger.error(`Error restoring from backup ${backupPath}:`, error);
            throw error;
        }
    }

    /**
     * Clean up old backup files
     * @param {string} directory - Directory containing backup files
     * @param {number} maxAge - Maximum age in days
     * @returns {Promise<void>}
     */
    static async cleanBackups(directory, maxAge) {
        try {
            const files = await fs.readdir(directory);
            const now = Date.now();
            const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.endsWith('.backup')) {
                    const filePath = path.join(directory, file);
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtime.getTime();

                    if (age > maxAgeMs) {
                        await fs.unlink(filePath);
                        logger.info(`Deleted old backup: ${filePath}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error cleaning backups in ${directory}:`, error);
            throw error;
        }
    }
}

module.exports = Database;
