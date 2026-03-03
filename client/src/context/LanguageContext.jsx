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

  // Re-translate whenever React renders new DOM content (e.g. async API data loads).
  // Without this, fixed-timeout translation fires before data arrives so pages stay English.
  useEffect(() => {
    if (language !== 'es') return;

    let debounceTimer = null;
    // Flag to avoid infinite loop: GT itself mutates the DOM, which would re-trigger the observer.
    let translating = false;

    const doRetranslate = () => {
      if (translating) return;
      translating = true;
      triggerGoogleTranslate('');
      setTimeout(() => {
        triggerGoogleTranslate('es');
        setTimeout(() => { translating = false; }, 600);
      }, 350);
    };

    const observer = new MutationObserver(() => {
      if (translating) return;
      clearTimeout(debounceTimer);
      // Wait 900ms for mutations to settle before re-translating
      debounceTimer = setTimeout(doRetranslate, 900);
    });

    const target = document.getElementById('root') || document.body;
    observer.observe(target, { childList: true, subtree: true });

    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
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
