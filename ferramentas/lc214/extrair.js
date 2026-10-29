// Depois do html2txt.js: gera partilha-lc214.json e confere se cada linha de partilha soma 100%.
// Extrai da LC 214/2025 (texto vigente) as alíquotas e a partilha dos Anexos I a V do Simples, por ano.
const fs = require('fs');
const linhas = fs.readFileSync('lcp214-vigente.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const ini = (re, de = 0) => linhas.findIndex((l, i) => i >= de && re.test(l));
const pct = (l) => { const m = l.match(/^(\d{1,3},\d{1,4})%/); return m ? Number(m[1].replace(',', '.')) : null; };
const moeda = (l) => { const m = l.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})$/); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };
const TRIB = /^(IRPJ|CSLL|CBS|CPP|ICMS|ISS|IBS|IPI)\b/;

const base = ini(/^ANEXO XVIII$/);
const anexoIni = { I: ini(/^ANEXO I$/, base), II: ini(/^ANEXO II$/, base), III: ini(/^ANEXO III$/, base), IV: ini(/^ANEXO IV$/, base), V: ini(/^ANEXO V$/, base) };
anexoIni.fim = ini(/^ANEXO VII$/, anexoIni.V);
const ordem = ['I', 'II', 'III', 'IV', 'V', 'fim'];
const res = {};
for (let a = 0; a < 5; a++) {
  const nome = ordem[a];
  const L = linhas.slice(anexoIni[nome], anexoIni[ordem[a + 1]]);
  const out = (res[nome] = { aliquotas: {}, partilha: {} });
  let periodo = null;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    let m;
    if (/calend[aá]rios? 2027 e 2028/.test(l)) periodo = '2027';
    else if ((m = l.match(/calend[aá]rio (20\d\d)/))) periodo = m[1];
    else if ((m = l.match(/Vig[eê]ncia: 1º\/1\/(20\d\d)/))) periodo = m[1];
    // Tabela de alíquotas: "Valor a Deduzir" seguido de 6 faixas
    if (/^Valor a Deduzir/.test(l)) {
      const faixas = [];
      let j = i + 1;
      while (faixas.length < 6 && j < L.length) {
        if (/^\d[ªºa] Faixa/.test(L[j])) {
          let k = j + 1, aliq = null, ded = 0;
          while (k < L.length && !/^\d[ªºa] Faixa|^Faixas|^Partilha/.test(L[k])) {
            if (aliq === null && pct(L[k]) !== null) aliq = pct(L[k]);
            else if (aliq !== null && moeda(L[k]) !== null) { ded = moeda(L[k]); break; }
            k++;
          }
          faixas.push({ aliq, ded });
        }
        j++;
      }
      out.aliquotas[periodo] = faixas;
    }
    // Tabela de partilha: cabeçalho de tributos e 6 faixas
    if (/^dos Tributos$|^Percentual de Repartição dos Tributos$/.test(l) && !out.partilha[periodo]) {
      const trib = [];
      let j = i + 1;
      while (!/^1ª Faixa/.test(L[j])) { const t = L[j].match(TRIB); if (t) trib.push(t[1]); j++; }
      const faixas = [];
      while (faixas.length < 6) {
        if (/^\d[ªºa] Faixa$/.test(L[j])) {
          const v = []; let k = j + 1;
          while (k < L.length && pct(L[k]) !== null) { v.push(pct(L[k])); k++; }
          const row = {}; trib.forEach((t, n) => (row[t] = v[n] ?? 0));
          faixas.push(row); j = k;
        } else j++;
      }
      out.partilha[periodo] = { tributos: trib, faixas };
    }
  }
}
fs.writeFileSync('partilha-lc214.json', JSON.stringify(res, null, 1));
for (const [an, d] of Object.entries(res)) {
  console.log(`Anexo ${an}: alíquotas ${Object.keys(d.aliquotas)} partilha ${Object.keys(d.partilha)}`);
  for (const [p, a] of Object.entries(d.aliquotas)) console.log('  aliq', p, a.map((f) => f.aliq + '/' + f.ded).join(' '));
  for (const [p, t] of Object.entries(d.partilha)) {
    const somas = t.faixas.map((r) => Object.values(r).reduce((s, v) => s + v, 0).toFixed(2));
    console.log('  part', p, t.tributos.join(','), 'somas', somas.join(' '));
  }
}
