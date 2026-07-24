export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[TraditionalTalmudDaf] Clipboard API failed, trying fallback:', e);
    }
  }

  // Fallback method 1: Textarea copy
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  textArea.setAttribute("readonly", "");
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error('[TraditionalTalmudDaf] Fallback copy failed:', err);
    document.body.removeChild(textArea);
  }

  // Fallback method 2: Prompt dialog
  try {
    window.prompt("Копирование заблокировано браузером. Скопируйте текст вручную (Ctrl+C):", text);
    return true;
  } catch (e) {
    console.error('[TraditionalTalmudDaf] Prompt fallback failed:', e);
    return false;
  }
};
