const VALIDATION_CHECKS = [
  { name: 'test metadata', test: /^test:/m, type: 'required' },
  { name: 'test.name', test: /^\s*name:\s*["']?.+["']?/m, type: 'required' },
  { name: 'http_defaults', test: /^http_defaults:/m, type: 'required' },
  { name: 'scenarios', test: /^scenarios:/m, type: 'required' },
  { name: 'steps', test: /^\s*steps:/m, type: 'required' }
];

export function validateYaml(yaml) {
  return VALIDATION_CHECKS.map((check) => ({
    ...check,
    passed: check.test.test(yaml)
  }));
}

export function displayValidation(results, validationSection, validationResults) {
  validationResults.innerHTML = '';
  for (const result of results) {
    const item = document.createElement('div');
    item.className = `validation-item ${result.passed ? 'success' : 'error'}`;
    const icon = result.passed
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    item.innerHTML = `${icon}<span>${result.name}</span>`;
    validationResults.appendChild(item);
  }

  validationSection.style.display = 'block';
}
