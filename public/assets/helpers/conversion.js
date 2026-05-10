import { convertPostmanJSONToPulseYAML } from '../converters/postman.js?v=postman-vars-set-runtime-v3';
import { convertJMXToPulseYAML } from '../converters/jmx.js?v=postman-vars-set-runtime-v3';

export function convertContent(fileText, extension) {
  if (extension === 'json') {
    return convertPostmanJSONToPulseYAML(fileText);
  }

  if (extension === 'jmx') {
    return convertJMXToPulseYAML(fileText);
  }

  throw new Error(`unsupported extension: ${extension}`);
}
