import hljs from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/highlight.min.js';
import yaml from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/languages/yaml.min.js';
import { convertContent } from './helpers/conversion.js';
import { buildSuggestedFileName, getFileExtension, isSupportedInputExtension } from './helpers/file.js';
import { createToastNotifier } from './helpers/toast.js';
import { displayValidation, validateYaml } from './helpers/validation.js';
import { initI18n, setLanguage, getCurrentLanguage, t } from './i18n.js';

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
const copyBtn = document.getElementById( 'copyBtn' );
const clearBtn = document.getElementById( 'clearBtn' );
const searchBtn = document.getElementById( 'searchBtn' );
const toast = document.getElementById( 'toast' );
const toastMessage = document.getElementById( 'toastMessage' );
const validationSection = document.getElementById( 'validationSection' );
const validationResults = document.getElementById( 'validationResults' );

let selectedFile = null;
let convertedYaml = null;
let suggestedFileName = 'converted.relampo.yml';
const showToast = createToastNotifier( toast, toastMessage );

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
  clearBtn.disabled = true;
  convertedYaml = null;
  validationSection.style.display = 'none';
}

function clearFile() {
  selectedFile = null;
  fileInfo.classList.remove( 'visible' );
  uploadZone.classList.remove( 'has-file' );
  convertBtn.disabled = true;
  fileInput.value = '';
}

async function convertFile() {
  if ( !selectedFile ) {
    return;
  }

  const extension = getFileExtension( selectedFile.name );
  try {
    const fileText = await selectedFile.text();
    convertedYaml = convertContent( fileText, extension );
    suggestedFileName = buildSuggestedFileName( selectedFile.name );

    setYamlOutput( convertedYaml );
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    clearBtn.disabled = false;
    searchBtn.disabled = false;

    const validation = validateYaml( convertedYaml );
    displayValidation( validation, validationSection, validationResults );
    
    // Analyze and display conversion summary
    analyzeConversionSummary( convertedYaml );
    
    showToast( `${ extension.toUpperCase() } → YAML conversion completed` );
  } catch ( err ) {
    convertedYaml = null;
    setYamlOutput( `# Conversion error\n# ${ err.message || err }` );
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    clearBtn.disabled = true;
    searchBtn.disabled = true;
    analyzeConversionSummary( null );
    showToast( 'Could not convert the file', 'error' );
  }
}

function downloadYaml() {
  if ( !convertedYaml ) {
    return;
  }

  const blob = new Blob( [ convertedYaml ], { type: 'text/yaml' } );
  const url = URL.createObjectURL( blob );
  const a = document.createElement( 'a' );
  a.href = url;
  a.download = suggestedFileName;
  document.body.appendChild( a );
  a.click();
  document.body.removeChild( a );
  URL.revokeObjectURL( url );
  showToast( `Downloaded: ${ suggestedFileName }` );
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

function analyzeConversionSummary( yamlContent ) {
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
      
      const extractorsMatch = line.match( /# - Extractors[^:]*: (\d+)/ );
      if ( extractorsMatch ) summary.extractors = parseInt( extractorsMatch[ 1 ] );
      
      const assertionsMatch = line.match( /# - Assertions: (\d+)/ );
      if ( assertionsMatch ) summary.assertions = parseInt( assertionsMatch[ 1 ] );
      
      const sparkMatch = line.match( /# - Spark Scripts[^:]*: (\d+)/ );
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
  
  // Build converted elements list
  const convertedItems = [];
  if ( summary.requests > 0 ) convertedItems.push( `${ summary.requests } HTTP Requests` );
  if ( summary.extractors > 0 ) convertedItems.push( `${ summary.extractors } Extractors` );
  if ( summary.assertions > 0 ) convertedItems.push( `${ summary.assertions } Assertions` );
  if ( summary.sparkScripts > 0 ) convertedItems.push( `${ summary.sparkScripts } Spark Scripts` );
  if ( summary.variables > 0 ) convertedItems.push( `${ summary.variables } User Variables` );
  if ( summary.dataSources > 0 ) convertedItems.push( `${ summary.dataSources } CSV Data Sources` );
  if ( summary.timers > 0 ) convertedItems.push( `${ summary.timers } Timers` );
  if ( summary.controllers > 0 ) convertedItems.push( `${ summary.controllers } Controllers` );
  if ( summary.folders > 0 ) convertedItems.push( `${ summary.folders } Folders/Groups` );
  
  if ( convertedItems.length === 0 ) {
    elementsConverted.innerHTML = '<li>No elements converted</li>';
  } else {
    elementsConverted.innerHTML = convertedItems.map( item => `<li>${ item }</li>` ).join( '' );
  }
  
  // Build unsupported/limitations list (combine both JMX warnings and Postman limitations)
  const allWarnings = [ ...summary.warnings, ...summary.limitations ];
  if ( allWarnings.length > 0 ) {
    elementsUnsupported.innerHTML = allWarnings.map( warning => `<li>${ warning }</li>` ).join( '' );
    unsupportedSection.style.display = 'block';
  } else {
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
clearBtn.addEventListener( 'click', () => {
  convertedYaml = null;
  setYamlOutput( '' );
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
  clearBtn.disabled = true;
  searchBtn.disabled = true;
  validationSection.style.display = 'none';
  const conversionSummary = document.getElementById( 'conversionSummary' );
  const defaultReference = document.getElementById( 'defaultReference' );
  if ( conversionSummary ) conversionSummary.style.display = 'none';
  if ( defaultReference ) defaultReference.style.display = 'block';
} );

// Language toggle
const langToggle = document.getElementById( 'langToggle' );
langToggle.addEventListener( 'change', ( e ) => {
  const newLang = e.target.checked ? 'es' : 'en';
  setLanguage( newLang );
} );

// Initialize i18n on page load
initI18n();

// Search functionality
const searchBar = document.getElementById( 'searchBar' );
const searchInput = document.getElementById( 'searchInput' );
const searchCounter = document.getElementById( 'searchCounter' );
const searchPrev = document.getElementById( 'searchPrev' );
const searchNext = document.getElementById( 'searchNext' );
const searchClose = document.getElementById( 'searchClose' );

let searchMatches = [];
let currentMatchIndex = -1;
let originalYamlHtml = '';

function showSearchBar() {
  if ( searchBar && convertedYaml ) {
    searchBar.style.display = 'flex';
    searchInput.focus();
    originalYamlHtml = yamlCode.innerHTML;
  }
}

function hideSearchBar() {
  if ( searchBar ) {
    searchBar.style.display = 'none';
    searchInput.value = '';
    clearSearchHighlights();
  }
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
  if ( ( e.ctrlKey || e.metaKey ) && e.key === 'f' && convertedYaml ) {
    e.preventDefault();
    showSearchBar();
  }
} );

// Update convertBtn to also hide search
const originalConvertBtnHandler = convertFile;
convertBtn.removeEventListener( 'click', convertFile );
convertBtn.addEventListener( 'click', async () => {
  await originalConvertBtnHandler();
  if ( searchBar && searchBar.style.display !== 'none' ) {
    hideSearchBar();
  }
} );
