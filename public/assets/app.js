const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const convertBtn = document.getElementById('convertBtn');
const yamlOutput = document.getElementById('yamlOutput');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const validationSection = document.getElementById('validationSection');
const validationResults = document.getElementById('validationResults');

let selectedFile = null;
let convertedYaml = null;
let suggestedFileName = 'converted.relampo.yml';

function showToast(message, type = 'success') {
  toast.className = `toast ${type}`;
  toastMessage.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function handleFile(file) {
  if (!file) return;

  const ext = file.name.toLowerCase().split('.').pop();
  if (ext !== 'json') {
    showToast('Por favor selecciona un archivo .json', 'error');
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileInfo.classList.add('visible');
  uploadZone.classList.add('has-file');
  convertBtn.disabled = false;

  yamlOutput.value = '';
  yamlOutput.classList.add('empty');
  yamlOutput.placeholder = 'Tu YAML convertido aparecerá aquí...';
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  convertedYaml = null;
  validationSection.style.display = 'none';
}

function clearFile() {
  selectedFile = null;
  fileInfo.classList.remove('visible');
  uploadZone.classList.remove('has-file');
  convertBtn.disabled = true;
  fileInput.value = '';
}

function validateYaml(yaml) {
  const checks = [
    { name: 'test metadata', test: /^test:/m, type: 'required' },
    { name: 'test.name', test: /name:\s*["']?.+["']?/m, type: 'required' },
    { name: 'scenarios', test: /^scenarios:/m, type: 'required' }
  ];

  return checks.map(check => ({
    ...check,
    passed: check.test.test(yaml)
  }));
}

function displayValidation(results) {
  validationResults.innerHTML = '';
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = `validation-item ${result.passed ? 'success' : 'error'}`;
    const icon = result.passed
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    item.innerHTML = `${icon}<span>${result.name}</span>`;
    validationResults.appendChild(item);
  });

  validationSection.style.display = 'block';
}

function buildPlaceholderYaml(jsonText) {
  const safeJson = jsonText
    .split('\n')
    .map(line => `# ${line}`)
    .join('\n');

  return [
    '# Placeholder Relampo YAML',
    '# Replace this with real conversion logic when schema is ready',
    'test:',
    '  name: "Recording..."',
    '  version: "1.0"',
    'scenarios:',
    '  - name: "Scenario"',
    '    steps: []',
    '',
    '# Original Postman JSON:',
    safeJson
  ].join('\n');
}

async function convertFile() {
  if (!selectedFile) return;

  try {
    const jsonText = await selectedFile.text();
    JSON.parse(jsonText);

    convertedYaml = buildPlaceholderYaml(jsonText);
    const baseName = selectedFile.name.replace(/\.json$/i, '');
    suggestedFileName = `${baseName}.relampo.yml`;

    yamlOutput.value = convertedYaml;
    yamlOutput.classList.remove('empty');
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

    const validation = validateYaml(convertedYaml);
    displayValidation(validation);
    showToast('Conversión placeholder generada');
  } catch (err) {
    yamlOutput.value = `# Error al leer el JSON: ${err.message || err}`;
    yamlOutput.classList.remove('empty');
    showToast('JSON inválido', 'error');
  }
}

function downloadYaml() {
  if (!convertedYaml) return;

  const blob = new Blob([convertedYaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Descargado: ${suggestedFileName}`);
}

async function copyToClipboard() {
  if (!convertedYaml) return;
  try {
    await navigator.clipboard.writeText(convertedYaml);
    showToast('Copiado al portapapeles');
  } catch (err) {
    showToast('Error al copiar', 'error');
  }
}

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  handleFile(file);
});
fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});
removeFile.addEventListener('click', (e) => {
  e.stopPropagation();
  clearFile();
});
convertBtn.addEventListener('click', convertFile);
downloadBtn.addEventListener('click', downloadYaml);
copyBtn.addEventListener('click', copyToClipboard);

yamlOutput.addEventListener('input', () => {
  if (yamlOutput.value) {
    convertedYaml = yamlOutput.value;
    const validation = validateYaml(yamlOutput.value);
    displayValidation(validation);
  }
});
