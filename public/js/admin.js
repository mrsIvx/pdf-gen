// public/js/admin.js
const { FormInput, FormSubmitButton, ErrorDisplay, TemplateSelector } = window.FormComponents;

class AdminApp extends React.Component {
    constructor(props) {
        super(props);
        this.positionsSectionRef = React.createRef();
        this.managementSectionRef = React.createRef();
        this.templatesRef = React.createRef();
    }

    state = {
        templates: {},
        selectedTemplate: null,
        newField: { label: '', type: 'text', required: false, font: 'Helvetica', fontSize: 12, positions: [], defaultValue: '', imageFile: null },
        newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 },
        editField: null,
        editPositionIndex: null,
        errors: [],
        success: '',
        showNewTemplateForm: false,
        showNewFontForm: false,
        newTemplate: { name: '', description: '', icon: '📄' },
        newFont: { name: '', file: null },
        pdfFile: null,
        searchTerm: '',
        loading: false,
        draggedField: null,
        previousFields: null,
        isSaving: false,
        showPreview: false,
        previewTemplateId: null,
        isFieldFormExpanded: false,
        isPositionFormExpanded: false,
        isFieldListExpanded: false,
        isTemplateListExpanded: true,
        isManagementExpanded: false,
        customFonts: [],
        previewData: null,
        previewScale: 1.0,
        isGeneratingPreview: false,
        isServerReady: false,
        showDeleteModal: false,
        templateToDelete: null,
        templateSummary: null,
        deleteConfirmationText: ''
    };

    emojiOptions = [
        { value: '📄', label: 'Document' },
        { value: '📋', label: 'Clipboard' },
        { value: '⚖️', label: 'Scales' },
        { value: '📝', label: 'Memo' },
        { value: '✉️', label: 'Envelope' },
        { value: '📅', label: 'Calendar' },
        { value: '✅', label: 'Checkmark' },
        { value: '@', label: 'At Symbol' },
        { value: '📜', label: 'Scroll' }
    ];

    componentDidMount() {
        this._isMounted = true;
        this.checkServerStatus();
        // Add scroll listener
        if (this.managementSectionRef.current) {
            this.managementSectionRef.current.addEventListener('scroll', this.handleScroll);
        }
    }

    componentWillUnmount() {
        this._isMounted = false;
        // Remove scroll listener
        if (this.managementSectionRef.current) {
            this.managementSectionRef.current.removeEventListener('scroll', this.handleScroll);
        }
    }

    handleScroll = () => {
        if (!this.managementSectionRef.current || !this.templatesRef.current) return;
        
        const templatesPosition = this.templatesRef.current.getBoundingClientRect().top;
        const managementSection = this.managementSectionRef.current;
        const goToTopButton = document.querySelector('.go-to-top');
        
        if (goToTopButton) {
            if (templatesPosition < 0) {
                goToTopButton.classList.add('visible');
            } else {
                goToTopButton.classList.remove('visible');
            }
        }
    };

    scrollToTemplates = () => {
        if (this.templatesRef.current) {
            this.templatesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    checkServerStatus = async () => {
        try {
            const response = await fetch('/api/templates');
            if (response.ok) {
                this.setState({ isServerReady: true });
                await this.fetchTemplates();
                await this.fetchCustomFonts();
            } else {
                throw new Error('Server not ready');
            }
        } catch (error) {
            console.error('Server status check failed:', error);
            this.setState({ 
                errors: ['Server is not responding. Please try again later.'],
                isServerReady: false
            });
        }
    };

    fetchTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            if (!response.ok) throw new Error(`Failed to fetch templates: ${response.status}`);
            const templates = await response.json();
            this.setState({ templates, errors: [], loading: false });
        } catch (error) {
            this.setState({ errors: [error.message], loading: false });
            throw error;
        }
    };

    fetchCustomFonts = async () => {
        try {
            const response = await fetch('/api/admin/fonts');
            if (!response.ok) throw new Error('Failed to fetch fonts');
            const fonts = await response.json();
            this.setState({ customFonts: fonts });
        } catch (error) {
            console.error('Error fetching fonts:', error);
        }
    };

    toggleNewTemplateForm = () => {
        this.setState(prev => ({
            showNewTemplateForm: !prev.showNewTemplateForm,
            showNewFontForm: false,
            newTemplate: { name: '', description: '', icon: '📄' },
            pdfFile: null,
            errors: [],
            success: ''
        }));
    };

    handleNewTemplateChange = (e) => {
        const { name, value } = e.target;
        this.setState(prev => ({
            newTemplate: { ...prev.newTemplate, [name]: value }
        }));
    };

    handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.setState({ pdfFile: file, errors: [] });
        } else {
            this.setState({ errors: ['Please upload a valid PDF file'], pdfFile: null });
        }
    };

    addNewTemplate = async () => {
        const { newTemplate, pdfFile } = this.state;
        if (!newTemplate.name || !newTemplate.description || !newTemplate.icon || !pdfFile) {
            return this.setState({ errors: ['All fields and a PDF file are required'] });
        }

        const formData = new FormData();
        formData.append('name', newTemplate.name);
        formData.append('description', newTemplate.description);
        formData.append('icon', newTemplate.icon);
        formData.append('pdfFile', pdfFile);

        try {
            const response = await fetch('/api/admin/templates', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add template');
            }
            await this.fetchTemplates();
            this.setState({
                showNewTemplateForm: false,
                newTemplate: { name: '', description: '', icon: '📄' },
                pdfFile: null,
                errors: [],
                success: 'Template added successfully',
                showUndo: false
            });
        } catch (error) {
            this.setState({ errors: [error.message], success: '' });
        }
    };

    handleTemplateSelect = (templateId) => {
        this.setState({
            selectedTemplate: templateId,
            newField: { 
                label: '', 
                type: 'text', 
                required: false, 
                font: 'Helvetica', 
                fontSize: 12, 
                positions: [], 
                defaultValue: '',
                imageFile: null 
            },
            editField: null,
            errors: [],
            success: '',
            showUndo: false,
            isSaving: false,
            isFieldFormExpanded: false,
            isPositionFormExpanded: false
        });
    };

    handleFieldChange = (e) => {
        const { name, value, type, checked } = e.target;
        const updater = type === 'checkbox' ? checked : (name === 'fontSize' ? (value === '' ? '' : parseInt(value)) : value);
        this.setState(prev => ({
            [prev.editField ? 'editField' : 'newField']: { ...prev[prev.editField ? 'editField' : 'newField'], [name]: updater }
        }));
    };

    handlePositionChange = (e) => {
        const { name, value } = e.target;
        this.setState(prev => ({
            newPosition: {
                ...prev.newPosition,
                [name]: name === 'page' || name === 'x' || name === 'y' || name === 'fontSize' || name === 'rotation' || name === 'scale'
                    ? (value === '' ? '' : parseInt(value) || 0)
                    : value
            }
        }));
    };

    editPosition = (fieldName, positionIndex) => {
        const { templates, selectedTemplate } = this.state;
        const field = templates[selectedTemplate].fields[fieldName];
        const position = field.positions[positionIndex];
        
        this.setState({
            editField: { ...field, key: fieldName },
            editPositionIndex: positionIndex,
            newPosition: {
                page: position.page,
                x: position.x,
                y: position.y,
                font: position.font || field.font,
                fontSize: position.fontSize || field.fontSize,
                rotation: position.rotation || 0,
                scale: position.scale || 100,
                // dateFormat: position.dateFormat || 'yyyy-mm-dd',
                // dateSeparator: position.dateSeparator || '-'
            },
            errors: [],
            success: ''
        });
    };

    updatePosition = async () => {
        const { selectedTemplate, editField, editPositionIndex, newPosition } = this.state;
        if (!selectedTemplate || !editField || editPositionIndex === null) return;

        const fieldName = editField.key;
        const updatedPositions = [...editField.positions];
        
        // Create base position object with required properties
        const positionData = {
            page: parseInt(newPosition.page) || 0,
            x: parseInt(newPosition.x) || 0,
            y: parseInt(newPosition.y) || 0
        };

        // Add type-specific properties
        if (editField.type === 'text') {
            positionData.font = newPosition.font || editField.font;
            positionData.fontSize = parseInt(newPosition.fontSize) || editField.fontSize;
        } else if (editField.type === 'image') {
            positionData.rotation = newPosition.rotation === '' ? 0 : (parseInt(newPosition.rotation) || 0);
            positionData.scale = newPosition.scale === '' ? 100 : (parseInt(newPosition.scale) || 100);
        }

        updatedPositions[editPositionIndex] = positionData;

        try {
            // Update positions
            const posResponse = await fetch(`/api/admin/templates/${selectedTemplate}/fields/${fieldName}/positions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions: updatedPositions })
            });

            if (!posResponse.ok) {
                const errorData = await posResponse.json();
                throw new Error(errorData.error || 'Failed to update position');
            }

            // Update the field
            const updatedFields = {
                ...this.state.templates[selectedTemplate].fields,
                [fieldName]: {
                    ...this.state.templates[selectedTemplate].fields[fieldName],
                    positions: updatedPositions
                }
            };

            const fieldResponse = await fetch(`/api/admin/templates/${selectedTemplate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: updatedFields })
            });

            if (!fieldResponse.ok) {
                const errorData = await fieldResponse.json();
                throw new Error(errorData.error || 'Failed to update field');
            }

            await this.fetchTemplates();
            this.setState(prevState => ({
                success: 'Position and field updated successfully',
                errors: [],
                editPositionIndex: null,
                newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 }
            }), () => {
                if (this._isMounted) {
                    this.updatePreview();
                }
            });
        } catch (error) {
            console.error('Error updating position:', error);
            if (this._isMounted) {
                this.setState({ errors: [error.message], success: '' });
            }
        }
    };

    cancelPositionEdit = () => {
        this.setState({
            editPositionIndex: null,
            newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 }
        });
    };

    addPosition = () => {
        const { newPosition, editField, newField, editPositionIndex } = this.state;
        const target = editField || newField;

        if (!target.key) {
            this.setState({ errors: ['Please save the field first before adding positions'] });
            return;
        }

        if (editPositionIndex !== null) {
            // We're editing an existing position
            this.updatePosition();
        } else {
            // We're adding a new position
            const positionExists = target.positions.some(pos =>
                pos.page === newPosition.page &&
                pos.x === newPosition.x &&
                pos.y === newPosition.y
            );

            if (positionExists) {
                this.setState({ errors: ['This position already exists for the field'] });
                return;
            }

            this.saveNewPosition();
        }
    };

    removePosition = async (index) => {
        const { selectedTemplate, editField, templates } = this.state;
        if (!selectedTemplate || !editField) return;

        const fieldName = editField.key;
        const field = templates[selectedTemplate].fields[fieldName];
        
        // Create a copy of the positions array without the position to be removed
        const updatedPositions = field.positions.filter((_, i) => i !== index);
        
        try {
            const response = await fetch(`/api/admin/templates/${selectedTemplate}/fields/${fieldName}/positions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions: updatedPositions })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to remove position');
            }

            // Update local state with the new positions
            this.setState(prevState => ({
                templates: {
                    ...prevState.templates,
                    [selectedTemplate]: {
                        ...prevState.templates[selectedTemplate],
                        fields: {
                            ...prevState.templates[selectedTemplate].fields,
                            [fieldName]: {
                                ...prevState.templates[selectedTemplate].fields[fieldName],
                                positions: updatedPositions
                            }
                        }
                    }
                },
                editField: {
                    ...editField,
                    positions: updatedPositions
                },
                success: 'Position removed successfully',
                errors: []
            }));
        } catch (error) {
            this.setState({ errors: [error.message], success: '' });
        }
    };

    addOrUpdateField = async () => {
        const { selectedTemplate, newField, editField, templates } = this.state;
        if (!selectedTemplate) return this.setState({ errors: ['Select a template first'] });
        const field = editField || newField;
        if (!field.label) return this.setState({ errors: ['Field label is required'] });
        
        // Only validate font size if it's not empty
        if (field.fontSize !== '' && field.fontSize < 1) {
            return this.setState({ errors: ['Font size must be positive'] });
        }

        // Validate default value for new fields
        if (!editField && !field.defaultValue) {
            return this.setState({ errors: ['Default value is required for new fields'] });
        }

        const fieldName = editField ? editField.key : field.label.toLowerCase().replace(/\s+/g, '_');
        const updatedFields = { ...templates[selectedTemplate].fields };

        // Preserve positions when updating a field
        const existingField = updatedFields[fieldName];
        const positions = existingField ? existingField.positions : [];

        if (!editField && templates[selectedTemplate].fields[fieldName]) {
            return this.setState({ errors: [`Field '${fieldName}' already exists in this template`] });
        }

        // Create the updated field object
        const updatedField = {
            ...field,
            key: fieldName,
            positions: positions // Preserve existing positions
        };

        // Update the field in the fields object
        updatedFields[fieldName] = updatedField;

        await this.updateTemplateFields(updatedFields);
        this.setState({ 
            showUndo: false,
            isFieldFormExpanded: false // Keep the field form collapsed
        }, () => {
            // Trigger preview update after field is added/updated
            if (this._isMounted) {
                this.updatePreview();
            }
        });
    };

    editField = (fieldName) => {
        const field = this.state.templates[this.state.selectedTemplate].fields[fieldName];
        this.setState({
            editField: { ...field, key: fieldName },
            newField: { label: '', type: 'text', required: false, font: 'Helvetica', fontSize: 12, positions: [], defaultValue: '' },
            newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 },
            errors: [],
            success: '',
            showUndo: false,
            isFieldFormExpanded: false,
            isPositionFormExpanded: true // Always expand positions when editing a field
        }, () => {
            // Scroll to positions section after state update
            if (this.positionsSectionRef.current) {
                this.positionsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    };

    removeField = async (fieldName) => {
        const { selectedTemplate, templates } = this.state;
        const updatedFields = { ...templates[selectedTemplate].fields };
        delete updatedFields[fieldName];
        await this.updateTemplateFields(updatedFields);
        this.setState({ showUndo: false });
    };

    updateTemplateFields = async (fields) => {
        const { selectedTemplate } = this.state;
        this.setState({ isSaving: true });
        try {
            const response = await fetch(`/api/admin/templates/${selectedTemplate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update template');
            }
            await this.fetchTemplates();
            this.setState({
                newField: { label: '', type: 'text', required: false, font: 'Helvetica', fontSize: 12, positions: [], defaultValue: '' },
                newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 },
                editField: null,
                errors: [],
                success: 'Fields updated successfully',
                showUndo: false,
                isSaving: false
            });
        } catch (error) {
            this.setState({ errors: [error.message], success: '', isSaving: false });
        }
    };

    handleSearchChange = (e) => this.setState({ searchTerm: e.target.value });

    handleDragStart = (e, fieldName) => {
        this.setState({ draggedField: `field-${fieldName}` });
        e.dataTransfer.setData('text/plain', fieldName);
        const emptyImage = new Image();
        emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(emptyImage, 0, 0);
        e.target.classList.add('dragging');
    };

    handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
        this.setState({ draggedField: null });
    };

    handleDragOver = (e) => {
        e.preventDefault();
    };

    handleDragEnter = (e) => {
        if (e.target.classList.contains('field-item') && !e.target.classList.contains('dragging')) {
            e.target.classList.add('drag-over');
        }
    };

    handleDragLeave = (e) => {
        if (e.target.classList.contains('field-item')) {
            e.target.classList.remove('drag-over');
        }
    };

    handleDrop = async (e, targetFieldName) => {
        e.preventDefault();
        const { draggedField, selectedTemplate, templates } = this.state;
        const draggedFieldName = draggedField ? draggedField.replace('field-', '') : null;
        if (!draggedFieldName || draggedFieldName === targetFieldName) return;

        const fields = { ...templates[selectedTemplate].fields };
        const fieldKeys = Object.keys(fields);
        const draggedIndex = fieldKeys.indexOf(draggedFieldName);
        const targetIndex = fieldKeys.indexOf(targetFieldName);

        const reorderedKeys = [...fieldKeys];
        const [movedField] = reorderedKeys.splice(draggedIndex, 1);
        reorderedKeys.splice(targetIndex, 0, movedField);

        const reorderedFields = {};
        reorderedKeys.forEach(key => {
            reorderedFields[key] = fields[key];
        });

        this.setState({ previousFields: fields, showUndo: true });
        await this.updateTemplateFields(reorderedFields);
        e.target.classList.remove('drag-over');
    };

    handleTouchStart = (e, fieldName) => {
        this.setState({ draggedField: `field-${fieldName}` });
        e.target.classList.add('dragging');
    };

    handleTouchMove = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        document.querySelectorAll('.field-item').forEach(item => item.classList.remove('drag-over'));
        if (target && target.classList.contains('field-item') && !target.classList.contains('dragging')) {
            target.classList.add('drag-over');
        }
    };

    handleTouchEnd = async (e) => {
        const { draggedField, selectedTemplate, templates } = this.state;
        const draggedFieldName = draggedField ? draggedField.replace('field-', '') : null;
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        e.target.classList.remove('dragging');

        if (target && target.classList.contains('field-item')) {
            const targetFieldName = target.getAttribute('data-field-name');
            if (draggedFieldName && targetFieldName && draggedFieldName !== targetFieldName) {
                const fields = { ...templates[selectedTemplate].fields };
                const fieldKeys = Object.keys(fields);
                const draggedIndex = fieldKeys.indexOf(draggedFieldName);
                const targetIndex = fieldKeys.indexOf(targetFieldName);

                const reorderedKeys = [...fieldKeys];
                const [movedField] = reorderedKeys.splice(draggedIndex, 1);
                reorderedKeys.splice(targetIndex, 0, movedField);

                const reorderedFields = {};
                reorderedKeys.forEach(key => {
                    reorderedFields[key] = fields[key];
                });

                this.setState({ previousFields: fields, showUndo: true });
                await this.updateTemplateFields(reorderedFields);
            }
            target.classList.remove('drag-over');
        }
        this.setState({ draggedField: null });
    };

    undoReorder = async () => {
        const { previousFields } = this.state;
        if (previousFields) {
            await this.updateTemplateFields(previousFields);
            this.setState({ previousFields: null, showUndo: false });
        }
    };

    handlePreview = async (templateId) => {
        if (!this._isMounted) return;

        this.setState({ 
            showPreview: true, 
            previewTemplateId: templateId,
            isGeneratingPreview: true,
            previewScale: 1.0,
            previewData: null,
            errors: [],
            selectedTemplate: templateId,
            isFieldListExpanded: true // Expand the field list
        }, async () => {
            await this.generatePreview(templateId);
            // Scroll to the field list section
            const fieldListSection = document.querySelector('.field-management');
            if (fieldListSection) {
                fieldListSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    };

    generatePreview = async (templateId) => {
        if (!this._isMounted) return;
        if (!this.state.isServerReady) {
            this.setState({ 
                errors: ['Server is not ready. Please try again later.'],
                isGeneratingPreview: false
            });
            return;
        }

        try {
            // Get the preview data with retry logic
            let retries = 3;
            let response;
            
            while (retries > 0) {
                try {
                    response = await fetch(`/api/preview/${templateId}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        credentials: 'same-origin'
                    });
                    
                    if (response.ok) break;
                    
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to generate preview: ${response.status}`);
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
                }
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate preview');
            }

            const previewData = await response.json();
            
            if (!previewData.success) {
                throw new Error(previewData.error || 'Preview generation failed');
            }

            if (!previewData.previewUrl) {
                throw new Error('Preview URL not available');
            }

            if (!this._isMounted) return;

            // Set the preview data
            this.setState({ 
                previewData,
                isGeneratingPreview: false,
                errors: []
            });

        } catch (error) {
            console.error('Preview generation error:', error);
            if (this._isMounted) {
                this.setState({ 
                    errors: [error.message],
                    isGeneratingPreview: false,
                    previewData: null
                });
            }
        }
    };

    handlePreviewError = () => {
        this.setState({
            errors: ['Failed to load PDF preview'],
            isGeneratingPreview: false,
            previewData: null
        });
    };

    updatePreview = async () => {
        if (!this._isMounted) return;

        const { selectedTemplate, showPreview } = this.state;
        if (showPreview && selectedTemplate) {
            this.setState({ isGeneratingPreview: true });
            try {
                await this.generatePreview(selectedTemplate);
            } catch (error) {
                console.error('Preview update error:', error);
                if (this._isMounted) {
                    this.setState({
                        errors: ['Failed to update preview'],
                        isGeneratingPreview: false
                    });
                }
            }
        }
    };

    closePreview = () => {
        this.setState({ 
            showPreview: false, 
            previewTemplateId: null,
            previewData: null,
            previewScale: 1.0,
            errors: []
        });
    };

    toggleFieldForm = () => {
        this.setState(prev => ({ isFieldFormExpanded: !prev.isFieldFormExpanded }));
    };

    toggleNewFontForm = () => {
        this.setState(prev => ({
            showNewFontForm: !prev.showNewFontForm,
            showNewTemplateForm: false,
            newFont: { name: '', file: null },
            errors: [],
            success: ''
        }));
    };

    handleNewFontChange = (e) => {
        const { name, value } = e.target;
        this.setState(prev => ({
            newFont: { ...prev.newFont, [name]: value }
        }));
    };

    handleFontFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'font/ttf' || file.type === 'font/otf' || file.name.endsWith('.ttf') || file.name.endsWith('.otf'))) {
            this.setState(prev => ({
                newFont: { ...prev.newFont, file },
                errors: []
            }));
        } else {
            this.setState({ errors: ['Please upload a valid font file (.ttf or .otf)'], newFont: { ...this.state.newFont, file: null } });
        }
    };

    addNewFont = async () => {
        const { newFont } = this.state;
        if (!newFont.name || !newFont.file) {
            return this.setState({ errors: ['Font name and file are required'] });
        }

        const formData = new FormData();
        formData.append('name', newFont.name);
        formData.append('fontFile', newFont.file);

        try {
            const response = await fetch('/api/admin/fonts', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add font');
            }
            await this.fetchCustomFonts();
            this.setState({
                showNewFontForm: false,
                newFont: { name: '', file: null },
                errors: [],
                success: 'Font added successfully'
            });
        } catch (error) {
            this.setState({ errors: [error.message], success: '' });
        }
    };

    handleImageFileChange = async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            try {
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch('/api/upload/image', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to upload image');
                }

                const { fileName } = await response.json();

                this.setState(prev => ({
                    [prev.editField ? 'editField' : 'newField']: {
                        ...prev[prev.editField ? 'editField' : 'newField'],
                        imageFile: file,
                        defaultValue: fileName
                    },
                    errors: []
                }));
            } catch (error) {
                this.setState({ 
                    errors: [error.message],
                    [this.state.editField ? 'editField' : 'newField']: {
                        ...this.state[this.state.editField ? 'editField' : 'newField'],
                        imageFile: null,
                        defaultValue: ''
                    }
                });
            }
        } else {
            this.setState({ 
                errors: ['Please upload a valid image file'],
                [this.state.editField ? 'editField' : 'newField']: {
                    ...this.state[this.state.editField ? 'editField' : 'newField'],
                    imageFile: null,
                    defaultValue: ''
                }
            });
        }
    };

    handleZoom = (factor) => {
        this.setState(prev => ({
            previewScale: Math.max(0.5, Math.min(2.0, prev.previewScale * factor))
        }));
    };

    handleDeleteClick = (templateId) => {
        const template = this.state.templates[templateId];
        this.setState({
            showDeleteModal: true,
            templateToDelete: templateId,
            deleteConfirmationText: '',
            templateSummary: {
                'Name': template.name,
                'Description': template.description,
                'Fields': Object.keys(template.fields).length,
                'File': template.file
            }
        });
    };

    handleDeleteConfirm = async () => {
        const { templateToDelete } = this.state;
        if (!templateToDelete) return;

        try {
            const response = await fetch(`/api/admin/templates/${templateToDelete}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete template');
            }

            // Update state before fetching templates
            this.setState({
                showDeleteModal: false,
                templateToDelete: null,
                templateSummary: null,
                deleteConfirmationText: '',
                success: 'Template deleted successfully',
                errors: []
            });

            // Fetch updated templates after state update
            await this.fetchTemplates();
        } catch (error) {
            console.error('Delete template error:', error);
            this.setState({
                errors: [error.message || 'Failed to delete template. Please try again.'],
                showDeleteModal: false,
                templateToDelete: null,
                templateSummary: null,
                deleteConfirmationText: '',
                success: ''
            });
        }
    };

    closeDeleteModal = () => {
        this.setState({
            showDeleteModal: false,
            templateToDelete: null,
            templateSummary: null,
            deleteConfirmationText: ''
        });
    };

    setDeleteConfirmationText = (text) => {
        this.setState({ deleteConfirmationText: text });
    };

    toggleFieldList = () => {
        this.setState(prev => ({ isFieldListExpanded: !prev.isFieldListExpanded }));
    };

    toggleTemplateList = () => {
        this.setState(prev => ({ isTemplateListExpanded: !prev.isTemplateListExpanded }));
    };

    toggleManagement = () => {
        this.setState(prev => ({ isManagementExpanded: !prev.isManagementExpanded }));
    };

    renderFieldList = () => {
        const { templates, selectedTemplate, isSaving } = this.state;
        const template = templates[selectedTemplate];
        return (
            <React.Fragment>
                {Object.entries(template.fields).map(([name, field]) => (
                    <div
                        className="field-item"
                        key={name}
                        draggable
                        onDragStart={(e) => this.handleDragStart(e, name)}
                        onDragEnd={this.handleDragEnd}
                        onDragOver={this.handleDragOver}
                        onDragEnter={this.handleDragEnter}
                        onDragLeave={this.handleDragLeave}
                        onDrop={(e) => this.handleDrop(e, name)}
                        onTouchStart={(e) => this.handleTouchStart(e, name)}
                        onTouchMove={this.handleTouchMove}
                        onTouchEnd={this.handleTouchEnd}
                        data-field-name={name}
                    >
                        <div>
                            <span className="field-label">{field.label}</span>
                            <span className="field-meta">({field.type}, {field.required ? 'Required' : 'Optional'}, Font: {field.font}, Size: {field.fontSize})</span>
                            <ul>
                                {field.positions.map((pos, i) => (
                                    <li key={i}>
                                        Page {pos.page}: ({pos.x}, {pos.y})
                                        {field.type === 'text' && (
                                            <React.Fragment>, Font: {pos.font}, Size: {pos.fontSize}</React.Fragment>
                                        )}
                                        {field.type === 'image' && (
                                            <React.Fragment>, Rotation: {pos.rotation || 0}°, Scale: {pos.scale || 100}%</React.Fragment>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="button-group">
                            <button className="action-button edit" onClick={() => this.editField(name)}>✏️ Edit</button>
                            <button className="action-button delete" onClick={() => this.removeField(name)}>🗑️ Remove</button>
                        </div>
                    </div>
                ))}
            </React.Fragment>
        );
    };

    renderPositionList = (fieldName) => {
        const { templates, selectedTemplate, editPositionIndex, newPosition, customFonts } = this.state;
        
        if (!templates || !selectedTemplate || !templates[selectedTemplate] || !fieldName) {
            return null;
        }
        
        const field = templates[selectedTemplate].fields[fieldName];
        if (!field) {
            return null;
        }
        
        return (
            <div className="position-list">
                {field.positions && field.positions.length > 0 && (
                    <div className="existing-positions">
                        {field.positions.map((position, index) => (
                            <div 
                                key={index} 
                                className={`position-item ${index === editPositionIndex ? 'editing' : ''}`}
                            >
                                <div className="position-info">
                                    <span>Page: {position.page}</span>
                                    <span>X: {position.x}</span>
                                    <span>Y: {position.y}</span>
                                    {field.type === 'text' && (
                                        <React.Fragment>
                                            <span>Font: {position.font || field.font}</span>
                                            <span>Size: {position.fontSize || field.fontSize}</span>
                                        </React.Fragment>
                                    )}
                                    {field.type === 'image' && (
                                        <React.Fragment>
                                            <span>Rotation: {position.rotation || 0}°</span>
                                            <span>Scale: {position.scale || 100}%</span>
                                        </React.Fragment>
                                    )}
                                </div>
                                <div className="position-actions">
                                    <button className="edit-btn" onClick={() => this.editPosition(fieldName, index)}>✏️ Edit</button>
                                    <button className="remove-btn" onClick={() => this.removePosition(index)}>🗑️ Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    renderPositionFields = () => {
        const { newPosition, editField, newField, editPositionIndex, customFonts } = this.state;
        const activeField = editField || newField;
        
        if (!activeField || !activeField.label) {
            return null;
        }
        
        return (
            <div className="position-fields">
                <FormInput name="page" label="Page" type="number" value={newPosition.page} onChange={this.handlePositionChange} min="0" />
                <FormInput name="x" label="X Position" type="number" value={newPosition.x} onChange={this.handlePositionChange} required />
                <FormInput name="y" label="Y Position" type="number" value={newPosition.y} onChange={this.handlePositionChange} required />
                {activeField.type === 'text' &&
                    <React.Fragment>
                        <div className="form-group">
                            <label className="form-label">Font</label>
                            <select name="font" value={newPosition.font || ''} onChange={this.handlePositionChange}>
                                <option value="">Use field default</option>
                                <option value="Helvetica">Helvetica</option>
                                <option value="Times-Roman">Times Roman</option>
                                <option value="Courier">Courier</option>
                                {customFonts.map(font => (
                                    <option key={font.name} value={font.name}>{font.name}</option>
                                ))}
                            </select>
                        </div>
                        <FormInput 
                            name="fontSize" 
                            label="Font Size" 
                            type="number" 
                            value={newPosition.fontSize || ''} 
                            onChange={this.handlePositionChange} 
                            min="1" 
                            placeholder="Use field default"
                        />
                    </React.Fragment>
                }
                {activeField.type === 'image' && (
                    <React.Fragment>
                        <FormInput 
                            name="rotation" 
                            label="Rotation (degrees)" 
                            type="number" 
                            value={newPosition.rotation} 
                            onChange={this.handlePositionChange} 
                            min="0" 
                            max="360"
                            placeholder="0"
                        />
                        <FormInput 
                            name="scale" 
                            label="Scale (%)" 
                            type="number" 
                            value={newPosition.scale} 
                            onChange={this.handlePositionChange} 
                            min="1"
                            placeholder="100"
                        />
                    </React.Fragment>
                )}
            </div>
        );
    };

    saveNewPosition = async () => {
        const { selectedTemplate, editField, newField, newPosition, templates } = this.state;
        const field = editField || newField;
        if (!selectedTemplate || !field) return;

        const fieldName = field.key;
        const updatedFields = { ...templates[selectedTemplate].fields };
        
        if (!updatedFields[fieldName].positions) {
            updatedFields[fieldName].positions = [];
        }
        
        const newPositionData = {
            page: parseInt(newPosition.page) || 0,
            x: parseInt(newPosition.x) || 0,
            y: parseInt(newPosition.y) || 0
        };

        // Add font properties only for text fields
        if (field.type === 'text') {
            newPositionData.font = newPosition.font || field.font;
            newPositionData.fontSize = newPosition.fontSize || field.fontSize;
        }

        // Add rotation and scale only for image fields
        if (field.type === 'image') {
            newPositionData.rotation = newPosition.rotation === '' ? 0 : (parseInt(newPosition.rotation) || 0);
            newPositionData.scale = newPosition.scale === '' ? 100 : (parseInt(newPosition.scale) || 100);
        }

        const updatedPositions = [...updatedFields[fieldName].positions, newPositionData];
        updatedFields[fieldName] = {
            ...updatedFields[fieldName],
            positions: updatedPositions
        };

        try {
            // Update positions
            const posResponse = await fetch(`/api/admin/templates/${selectedTemplate}/fields/${fieldName}/positions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions: updatedPositions })
            });

            if (!posResponse.ok) {
                const errorData = await posResponse.json();
                throw new Error(errorData.error || 'Failed to add position');
            }

            // Update the field
            const fieldResponse = await fetch(`/api/admin/templates/${selectedTemplate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: updatedFields })
            });

            if (!fieldResponse.ok) {
                const errorData = await fieldResponse.json();
                throw new Error(errorData.error || 'Failed to update field');
            }

            await this.fetchTemplates();
            this.setState(prevState => ({
                editPositionIndex: null,
                newPosition: { page: 0, x: 0, y: 0, font: '', fontSize: '', rotation: 0, scale: 100 },
                success: 'Position added and field updated successfully',
                errors: [],
                editField: editField ? {
                    ...editField,
                    positions: updatedPositions
                } : null
            }), () => {
                // Trigger preview update after position is added/updated
                if (this._isMounted) {
                    this.updatePreview();
                }
            });
        } catch (error) {
            this.setState({ errors: [error.message], success: '' });
        }
    };

    renderPreviewSection = () => {
        const { isGeneratingPreview, previewData, previewScale, errors, previewTemplateId } = this.state;
        
        return (
            <div className="preview-section">
                <div className="preview-container">
                    {isGeneratingPreview ? (
                        <div className="loading">Generating preview...</div>
                    ) : previewData ? (
                        <div className="pdf-preview" style={{ transform: `scale(${previewScale})` }}>
                            <iframe 
                                src={`/api/preview/${previewTemplateId}/pdf`}
                                className="preview-iframe"
                                onError={this.handlePreviewError}
                                title="PDF Preview"
                            />
                        </div>
                    ) : (
                        <div className="no-preview">
                            {errors.length > 0 ? errors[0] : (
                                <div className="react-favicon-container">
                                    <img 
                                        src="/images/react-favicon.gif" 
                                        alt="React Logo" 
                                        className="react-favicon"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    render() {
        const { 
            templates, 
            selectedTemplate, 
            newField, 
            newPosition, 
            editField, 
            errors, 
            success, 
            showNewTemplateForm, 
            showNewFontForm, 
            newTemplate, 
            newFont, 
            pdfFile, 
            searchTerm, 
            loading, 
            showUndo, 
            isSaving, 
            showPreview, 
            previewTemplateId,
            isFieldFormExpanded, 
            isPositionFormExpanded, 
            isFieldListExpanded,
            isTemplateListExpanded,
            isManagementExpanded,
            customFonts,
            previewData,
            isGeneratingPreview,
            previewScale,
            isServerReady,
            showDeleteModal,
            templateToDelete,
            templateSummary,
            deleteConfirmationText
        } = this.state;
        const template = selectedTemplate ? templates[selectedTemplate] : null;
        const activeField = editField || newField;
        const isAddPositionDisabled = !activeField.label || (newPosition.page < 0 || newPosition.x < 0 || newPosition.y < 0);
        const isAddFieldDisabled = !activeField.label;
        const filteredTemplates = Object.entries(templates).reduce((acc, [id, t]) => {
            const searchLower = searchTerm.toLowerCase();
            if (t.name.toLowerCase().includes(searchLower) || t.description.toLowerCase().includes(searchLower)) {
                acc[id] = t;
            }
            return acc;
        }, {});

        // Get template name safely
        const templateToDeleteName = templateToDelete && templates[templateToDelete] ? templates[templateToDelete].name : '';

        return (
            <div className="admin-container split-screen">
                {loading && <div className="card"><p>Loading templates...</p></div>}
                {errors.length > 0 && <ErrorDisplay errors={errors} />}
                
                {!loading && (
                    <React.Fragment>
                        <div className="header">
                            <h2>Template Manager</h2>
                            <button className="nav-button" onClick={() => window.location.href = '/'}>
                                Back to Home
                            </button>
                        </div>

                        <div className="admin-content">
                            {/* Left side - Preview */}
                            {this.renderPreviewSection()}

                            {/* Right side - Management */}
                            <div className="management-section" ref={this.managementSectionRef}>
                                <div className="card" ref={this.templatesRef}>
                                    <div className={`field-form ${!isTemplateListExpanded ? 'collapsed' : ''}`}>
                                        <div className="form-header" onClick={this.toggleTemplateList}>
                                            <h4>Templates</h4>
                                            <span className={`toggle-icon ${isTemplateListExpanded ? 'expanded' : ''}`}>▼</span>
                                        </div>
                                        {isTemplateListExpanded && (
                                            <div className="form-content">
                                                <div className="search-input-container">
                                                    <input
                                                        type="text"
                                                        className="search-input"
                                                        placeholder="Search templates..."
                                                        value={searchTerm}
                                                        onChange={this.handleSearchChange}
                                                    />
                                                </div>
                                                <TemplateSelector
                                                    templates={filteredTemplates}
                                                    selectedTemplate={selectedTemplate}
                                                    onSelect={this.handleTemplateSelect}
                                                    onPreview={this.handlePreview}
                                                    onDelete={this.handleDeleteClick}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`field-form ${!isManagementExpanded ? 'collapsed' : ''}`}>
                                        <div className="form-header" onClick={this.toggleManagement}>
                                            <h4>Management</h4>
                                            <span className={`toggle-icon ${isManagementExpanded ? 'expanded' : ''}`}>▼</span>
                                        </div>
                                        {isManagementExpanded && (
                                            <div className="form-content">
                                                <div className="template-font-buttons">
                                                    <button 
                                                        className={`action-button add-template-btn ${showNewTemplateForm ? 'active' : showNewFontForm ? 'inactive' : ''}`} 
                                                        onClick={this.toggleNewTemplateForm}
                                                        disabled={showNewFontForm}
                                                    >
                                                        {showNewTemplateForm ? 'Cancel' : '➕ Add Template'}
                                                    </button>
                                                    <button 
                                                        className={`action-button add-font-btn ${showNewFontForm ? 'active' : showNewTemplateForm ? 'inactive' : ''}`} 
                                                        onClick={this.toggleNewFontForm}
                                                        disabled={showNewTemplateForm}
                                                    >
                                                        {showNewFontForm ? 'Cancel' : '🎨 Add Font'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {showNewTemplateForm && (
                                        <div className="new-template-form">
                                            <h4>Create New Template</h4>
                                            <FormInput name="name" label="Template Name" value={newTemplate.name} onChange={this.handleNewTemplateChange} placeholder="e.g., Application Form" />
                                            <FormInput name="description" label="Description" value={newTemplate.description} onChange={this.handleNewTemplateChange} placeholder="e.g., A simple application form" />
                                            <div className="form-group">
                                                <label className="form-label">Icon</label>
                                                <select name="icon" value={newTemplate.icon} onChange={this.handleNewTemplateChange} className="form-input">
                                                    {this.emojiOptions.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.value} - {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Upload PDF Template</label>
                                                <input type="file" accept="application/pdf" onChange={this.handleFileChange} />
                                                {pdfFile && <p className="file-info">Selected file: {pdfFile.name}</p>}
                                            </div>
                                            <FormSubmitButton onClick={this.addNewTemplate}>Create Template</FormSubmitButton>
                                        </div>
                                    )}
                                    {showNewFontForm && (
                                        <div className="new-font-form">
                                            <h4>Add New Font</h4>
                                            <FormInput 
                                                name="name" 
                                                label="Font Name" 
                                                value={newFont.name} 
                                                onChange={this.handleNewFontChange} 
                                                placeholder="e.g., CustomFont" 
                                            />
                                            <div className="form-group">
                                                <label className="form-label">Upload Font File</label>
                                                <input 
                                                    type="file" 
                                                    accept=".ttf,.otf" 
                                                    onChange={this.handleFontFileChange} 
                                                />
                                                {newFont.file && <p className="file-info">Selected file: {newFont.file.name}</p>}
                                            </div>
                                            <FormSubmitButton onClick={this.addNewFont}>Add Font</FormSubmitButton>
                                        </div>
                                    )}
                                </div>
                                {success && <div className="success-message">{success}</div>}
                                {template ? (
                                    <div className="card field-management">
                                        <h3>{template.name}</h3>
                                        {isSaving && <div className="saving-indicator">Saving...</div>}
                                        <div className={`field-form ${!isFieldListExpanded ? 'collapsed' : ''}`}>
                                            <div className="form-header" onClick={this.toggleFieldList}>
                                                <h4>Field List</h4>
                                                <span className={`toggle-icon ${isFieldListExpanded ? 'expanded' : ''}`}>▼</span>
                                            </div>
                                            {isFieldListExpanded && (
                                                <div className="form-content">
                                                    {this.renderFieldList()}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`field-form ${isFieldFormExpanded ? '' : 'collapsed'}`}>
                                            <div className="form-header" onClick={this.toggleFieldForm}>
                                                <h4>{editField ? `Edit Field: ${editField.label}` : 'Add New Field'}</h4>
                                                <span className={`toggle-icon ${isFieldFormExpanded ? 'expanded' : ''}`}>▼</span>
                                            </div>
                                            {isFieldFormExpanded && (
                                                <div className="form-content">
                                                    <FormInput name="label" label="Field Label" value={activeField.label} onChange={this.handleFieldChange} />
                                                    <div className="form-group">
                                                        <label className="form-label">Field Type</label>
                                                        <select name="type" value={activeField.type} onChange={this.handleFieldChange}>
                                                            <option value="text">Text</option>
                                                            <option value="image">Image</option>
                                                        </select>
                                                    </div>
                                                    {activeField.type === 'text' ? (
                                                        <FormInput 
                                                            name="defaultValue" 
                                                            label="Default Value" 
                                                            value={activeField.defaultValue || ''} 
                                                            onChange={this.handleFieldChange}
                                                            required={!editField}
                                                        />
                                                    ) : (
                                                        <div className="form-group">
                                                            <label className="form-label">Upload Image</label>
                                                            {activeField.imageFile ? (
                                                                <div className="image-input-container">
                                                                    <input 
                                                                        type="text" 
                                                                        className="form-input"
                                                                        value={activeField.defaultValue}
                                                                        readOnly
                                                                        disabled
                                                                        style={{ opacity: 0.7 }}
                                                                    />
                                                                    <button 
                                                                        className="clear-image-btn"
                                                                        onClick={() => this.setState(prev => ({
                                                                            [prev.editField ? 'editField' : 'newField']: {
                                                                                ...prev[prev.editField ? 'editField' : 'newField'],
                                                                                imageFile: null,
                                                                                defaultValue: ''
                                                                            }
                                                                        }))}
                                                                    >
                                                                        ✖️
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    onChange={this.handleImageFileChange} 
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                    {activeField.type === 'text' && (
                                                        <React.Fragment>
                                                            <div className="form-group">
                                                                <label className="form-label">Default Font</label>
                                                                <select name="font" value={activeField.font} onChange={this.handleFieldChange}>
                                                                    <option value="Helvetica">Helvetica</option>
                                                                    <option value="Times-Roman">Times Roman</option>
                                                                    <option value="Courier">Courier</option>
                                                                    {customFonts.map(font => (
                                                                        <option key={font.name} value={font.name}>{font.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <FormInput name="fontSize" label="Default Font Size" type="number" value={activeField.fontSize} onChange={this.handleFieldChange} min="1" />
                                                        </React.Fragment>
                                                    )}
                                                    <label>
                                                        <input type="checkbox" name="required" checked={activeField.required} onChange={this.handleFieldChange} />
                                                        Required
                                                    </label>
                                                    <div className="field-actions">
                                                        <button className="add-field-btn" onClick={this.addOrUpdateField} disabled={isAddFieldDisabled}>
                                                            {editField ? 'Update Field' : 'Add Field'}
                                                        </button>
                                                        {editField && (
                                                            <button className="cancel-edit-btn" onClick={() => this.setState({ editField: null })}>
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`position-form ${!isPositionFormExpanded ? 'collapsed' : ''}`} ref={this.positionsSectionRef}>
                                            <div className="form-header">
                                                <h4>Positions {activeField && activeField.label ? `- ${activeField.label}` : ''}</h4>
                                                <span className={`toggle-icon ${isPositionFormExpanded ? 'expanded' : ''}`}>▼</span>
                                            </div>
                                            <div className="form-content">
                                                {this.renderPositionList(activeField.key)}
                                                {activeField && activeField.label && (
                                                    <React.Fragment>
                                                        {this.renderPositionFields()}
                                                        <div className="field-actions">
                                                            <button 
                                                                className="add-position-btn" 
                                                                onClick={this.addPosition} 
                                                                disabled={isAddPositionDisabled}
                                                            >
                                                                {this.state.editPositionIndex !== null ? 'Update Position' : 'Add Position'}
                                                            </button>
                                                            {this.state.editPositionIndex !== null && (
                                                                <button 
                                                                    className="cancel-edit-btn" 
                                                                    onClick={this.cancelPositionEdit}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            )}
                                                        </div>
                                                    </React.Fragment>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card">
                                        <p>Please select a template to manage its fields.</p>
                                    </div>
                                )}
                                {/* Add Go to Top button */}
                                <button className="go-to-top" onClick={this.scrollToTemplates} aria-label="Go to top"></button>
                            </div>
                        </div>
                    </React.Fragment>
                )}
                {showDeleteModal && templateToDelete && (
                    <DeleteConfirmationModal
                        isOpen={showDeleteModal}
                        onClose={this.closeDeleteModal}
                        onConfirm={this.handleDeleteConfirm}
                        templateName={templateToDeleteName}
                        templateSummary={templateSummary}
                        confirmationText={deleteConfirmationText}
                        setConfirmationText={this.setDeleteConfirmationText}
                    />
                )}
            </div>
        );
    }
}

ReactDOM.render(<AdminApp />, document.getElementById('root'));
