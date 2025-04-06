// public/js/components.js
class FormInput extends React.Component {
    constructor(props) {
        super(props);
        this.state = { value: props.value || '', error: '' };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.value !== this.props.value) {
            this.setState({ value: this.props.value || '' });
        }
    }

    handleChange = (e) => {
        const value = e.target.value;
        this.setState({ value, error: '' });
        this.props.onChange && this.props.onChange(e);
    };

    render() {
        const { label, type, required, name, placeholder, ...props } = this.props;
        return (
            <div className="form-group">
                <label className="form-label">{label}{required ? ' *' : ''}</label>
                <input
                    type={type}
                    name={name}
                    required={required}
                    className={`form-input ${this.state.error ? 'error' : ''}`}
                    value={this.state.value}
                    onChange={this.handleChange}
                    placeholder={placeholder}
                    {...props}
                />
                {this.state.error && <div className="error-message">{this.state.error}</div>}
            </div>
        );
    }
}

class FormSubmitButton extends React.Component {
    render() {
        const { loading, disabled, children, ...props } = this.props;
        return (
            <button
                className={`submit-button ${loading ? 'loading' : ''}`}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? 'Processing...' : children}
            </button>
        );
    }
}

class TemplateSelector extends React.Component {
    constructor(props) {
        super(props);
        this.sliderRef = React.createRef();
    }

    componentDidUpdate(prevProps) {
        if (this.props.selectedTemplate !== prevProps.selectedTemplate && this.props.selectedTemplate) {
            this.centerSelectedTemplate();
        }
    }

    centerSelectedTemplate = () => {
        const sliderElement = this.sliderRef.current;
        const selectedElement = sliderElement.querySelector('.template-button.active');
        
        if (selectedElement && sliderElement) {
            const sliderRect = sliderElement.getBoundingClientRect();
            const selectedRect = selectedElement.getBoundingClientRect();
            
            // Calculate the scroll position to center the selected template
            const scrollTo = selectedElement.offsetLeft - (sliderRect.width / 2) + (selectedRect.width / 2);
            
            // Smooth scroll to the position
            sliderElement.scrollTo({
                left: scrollTo,
                behavior: 'smooth'
            });
        }
    }

    render() {
        const { templates, selectedTemplate, onSelect, onPreview, onDelete, ...props } = this.props;
        if (Object.keys(templates).length === 0) {
            return <div className="template-slider" ref={this.sliderRef}><p>No templates available</p></div>;
        }
        return (
            <div className="template-slider" ref={this.sliderRef}>
                <div className="template-slider-content">
                    {Object.entries(templates).map(([id, template]) => (
                        <div
                            key={id}
                            className={`template-button ${selectedTemplate === id ? 'active' : ''}`}
                            onClick={() => onSelect(id)}
                            {...props}
                        >
                            <span className="template-icon">{template.icon}</span>
                            <div className="template-name">{template.name}</div>
                            <div className="template-description">{template.description}</div>
                            <div className="template-actions">
                                {onPreview && (
                                    <button
                                        className="preview-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPreview(id);
                                        }}
                                    >
                                        Preview
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        className="delete-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(id);
                                        }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

class ErrorDisplay extends React.Component {
    render() {
        const { errors } = this.props;
        if (!errors || errors.length === 0) return null;
        return (
            <div className="error-container">
                {errors.map((error, index) => (
                    <div key={index} className="error-message">{error}</div>
                ))}
            </div>
        );
    }
}

class SummaryModal extends React.Component {
    render() {
        const { 
            isOpen, 
            onClose, 
            summaryData, 
            onSubmit, 
            onPreview,
            fieldVisibility,
            fieldBlur,
            onFieldVisibilityChange,
            onFieldBlurChange,
            template
        } = this.props;
        
        if (!isOpen) return null;

        return (
            <div className="preview-modal-overlay">
                <div className="preview-modal-content" style={{ 
                    maxHeight: '95%',
                    // width: '40%',
                    // minWidth: '400px',
                    maxWidth: '90vw',
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column'
                }}>
                    <h3>PDF Generation Summary</h3>
                    <button className="preview-close-button" onClick={onClose}>✖️ Close</button>
                    
                    <div className="summary-list" style={{ flex: '1 1 auto' }}>
                        <div className="summary-section">
                            <h4>Template Information</h4>
                            <div className="summary-item">
                                <span className="summary-label">Template Name</span>
                                <span className="summary-value">{summaryData['Template Name'] || 'N/A'}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Total Fields</span>
                                <span className="summary-value">{summaryData['Fields to Fill'] || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="summary-section">
                            <h4>Field Settings</h4>
                            {template && Object.entries(template.fields).map(([key, field]) => (
                                <div key={key} className="field-summary-item">
                                    <div className="field-header">
                                        <div className="field-header-content">
                                            <span className="field-label">{field.label}</span>
                                            <div className="field-controls">
                                                <label className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={fieldVisibility[key]}
                                                        onChange={() => onFieldVisibilityChange(key)}
                                                    />
                                                    <span className="checkbox-text">Include</span>
                                                </label>
                                                {fieldVisibility[key] && (
                                                    <label className="checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={fieldBlur[key]}
                                                            onChange={() => onFieldBlurChange(key)}
                                                        />
                                                        <span className="checkbox-text">Blur</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {fieldVisibility[key] && (
                                        <div className="field-value">
                                            {summaryData[field.label + ':'] || 'N/A'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="field-actions" style={{ 
                        marginTop: '20px', 
                        padding: '15px 0', 
                        display: 'flex', 
                        gap: '15px', 
                        justifyContent: 'flex-end', 
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <button className="action-button" onClick={onPreview}>Preview</button>
                        <button className="submit-button" onClick={onSubmit}>Generate PDF</button>
                    </div>
                </div>
            </div>
        );
    }
}

class DeleteConfirmationModal extends React.Component {
    render() {
        const { 
            isOpen, 
            onClose, 
            onConfirm, 
            templateName, 
            templateSummary, 
            confirmationText, 
            setConfirmationText 
        } = this.props;

        // Check if the entered text matches the template name exactly (case-insensitive and trimmed)
        const isDeleteEnabled = confirmationText.trim().toLowerCase() === templateName.trim().toLowerCase();
        const inputClassName = `delete-summary-input ${isDeleteEnabled ? 'match' : confirmationText ? 'no-match' : ''}`;

        if (!isOpen) return null;

        return (
            <div className="preview-modal-overlay">
                <div className="delete-summary-modal">
                    <div className="delete-summary-header">
                        <h3>Delete Template</h3>
                        <button className="close-button" onClick={onClose}>✕</button>
                    </div>
                    
                    <div className="delete-confirmation-content">
                        <p>Are you sure you want to delete the template <strong>{templateName}</strong>?</p>
                        
                        <div className="template-summary">
                            <h4>Template Summary:</h4>
                            <ul>
                                {Object.entries(templateSummary).map(([key, value]) => (
                                    <li key={key}>
                                        <strong>{key}:</strong> {value}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className={inputClassName}>
                            <p>Please type <strong>{templateName}</strong> to confirm:</p>
                            <input
                                type="text"
                                placeholder="Enter template name"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                autoFocus
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && isDeleteEnabled) {
                                        onConfirm();
                                    }
                                }}
                            />
                            {confirmationText && !isDeleteEnabled && (
                                <div className="helper-text">Template name does not match</div>
                            )}
                        </div>
                        
                        <div className="delete-summary-actions">
                            <button 
                                className="delete-summary-button cancel"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button 
                                className="delete-summary-button delete"
                                onClick={onConfirm}
                                disabled={!isDeleteEnabled}
                            >
                                Delete Template
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

window.FormComponents = { FormInput, FormSubmitButton, TemplateSelector, ErrorDisplay, SummaryModal, DeleteConfirmationModal };