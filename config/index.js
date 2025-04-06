// config/index.js
const fs = require('fs').promises;
const path = require('path');

// Define loadTemplates function to load templates from a JSON file
async function loadTemplates() {
    try {
        const templatesPath = path.join(__dirname, 'templates.json');
        const data = await fs.readFile(templatesPath, 'utf-8');
        const templates = JSON.parse(data);
        console.log('Loading templates:', JSON.stringify(templates, null, 2));
        return templates;
    } catch (error) {
        throw new Error(`Failed to load templates: ${error.message}`);
    }
}

// Define saveTemplates function to save templates to a JSON file
async function saveTemplates(templates) {
    try {
        const templatesPath = path.join(__dirname, 'templates.json');
        // Convert Template instances back to plain objects
        const rawTemplates = Object.entries(templates).reduce((acc, [id, template]) => {
            acc[id] = {
                name: template.name,
                description: template.description,
                file: template.file,
                icon: template.icon,
                fields: template.fields
            };
            return acc;
        }, {});
        console.log('Saving templates:', JSON.stringify(rawTemplates, null, 2));
        await fs.writeFile(templatesPath, JSON.stringify(rawTemplates, null, 2), 'utf-8');
    } catch (error) {
        throw new Error(`Failed to save templates: ${error.message}`);
    }
}

// Initialize templates
async function initTemplates() {
    try {
        const templates = await loadTemplates();
        // You can add additional initialization logic here if needed
        return templates;
    } catch (error) {
        throw new Error(`Failed to initialize templates: ${error.message}`);
    }
}

// Export the functions for use in main.js and index.js
module.exports = { initTemplates, loadTemplates, saveTemplates };