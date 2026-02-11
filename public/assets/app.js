import { convertContent } from './helpers/conversion.js';
import { getFileExtension, isSupportedInputExtension, buildSuggestedFileName } from './helpers/file.js';
import { createToastNotifier } from './helpers/toast.js';
import { validateYaml, displayValidation } from './helpers/validation.js';
import hljs from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/highlight.min.js';
import yaml from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/es/languages/yaml.min.js';

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

    const validation = validateYaml( convertedYaml );
    displayValidation( validation, validationSection, validationResults );
    showToast( `${ extension.toUpperCase() } → YAML conversion completed` );
  } catch ( err ) {
    convertedYaml = null;
    setYamlOutput( `# Conversion error\n# ${ err.message || err }` );
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
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
