export function createToastNotifier(toastElement, toastMessageElement) {
  return function showToast(message, type = 'success') {
    toastElement.className = `toast ${type}`;
    toastMessageElement.textContent = message;
    toastElement.classList.add('visible');
    setTimeout(() => toastElement.classList.remove('visible'), 3000);
  };
}
