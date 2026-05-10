import { convertPostmanJSONToPulseYAML } from '../converters/postman.js?v=relampo-vars-native-v2';
import { convertJMXToPulseYAML } from '../converters/jmx.js?v=relampo-vars-native-v2';

export function convertContent(fileText, extension) {
  if (extension === 'json') {
    return convertPostmanJSONToPulseYAML(fileText);
  }

  if (extension === 'jmx') {
    return convertJMXToPulseYAML(fileText);
  }

  throw new Error(`unsupported extension: ${extension}`);
}
