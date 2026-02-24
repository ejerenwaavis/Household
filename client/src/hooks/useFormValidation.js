/**
 * useFormValidation Hook
 * Provides real-time form validation with error tracking
 */

import { useState, useCallback, useRef } from 'react';
import { validateForm, validateField } from '../services/validationService';
import { logValidationError } from '../services/errorService';

export const useFormValidation = (initialValues, validationSchema, onSubmit) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const validationRef = useRef({});

  // Validate entire form
  const validateFormData = useCallback((data) => {
    const formErrors = validateForm(data, validationSchema);
    return formErrors;
  }, [validationSchema]);

  // Handle field change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setValues(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    // Real-time validation if field was touched
    if (touched[name] && validationSchema[name]) {
      const error = validateField(
        name,
        fieldValue,
        validationSchema[name],
        { ...values, [name]: fieldValue }
      );
      
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [touched, validationSchema, values]);

  // Handle field blur
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    // Validate on blur
    if (validationSchema[name]) {
      const error = validateField(
        name,
        values[name],
        validationSchema[name],
        values
      );
      
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [validationSchema, values]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Mark all fields as touched
    const touchedFields = Object.keys(validationSchema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(touchedFields);

    // Validate entire form
    const formErrors = validateFormData(values);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      logValidationError(formErrors, 'form_submission');
      setSubmitError('Please correct the errors below');
      return false;
    }

    // No errors, submit
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
      return true;
    } catch (error) {
      setSubmitError(error.message || 'An error occurred');
      console.error('Form submission error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [validationSchema, values, validateFormData, onSubmit]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setSubmitError(null);
  }, [initialValues]);

  // Set field value (programmatic)
  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  // Set field error (programmatic)
  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, []);

  // Check if form is valid
  const isValid = Object.keys(errors).length === 0;

  // Get field props for easy binding to input
  const getFieldProps = useCallback((name) => {
    return {
      name,
      value: values[name] || '',
      onChange: handleChange,
      onBlur: handleBlur,
      ...(errors[name] && touched[name] && { 'aria-invalid': true })
    };
  }, [values, errors, touched, handleChange, handleBlur]);

  // Get field error message (only if touched)
  const getFieldError = useCallback((name) => {
    return touched[name] ? errors[name] : null;
  }, [errors, touched]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    setValues,
    getFieldProps,
    getFieldError,
    validateFormData
  };
};

export default useFormValidation;
