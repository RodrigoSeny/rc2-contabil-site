// Uso (na pasta deste script): curl -o lcp214.htm https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm && node html2txt.js && node extrair.js
// Converte o HTML do Planalto em texto, descartando o que está riscado (texto revogado).
const fs = require('fs');
const s = fs.readFileSync('lcp214.htm', 'latin1');
const VOID = new Set(['br','img','hr','meta','link','input','col','area','base','wbr']);
const out = [];
const stack = []; // { tag, riscado }
const riscado = () => stack.some((e) => e.riscado);
const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|<!--[\s\S]*?-->|([^<]+)/g;
let m, skipScript = false;
while ((m = re.exec(s))) {
  if (m[4] !== undefined) { if (!skipScript && !riscado()) out.push(m[4]); continue; }
  if (!m[2]) continue;
  const tag = m[2].toLowerCase(), fecha = m[1] === '/', attrs = m[3] || '';
  if (tag === 'script' || tag === 'style') { skipScript = !fecha; continue; }
  if (tag === 'br') { out.push('\n'); continue; }
  if (VOID.has(tag) || attrs.trim().endsWith('/')) continue;
  if (!fecha) {
    stack.push({ tag, riscado: /line-through/i.test(attrs) || tag === 'strike' || tag === 's' || tag === 'del' });
  } else {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].tag === tag) { stack.length = k; break; }
    if (['p','tr','td','th','div','h1','h2','h3','h4','li','table'].includes(tag)) out.push('\n');
  }
}
let t = out.join('').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ')
  .replace(/[ \t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n');
fs.writeFileSync('lcp214-vigente.txt', t);
console.log(t.length);
