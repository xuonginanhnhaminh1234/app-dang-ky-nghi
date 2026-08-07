async function api(action, data) {
  showLoading(true);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // tránh CORS preflight với Apps Script
      body: JSON.stringify({ action: action, data: data || {} })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Không kết nối được máy chủ. Kiểm tra mạng hoặc API_URL.' };
  } finally {
    showLoading(false);
  }
}
