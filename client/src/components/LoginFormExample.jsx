/**
 * Example Login Form with Real-Time Validation
 * Demonstrates FormField component with validation feedback
 */

import React, { useState } from 'react';
import FormField from './FormField';
import useFormValidation from '../hooks/useFormValidation';
import { validators } from '../services/validationService';

const LoginFormExample = ({ onSubmit }) => {
  const [submitStatus, setSubmitStatus] = useState(null);

  // Define validation schema
  const validationSchema = {
    email: [validators.email],
    password: [validators.required]
  };

  // Use form validation hook
  const {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm
  } = useFormValidation(
    { email: '', password: '' },
    validationSchema,
    async (formData) => {
      try {
        // Call the onSubmit callback or make API request
        if (onSubmit) {
          await onSubmit(formData);
        }
        setSubmitStatus('success');
        setTimeout(() => setSubmitStatus(null), 3000);
      } catch (error) {
        setSubmitStatus('error');
        throw error;
      }
    }
  );

  return (
    <form onSubmit={handleSubmit} className="form form--login">
      <h2 className="form__title">Login</h2>

      {submitError && (
        <div className="form__submit-error">
          <span>⚠</span>
          {submitError}
        </div>
      )}

      <FormField
        type="email"
        name="email"
        label="Email Address"
        placeholder="you@example.com"
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.email}
        touched={touched.email}
        required
        icon="✉️"
        helpText="We'll never share your email with anyone else."
      />

      <FormField
        type="password"
        name="password"
        label="Password"
        placeholder="••••••••"
        value={values.password}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.password}
        touched={touched.password}
        required
        icon="🔒"
      />

      <div className="form__actions">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn--primary"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={resetForm}
          className="btn btn--secondary"
        >
          Clear
        </button>
      </div>
    </form>
  );
};

export default LoginFormExample;
