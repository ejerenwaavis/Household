/**
 * SkeletonBlock
 * A simple animated shimmer placeholder. Pass a `className` to control
 * size and shape (e.g. `h-6 w-32 rounded-md`).
 */
const SkeletonBlock = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className}`}
    aria-hidden="true"
  />
);

export default SkeletonBlock;
