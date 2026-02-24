/**
 * Token Rotation Service
 * Implements secure refresh token rotation to prevent replay attacks
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Ensure secrets are configured
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-development-only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-development-only';

export class TokenRotationService {
  /**
   * Generate new access token
   */
  static generateAccessToken(payload) {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not configured');
    }
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      algorithm: 'HS256',
    });
  }

  /**
   * Generate new refresh token with unique token version
   */
  static generateRefreshToken(userId, tokenVersion = 0) {
    if (!JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not configured');
    }
    return jwt.sign(
      {
        userId,
        type: 'refresh',
        tokenVersion,
        issuedAt: Date.now(),
      },
      JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256',
      }
    );
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    try {
      if (!JWT_REFRESH_SECRET) {
        throw new Error('JWT_REFRESH_SECRET environment variable is not configured');
      }
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      });
      return decoded;
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token) {
    try {
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not configured');
      }
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
      });
      return decoded;
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Rotate tokens (exchange old refresh token for new access + refresh tokens)
   * This prevents token replay attacks
   *
   * @param {string} oldRefreshToken - The current refresh token
   * @param {object} additionalPayload - Additional data to include in token
   * @returns {object} { accessToken, refreshToken }
   */
  static async rotateTokens(oldRefreshToken, additionalPayload = {}) {
    try {
      // Verify the old refresh token
      const decoded = this.verifyRefreshToken(oldRefreshToken);

      // Get user from database
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if refresh token version matches (invalidates old tokens)
      if (decoded.tokenVersion !== user.tokenVersion) {
        console.warn(`[TokenRotation] Token version mismatch for user ${decoded.userId}. Possible token replay attack.`);
        throw new Error('Refresh token has been revoked');
      }

      // Increment token version to invalidate this refresh token
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      // Generate new tokens
      const accessPayload = {
        userId: user._id,
        householdId: user.householdId,
        email: user.email,
        ...additionalPayload,
      };

      const newAccessToken = this.generateAccessToken(accessPayload);
      const newRefreshToken = this.generateRefreshToken(user._id, user.tokenVersion);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '15m', 10),
      };
    } catch (error) {
      console.error('[TokenRotation] Error rotating tokens:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate all refresh tokens for a user (logout all sessions)
   * by incrementing their token version
   */
  static async invalidateAllTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Increment version to invalidate all tokens
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.lastLogout = new Date();
      await user.save();

      console.log(`[TokenRotation] Invalidated all tokens for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[TokenRotation] Error invalidating tokens:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate refresh tokens issued before a certain date
   * Useful for security incidents
   */
  static async invalidateTokensBefore(userId, beforeDate = new Date()) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.lastLogout && user.lastLogout > beforeDate) {
        throw new Error('Tokens already invalidated');
      }

      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.lastLogout = beforeDate;
      await user.save();

      console.log(`[TokenRotation] Invalidated tokens for user ${userId} issued before ${beforeDate}`);
      return true;
    } catch (error) {
      console.error('[TokenRotation] Error invalidating tokens:', error.message);
      throw error;
    }
  }

  /**
   * Get token metadata for auditing
   */
  static getTokenMetadata(token, isRefresh = false) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return null;

      return {
        userId: decoded.userId,
        type: decoded.type,
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000),
        tokenVersion: decoded.tokenVersion,
        isExpired: Date.now() >= decoded.exp * 1000,
      };
    } catch (error) {
      return null;
    }
  }
}

export default TokenRotationService;
