export function getFileExtension(fileNameValue) {
  return fileNameValue.toLowerCase().split('.').pop();
}

export function isSupportedInputExtension(extension) {
  return extension === 'json' || extension === 'jmx';
}

export function buildSuggestedFileName(originalFileName) {
  const baseName = originalFileName.replace(/\.(json|jmx)$/i, '');
  return `${baseName}.relampo.yml`;
}
