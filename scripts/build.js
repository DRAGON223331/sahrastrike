// يجهّز مجلد public/ (موقع ثابت) للرفع على Vercel أو أي استضافة ملفات ثابتة
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');
fs.rmSync(out, { recursive: true, force: true });
const cp = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });
cp('client', '.');
cp('shared', 'shared');
cp('assets', 'assets');
cp('node_modules/three/build', 'vendor/three');
// لو متحدد SERVER_URL وقت البناء، يتكتب في config.js
if (process.env.SERVER_URL) {
  fs.writeFileSync(path.join(out, 'config.js'), `window.SERVER_URL = ${JSON.stringify(process.env.SERVER_URL)};\n`);
}
console.log('تم تجهيز public/');
