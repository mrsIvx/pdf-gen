// utils/pdfGenerator.js
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const fontkit = require('fontkit'); // Import fontkit
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

async function blurImage(imagePath) {
    try {
        const outputPath = imagePath.replace(/\.[^.]+$/, '_blurred$&');
        // First resize the image by 1.3x, then apply blur
        const command = `magick "${imagePath}" -resize 130% -blur 50x50 "${outputPath}"`;
        console.log('Executing blur command:', command);
        await execPromise(command);
        return outputPath;
    } catch (error) {
        console.error('Error blurring image:', error);
        throw error;
    }
}

async function blurText(pdfDoc, text, position, font, blurAmount = 20) {
    try {
        console.log('Blur text called with:', { 
            text, 
            fontName: font?.name || 'undefined',
            positionFont: position.font
        });

        if (!font) {
            throw new Error('No font provided to blurText');
        }

        // Calculate text dimensions more reliably
        const fontSize = position.fontSize || 12;
        const textWidth = font.widthOfTextAtSize(text, fontSize) * 1.2;
        const textHeight = fontSize * 1.2;

        // Add minimal padding to avoid text clipping
        const padding = Math.ceil(fontSize * 0.2)
        const pageWidth = textWidth
        const pageHeight = textHeight 

        console.log('Text dimensions for blurring:', {
            text,
            fontSize,
            textWidth,
            textHeight,
            pageWidth,
            pageHeight,
            fontName: font.name
        });

        // Create a new PDF document for the text
        const textDoc = await PDFDocument.create();
        textDoc.registerFontkit(fontkit);

        let embedFont;
        // Try to copy the font from the original document first
        try {
            const fontBytes = await font.save();
            embedFont = await textDoc.embedFont(fontBytes);
            console.log('Successfully copied original font for blurring:', font.name);
        } catch (error) {
            console.log('Could not copy original font for blurring, trying to load from cache:', error.message);
            
            try {
                // Try to load the font using the same font loading logic
                embedFont = await loadFont(textDoc, position.font);
                console.log('Successfully loaded font from cache for blurring:', position.font);
            } catch (loadError) {
                console.error('Failed to load font from cache for blurring:', loadError);
                // Fall back to original font as last resort
                embedFont = font;
            }
        }

        // Create temporary page and draw text
        const tempPage = textDoc.addPage([pageWidth, pageHeight]);
        tempPage.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: rgb(1, 1, 1)
        });

        tempPage.drawText(text, {
            x: padding,
            y: padding,
            size: fontSize,
            font: embedFont,
            color: rgb(0, 0, 0)
        });

        // Save temporary PDF
        const tempDir = path.join(__dirname, '..', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempPdfPath = path.join(tempDir, `text_${Date.now()}.pdf`);
        const tempPdfBytes = await textDoc.save();
        await fs.writeFile(tempPdfPath, tempPdfBytes);
        console.log('Temporary PDF created at:', tempPdfPath);

        // Convert PDF to image and blur it
        const tempImagePath = tempPdfPath.replace('.pdf', '.png');
        const blurredImagePath = tempPdfPath.replace('.pdf', '_blurred.png');

        try {
            // Convert PDF to PNG with higher density for better quality
            const convertCommand = `magick convert -density 300 "${tempPdfPath}" -quality 100 "${tempImagePath}"`;
            console.log('Running ImageMagick convert command:', convertCommand);
            await execPromise(convertCommand);
            
            console.log('Checking if PNG was created successfully');
            const fileStats = await fs.stat(tempImagePath);
            console.log('PNG file created with size:', fileStats.size);
            
            // Reduced blur values to very light blur
            const blurCommand = `magick convert "${tempImagePath}" -blur ${blurAmount/4}x${blurAmount/4} "${blurredImagePath}"`;
            console.log('Running ImageMagick blur command:', blurCommand);
            await execPromise(blurCommand);
            
            console.log('Checking if blurred image was created successfully');
            const blurredStats = await fs.stat(blurredImagePath);
            console.log('Blurred image created with size:', blurredStats.size);
            
            // Load the blurred image back
            const blurredImageBytes = await fs.readFile(blurredImagePath);
            const blurredImage = await pdfDoc.embedPng(blurredImageBytes);
            console.log('Successfully embedded blurred image into PDF');

            return {
                image: blurredImage,
                originalWidth: textWidth,
                originalHeight: textHeight,
                x: position.x,
                y: position.y
            };
        } catch (error) {
            console.error('Error in image processing during blur:', error);
            throw error;
        } finally {
            // Clean up temporary files
            Promise.all([
                fs.unlink(tempPdfPath).catch(e => console.error('Failed to delete temp PDF:', e)),
                fs.unlink(tempImagePath).catch(e => console.error('Failed to delete temp PNG:', e)),
                fs.unlink(blurredImagePath).catch(e => console.error('Failed to delete blurred PNG:', e))
            ]).catch(console.error);
        }
    } catch (error) {
        console.error('Error in blurText:', error);
        throw error;
    }
}

async function loadFont(pdfDoc, fontName) {
  console.log('Loading font:', fontName);
  
  // Standard font mapping
  const standardFontMap = {
    'Courier': StandardFonts.Courier,
    'CourierBold': StandardFonts.CourierBold,
    'CourierOblique': StandardFonts.CourierOblique,
    'CourierBoldOblique': StandardFonts.CourierBoldOblique,
    'Helvetica': StandardFonts.Helvetica,
    'HelveticaBold': StandardFonts.HelveticaBold,
    'HelveticaOblique': StandardFonts.HelveticaOblique,
    'HelveticaBoldOblique': StandardFonts.HelveticaBoldOblique,
    'TimesRoman': StandardFonts.TimesRoman,
    'Times-Roman': StandardFonts.TimesRoman, // Backward compatibility
    'TimesBold': StandardFonts.TimesBold,
    'TimesItalic': StandardFonts.TimesItalic,
    'TimesBoldItalic': StandardFonts.TimesBoldItalic,
    'Symbol': StandardFonts.Symbol,
    'ZapfDingbats': StandardFonts.ZapfDingbats
  };

  try {
    // Validate fontName to prevent 'undefined'
    if (!fontName) {
      console.warn('Font name is undefined, defaulting to Helvetica');
      return await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    if (standardFontMap[fontName]) {
      console.log('Using standard font:', fontName);
      return await pdfDoc.embedFont(standardFontMap[fontName]);
    } else {
      // Try to load custom font from fonts.json
      try {
        const fontsPath = path.join(__dirname, '..', 'public', 'fonts', 'fonts.json');
        console.log('Reading fonts.json from:', fontsPath);
        const fontsData = await fs.readFile(fontsPath, 'utf8');
        const customFonts = JSON.parse(fontsData);
        console.log('Available custom fonts:', customFonts);
        const customFont = customFonts.find(font => font.name === fontName);
        
        if (customFont) {
          console.log('Found custom font:', customFont);
          const fontPath = path.join(__dirname, '..', 'public', 'fonts', customFont.file);
          console.log('Loading font file from:', fontPath);
          const fontBytes = await fs.readFile(fontPath);
          console.log('Font file size:', fontBytes.length);
          
          // Try embedding without subsetting first
          try {
            console.log('Attempting to embed font without subsetting...');
            const embeddedFont = await pdfDoc.embedFont(fontBytes);
            console.log('Font embedded successfully without subsetting');
            return embeddedFont;
          } catch (noSubsetError) {
            console.log('Failed to embed without subsetting, trying with subsetting:', noSubsetError.message);
            // If that fails, try with subsetting but without fontkit
            try {
              const embeddedFont = await pdfDoc.embedFont(fontBytes, { subset: true });
              console.log('Font embedded successfully with subsetting');
              return embeddedFont;
            } catch (subsetError) {
              console.error('Failed to embed with subsetting:', subsetError.message);
            }
          }
        } else {
          console.log('Custom font not found in fonts.json:', fontName);
        }
      } catch (error) {
        console.error(`Error loading custom font '${fontName}':`, error.message);
      }
      
      console.warn(`Font '${fontName}' not found, defaulting to Helvetica`);
      return await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  } catch (error) {
    console.error(`Error loading font '${fontName}':`, error.message);
    return await pdfDoc.embedFont(StandardFonts.Helvetica); // Fallback to Helvetica on error
  }
}

function getPage(pdfDoc, pageNumber) {
  return pageNumber >= pdfDoc.getPageCount() ? pdfDoc.addPage() : pdfDoc.getPage(pageNumber);
}

function drawTextOnPage(page, text, position, font) {
  console.log('Drawing text:', {
    text,
    position,
    font: font ? 'Font loaded' : 'No font',
    fontSize: position.fontSize
  });
  
  page.drawText(text, {
    x: position.x,
    y: position.y,
    size: position.fontSize,
    font,
    color: require('pdf-lib').rgb(0, 0, 0)
  });
}

function formatDate(dateString, format = 'yyyy-mm-dd', separator = '-') {
  const [year, month, day] = dateString.split(/[-\/]/);
  const parts = { 'yyyy': year, 'mm': month, 'dd': day };
  const formatParts = format.split(/[-:./]/);
  return formatParts.map(part => parts[part] || part).join(separator);
}

async function loadImage(pdfDoc, imagePath) {
  try {
    const imageBytes = await fs.readFile(imagePath);
    const extension = path.extname(imagePath).toLowerCase();
    
    if (extension === '.jpg' || extension === '.jpeg') {
      return await pdfDoc.embedJpg(imageBytes);
    } else if (extension === '.png') {
      return await pdfDoc.embedPng(imageBytes);
    } else {
      throw new Error(`Unsupported image format: ${extension}`);
    }
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error.message);
    throw error;
  }
}

async function drawImageOnPage(page, image, position) {
  const { width, height } = page.getSize();
  const { width: imgWidth, height: imgHeight } = image.size();
  
  // Calculate scale
  const scale = (position.scale || 100) / 100;
  
  // Calculate dimensions after scaling
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  
  // Draw the image with rotation
  page.drawImage(image, {
    x: position.x,
    y: position.y,
    width: scaledWidth,
    height: scaledHeight,
    rotate: degrees(position.rotation || 0)
  });
}

async function generatePDF(template, formData, fieldVisibility = {}, fieldBlur = {}, blurOptions = {}) {
  try {
    console.log('Generating PDF with:', {
      template: {
        name: template.name,
        fields: template.fields
      },
      formData,
      fieldVisibility,
      fieldBlur,
      blurOptions
    });

    // Default blur settings
    const defaultBlurOptions = {
      textBlur: 40,     // New reduced value
      imageBlur: 10,
    };

    // Merge default options with provided options
    const finalBlurOptions = { ...defaultBlurOptions, ...blurOptions };

    const templatePath = path.join(__dirname, '..', 'public', 'templates', template.file);
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    pdfDoc.registerFontkit(fontkit);

    const fontCache = {};
    const imageCache = {};
    const blurredImageCache = {};

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '..', 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Pre-load all fonts and images for visible fields
    for (const [fieldName, field] of Object.entries(template.fields)) {
      if (fieldVisibility[fieldName] === false) continue;

      if (field.type === 'text') {
        for (const position of field.positions) {
          const fontToLoad = position.font || field.font || 'Helvetica';
          fontCache[fontToLoad] = fontCache[fontToLoad] || await loadFont(pdfDoc, fontToLoad);
        }
      } else if (field.type === 'image') {
        const value = (formData[fieldName] !== undefined && formData[fieldName] !== '') 
          ? formData[fieldName] 
          : field.defaultValue;
          
        if (value) {
          const imagePath = path.join(__dirname, '..', 'public', 'uploads', value);
          try {
            if (fieldBlur[fieldName]) {
              console.log(`Blurring image for field ${fieldName}`);
              const blurredPath = await blurImage(imagePath, finalBlurOptions.imageBlur);
              blurredImageCache[fieldName] = await loadImage(pdfDoc, blurredPath);
              await fs.unlink(blurredPath).catch(console.error);
            } else {
              imageCache[fieldName] = await loadImage(pdfDoc, imagePath);
            }
          } catch (error) {
            console.error(`Failed to load/blur image for field ${fieldName}:`, error);
          }
        }
      }
    }

    // Process visible fields
    for (const [fieldName, field] of Object.entries(template.fields)) {
      if (fieldVisibility[fieldName] === false) continue;

      // Get the actual value to be used (user input or default)
      const value = (formData[fieldName] !== undefined && formData[fieldName] !== '') 
        ? formData[fieldName] 
        : (field.defaultValue || '');

      for (const position of field.positions) {
        const page = getPage(pdfDoc, position.page);
        
        if (field.type === 'text') {
          let textToRender = value;
          
          // Format date if needed
          if (field.type === 'date' && value) {
            textToRender = formatDate(value, position.dateFormat || 'yyyy-mm-dd', position.dateSeparator || '-');
          }
          
          if (textToRender && textToRender.trim().length > 0) {
            const fontToUse = position.font || field.font || 'Helvetica';
            console.log(`Processing field ${fieldName} with value "${textToRender}", blur: ${fieldBlur[fieldName]}`);
            
            if (fieldBlur[fieldName]) {
              try {
                console.log(`Blurring text for field ${fieldName} with font ${fontToUse}`);
                const blurred = await blurText(
                  pdfDoc, 
                  textToRender, 
                  {
                    ...position,
                    font: fontToUse // Ensure font name is passed
                  }, 
                  fontCache[fontToUse], // Pass the actual font object
                  finalBlurOptions.textBlur
                );

                page.drawImage(blurred.image, {
                  x: blurred.x,
                  y: blurred.y,
                  width: blurred.originalWidth,
                  height: blurred.originalHeight
                });
              } catch (error) {
                console.error(`Failed to blur text for field ${fieldName}:`, error);
                // Fallback to drawing unblurred text if blurring fails
                drawTextOnPage(page, textToRender, position, fontCache[fontToUse]);
              }
            } else {
              drawTextOnPage(page, textToRender, position, fontCache[fontToUse]);
            }
          }
        } else if (field.type === 'image') {
          const image = fieldBlur[fieldName] ? blurredImageCache[fieldName] : imageCache[fieldName];
          if (image) {
            console.log('Drawing image for field:', fieldName, 'at position:', position);
            drawImageOnPage(page, image, position);
          }
        }
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

module.exports = { generatePDF };