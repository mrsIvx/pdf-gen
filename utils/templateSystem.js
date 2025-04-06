// utils/templateSystem.js
class Template {
  constructor(config) {
    this.name = config.name || 'Unnamed Template';
    this.description = config.description || '';
    this.file = config.file || '';
    this.icon = config.icon || '📄';
    this.fields = Object.entries(config.fields || {}).reduce((acc, [key, field]) => {
      acc[key] = {
        ...field,
        type: field.type || 'text',
        font: field.type === 'text' ? (field.font || 'Helvetica') : undefined,
        fontSize: field.type === 'text' ? (field.fontSize || 12) : undefined,
        defaultValue: field.defaultValue || '',
        positions: (field.positions || []).map(pos => ({
          page: pos.page || 0,
          x: pos.x || 0,
          y: pos.y || 0,
          font: field.type === 'text' ? (pos.font || field.font || 'Helvetica') : undefined,
          fontSize: field.type === 'text' ? (pos.fontSize || field.fontSize || 12) : undefined,
          rotation: pos.rotation || 0,
          scale: pos.scale || 100
        }))
      };
      return acc;
    }, {});
  }

  validateFormData(formData, fieldVisibility = {}) {
    if (!formData || typeof formData !== 'object') {
      return ['Invalid form data: formData must be an object'];
    }

    const errors = Object.entries(this.fields)
      .filter(([key, field]) => {
        // Skip validation for fields that are not visible
        if (fieldVisibility[key] === false) return false;

        const value = formData[key];
        const isMissing = field.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));
        if (isMissing) {
          console.log(`Validation failed for ${key}: value='${value}' (required: ${field.required})`);
        }
        return isMissing;
      })
      .map(([key, field]) => `${field.label} (key: ${key}) is required`);
    
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
    }
    return errors;
  }
}

module.exports = { Template, createTemplate: config => new Template(config) };