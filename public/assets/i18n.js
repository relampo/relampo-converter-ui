// Sistema de traducción inglés/español latinoamericano
export const translations = {
  en: {
    // Header
    title: "RELAMPO",
    subtitle: "Postman/JMX to Relampo YAML",
    
    // Upload Panel
    uploadTitle: "Upload Collection",
    uploadInfo: "Convert Postman (.json) or JMeter (.jmx) files to Relampo YAML directly in your browser.",
    dropFile: "Drop your file here",
    orClick: "or click to select",
    convertButton: "Convert to YAML",
    validationTitle: "Structure Validation",
    
    // Output Panel
    outputTitle: "YAML Output",
    outputPlaceholder: "Your converted YAML will appear here...",
    downloadButton: "Download YAML",
    copyButton: "Copy",
    clearButton: "Clear",
    
    // Reference Panel
    referenceTitle: "Reference",
    summaryTitle: "Conversion Summary",
    generatedOutput: "Generated Output",
    includes: "✓ Includes",
    includesList: {
      metadata: "test metadata",
      defaults: "http_defaults + detected base_url",
      steps: "steps (requests and groups)"
    },
    
    // Messages
    fileSelected: "File selected",
    converting: "Converting...",
    conversionSuccess: "Converted successfully!",
    conversionError: "Error converting file",
    copied: "Copied to clipboard!",
    cleared: "Output cleared",
    invalidFile: "Invalid file type. Only .json and .jmx files are allowed.",
    noFile: "Please select a file first",
    
    // File types
    postman: "Postman Collection",
    jmeter: "JMeter Test Plan",
    
    // Language toggle
    language: "Language",
    english: "English",
    spanish: "Español"
  },
  
  es: {
    // Header
    title: "RELAMPO",
    subtitle: "Postman/JMX a YAML de Relampo",
    
    // Panel de Carga
    uploadTitle: "Subir Colección",
    uploadInfo: "Convierte archivos de Postman (.json) o JMeter (.jmx) a YAML de Relampo directamente en tu navegador.",
    dropFile: "Suelta tu archivo aquí",
    orClick: "o haz clic para seleccionar",
    convertButton: "Convertir a YAML",
    validationTitle: "Validación de Estructura",
    
    // Panel de Salida
    outputTitle: "Salida YAML",
    outputPlaceholder: "Tu YAML convertido aparecerá aquí...",
    downloadButton: "Descargar YAML",
    copyButton: "Copiar",
    clearButton: "Limpiar",
    
    // Panel de Referencia
    referenceTitle: "Referencia",
    summaryTitle: "Resumen de Conversión",
    generatedOutput: "Salida Generada",
    includes: "✓ Incluye",
    includesList: {
      metadata: "metadatos del test",
      defaults: "http_defaults + base_url detectado",
      steps: "pasos (requests y grupos)"
    },
    
    // Mensajes
    fileSelected: "Archivo seleccionado",
    converting: "Convirtiendo...",
    conversionSuccess: "¡Convertido exitosamente!",
    conversionError: "Error al convertir el archivo",
    copied: "¡Copiado al portapapeles!",
    cleared: "Salida limpiada",
    invalidFile: "Tipo de archivo inválido. Solo se permiten archivos .json y .jmx.",
    noFile: "Por favor selecciona un archivo primero",
    
    // Tipos de archivo
    postman: "Colección de Postman",
    jmeter: "Plan de Prueba de JMeter",
    
    // Toggle de idioma
    language: "Idioma",
    english: "English",
    spanish: "Español"
  }
};

// Función para cambiar idioma
export function setLanguage(lang) {
  localStorage.setItem('relampo-lang', lang);
  document.documentElement.lang = lang;
  updateUI(lang);
}

// Función para obtener idioma actual
export function getCurrentLanguage() {
  return localStorage.getItem('relampo-lang') || 'en';
}

// Función para actualizar la UI con las traducciones
function updateUI(lang) {
  const t = translations[lang];
  
  // Actualizar textos con data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const keys = key.split('.');
    let value = t;
    
    for (const k of keys) {
      value = value[k];
      if (!value) break;
    }
    
    if (value) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = value;
      } else {
        el.textContent = value;
      }
    }
  });
  
  // Actualizar placeholder del output
  const yamlOutput = document.getElementById('yamlOutput');
  if (yamlOutput) {
    yamlOutput.setAttribute('data-placeholder', t.outputPlaceholder);
  }
  
  // Actualizar atributos title (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const keys = key.split('.');
    let value = t;
    
    for (const k of keys) {
      value = value[k];
      if (!value) break;
    }
    
    if (value) {
      el.title = value;
    }
  });
}

// Inicializar idioma al cargar
export function initI18n() {
  const currentLang = getCurrentLanguage();
  updateUI(currentLang);
  
  // Actualizar el toggle si existe
  const langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.checked = currentLang === 'es';
  }
}

// Exportar traducciones actuales
export function t(key) {
  const lang = getCurrentLanguage();
  const keys = key.split('.');
  let value = translations[lang];
  
  for (const k of keys) {
    value = value[k];
    if (!value) return key;
  }
  
  return value;
}
