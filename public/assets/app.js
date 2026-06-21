import hljs from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/highlight.min.js';
import yaml from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/languages/yaml.min.js';
import { convertWithAIEnhancement, getAISettingsStatus } from './helpers/aiConversionClient.js';
import { convertContent } from './helpers/conversion.js?v=postman-vars-set-runtime-v3';
import { buildSuggestedFileName, getFileExtension, isSupportedInputExtension } from './helpers/file.js';
import { createToastNotifier } from './helpers/toast.js';
import { displayValidation, validateYaml } from './helpers/validation.js';
import { initI18n, setLanguage, t } from './i18n.js';

hljs.registerLanguage( 'yaml', yaml );

const uploadZone = document.getElementById( 'uploadZone' );
const fileInput = document.getElementById( 'fileInput' );
const fileInfo = document.getElementById( 'fileInfo' );
const fileName = document.getElementById( 'fileName' );
const removeFile = document.getElementById( 'removeFile' );
const convertBtn = document.getElementById( 'convertBtn' );
const yamlOutput = document.getElementById( 'yamlOutput' );
const yamlCode = document.getElementById( 'yamlCode' );
const downloadBtn = document.getElementById( 'downloadBtn' );
const downloadOptionsModal = document.getElementById( 'downloadOptionsModal' );
const downloadWithAssertionsBtn = document.getElementById( 'downloadWithAssertionsBtn' );
const downloadWithoutAssertionsBtn = document.getElementById( 'downloadWithoutAssertionsBtn' );
const downloadCancelBtn = document.getElementById( 'downloadCancelBtn' );
const copyBtn = document.getElementById( 'copyBtn' );
const searchBtn = document.getElementById( 'searchBtn' );
const toast = document.getElementById( 'toast' );
const toastMessage = document.getElementById( 'toastMessage' );
const validationSection = document.getElementById( 'validationSection' );
const validationResults = document.getElementById( 'validationResults' );
const errorMessageSection = document.getElementById( 'errorMessageSection' );
const conversionErrorList = document.getElementById( 'conversionErrorList' );
const aiSettingsBtn = document.getElementById( 'aiSettingsBtn' );
const aiSettingsModal = document.getElementById( 'aiSettingsModal' );
const aiEnabled = document.getElementById( 'aiEnabled' );
const aiProvider = document.getElementById( 'aiProvider' );
const aiEndpoint = document.getElementById( 'aiEndpoint' );
const aiModel = document.getElementById( 'aiModel' );
const aiApiKey = document.getElementById( 'aiApiKey' );
const aiRemember = document.getElementById( 'aiRemember' );
const aiTestBtn = document.getElementById( 'aiTestBtn' );
const aiClearBtn = document.getElementById( 'aiClearBtn' );
const aiSaveBtn = document.getElementById( 'aiSaveBtn' );
const aiCancelBtn = document.getElementById( 'aiCancelBtn' );

let selectedFile = null;
let convertedYaml = null;
let suggestedFileName = 'converted.relampo.yml';
let sessionAISettings = null;
let latestAIConversionReport = null;
const showToast = createToastNotifier( toast, toastMessage );

const searchBar = document.getElementById( 'searchBar' );
const searchInput = document.getElementById( 'searchInput' );
const searchCounter = document.getElementById( 'searchCounter' );
const searchPrev = document.getElementById( 'searchPrev' );
const searchNext = document.getElementById( 'searchNext' );
const searchClose = document.getElementById( 'searchClose' );

let searchMatches = [];
let currentMatchIndex = -1;
let originalYamlHtml = '';

const AI_SETTINGS_STORAGE_KEY = 'relampo-ai-settings';

const AI_PROVIDER_DEFAULTS = {
  openai: {
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4.1'
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514'
  },
  openai_compatible: {
    endpoint: '',
    model: ''
  },
  custom_agent: {
    endpoint: '',
    model: ''
  }
};

function getStoredAISettings() {
  try {
    const stored = localStorage.getItem( AI_SETTINGS_STORAGE_KEY );
    return stored ? JSON.parse( stored ) : null;
  } catch {
    return null;
  }
}

function getCurrentAISettings() {
  const stored = getStoredAISettings();
  return sessionAISettings || stored || null;
}

function applyAISettingsToForm( settings = null ) {
  if ( !aiEnabled || !aiProvider || !aiEndpoint || !aiModel || !aiApiKey || !aiRemember ) {
    return;
  }

  const selectedSettings = settings || getCurrentAISettings() || {};
  const provider = selectedSettings.provider || 'openai';
  const defaults = AI_PROVIDER_DEFAULTS[ provider ] || AI_PROVIDER_DEFAULTS.openai;

  aiEnabled.checked = Boolean( selectedSettings.enabled );
  aiProvider.value = provider;
  aiEndpoint.value = selectedSettings.endpoint ?? defaults.endpoint;
  aiModel.value = selectedSettings.model ?? defaults.model;
  aiApiKey.value = selectedSettings.apiKey || '';
  aiRemember.checked = Boolean( selectedSettings.rememberOnDevice );
}

function readAISettingsFromForm() {
  return {
    enabled: Boolean( aiEnabled?.checked ),
    provider: aiProvider?.value || 'openai',
    endpoint: aiEndpoint?.value.trim() || '',
    model: aiModel?.value.trim() || '',
    apiKey: aiApiKey?.value || '',
    rememberOnDevice: Boolean( aiRemember?.checked )
  };
}

function persistAISettings( settings ) {
  sessionAISettings = settings;

  if ( settings.rememberOnDevice ) {
    localStorage.setItem( AI_SETTINGS_STORAGE_KEY, JSON.stringify( settings ) );
  } else {
    localStorage.removeItem( AI_SETTINGS_STORAGE_KEY );
  }
}

function clearAISettings() {
  sessionAISettings = null;
  localStorage.removeItem( AI_SETTINGS_STORAGE_KEY );
  applyAISettingsToForm( {
    enabled: false,
    provider: 'openai',
    endpoint: AI_PROVIDER_DEFAULTS.openai.endpoint,
    model: AI_PROVIDER_DEFAULTS.openai.model,
    apiKey: '',
    rememberOnDevice: false
  } );
}

function showAISettingsModal() {
  if ( !aiSettingsModal ) {
    return;
  }

  applyAISettingsToForm();
  aiSettingsModal.classList.add( 'visible' );
  aiSettingsModal.setAttribute( 'aria-hidden', 'false' );
  aiProvider?.focus();
}

function hideAISettingsModal() {
  if ( !aiSettingsModal ) {
    return;
  }

  aiSettingsModal.classList.remove( 'visible' );
  aiSettingsModal.setAttribute( 'aria-hidden', 'true' );
}

function updateAIProviderDefaults() {
  if ( !aiProvider || !aiEndpoint || !aiModel ) {
    return;
  }

  const defaults = AI_PROVIDER_DEFAULTS[ aiProvider.value ] || AI_PROVIDER_DEFAULTS.openai;
  if ( !aiEndpoint.value.trim() ) {
    aiEndpoint.value = defaults.endpoint;
  }
  if ( !aiModel.value.trim() ) {
    aiModel.value = defaults.model;
  }
}

function saveAISettings() {
  const settings = readAISettingsFromForm();
  persistAISettings( settings );
  hideAISettingsModal();
  showToast( settings.enabled ? 'AI settings saved' : 'AI settings saved but disabled' );
}

function testAISettings() {
  const settings = readAISettingsFromForm();
  const status = getAISettingsStatus( settings );
  if ( !status.ready ) {
    showToast( status.reason, 'error' );
    return;
  }

  showToast( 'AI connection test is not wired yet' );
}

function buildConverterReport( yamlContent ) {
  const warnings = [];
  const detectedFeatures = [];
  const unsupportedItems = [];

  if ( yamlContent.includes( 'extract:' ) || yamlContent.includes( 'extractors:' ) ) {
    detectedFeatures.push( 'extractors' );
  }
  if ( yamlContent.includes( 'assertions:' ) || yamlContent.includes( 'assert:' ) ) {
    detectedFeatures.push( 'assertions' );
  }
  if ( yamlContent.includes( 'spark:' ) ) {
    detectedFeatures.push( 'spark_scripts' );
  }
  if ( yamlContent.includes( 'data_source:' ) ) {
    detectedFeatures.push( 'data_sources' );
  }

  const warningSections = [
    /#.*UNSUPPORTED ELEMENTS[\s\S]*?(?=# =====|\n\n|test:)/,
    /# LIMITATIONS \(not converted\):[\s\S]*?(?=# =====|\n\n|test:)/
  ];

  for ( const sectionRegex of warningSections ) {
    const section = yamlContent.match( sectionRegex );
    if ( !section ) {
      continue;
    }

    for ( const line of section[ 0 ].split( '\n' ) ) {
      if ( !line.match( /#\s+-\s+/ ) ) {
        continue;
      }
      const warning = line.replace( /#\s+-\s+/, '' ).trim();
      if ( warning ) {
        warnings.push( warning );
        unsupportedItems.push( warning );
      }
    }
  }

  return {
    warnings,
    detected_features: detectedFeatures,
    unsupported_items: unsupportedItems
  };
}

function clearErrorMessages() {
  if ( conversionErrorList ) {
    conversionErrorList.textContent = '';
  }
  if ( errorMessageSection ) {
    errorMessageSection.style.display = 'none';
  }
}

function showErrorMessages( errors ) {
  if ( !errorMessageSection || !conversionErrorList ) {
    return;
  }

  conversionErrorList.textContent = '';
  for ( const error of errors ) {
    const li = document.createElement( 'li' );
    li.textContent = error;
    conversionErrorList.appendChild( li );
  }
  errorMessageSection.style.display = 'block';
}

function getTagCounts( text, tagName ) {
  const openRegex = new RegExp( `<${ tagName }(?=[\\s>/])`, 'g' );
  const closeRegex = new RegExp( `</${ tagName }>`, 'g' );
  const openCount = ( text.match( openRegex ) || [] ).length;
  const closeCount = ( text.match( closeRegex ) || [] ).length;
  return { openCount, closeCount };
}

function buildJMXErrorMessages( fileText, err ) {
  const errors = [];
  const tagNames = [ 'jmeterTestPlan', 'hashTree', 'HTTPSamplerProxy' ];
  const mismatches = [];

  for ( const tagName of tagNames ) {
    const { openCount, closeCount } = getTagCounts( fileText, tagName );
    if ( openCount !== closeCount ) {
      mismatches.push( `${ tagName } open=${ openCount } close=${ closeCount }` );
    }
  }

  if ( mismatches.length > 0 ) {
    errors.push( 'Missing closing tags in the main XML structure:' );
    errors.push( ...mismatches );
  }

  if ( !fileText.includes( '</jmeterTestPlan>' ) ) {
    errors.push( 'No </jmeterTestPlan> closing tag found at the end of the file.' );
  }

  if ( errors.length === 0 ) {
    errors.push( 'Invalid JMX XML structure. Please verify the file is complete and well-formed.' );
  }

  const errMessage = err?.message ? String( err.message ) : String( err || '' );
  if ( errMessage && !errors.includes( errMessage ) ) {
    errors.push( `Parser detail: ${ errMessage }` );
  }

  return errors;
}

function buildConversionErrorMessages( extension, fileText, err ) {
  if ( extension === 'jmx' ) {
    return buildJMXErrorMessages( fileText || '', err );
  }

  const errMessage = err?.message ? String( err.message ) : String( err || 'Unknown conversion error' );
  return [ errMessage ];
}

function resetSearchState( { clearOutput = false } = {} ) {
  if ( searchBar ) {
    searchBar.style.display = 'none';
  }
  if ( searchInput ) {
    searchInput.value = '';
  }
  searchMatches = [];
  currentMatchIndex = -1;
  originalYamlHtml = '';
  if ( clearOutput ) {
    yamlCode.textContent = '';
  }
  updateSearchUI();
}

function handleFile( file ) {
  if ( !file ) {
    return;
  }

  const ext = getFileExtension( file.name );
  if ( !isSupportedInputExtension( ext ) ) {
    showToast( 'Please select a .json or .jmx file', 'error' );
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileInfo.classList.add( 'visible' );
  uploadZone.classList.add( 'has-file' );
  convertBtn.disabled = false;

  setYamlOutput( '' );
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  searchBtn.disabled = true;
  convertedYaml = null;
  latestAIConversionReport = null;
  validationSection.style.display = 'none';
  resetSearchState();
  hideDownloadOptionsModal();
  clearErrorMessages();
}

function clearFile() {
  selectedFile = null;
  fileInfo.classList.remove( 'visible' );
  uploadZone.classList.remove( 'has-file' );
  convertBtn.disabled = true;
  fileInput.value = '';

  convertedYaml = null;
  latestAIConversionReport = null;
  setYamlOutput( '' );
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  searchBtn.disabled = true;
  validationSection.style.display = 'none';
  resetSearchState();
  hideDownloadOptionsModal();

  const conversionSummary = document.getElementById( 'conversionSummary' );
  const defaultReference = document.getElementById( 'defaultReference' );
  if ( conversionSummary ) conversionSummary.style.display = 'none';
  if ( defaultReference ) defaultReference.style.display = 'block';
  clearErrorMessages();
}

async function convertFile() {
  if ( !selectedFile ) {
    return;
  }

  const extension = getFileExtension( selectedFile.name );
  let fileText = '';
  try {
    fileText = await selectedFile.text();
    const deterministicYaml = convertContent( fileText, extension );
    const aiSettings = getCurrentAISettings();
    latestAIConversionReport = null;

    if ( aiSettings?.enabled ) {
      const aiResult = await convertWithAIEnhancement( {
        sourceType: extension === 'jmx' ? 'jmx' : 'postman',
        filename: selectedFile.name,
        sourceText: fileText,
        deterministicYaml,
        converterReport: buildConverterReport( deterministicYaml ),
        settings: aiSettings
      } );

      convertedYaml = aiResult.yaml;
      latestAIConversionReport = aiResult;
    } else {
      convertedYaml = deterministicYaml;
    }
    suggestedFileName = buildSuggestedFileName( selectedFile.name );

    setYamlOutput( convertedYaml );
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    searchBtn.disabled = false;

    const validation = validateYaml( convertedYaml );
    displayValidation( validation, validationSection, validationResults );
    clearErrorMessages();
    
    // Analyze and display conversion summary
    analyzeConversionSummary( convertedYaml, latestAIConversionReport );
    
    showToast( latestAIConversionReport?.status === 'fallback'
      ? `${ extension.toUpperCase() } → YAML conversion completed with AI fallback`
      : `${ extension.toUpperCase() } → YAML conversion completed` );
  } catch ( err ) {
    convertedYaml = null;
    latestAIConversionReport = null;
    setYamlOutput( `# Conversion error\n# ${ err.message || err }` );
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    searchBtn.disabled = true;
    analyzeConversionSummary( null );
    showErrorMessages( buildConversionErrorMessages( extension, fileText, err ) );
    showToast( 'Could not convert the file', 'error' );
  }
}

function downloadYaml() {
  if ( !convertedYaml ) {
    return;
  }

  showDownloadOptionsModal();
}

function showDownloadOptionsModal() {
  if ( !downloadOptionsModal || !convertedYaml ) {
    return;
  }

  downloadOptionsModal.classList.add( 'visible' );
  downloadOptionsModal.setAttribute( 'aria-hidden', 'false' );
  if ( downloadWithAssertionsBtn ) {
    downloadWithAssertionsBtn.focus();
  }
}

function hideDownloadOptionsModal() {
  if ( !downloadOptionsModal ) {
    return;
  }

  downloadOptionsModal.classList.remove( 'visible' );
  downloadOptionsModal.setAttribute( 'aria-hidden', 'true' );
}

function buildDownloadName( includeAssertions ) {
  if ( includeAssertions ) {
    return suggestedFileName;
  }

  if ( suggestedFileName.endsWith( '.relampo.yml' ) ) {
    return `${ suggestedFileName.slice( 0, -12 ) }.no-assertions.relampo.yml`;
  }

  if ( suggestedFileName.endsWith( '.yml' ) ) {
    return `${ suggestedFileName.slice( 0, -4 ) }-no-assertions.yml`;
  }

  return `${ suggestedFileName }-no-assertions`;
}

function removeAssertionBlocks( yamlText ) {
  if ( !yamlText ) {
    return '';
  }

  const hadTrailingNewline = yamlText.endsWith( '\n' );
  const lines = yamlText.split( '\n' );
  const result = [];

  for ( let i = 0; i < lines.length; ) {
    const line = lines[ i ];
    const assertionMatch = line.match( /^(\s*)(assertions|assert):\s*.*$/ );
    if ( !assertionMatch ) {
      result.push( line );
      i += 1;
      continue;
    }

    const blockIndent = assertionMatch[ 1 ].length;
    i += 1;

    while ( i < lines.length ) {
      const nextLine = lines[ i ];
      if ( !nextLine.trim() ) {
        i += 1;
        continue;
      }

      const nextIndent = ( nextLine.match( /^\s*/ ) || [ '' ] )[ 0 ].length;
      if ( nextIndent <= blockIndent ) {
        break;
      }
      i += 1;
    }

    while ( result.length > 0 && result[ result.length - 1 ].trim() === '' ) {
      result.pop();
    }

    if ( i < lines.length && lines[ i ].trim() !== '' && result.length > 0 ) {
      result.push( '' );
    }
  }

  let output = result.join( '\n' ).replace( /\n{3,}/g, '\n\n' );
  if ( hadTrailingNewline && output && !output.endsWith( '\n' ) ) {
    output += '\n';
  }
  return output;
}

function resetAssertionStats( yamlText ) {
  return yamlText
    .replace( /^(#\s*-\s*Assertions[^:]*:\s*)\d+\s*$/gm, '$10' )
    .replace( /^(#\s*-\s*Custom Assertions[^:]*:\s*)\d+\s*$/gm, '$10' );
}

function prepareYamlForDownload( includeAssertions ) {
  let content = includeAssertions ? convertedYaml : removeAssertionBlocks( convertedYaml );
  if ( !includeAssertions ) {
    content = resetAssertionStats( content );
  }

  const warningText = t( 'downloadOptionsWarning' );
  const loadWarningComment = `# ${ warningText }`;
  return `${ loadWarningComment }\n${ content }`;
}

function triggerDownload( content, fileName ) {
  const blob = new Blob( [ content ], { type: 'text/yaml' } );
  const url = URL.createObjectURL( blob );
  const a = document.createElement( 'a' );
  a.href = url;
  a.download = fileName;
  document.body.appendChild( a );
  a.click();
  document.body.removeChild( a );
  URL.revokeObjectURL( url );
  showToast( `Downloaded: ${ fileName }` );
}

function downloadYamlWithOption( includeAssertions ) {
  if ( !convertedYaml ) {
    return;
  }

  const outputName = buildDownloadName( includeAssertions );
  const outputContent = prepareYamlForDownload( includeAssertions );
  triggerDownload( outputContent, outputName );
  hideDownloadOptionsModal();
}

async function copyToClipboard() {
  if ( !convertedYaml ) {
    return;
  }

  try {
    await navigator.clipboard.writeText( convertedYaml );
    showToast( 'Copied to clipboard' );
  } catch ( _err ) {
    showToast( 'Copy failed', 'error' );
  }
}

function setYamlOutput( content ) {
  yamlOutput.classList.toggle( 'empty', !content );

  if ( !content ) {
    yamlCode.textContent = '';
    return;
  }

  const highlighted = hljs.highlight( content, { language: 'yaml' } );
  yamlCode.innerHTML = highlighted.value;
}

function analyzeConversionSummary( yamlContent, aiConversionReport = null ) {
  const conversionSummary = document.getElementById( 'conversionSummary' );
  const defaultReference = document.getElementById( 'defaultReference' );
  
  if ( !conversionSummary || !defaultReference ) {
    return;
  }
  
  if ( !yamlContent || yamlContent.startsWith( '# Conversion error' ) ) {
    conversionSummary.style.display = 'none';
    defaultReference.style.display = 'block';
    return;
  }

  const summary = {
    requests: 0,
    extractors: 0,
    assertions: 0,
    sparkScripts: 0,
    variables: 0,
    dataSources: 0,
    timers: 0,
    controllers: 0,
    folders: 0,
    warnings: [],
    limitations: []
  };

  // Parse statistics from header
  const statsMatch = yamlContent.match( /# CONVERSION STATS:[\s\S]*?(?=# =====|#\n# |\n\n)/ );
  if ( statsMatch ) {
    const statsLines = statsMatch[ 0 ].split( '\n' );
    statsLines.forEach( line => {
      const requestsMatch = line.match( /# - HTTP Requests: (\d+)/ );
      if ( requestsMatch ) summary.requests = parseInt( requestsMatch[ 1 ] );
      
      const extractorsMatch = line.match( /# - (?:Extractors|Spark Variable Extracts|Response Variables)[^:]*: (\d+)/ );
      if ( extractorsMatch ) summary.extractors = parseInt( extractorsMatch[ 1 ] );
      
      const assertionsMatch = line.match( /# - Assertions: (\d+)/ );
      if ( assertionsMatch ) summary.assertions = parseInt( assertionsMatch[ 1 ] );
      
      const sparkMatch = line.match( /# - Spark (?:Scripts|Logic Blocks)[^:]*: (\d+)/ );
      if ( sparkMatch ) summary.sparkScripts = parseInt( sparkMatch[ 1 ] );
      
      const variablesMatch = line.match( /# - User Variables: (\d+)/ );
      if ( variablesMatch ) summary.variables = parseInt( variablesMatch[ 1 ] );
      
      const dataSourcesMatch = line.match( /# - CSV Data Sources: (\d+)/ );
      if ( dataSourcesMatch ) summary.dataSources = parseInt( dataSourcesMatch[ 1 ] );
      
      const timersMatch = line.match( /# - Timers[^:]*: (\d+)/ );
      if ( timersMatch ) summary.timers = parseInt( timersMatch[ 1 ] );
      
      const controllersMatch = line.match( /# - Controllers[^:]*: (\d+)/ );
      if ( controllersMatch ) summary.controllers = parseInt( controllersMatch[ 1 ] );
      
      const foldersMatch = line.match( /# - Folders\/Groups: (\d+)/ );
      if ( foldersMatch ) summary.folders = parseInt( foldersMatch[ 1 ] );
    } );
  }

  // Parse warnings (JMX format)
  const warningsMatch = yamlContent.match( /# ⚠️\s+UNSUPPORTED ELEMENTS[\s\S]*?(?=# =====|\n\n|test:)/ );
  if ( warningsMatch ) {
    const warningLines = warningsMatch[ 0 ].split( '\n' );
    warningLines.forEach( line => {
      if ( line.match( /#\s+-\s+/ ) ) {
        const warning = line.replace( /#\s+-\s+/, '' ).trim();
        if ( warning && !warning.includes( 'UNSUPPORTED' ) ) {
          summary.warnings.push( warning );
        }
      }
    } );
  }
  
  // Parse limitations (Postman format)
  const limitationsMatch = yamlContent.match( /# LIMITATIONS \(not converted\):[\s\S]*?(?=# =====|\n\n|test:)/ );
  if ( limitationsMatch ) {
    const limitationLines = limitationsMatch[ 0 ].split( '\n' );
    limitationLines.forEach( line => {
      if ( line.match( /#\s+-\s+/ ) ) {
        const limitation = line.replace( /#\s+-\s+/, '' ).trim();
        if ( limitation && !limitation.includes( 'LIMITATIONS' ) ) {
          summary.limitations.push( limitation );
        }
      }
    } );
  }

  if ( aiConversionReport?.warnings?.length ) {
    summary.warnings.push( ...aiConversionReport.warnings );
  }

  if ( aiConversionReport?.manualReviewItems?.length ) {
    summary.limitations.push( ...aiConversionReport.manualReviewItems );
  }

  displayConversionSummary( summary );
}

function displayConversionSummary( summary ) {
  const elementsConverted = document.getElementById( 'elementsConverted' );
  const elementsUnsupported = document.getElementById( 'elementsUnsupported' );
  const unsupportedSection = document.getElementById( 'unsupportedSection' );
  const conversionSummary = document.getElementById( 'conversionSummary' );
  const defaultReference = document.getElementById( 'defaultReference' );

  if ( !elementsConverted || !elementsUnsupported || !unsupportedSection || !conversionSummary || !defaultReference ) {
    return;
  }

  function renderList( listEl, items, emptyLabel ) {
    listEl.textContent = '';

    if ( items.length === 0 ) {
      const li = document.createElement( 'li' );
      li.textContent = emptyLabel;
      listEl.appendChild( li );
      return;
    }

    for ( const item of items ) {
      const li = document.createElement( 'li' );
      li.textContent = item;
      listEl.appendChild( li );
    }
  }

  // Build converted elements list (numbers only, but still render safely)
  const convertedItems = [];
  if ( summary.requests > 0 ) convertedItems.push( `${ summary.requests } HTTP Requests` );
  if ( summary.extractors > 0 ) convertedItems.push( `${ summary.extractors } Response Variables` );
  if ( summary.assertions > 0 ) convertedItems.push( `${ summary.assertions } Assertions` );
  if ( summary.sparkScripts > 0 ) convertedItems.push( `${ summary.sparkScripts } Spark Logic Blocks` );
  if ( summary.variables > 0 ) convertedItems.push( `${ summary.variables } User Variables` );
  if ( summary.dataSources > 0 ) convertedItems.push( `${ summary.dataSources } CSV Data Sources` );
  if ( summary.timers > 0 ) convertedItems.push( `${ summary.timers } Timers` );
  if ( summary.controllers > 0 ) convertedItems.push( `${ summary.controllers } Controllers` );
  if ( summary.folders > 0 ) convertedItems.push( `${ summary.folders } Folders/Groups` );

  renderList( elementsConverted, convertedItems, 'No elements converted' );

  // Unsupported/limitations may contain user-controlled strings; never inject as HTML.
  const allWarnings = [ ...summary.warnings, ...summary.limitations ];
  if ( allWarnings.length > 0 ) {
    renderList( elementsUnsupported, allWarnings, '' );
    unsupportedSection.style.display = 'block';
  } else {
    elementsUnsupported.textContent = '';
    unsupportedSection.style.display = 'none';
  }

  // Show summary panel
  conversionSummary.style.display = 'block';
  defaultReference.style.display = 'none';
}

uploadZone.addEventListener( 'click', () => fileInput.click() );
uploadZone.addEventListener( 'dragover', ( event ) => {
  event.preventDefault();
  uploadZone.classList.add( 'dragover' );
} );
uploadZone.addEventListener( 'dragleave', () => {
  uploadZone.classList.remove( 'dragover' );
} );
uploadZone.addEventListener( 'drop', ( event ) => {
  event.preventDefault();
  uploadZone.classList.remove( 'dragover' );
  handleFile( event.dataTransfer.files[ 0 ] );
} );

fileInput.addEventListener( 'change', ( event ) => {
  handleFile( event.target.files[ 0 ] );
} );

removeFile.addEventListener( 'click', ( event ) => {
  event.stopPropagation();
  clearFile();
} );

convertBtn.addEventListener( 'click', convertFile );
downloadBtn.addEventListener( 'click', downloadYaml );
copyBtn.addEventListener( 'click', copyToClipboard );
searchBtn.addEventListener( 'click', showSearchBar );

if ( downloadWithAssertionsBtn ) {
  downloadWithAssertionsBtn.addEventListener( 'click', () => {
    downloadYamlWithOption( true );
  } );
}

if ( downloadWithoutAssertionsBtn ) {
  downloadWithoutAssertionsBtn.addEventListener( 'click', () => {
    downloadYamlWithOption( false );
  } );
}

if ( downloadCancelBtn ) {
  downloadCancelBtn.addEventListener( 'click', hideDownloadOptionsModal );
}

if ( downloadOptionsModal ) {
  downloadOptionsModal.addEventListener( 'click', ( event ) => {
    if ( event.target === downloadOptionsModal ) {
      hideDownloadOptionsModal();
    }
  } );
}

if ( aiSettingsBtn ) {
  aiSettingsBtn.addEventListener( 'click', showAISettingsModal );
}

if ( aiSettingsModal ) {
  aiSettingsModal.addEventListener( 'click', ( event ) => {
    if ( event.target === aiSettingsModal ) {
      hideAISettingsModal();
    }
  } );
}

if ( aiProvider ) {
  aiProvider.addEventListener( 'change', updateAIProviderDefaults );
}

if ( aiSaveBtn ) {
  aiSaveBtn.addEventListener( 'click', saveAISettings );
}

if ( aiCancelBtn ) {
  aiCancelBtn.addEventListener( 'click', hideAISettingsModal );
}

if ( aiClearBtn ) {
  aiClearBtn.addEventListener( 'click', () => {
    clearAISettings();
    showToast( 'AI settings cleared' );
  } );
}

if ( aiTestBtn ) {
  aiTestBtn.addEventListener( 'click', testAISettings );
}

// Language toggle
const langToggle = document.getElementById( 'langToggle' );
langToggle.addEventListener( 'change', ( e ) => {
  const newLang = e.target.checked ? 'es' : 'en';
  setLanguage( newLang );
} );

// Initialize i18n on page load
initI18n();

// Search functionality
function showSearchBar() {
  if ( searchBar && convertedYaml ) {
    searchBar.style.display = 'flex';
    searchInput.focus();
    originalYamlHtml = yamlCode.innerHTML;
  }
}

function hideSearchBar() {
  if ( !searchBar ) return;
  clearSearchHighlights();
  searchBar.style.display = 'none';
  searchInput.value = '';
}

function clearSearchHighlights() {
  if ( originalYamlHtml ) {
    yamlCode.innerHTML = originalYamlHtml;
  }
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchUI();
}

function performSearch() {
  const query = searchInput.value.trim();
  
  if ( !query || !convertedYaml ) {
    clearSearchHighlights();
    return;
  }
  
  // Reset to original HTML
  yamlCode.innerHTML = originalYamlHtml;
  
  // Escape regex special characters for regex
  const escapedQuery = query.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
  
  // Walk through text nodes and highlight matches
  searchMatches = [];
  highlightInNode( yamlCode, escapedQuery, 0 );
  
  if ( searchMatches.length > 0 ) {
    currentMatchIndex = 0;
    updateHighlightClasses();
    scrollToCurrentMatch();
  } else {
    currentMatchIndex = -1;
  }
  
  updateSearchUI();
}

function highlightInNode( node, query, startIndex ) {
  if ( node.nodeType === Node.TEXT_NODE ) {
    const text = node.textContent;
    const regex = new RegExp( query, 'gi' );
    let match;
    const matches = [];
    
    while ( ( match = regex.exec( text ) ) !== null ) {
      matches.push( { start: match.index, end: match.index + match[0].length, text: match[0] } );
    }
    
    if ( matches.length > 0 ) {
      const parent = node.parentNode;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      
      matches.forEach( m => {
        // Add text before match
        if ( m.start > lastIndex ) {
          frag.appendChild( document.createTextNode( text.slice( lastIndex, m.start ) ) );
        }
        
        // Add highlighted match
        const mark = document.createElement( 'mark' );
        mark.className = 'search-highlight';
        mark.textContent = m.text;
        mark.dataset.matchIndex = searchMatches.length;
        frag.appendChild( mark );
        searchMatches.push( mark );
        
        lastIndex = m.end;
      } );
      
      // Add remaining text
      if ( lastIndex < text.length ) {
        frag.appendChild( document.createTextNode( text.slice( lastIndex ) ) );
      }
      
      parent.replaceChild( frag, node );
    }
  } else if ( node.nodeType === Node.ELEMENT_NODE ) {
    // Skip script and style elements
    if ( node.tagName === 'SCRIPT' || node.tagName === 'STYLE' ) {
      return;
    }
    
    // Process child nodes (make a copy of the list as we'll be modifying it)
    const children = Array.from( node.childNodes );
    children.forEach( child => highlightInNode( child, query, startIndex ) );
  }
}

function updateHighlightClasses() {
  searchMatches.forEach( ( mark, i ) => {
    mark.className = i === currentMatchIndex ? 'search-highlight-current' : 'search-highlight';
  } );
}

function scrollToCurrentMatch() {
  const currentHighlight = yamlCode.querySelector( '.search-highlight-current' );
  if ( currentHighlight ) {
    currentHighlight.scrollIntoView( { behavior: 'smooth', block: 'center' } );
  }
}

function updateSearchUI() {
  if ( searchMatches.length > 0 ) {
    searchCounter.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
    searchPrev.disabled = false;
    searchNext.disabled = false;
  } else {
    searchCounter.textContent = searchInput.value ? '0/0' : '0/0';
    searchPrev.disabled = true;
    searchNext.disabled = true;
  }
}

function goToNextMatch() {
  if ( searchMatches.length === 0 ) return;
  
  currentMatchIndex = ( currentMatchIndex + 1 ) % searchMatches.length;
  updateHighlightPosition();
}

function goToPrevMatch() {
  if ( searchMatches.length === 0 ) return;
  
  currentMatchIndex = ( currentMatchIndex - 1 + searchMatches.length ) % searchMatches.length;
  updateHighlightPosition();
}

function updateHighlightPosition() {
  updateHighlightClasses();
  scrollToCurrentMatch();
  updateSearchUI();
}

// Search event listeners
if ( searchInput ) {
  searchInput.addEventListener( 'input', performSearch );
  searchInput.addEventListener( 'keydown', ( e ) => {
    if ( e.key === 'Enter' ) {
      e.preventDefault();
      if ( e.shiftKey ) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if ( e.key === 'Escape' ) {
      hideSearchBar();
    }
  } );
}

if ( searchNext ) {
  searchNext.addEventListener( 'click', goToNextMatch );
}

if ( searchPrev ) {
  searchPrev.addEventListener( 'click', goToPrevMatch );
}

if ( searchClose ) {
  searchClose.addEventListener( 'click', hideSearchBar );
}

// Keyboard shortcut Ctrl+F / Cmd+F to open search
document.addEventListener( 'keydown', ( e ) => {
  if ( e.key === 'Escape' && aiSettingsModal?.classList.contains( 'visible' ) ) {
    hideAISettingsModal();
    return;
  }

  if ( e.key === 'Escape' && downloadOptionsModal?.classList.contains( 'visible' ) ) {
    hideDownloadOptionsModal();
    return;
  }

  if ( ( e.ctrlKey || e.metaKey ) && e.key === 'f' && convertedYaml ) {
    e.preventDefault();
    showSearchBar();
  }
} );
