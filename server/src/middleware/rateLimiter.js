/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP address
 * Different limits for different endpoint types
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * 500 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : req.ip;
  }
});

/**
 * Strict rate limiter for auth endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    const identifier = req.body?.email || req.body?.username || '';
    return `${req.ip}-${identifier}`;
  }
});

/**
 * Moderate rate limiter for create/update operations
 * 200 requests per 15 minutes per IP
 */
export const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : req.ip;
  }
});

/**
 * Strict rate limiter for password reset
 * 3 requests per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => `${req.ip}-${req.body?.email || ''}`
});

/**
 * Very strict rate limiter for sensitive operations
 * 10 requests per hour per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many requests to this endpoint, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip
});

/**
 * File upload rate limiter
 * 10 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    return req.user?.householdId || req.ip;
  }
});

/**
 * API endpoint rate limiter for authenticated users
 * 200 requests per 15 minutes per household
 */
export const apiUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Rate limit exceeded for this account',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || !req.user,
  keyGenerator: (req) => {
    return req.user?.householdId || req.ip;
  }
});

/**
 * Export rate limiter (data export operations)
 * 5 exports per hour per household
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many export requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?.householdId || req.ip
});

/**
 * Invite rate limiter
 * 20 invites per hour per household
 */
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many invitations sent, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.user?.householdId || req.ip
});

export default {
  generalLimiter,
  authLimiter,
  createLimiter,
  passwordResetLimiter,
  strictLimiter,
  uploadLimiter,
  apiUserLimiter,
  exportLimiter,
  inviteLimiter
};
