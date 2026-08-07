/**
 * NETLIFY FUNCTION PROXY - App Nhân Sự Nhà Mình (V3.3.2)
 *
 * Nhiệm vụ: nhận POST từ frontend (cùng domain Netlify) rồi chuyển tiếp
 * nguyên văn sang Google Apps Script /exec, trả JSON về lại frontend.
 * Nhờ đó mobile browser không phải fetch trực tiếp sang script.google.com.
 *
 * Cấu hình link Apps Script (chọn 1 trong 2 cách):
 *   Cách 1 (khuyên dùng): đặt biến môi trường trên Netlify
 *     Site settings -> Environment variables -> Add:
 *       Key:   APPS_SCRIPT_URL
 *       Value: https://script.google.com/macros/s/AKfycb.../exec
 *     (sau khi thêm biến phải Deploy lại site để function nhận giá trị mới)
 *   Cách 2 (đơn giản): thay trực tiếp link vào dòng dưới đây,
 *     chỗ chữ 'DAN_LINK_APPS_SCRIPT_EXEC_VAO_DAY'.
 */
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'DAN_LINK_APPS_SCRIPT_EXEC_VAO_DAY';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS_HEADERS),
    body: JSON.stringify(obj)
  };
}

exports.handler = async function (event) {
  // Preflight (nếu có) -> trả 204 rỗng
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, message: 'Proxy chỉ hỗ trợ POST.' });
  }

  // Chưa cấu hình link Apps Script -> báo rõ để dễ sửa
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('https://script.google.com') !== 0) {
    return jsonResponse(500, {
      success: false,
      message: 'Proxy chưa cấu hình APPS_SCRIPT_URL. Thêm biến môi trường APPS_SCRIPT_URL trên Netlify (hoặc sửa trong netlify/functions/api.js) rồi deploy lại.'
    });
  }

  try {
    // Chuyển tiếp nguyên body { action, data } sang Apps Script.
    // Giữ Content-Type text/plain đúng như frontend gọi trực tiếp trước đây.
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: event.body || '{}',
      redirect: 'follow' // Apps Script /exec luôn redirect 302 sang googleusercontent
    });

    const text = await res.text();

    // Apps Script phải trả JSON. Nếu trả HTML (sai link, chưa deploy Anyone,
    // hoặc script lỗi) thì báo rõ thay vì đẩy HTML về app.
    try {
      JSON.parse(text);
    } catch (e) {
      return jsonResponse(502, {
        success: false,
        message: 'Apps Script trả về dữ liệu không phải JSON. Kiểm tra lại link /exec và deployment (Execute as: Me, Who has access: Anyone).',
        error: text.slice(0, 300)
      });
    }

    return {
      statusCode: 200,
      headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS_HEADERS),
      body: text
    };
  } catch (err) {
    return jsonResponse(502, {
      success: false,
      message: 'Proxy không gọi được Apps Script',
      error: String((err && err.message) || err)
    });
  }
};
