/**
 * Translates raw browser/DOM exceptions and API errors into clear, friendly Russian messages.
 */
export function getRussianErrorMessage(err) {
  if (!err) return 'Произошла неизвестная ошибка. Попробуйте еще раз.';

  const msg = typeof err === 'string' ? err : (err.message || String(err));

  if (
    msg.includes('did not match the expected pattern') || 
    msg.includes('InvalidStateError') ||
    msg.includes('TypeMismatchError')
  ) {
    return 'Не удалось обработать формат фотографии. Пожалуйста, сделайте новое фото на камеру или выберите другой файл.';
  }

  if (
    msg.includes('Failed to fetch') || 
    msg.includes('NetworkError') || 
    msg.includes('load failed') ||
    msg.includes('Network request failed')
  ) {
    return 'Ошибка сети. Не удалось связаться с сервером. Проверьте интернет-соединение.';
  }

  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Не авторизован')) {
    return 'Сессия исткла. Пожалуйста, перезапустите приложение через Telegram.';
  }

  if (msg.includes('404') || msg.includes('Not Found')) {
    return 'Запрашиваемая страница или файл не найдены.';
  }

  if (msg.includes('500') || msg.includes('Internal Server Error')) {
    return 'Сервер временно недоступен. Попробуйте через несколько секунд.';
  }

  if (msg.includes('file size') || msg.includes('too large')) {
    return 'Файл слишком большой. Пожалуйста, выберите фото меньшего размера.';
  }

  return msg;
}
