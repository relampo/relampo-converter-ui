function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function isPlainString(value) {
  if (value.length === 0 || value.trim() !== value) {
    return false;
  }

  if (/^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(value)) {
    return false;
  }

  if (!/^[A-Za-z0-9._/:?-]+$/.test(value)) {
    return false;
  }

  const lowered = value.toLowerCase();
  const reserved = new Set(['null', 'true', 'false', 'yes', 'no', 'on', 'off']);
  if (reserved.has(lowered)) {
    return false;
  }

  return true;
}

function formatScalar(value) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isPlainString(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function renderObject(value, indent) {
  const entries = Object.entries(value);
  const space = ' '.repeat(indent);

  if (entries.length === 0) {
    return [`${space}{}`];
  }

  const lines = [];

  for (const [key, childValue] of entries) {
    const renderedKey = formatKey(key);
    if (isScalar(childValue)) {
      lines.push(`${space}${renderedKey}: ${formatScalar(childValue)}`);
      continue;
    }

    lines.push(`${space}${renderedKey}:`);
    lines.push(...renderNode(childValue, indent + 2));
  }

  return lines;
}

function renderArray(value, indent) {
  const space = ' '.repeat(indent);
  if (value.length === 0) {
    return [`${space}[]`];
  }

  const lines = [];
  for (const item of value) {
    if (isScalar(item)) {
      lines.push(`${space}- ${formatScalar(item)}`);
      continue;
    }

    if (isPlainObject(item)) {
      const entries = Object.entries(item);
      if (entries.length === 0) {
        lines.push(`${space}- {}`);
        continue;
      }

      const [firstKey, firstValue] = entries[0];
      if (isScalar(firstValue)) {
        lines.push(`${space}- ${formatKey(firstKey)}: ${formatScalar(firstValue)}`);
      } else {
        lines.push(`${space}- ${formatKey(firstKey)}:`);
        lines.push(...renderNode(firstValue, indent + 4));
      }

      for (let i = 1; i < entries.length; i += 1) {
        const [key, childValue] = entries[i];
        const childPrefix = `${space}  ${formatKey(key)}:`;
        if (isScalar(childValue)) {
          lines.push(`${childPrefix} ${formatScalar(childValue)}`);
        } else {
          lines.push(childPrefix);
          lines.push(...renderNode(childValue, indent + 4));
        }
      }
      continue;
    }

    lines.push(`${space}-`);
    lines.push(...renderNode(item, indent + 2));
  }

  return lines;
}

function renderNode(value, indent = 0) {
  if (Array.isArray(value)) {
    return renderArray(value, indent);
  }

  if (isPlainObject(value)) {
    return renderObject(value, indent);
  }

  return [`${' '.repeat(indent)}${formatScalar(value)}`];
}

export function stringifyYAML(value) {
  return `${renderNode(value, 0).join('\n')}\n`;
}
