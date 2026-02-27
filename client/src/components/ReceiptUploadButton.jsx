import { useRef, useState } from 'react';
import api from '../services/api';

/**
 * ReceiptUploadButton
 *
 * Renders a small camera/upload icon button. When the user picks an image file the
 * component POSTs it to /api/receipts/scan (OCR), then fires onScanComplete with the
 * extracted { amount, date, merchant, category } so the parent form can pre-fill itself.
 *
 * Props:
 *   onScanComplete({ amount, date, merchant, category, rawText }) – called on success
 *   onError(message)  – called if the scan fails (optional, defaults to console.warn)
 */
export default function ReceiptUploadButton({ onScanComplete, onError }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Wipe the input value so re-selecting the same file fires onChange again
    e.target.value = '';

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const { data } = await api.post('/receipts/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (onScanComplete) onScanComplete(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Receipt scan failed. Please try again.';
      if (onError) {
        onError(msg);
      } else {
        console.warn('[ReceiptUpload]', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hidden file input – captures camera on mobile, regular file picker on desktop */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        title="Scan receipt"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg border border-indigo-200 transition-colors"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Scanning…
          </>
        ) : (
          <>
            {/* Camera icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scan receipt
          </>
        )}
      </button>
    </>
  );
}
