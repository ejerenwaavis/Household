/**
 * FormField Component
 * Reusable form field with real-time validation feedback
 */

import React, { useState } from 'react';
import { getPasswordStrength } from '../services/validationService';
import '../styles/formField.css';

const FormField = ({
  type = 'text',
  name,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  validator = null, // Optional: custom validator function
  showPasswordStrength = false,
  helpText,
  icon,
  className = ''
}) => {
  const [localError, setLocalError] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  const handleChange = (e) => {
    const { value: newValue } = e.target;

    // Update password strength if applicable
    if (showPasswordStrength) {
      setPasswordStrength(getPasswordStrength(newValue));
    }

    // Run validator if provided and field has been touched
    if (validator && touched) {
      const validationResult = validator(newValue);
      if (validationResult.valid) {
        setLocalError(null);
        setHasError(false);
      } else {
        setLocalError(validationResult.error);
        setHasError(true);
      }
    }

    onChange(e);
  };

  const handleBlur = (e) => {
    setHasError(!!error || !!localError);

    if (onBlur) {
      onBlur(e);
    }
  };

  const displayError = error || localError;
  const isInvalid = (touched || displayError) && hasError;
  const isValid = touched && !isInvalid && value;

  return (
    <div className={`form-field ${className} ${isInvalid ? 'error' : ''} ${isValid ? 'valid' : ''}`}>
      {label && (
        <label htmlFor={name} className="form-field__label">
          {label}
          {required && <span className="form-field__required">*</span>}
        </label>
      )}

      <div className="form-field__input-wrapper">
        {icon && <span className="form-field__icon">{icon}</span>}
        
        <input
          id={name}
          type={type}
          name={name}
          value={value || ''}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={isInvalid}
          className="form-field__input"
          aria-describedby={isInvalid ? `${name}-error` : helpText ? `${name}-help` : undefined}
        />

        {isInvalid && (
          <span className="form-field__icon form-field__icon--error">✕</span>
        )}
        {isValid && (
          <span className="form-field__icon form-field__icon--valid">✓</span>
        )}
      </div>

      {/* Password Strength Indicator */}
      {showPasswordStrength && passwordStrength && (
        <div className="form-field__password-strength">
          <div className="form-field__strength-bar">
            <div
              className={`form-field__strength-indicator form-field__strength-${passwordStrength.color}`}
              style={{ width: `${passwordStrength.score}%` }}
            />
          </div>
          <span className={`form-field__strength-label form-field__strength-${passwordStrength.color}`}>
            Strength: {passwordStrength.label}
          </span>
        </div>
      )}

      {/* Error Message */}
      {isInvalid && displayError && (
        <div id={`${name}-error`} className="form-field__error">
          <span className="form-field__error-icon">⚠</span>
          {displayError}
        </div>
      )}

      {/* Help Text */}
      {helpText && !isInvalid && (
        <div id={`${name}-help`} className="form-field__help">
          {helpText}
        </div>
      )}
    </div>
  );
};

export default FormField;
