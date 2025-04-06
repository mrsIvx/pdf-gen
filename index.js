// index.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const cors = require('cors');
const { loadTemplates, saveTemplates } = require('./config/index');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fontkit = require('fontkit');
const { Template } = require('./utils/templateSystem');
const { generatePDF } = require('./utils/pdfGenerator');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Configure static file serving
app.use(express.static(path.join(__dirname, 'public'), { 
    index: false,
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));

const upload = multer({
  dest: 'public/templates/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const fontUpload = multer({ 
    dest: 'public/fonts/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'font/ttf' || file.mimetype === 'font/otf' || 
            file.originalname.endsWith('.ttf') || file.originalname.endsWith('.otf')) {
            cb(null, true);
        } else {
            cb(new Error('Only .ttf and .otf files are allowed'));
        }
    }
});

const imageUpload = multer({
  dest: 'public/uploads/',
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use(express.json());

let templates = {};

const initTemplates = async () => {
  try {
    const rawTemplates = await loadTemplates();
    templates = Object.entries(rawTemplates).reduce((acc, [id, config]) => {
      acc[id] = new Template(config);
      return acc;
    }, {});
    console.log('Templates initialized:', Object.keys(templates));
  } catch (error) {
    console.error('Failed to initialize templates:', error.message);
    throw error;
  }
};

const handleError = (res, error, context, status = 500) => {
  console.error(`Error in ${context}:`, error.message);
  res.status(status).json({ success: false, error: error.message, context });
};

// Add function to generate next template ID
const generateNextTemplateId = (templates) => {
  const existingIds = Object.keys(templates)
    .map(id => parseInt(id.replace('template', '')))
    .filter(id => !isNaN(id));
  
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  return `template${maxId + 1}`;
};

// Initialize templates and start server
const startServer = async () => {
  try {
    await initTemplates();
    await initFonts();
    await initUploads();

    // API Routes
    app.get('/api/templates', async (req, res) => {
      try {
        const templatesData = await loadTemplates();
        res.json(templatesData);
      } catch (error) {
        handleError(res, error, 'Fetch Templates', 500);
      }
    });

    app.post('/api/admin/templates', upload.single('pdfFile'), async (req, res) => {
      try {
        const { name, description, icon } = req.body;
        if (!name || !description || !icon || !req.file) {
          throw new Error('Missing required fields: name, description, icon, or PDF file');
        }

        const templateId = generateNextTemplateId(templates);
        const newFileName = `${templateId}.pdf`;
        const oldPath = path.join(__dirname, 'public/templates', req.file.filename);
        const newPath = path.join(__dirname, 'public/templates', newFileName);

        await fs.rename(oldPath, newPath);

        const config = { name, description, file: newFileName, icon, fields: {} };
        templates[templateId] = new Template(config);
        await saveTemplates(templates);

        res.json({ success: true, templateId });
      } catch (error) {
        if (req.file) await fs.unlink(path.join(__dirname, 'public/templates', req.file.filename)).catch(() => {});
        handleError(res, error, 'Add Template', 400);
      }
    });

    app.put('/api/admin/templates/:templateId', async (req, res) => {
      try {
        const { templateId } = req.params;
        const { fields } = req.body;
        if (!templates[templateId]) throw new Error('Template not found');
        if (!fields || typeof fields !== 'object') throw new Error('Invalid fields object');

        templates[templateId].fields = fields;
        await saveTemplates(templates);

        res.json({ success: true, templateId });
      } catch (error) {
        handleError(res, error, 'Update Template', 400);
      }
    });

    app.delete('/api/admin/templates/:templateId', async (req, res) => {
      try {
        const { templateId } = req.params;
        if (!templates[templateId]) throw new Error('Template not found');

        // Delete the template file
        const templateFile = path.join(__dirname, 'public/templates', templates[templateId].file);
        await fs.unlink(templateFile).catch(err => console.error('Error deleting template file:', err));

        // Remove template from memory and save
        delete templates[templateId];
        await saveTemplates(templates);

        res.json({ success: true, templateId });
      } catch (error) {
        handleError(res, error, 'Delete Template', 400);
      }
    });

    app.put('/api/admin/templates/:templateId/fields/:fieldId/positions', async (req, res) => {
      try {
        const { templateId, fieldId } = req.params;
        const { positions } = req.body;

        console.log('Position update request received:', {
          templateId,
          fieldId,
          positions,
          body: req.body
        });

        if (!templates[templateId]) throw new Error('Template not found');
        if (!templates[templateId].fields[fieldId]) throw new Error('Field not found');
        if (!Array.isArray(positions)) throw new Error('Positions must be an array');

        const field = templates[templateId].fields[fieldId];
        const isImageField = field.type === 'image';

        console.log('Field details:', {
          fieldType: field.type,
          isImageField,
          currentPositions: field.positions
        });

        // Validate each position
        positions.forEach((pos, index) => {
          if (typeof pos !== 'object') throw new Error(`Position ${index} must be an object`);
          if (typeof pos.page !== 'number') throw new Error(`Position ${index} must have a numeric page`);
          if (typeof pos.x !== 'number') throw new Error(`Position ${index} must have a numeric x coordinate`);
          if (typeof pos.y !== 'number') throw new Error(`Position ${index} must have a numeric y coordinate`);
          
          // Handle optional properties
          if (isImageField) {
            // For image fields, make rotation and scale optional with defaults
            pos.rotation = typeof pos.rotation === 'number' ? pos.rotation : 0;
            pos.scale = typeof pos.scale === 'number' ? pos.scale : 100;
          } else {
            // For text fields, validate font properties
            if (typeof pos.font !== 'string') throw new Error(`Position ${index} must have a font name for text fields`);
            if (typeof pos.fontSize !== 'number') throw new Error(`Position ${index} must have a numeric font size for text fields`);
          }
        });

        // Update positions while preserving other field properties
        templates[templateId].fields[fieldId].positions = positions;
        await saveTemplates(templates);

        // Reload templates to ensure everything is in sync
        const reloadedTemplates = await loadTemplates();
        templates = Object.entries(reloadedTemplates).reduce((acc, [id, config]) => {
          acc[id] = new Template(config);
          return acc;
        }, {});

        console.log('Updated positions for field:', {
          fieldId,
          templateId,
          newPositions: templates[templateId].fields[fieldId].positions
        });

        res.json({ 
          success: true, 
          templateId, 
          fieldId,
          positions: templates[templateId].fields[fieldId].positions 
        });
      } catch (error) {
        console.error('Error updating positions:', error);
        handleError(res, error, 'Update Field Positions', 400);
      }
    });

    app.post('/api/generate/:templateId', async (req, res) => {
      try {
        const { templateId } = req.params;
        const { formData, fieldVisibility, fieldBlur } = req.body;

        if (!templates[templateId]) {
          throw new Error('Template not found');
        }

        // Validate form data considering field visibility
        const validationErrors = templates[templateId].validateFormData(formData, fieldVisibility);
        if (validationErrors.length > 0) {
          throw new Error('Validation failed: ' + validationErrors[0]);
        }

        // Generate PDF
        const pdfBytes = await generatePDF(templates[templateId], formData, fieldVisibility, fieldBlur);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment');
        res.send(Buffer.from(pdfBytes));
      } catch (error) {
        handleError(res, error, 'Generate PDF', 400);
      }
    });

    app.get('/api/preview/:templateId', async (req, res) => {
      try {
        const { templateId } = req.params;
        console.log('Generating preview for template:', templateId);
        
        // Set CORS headers explicitly for this endpoint
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        const templates = await loadTemplates();
        const template = templates[templateId];

        if (!template) {
          console.error('Template not found:', templateId);
          return res.status(404).json({ error: 'Template not found' });
        }

        // Initialize default field visibility and blur settings
        const fieldVisibility = {};
        const fieldBlur = {};
        Object.keys(template.fields).forEach(key => {
          fieldVisibility[key] = true;
          fieldBlur[key] = false;
        });

        // Generate preview with default values and settings
        const previewData = await generatePDF(template, {}, fieldVisibility, fieldBlur);
        
        // Send the preview data
        res.json({
          template: template,
          previewUrl: `/api/preview/${templateId}/pdf`,
          success: true
        });
      } catch (error) {
        console.error('Preview generation error:', error);
        res.status(500).json({ 
          error: 'Failed to generate preview',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          success: false
        });
      }
    });

    // Add PDF preview endpoint
    app.get('/api/preview/:templateId/pdf', async (req, res) => {
      try {
        const { templateId } = req.params;
        
        // Set CORS headers explicitly for this endpoint
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        const templates = await loadTemplates();
        const template = templates[templateId];

        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        // Initialize default field visibility and blur settings
        const fieldVisibility = {};
        const fieldBlur = {};
        Object.keys(template.fields).forEach(key => {
          fieldVisibility[key] = true;
          fieldBlur[key] = false;
        });

        // Generate preview with default values and settings
        const pdfBytes = await generatePDF(template, {}, fieldVisibility, fieldBlur);
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=preview.pdf');
        
        // Send the PDF
        res.send(Buffer.from(pdfBytes));
      } catch (error) {
        console.error('PDF preview generation error:', error);
        res.status(500).json({ 
          error: 'Failed to generate PDF preview',
          details: error.message,
          success: false
        });
      }
    });

    // Font Management API Routes
    app.get('/api/admin/fonts', async (req, res) => {
      try {
        const fonts = await loadCustomFonts();
        res.json(fonts);
      } catch (error) {
        handleError(res, error, 'Fetch Fonts', 500);
      }
    });

    app.post('/api/admin/fonts', fontUpload.single('fontFile'), async (req, res) => {
      try {
        const { name } = req.body;
        if (!name || !req.file) {
          throw new Error('Missing required fields: name and font file');
        }

        const newFileName = `${name.toLowerCase().replace(/\s+/g, '_')}${path.extname(req.file.originalname)}`;
        const oldPath = path.join(__dirname, 'public/fonts', req.file.filename);
        const newPath = path.join(__dirname, 'public/fonts', newFileName);

        await fs.rename(oldPath, newPath);
        await saveFonts([...await loadCustomFonts(), { name, file: newFileName }]);

        res.json({ success: true, name });
      } catch (error) {
        if (req.file) await fs.unlink(path.join(__dirname, 'public/fonts', req.file.filename)).catch(() => {});
        handleError(res, error, 'Add Font', 400);
      }
    });

    // Frontend Routes
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.get('/admin', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.post('/api/upload/image', imageUpload.single('image'), async (req, res) => {
      try {
        if (!req.file) {
          throw new Error('No image file uploaded');
        }

        const newFileName = `${Date.now()}-${req.file.originalname}`;
        const oldPath = path.join(__dirname, 'public/uploads', req.file.filename);
        const newPath = path.join(__dirname, 'public/uploads', newFileName);

        await fs.rename(oldPath, newPath);

        res.json({ 
          success: true, 
          fileName: newFileName,
          url: `/uploads/${newFileName}`
        });
      } catch (error) {
        if (req.file) {
          await fs.unlink(path.join(__dirname, 'public/uploads', req.file.filename)).catch(() => {});
        }
        handleError(res, error, 'Upload Image', 400);
      }
    });

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

// Font Management Functions
const initFonts = async () => {
  try {
    await fs.mkdir(path.join(__dirname, 'public/fonts'), { recursive: true });
  } catch (error) {
    console.error('Error initializing fonts directory:', error);
  }
};

const loadCustomFonts = async () => {
  try {
    const fontsPath = path.join(__dirname, 'public/fonts', 'fonts.json');
    const data = await fs.readFile(fontsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const saveFonts = async (fonts) => {
  const fontsPath = path.join(__dirname, 'public/fonts', 'fonts.json');
  await fs.writeFile(fontsPath, JSON.stringify(fonts, null, 2));
};

const initUploads = async () => {
  try {
    await fs.mkdir(path.join(__dirname, 'public/uploads'), { recursive: true });
  } catch (error) {
    console.error('Error initializing uploads directory:', error);
  }
};

startServer();