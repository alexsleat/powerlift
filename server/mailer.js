const https = require('https');

async function sendMail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // No API key configured — log to console (dev / self-hosted without email)
    console.log(`[MAILER] No RESEND_API_KEY set. Would send to ${to}:\n  Subject: ${subject}\n  ${text}`);
    return;
  }

  const body = JSON.stringify({
    from:    process.env.SMTP_FROM || 'Powerlift <noreply@example.com>',
    to:      [to],
    subject,
    text,
    html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendMail };
