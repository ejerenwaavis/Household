import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const LanguageContext = createContext();

// Drive the hidden Google Translate widget select element to the target language.
// 'es' activates Spanish; '' (empty string) restores to the original page language (English).
// Exported so any component inside <Router> can re-trigger after a route change.
export function triggerGoogleTranslate(langCode) {
  const attempt = (retries) => {
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (retries > 0) {
      setTimeout(() => attempt(retries - 1), 250);
    }
  };
  attempt(20); // up to 5 seconds of retries
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial mount — no need to trigger on first load (page is already English)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    triggerGoogleTranslate(language === 'es' ? 'es' : '');
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'es' : 'en');
  };

  const t = (enText, esText) => {
    return language === 'es' ? esText : enText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
