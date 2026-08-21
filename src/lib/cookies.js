import Cookies from 'js-cookie';

export const cookieManager = {
  // Set cookie with common options
  set: (key, value, options = {}) => {
    const defaultOptions = {
      expires: 7, // 7 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };
    
    Cookies.set(key, value, { ...defaultOptions, ...options });
  },

  // Get cookie
  get: (key) => {
    return Cookies.get(key);
  },

  // Remove cookie
  remove: (key, options = {}) => {
    Cookies.remove(key, options);
  },

  // Get and parse JSON cookie
  getJSON: (key) => {
    const value = Cookies.get(key);
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return value;
    }
  },

  // Clear all auth related cookies
  clearAuth: () => {
    Cookies.remove('access_token');
    // Cookies.remove('refresh_token');
    Cookies.remove('user');
    Cookies.remove('dietician');
  }
};