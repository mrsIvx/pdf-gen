// public/js/app.js
const { FormInput, FormSubmitButton, ErrorDisplay, TemplateSelector, SummaryModal, DeleteConfirmationModal } = window.FormComponents;

const ErrorModal = ({ isOpen, errors, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content error-modal">
                <div className="modal-header error-header">
                    <h3>Attention Required</h3>
                </div>
                <div className="modal-body error-body">
                    {errors.map((error, index) => (
                        <p key={index} className="error-message">{error}</p>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="button primary-button" onClick={onClose}>
                        Okay
                    </button>
                </div>
            </div>
        </div>
    );
};

class App extends React.Component {
    state = {
        templates: {},
        selectedTemplate: null,
        formData: {},
        fieldVisibility: {},
        fieldBlur: {},
        errors: [],
        showErrorModal: false,
        success: '',
        loading: false,
        searchTerm: '',
        showSummaryModal: false,
        summaryData: {},
        showPreviewModal: false,
        previewTemplateId: null,
        showFormPreviewModal: false,
        previewUrl: null,
        showDeleteModal: false,
        templateToDelete: null,
        deleteConfirmationText: '',
        templateSummary: {}
    };

    componentDidMount() {
        console.log('App mounted, fetching templates...');
        this.setState({ loading: true });
        this.fetchTemplates().finally(() => this.setState({ loading: false }));
    }

    fetchTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            if (!response.ok) throw new Error(`Failed to fetch templates: ${response.status}`);
            const templates = await response.json();
            console.log('Templates fetched:', Object.keys(templates));
            this.setState({ templates, errors: [], loading: false });
        } catch (error) {
            console.error('Fetch templates error:', error);
            this.setState({ errors: [error.message], loading: false });
            throw error;
        }
    };

    handleTemplateSelect = (templateId) => {
        const { templates } = this.state;
        const formData = Object.keys(templates[templateId].fields).reduce((acc, key) => {
            acc[key] = '';
            return acc;
        }, {});
        const fieldVisibility = Object.keys(templates[templateId].fields).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});
        const fieldBlur = Object.keys(templates[templateId].fields).reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {});
        console.log('Template selected:', templateId);
        this.setState({ 
            selectedTemplate: templateId, 
            formData, 
            fieldVisibility,
            fieldBlur,
            errors: [], 
            success: '' 
        });
    };

    handleInputChange = (e) => {
        const { name, value } = e.target;
        this.setState(prev => ({
            formData: { ...prev.formData, [name]: value }
        }));
    };

    handleSearchChange = (e) => this.setState({ searchTerm: e.target.value });

    handleFieldVisibilityChange = (fieldName) => {
        this.setState(prev => ({
            fieldVisibility: {
                ...prev.fieldVisibility,
                [fieldName]: !prev.fieldVisibility[fieldName]
            }
        }));
    };

    handleFieldBlurChange = (fieldName) => {
        this.setState(prev => ({
            fieldBlur: {
                ...prev.fieldBlur,
                [fieldName]: !prev.fieldBlur[fieldName]
            }
        }));
    };

    setError = (errors) => {
        this.setState({ 
            errors: Array.isArray(errors) ? errors : [errors],
            showErrorModal: true 
        });
    };

    closeErrorModal = () => {
        this.setState({ 
            showErrorModal: false,
            errors: [] 
        });
    };

    prepareSummaryAndShowModal = (e) => {
        e.preventDefault();
        console.log('Preparing summary modal...');
        const { selectedTemplate, formData, templates, fieldVisibility } = this.state;
        if (!selectedTemplate) {
            this.setError('Please select a template');
            return;
        }

        const template = templates[selectedTemplate];
        // Only check required fields that are visible (checked)
        const requiredFields = Object.entries(template.fields)
            .filter(([key, field]) => field.required && field.type !== 'image' && fieldVisibility[key])
            .map(([key]) => key);

        const missingFields = requiredFields.filter(field => !formData[field] || formData[field].trim() === '');
        if (missingFields.length > 0) {
            this.setError(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        const summaryData = {
            'Template Name': template.name,
            'Fields to Fill': Object.keys(formData).length
        };

        // Only include visible fields in summary
        Object.entries(template.fields).forEach(([key, field]) => {
            if (!fieldVisibility[key]) return; // Skip invisible fields
            
            const userValue = field.type === 'image' ? 
                (field.defaultValue || '') :
                (formData[key] || '');
            summaryData[field.label + ':'] = userValue;
        });

        this.setState({
            showSummaryModal: true,
            summaryData,
            errors: [],
            success: ''
        });
    };

    generatePDF = async (e) => {
        e.preventDefault();
        console.log('Generating PDF...');
        const { selectedTemplate, formData, templates, fieldVisibility, fieldBlur } = this.state;
        try {
            const payload = {
                formData: {},
                fieldVisibility: fieldVisibility,
                fieldBlur: fieldBlur
            };

            Object.entries(templates[selectedTemplate].fields).forEach(([key, field]) => {
                if (!fieldVisibility[key]) return;
                
                if (field.type === 'image') {
                    payload.formData[key] = field.defaultValue || '';
                } else if (formData[key] && formData[key].trim() !== '') {
                    payload.formData[key] = formData[key];
                }
            });

            const response = await fetch(`/api/generate/${selectedTemplate}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate PDF');
            }

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const blob = await response.blob();

            if (isIOS) {
                // For iOS, open in a new window/tab to let Safari handle it
                const url = window.URL.createObjectURL(blob);
                window.location.href = url;
                
                // Clean up the URL after a delay
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                }, 1000);
            } else {
                // For other browsers, use download attribute
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${templates[selectedTemplate].name.replace(/\s+/g, '_')}_filled.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }

            // Don't redirect immediately on iOS to allow the PDF to open
            if (!isIOS) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Generate PDF error:', error);
            this.setError(error.message);
            this.setState({ success: '', showSummaryModal: false });
        }
    };

    handlePreview = async (e) => {
        e.preventDefault();
        console.log('Opening preview modal...');
        const { selectedTemplate, formData, templates, fieldVisibility, fieldBlur } = this.state;
        if (!selectedTemplate) {
            this.setState({ errors: ['Please select a template to preview'] });
            return;
        }

        try {
            // Create payload with form data, field visibility, and blur settings
            const payload = {
                formData: {},
                fieldVisibility: fieldVisibility,
                fieldBlur: fieldBlur
            };

            // Only include fields that are visible
            Object.entries(templates[selectedTemplate].fields).forEach(([key, field]) => {
                if (!fieldVisibility[key]) return;
                
                if (field.type === 'image') {
                    payload.formData[key] = field.defaultValue || '';
                } else if (formData[key] && formData[key].trim() !== '') {
                    payload.formData[key] = formData[key];
                }
            });

            console.log('Preview payload:', payload);

            const response = await fetch(`/api/generate/${selectedTemplate}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate preview PDF');
            }

            const pdfBlob = await response.blob();
            const previewUrl = window.URL.createObjectURL(pdfBlob);

            this.setState({
                showPreviewModal: true,
                previewTemplateId: selectedTemplate,
                showSummaryModal: false,
                previewUrl: previewUrl
            });
        } catch (error) {
            console.error('Preview generation error:', error);
            this.setState({ 
                errors: [error.message], 
                showPreviewModal: false,
                previewTemplateId: null 
            });
        }
    };

    closeSummaryModal = () => {
        console.log('Closing summary modal');
        this.setState({ showSummaryModal: false });
    };

    closePreviewModal = () => {
        console.log('Closing preview modal');
        this.setState({ 
            showPreviewModal: false, 
            previewTemplateId: null,
            showSummaryModal: true // Show summary modal when closing preview
        });
    };

    closeFormPreviewModal = () => {
        console.log('Closing form preview modal');
        this.setState({ showFormPreviewModal: false });
    };

    handleAdminNavigation = (e) => {
        e.preventDefault();
        // In Electron, use loadURL instead of window.location.href to avoid breaking React state
        if (window.electronAPI) { // Assuming Electron exposes an API; adjust based on your setup
            window.electronAPI.loadURL('http://localhost:3000/admin');
        } else {
            window.location.href = '/admin'; // Fallback for non-Electron environments
        }
    };

    renderFormPreviewModal = () => {
        const { showFormPreviewModal, formData, templates, selectedTemplate, previewUrl } = this.state;
        if (!showFormPreviewModal || !selectedTemplate) return null;

        const template = templates[selectedTemplate];
        console.log('Rendering form preview modal for:', template.name);
        return (
            <div className="preview-modal-overlay">
                <div className="preview-modal-content preview-mode">
                    <div className="modal-header">
                        <h3>PDF Preview: {template.name}</h3>
                        <button 
                            className="preview-close-button"
                            onClick={this.closeFormPreviewModal}
                        >
                            <span>Close</span>
                            <span style={{ fontSize: '14px' }}>✕</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        {previewUrl && (
                            <iframe
                                src={previewUrl}
                                title="PDF Preview"
                                allowTransparency="true"
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    renderPreviewModal = () => {
        const { showPreviewModal, previewUrl } = this.state;
        if (!showPreviewModal || !previewUrl) return null;

        return (
            <div className="preview-modal-overlay">
                <div className="preview-modal-content preview-mode">
                    <div className="modal-header">
                        <h3>PDF Preview</h3>
                        <button 
                            className="preview-close-button"
                            onClick={() => {
                                window.URL.revokeObjectURL(previewUrl);
                                this.closePreviewModal();
                            }}
                        >
                            <span>Back to Summary</span>
                            <span style={{ fontSize: '14px' }}>←</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <iframe
                            src={previewUrl}
                            title="PDF Preview"
                            allowTransparency="true"
                        />
                    </div>
                </div>
            </div>
        );
    };

    handleDeleteTemplate = (templateId) => {
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

    handleDeleteConfirmation = async () => {
        const { templateToDelete, templates } = this.state;
        if (!templateToDelete) return;

        try {
            const response = await fetch(`/api/admin/templates/${templateToDelete}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete template');
            }

            // Remove template from state
            const updatedTemplates = { ...templates };
            delete updatedTemplates[templateToDelete];

            this.setState({
                templates: updatedTemplates,
                showDeleteModal: false,
                templateToDelete: null,
                deleteConfirmationText: '',
                errors: []
            });
        } catch (error) {
            this.setState({ errors: [error.message] });
        }
    };

    setDeleteConfirmationText = (text) => {
        this.setState({ deleteConfirmationText: text });
    };

    render() {
        const { 
            templates, selectedTemplate, formData, fieldVisibility, fieldBlur, 
            errors, showErrorModal, success, loading, searchTerm, showSummaryModal, 
            summaryData, showPreviewModal, previewTemplateId, showDeleteModal, 
            templateToDelete, deleteConfirmationText, templateSummary 
        } = this.state;
        const template = selectedTemplate ? templates[selectedTemplate] : null;
        const filteredTemplates = Object.entries(templates).reduce((acc, [id, t]) => {
            const searchLower = searchTerm.toLowerCase();
            if (t.name.toLowerCase().includes(searchLower) || t.description.toLowerCase().includes(searchLower)) {
                acc[id] = t;
            }
            return acc;
        }, {});

        console.log('Rendering App, state:', this.state);

        return (
            <div className="container">
                {loading && <div className="card"><p>Loading templates...</p></div>}
                <ErrorModal 
                    isOpen={showErrorModal} 
                    errors={errors} 
                    onClose={this.closeErrorModal}
                />
                {!loading && (
                    <React.Fragment>
                        <div className="app-header">
                            <h2>PDF Generator</h2>
                            <button className="nav-button" onClick={this.handleAdminNavigation}>
                                Admin
                            </button>
                        </div>
                        <div className="card">
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
                            />
                        </div>
                        {success && <div className="success-message">{success}</div>}
                        {template ? (
                            <div className="card">
                                <h3>Fill {template.name}</h3>
                                <form onSubmit={this.prepareSummaryAndShowModal}>
                                    {Object.entries(template.fields).map(([key, field]) => (
                                        <div key={key} className="form-field-container">
                                            <FormInput
                                                name={key}
                                                label={field.label + (field.required ? ' *' : '')}
                                                value={formData[key]}
                                                placeholder={field.defaultValue || ''}
                                                onChange={this.handleInputChange}
                                                type={field.type === 'image' ? 'text' : 'text'}
                                                readOnly={field.type === 'image'}
                                                disabled={field.type === 'image'}
                                                style={field.type === 'image' ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                                            />
                                        </div>
                                    ))}
                                    <FormSubmitButton type="submit">Review and Generate</FormSubmitButton>
                                </form>
                            </div>
                        ) : (
                            <div className="card">
                                <p>Please select a template to fill.</p>
                            </div>
                        )}
                        <SummaryModal
                            isOpen={showSummaryModal}
                            onClose={this.closeSummaryModal}
                            summaryData={summaryData}
                            onSubmit={this.generatePDF}
                            onPreview={this.handlePreview}
                            fieldVisibility={fieldVisibility}
                            fieldBlur={fieldBlur}
                            onFieldVisibilityChange={this.handleFieldVisibilityChange}
                            onFieldBlurChange={this.handleFieldBlurChange}
                            template={template}
                        />
                        {this.renderPreviewModal()}
                        {this.renderFormPreviewModal()}
                        {showDeleteModal && (
                            <DeleteConfirmationModal
                                isOpen={showDeleteModal}
                                onClose={() => this.setState({ 
                                    showDeleteModal: false, 
                                    templateToDelete: null,
                                    deleteConfirmationText: '' 
                                })}
                                onConfirm={this.handleDeleteConfirmation}
                                templateName={templates[templateToDelete] ? templates[templateToDelete].name : ''}
                                templateSummary={templateSummary}
                                confirmationText={deleteConfirmationText}
                                setConfirmationText={this.setDeleteConfirmationText}
                            />
                        )}
                    </React.Fragment>
                )}
            </div>
        );
    }
}

ReactDOM.render(<App />, document.getElementById('root'));