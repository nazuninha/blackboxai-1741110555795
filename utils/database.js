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
            
            // Write data with pretty formatting
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error(`Error writing to file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Update specific fields in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {Object} updates - Object containing fields to update
     * @returns {Promise<Object>} Updated data
     */
    static async update(filePath, updates) {
        try {
            const data = await this.read(filePath);
            const updatedData = { ...data, ...updates };
            await this.write(filePath, updatedData);
            return updatedData;
        } catch (error) {
            logger.error(`Error updating file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Delete a JSON file
     * @param {string} filePath - Path to the JSON file
     * @returns {Promise<void>}
     */
    static async delete(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error(`Error deleting file ${filePath}:`, error);
                throw error;
            }
        }
    }

    /**
     * Add an item to an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayField - Name of the array field
     * @param {Object} item - Item to add
     * @returns {Promise<Object>} Updated data
     */
    static async addToArray(filePath, arrayField, item) {
        try {
            const data = await this.read(filePath);
            if (!Array.isArray(data[arrayField])) {
                data[arrayField] = [];
            }
            data[arrayField].push(item);
            await this.write(filePath, data);
            return data;
        } catch (error) {
            logger.error(`Error adding item to array in ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Remove an item from an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayField - Name of the array field
     * @param {function} predicate - Function to identify item to remove
     * @returns {Promise<Object>} Updated data
     */
    static async removeFromArray(filePath, arrayField, predicate) {
        try {
            const data = await this.read(filePath);
            if (Array.isArray(data[arrayField])) {
                data[arrayField] = data[arrayField].filter(item => !predicate(item));
                await this.write(filePath, data);
            }
            return data;
        } catch (error) {
            logger.error(`Error removing item from array in ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Update an item in an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayField - Name of the array field
     * @param {function} predicate - Function to identify item to update
     * @param {Object} updates - Updates to apply to the item
     * @returns {Promise<Object>} Updated data
     */
    static async updateInArray(filePath, arrayField, predicate, updates) {
        try {
            const data = await this.read(filePath);
            if (Array.isArray(data[arrayField])) {
                data[arrayField] = data[arrayField].map(item => 
                    predicate(item) ? { ...item, ...updates } : item
                );
                await this.write(filePath, data);
            }
            return data;
        } catch (error) {
            logger.error(`Error updating item in array in ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Find items in an array in a JSON file
     * @param {string} filePath - Path to the JSON file
     * @param {string} arrayField - Name of the array field
     * @param {function} predicate - Function to filter items
     * @returns {Promise<Array>} Matching items
     */
    static async findInArray(filePath, arrayField, predicate) {
        try {
            const data = await this.read(filePath);
            if (Array.isArray(data[arrayField])) {
                return data[arrayField].filter(predicate);
            }
            return [];
        } catch (error) {
            logger.error(`Error finding items in array in ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Check if a file exists
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} Whether the file exists
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
     * Initialize a JSON file with default data if it doesn't exist
     * @param {string} filePath - Path to the JSON file
     * @param {Object} defaultData - Default data to write
     * @returns {Promise<void>}
     */
    static async initialize(filePath, defaultData) {
        try {
            const exists = await this.exists(filePath);
            if (!exists) {
                await this.write(filePath, defaultData);
            }
        } catch (error) {
            logger.error(`Error initializing file ${filePath}:`, error);
            throw error;
        }
    }
}

module.exports = Database;
