import { convertPostmanJSONToPulseYAML } from '../converters/postman.js';
import { convertJMXToPulseYAML } from '../converters/jmx.js';

export function convertContent(fileText, extension) {
  if (extension === 'json') {
    return convertPostmanJSONToPulseYAML(fileText);
  }

  if (extension === 'jmx') {
    return convertJMXToPulseYAML(fileText);
  }

  throw new Error(`unsupported extension: ${extension}`);
}
