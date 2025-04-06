const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { generatePDF } = require('./utils/pdfGenerator');

const app = express();

app.post('/generate-pdf', async (req, res) => {
    try {
        const { template, formData, fieldVisibility, fieldBlur } = req.body;
        
        console.log('Received request to generate PDF:', {
            template: template.name,
            formFields: Object.keys(formData),
            visibleFields: Object.keys(fieldVisibility).filter(k => fieldVisibility[k]),
            blurredFields: Object.keys(fieldBlur).filter(k => fieldBlur[k])
        });

        // Validate required fields for visible fields only
        const errors = {};
        Object.entries(template.fields).forEach(([fieldName, field]) => {
            if (fieldVisibility[fieldName] === false) return; // Skip validation for invisible fields
            
            if (field.required && (!formData[fieldName] || formData[fieldName].trim() === '')) {
                errors[fieldName] = 'This field is required';
            }
        });

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        const pdfBytes = await generatePDF(template, formData, fieldVisibility, fieldBlur);
        
        // Set appropriate headers for better iOS compatibility
        const filename = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const userAgent = req.headers['user-agent'] || '';
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', Buffer.from(pdfBytes).length);
        
        if (isIOS) {
            // For iOS devices, set to inline to let iOS handle it natively
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        } else {
            // For other devices, use attachment
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        }
        
        // Send the PDF
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

module.exports = app; 