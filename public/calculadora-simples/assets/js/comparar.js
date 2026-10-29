/*
 * RC2 Contábil — Comparativo de regimes na Reforma Tributária (interface).
 * Todo conteúdo é inserido via textContent (nunca innerHTML).
 */
(function () {
  'use strict';

  var R = window.RC2_REFORMA;
  var RG = window.RC2_REGIMES;
  var ORDEM = ['A', 'B', 'C', 'D'];
  var CURTO = { A: 'Simples (DAS)', B: 'Simples + IBS/CBS por fora', C: 'Lucro Presumido', D: 'Lucro Real' };

  /* ---------------- Utilitários ---------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(v) { return brl.format(v || 0); }
  function pct(v, casas) {
    casas = casas === undefined ? 2 : casas;
    return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
  }
  function numBR(v) { return String(v).replace('.', ','); }

  function parseNumero(str) {
    var s = String(str || '').trim().replace(/[R$%\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 && n < 1e12 ? n : NaN;
  }

  /* ---------------- Formulário ---------------- */
  var PERCENTUAIS = [
    ['#c-b2b', 'Vendas para outras empresas'], ['#c-margem', 'Lucro antes do IR'],
    ['#c-icms-saida', 'ICMS nas vendas'], ['#c-icms-entrada', 'ICMS nas compras'], ['#c-iss', 'ISS'],
    ['#c-pres-irpj', 'Presunção do IRPJ'], ['#c-pres-csll', 'Presunção da CSLL'],
    ['#p-cbs', 'CBS de referência'], ['#p-ibs', 'IBS pleno'], ['#p-cred-sn', 'Crédito médio em compras do Simples'],
    ['#p-inss', 'INSS patronal + RAT'], ['#p-terceiros', 'Terceiros']
  ];

  function tipoDoAnexo(anexo) { return anexo === 'I' || anexo === 'II' ? 'comercio' : 'servico'; }

  function ajustarAtividade() {
    var tipo = tipoDoAnexo($('#c-anexo').value);
    $all('[data-tipo]').forEach(function (el) { el.hidden = el.getAttribute('data-tipo') !== tipo; });
    var pres = R.PREMISSAS.presuncao[tipo];
    $('#c-pres-irpj').value = numBR(pres.irpj);
    $('#c-pres-csll').value = numBR(pres.csll);
  }

  function preencherPremissas() {
    var p = R.PREMISSAS;
    $('#p-cbs').value = numBR(p.cbsReferencia);
    $('#p-ibs').value = numBR(p.ibsPleno);
    $('#p-cred-sn').value = numBR(p.creditoFornecedorSimples);
    $('#p-inss').value = numBR(p.inssPatronalRat);
    $('#p-terceiros').value = numBR(p.terceiros);
    $('#p-lc224').checked = p.acrescimoLc224;
  }

  function lerEntrada() {
    var erros = [];
    function valor(sel, nome, obrigatorio) {
      var raw = $(sel).value;
      if (!String(raw).trim()) {
        if (obrigatorio) erros.push('Informe: ' + nome + '.');
        return 0;
      }
      var n = parseNumero(raw);
      if (isNaN(n)) { erros.push('Valor inválido em: ' + nome + '.'); return 0; }
      return n;
    }
    var tipo = tipoDoAnexo($('#c-anexo').value);
    var entrada = {
      ano: Number($('#c-ano').value),
      anexo: $('#c-anexo').value,
      reducao: Number($('#c-reducao').value),
      receita: valor('#c-receita', 'receita bruta anual', true),
      folha: valor('#c-folha', 'folha anual'),
      comprasRegular: valor('#c-compras', 'compras de fornecedores do regime regular'),
      comprasSimples: valor('#c-compras-sn', 'compras de fornecedores do Simples')
    };
    var p = {};
    PERCENTUAIS.forEach(function (par) {
      var campo = $(par[0]);
      if (campo.closest('[hidden]')) return;
      var v = valor(par[0], par[1], true);
      if (v > 100) erros.push(par[1] + ': use um percentual entre 0 e 100.');
      p[par[0]] = v;
    });
    if (entrada.receita <= 0 && !erros.length) erros.push('A receita bruta anual precisa ser maior que zero.');
    entrada.vendasEmpresas = (p['#c-b2b'] || 0) / 100;
    entrada.margemReal = p['#c-margem'] || 0;
    entrada.icmsSaida = tipo === 'comercio' ? p['#c-icms-saida'] : 0;
    entrada.icmsEntrada = tipo === 'comercio' ? p['#c-icms-entrada'] : 0;
    entrada.iss = tipo === 'servico' ? p['#c-iss'] : 0;
    entrada.presuncao = { irpj: p['#c-pres-irpj'], csll: p['#c-pres-csll'] };
    entrada.premissas = {
      cbsReferencia: p['#p-cbs'], ibsPleno: p['#p-ibs'], creditoFornecedorSimples: p['#p-cred-sn'],
      inssPatronalRat: p['#p-inss'], terceiros: p['#p-terceiros'], acrescimoLc224: $('#p-lc224').checked
    };
    return { entrada: entrada, erros: erros };
  }

  function mostrarErros(erros) {
    var box = $('#c-erros');
    limpar(box);
    if (!erros.length) { box.hidden = true; return; }
    var ul = h('ul');
    erros.forEach(function (e) { append(ul, h('li', { text: e })); });
    append(box, [h('strong', { text: 'Revise os campos:' }), ul]);
    box.hidden = false;
    box.setAttribute('tabindex', '-1');
    box.focus();
  }

  /* ---------------- Resultado ---------------- */
  function cenario(res, id) {
    for (var i = 0; i < res.cenarios.length; i++) if (res.cenarios[i].id === id) return res.cenarios[i];
    return null;
  }

  function blocoRecomendacao(res) {
    var rec = res.recomendacao;
    if (!rec) return h('div', { class: 'notice notice--error', text: 'Nenhum regime aplicável com os valores informados.' });
    var corpo = h('div', null,
      h('strong', { text: 'Em ' + res.ano + ', o menor imposto estimado é no ' + cenario(res, rec.id).nome + '.' }),
      h('p', { text: rec.motivo }));
    if (rec.alternativa) append(corpo, h('p', { text: rec.motivoAlternativa }));
    if (res.fatorR !== null && res.fatorR !== undefined) {
      append(corpo, h('p', { class: 'muted', text: 'Fator R de ' + pct(res.fatorR) + ': no Simples a atividade fica no Anexo ' + res.anexoEfetivo + '.' }));
    }
    return h('div', { class: 'notice notice--ok recomendacao' }, corpo);
  }

  function tabelaAnos(porAno) {
    var thead = h('thead', null, h('tr', null,
      h('th', { scope: 'col', text: 'Ano' }),
      ORDEM.map(function (id) { return h('th', { scope: 'col', class: 'num', text: CURTO[id] }); })));
    var tbody = h('tbody');
    porAno.forEach(function (res) {
      var melhor = res.melhor ? res.melhor.id : null;
      var tr = h('tr', null, h('th', { scope: 'row', text: String(res.ano) }));
      ORDEM.forEach(function (id) {
        var c = cenario(res, id);
        var td = h('td', { class: 'num' + (id === melhor ? ' melhor' : '') });
        if (!c.aplicavel) td.textContent = '—';
        else {
          append(td, moeda(c.total));
          append(td, h('small', { text: pct(c.carga) + ' da receita' }));
          if (id === melhor) append(td, h('span', { class: 'tag tag--ok', text: 'menor' }));
        }
        append(tr, td);
      });
      append(tbody, tr);
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'tabela-anos' },
      h('caption', { class: 'sr-only', text: 'Imposto anual estimado por regime e ano' }), thead, tbody));
  }

  function barras(res) {
    var validos = res.cenarios.filter(function (c) { return c.aplicavel; });
    var max = Math.max.apply(null, validos.map(function (c) { return c.total; }).concat([1]));
    return h('div', { class: 'bars' }, ORDEM.map(function (id) {
      var c = cenario(res, id);
      var fill = h('span', { class: 'bar__fill' + (res.melhor && res.melhor.id === id ? ' bar__fill--ok' : '') });
      fill.style.width = c.aplicavel ? Math.max(1, c.total / max * 100) + '%' : '0';
      return h('div', { class: 'bar bar--regime' },
        h('span', { class: 'bar__nome', text: CURTO[id] }),
        h('span', { class: 'bar__track' }, fill),
        h('span', { class: 'bar__valor', text: c.aplicavel ? moeda(c.total) : 'não se aplica' }));
    }));
  }

  function cartaoRegime(res, c) {
    var melhor = res.melhor && res.melhor.id === c.id;
    var card = h('article', { class: 'regime' + (melhor ? ' regime--melhor' : '') },
      h('header', { class: 'regime__head' },
        h('h4', { text: c.nome }),
        melhor ? h('span', { class: 'tag tag--ok', text: 'menor imposto' }) : null));
    if (!c.aplicavel) {
      append(card, h('p', { class: 'muted', text: c.motivo }));
      return card;
    }
    append(card, h('div', { class: 'regime__total' },
      h('span', { text: moeda(c.total) }),
      h('small', { text: pct(c.carga) + ' da receita' })));
    var tbody = h('tbody');
    c.linhas.forEach(function (l) {
      append(tbody, h('tr', null,
        h('td', null, l.nome, l.obs ? h('span', { class: 'cnae-obs', text: l.obs }) : null),
        h('td', { class: 'num', text: moeda(l.valor) })));
    });
    append(card, h('div', { class: 'table-wrap' }, h('table', null, tbody)));
    var dl = h('dl', { class: 'dl regime__dl' },
      h('div', null, h('dt', { text: 'Crédito de IBS/CBS que seus clientes empresas aproveitam' }), h('dd', { text: moeda(c.creditoCliente) })));
    if (c.saldoCredor > 0) {
      append(dl, h('div', null, h('dt', { text: 'Saldo credor de IBS/CBS (não abatido do custo)' }), h('dd', { text: moeda(c.saldoCredor) })));
    }
    append(card, dl);
    c.avisos.forEach(function (a) { append(card, h('p', { class: 'disclaimer-mini', text: a })); });
    return card;
  }

  function textoPremissas(res) {
    var a = res.aliquotasIbsCbs;
    var partes = [
      'CBS ' + pct(a.cbs) + ' e IBS ' + pct(a.ibs, 3) + ' no regime regular',
      res.fracaoIcmsIss === 1 ? 'ICMS/ISS integrais' :
        res.fracaoIcmsIss === 0 ? 'ICMS/ISS extintos' : 'ICMS/ISS a ' + Math.round(res.fracaoIcmsIss * 10) + '/10 da alíquota'
    ];
    return 'Premissas de ' + res.ano + ': ' + partes.join('; ') + '.';
  }

  function renderizar(entrada) {
    var porAno = RG.compararAnos(entrada);
    var res = porAno.filter(function (r) { return r.ano === entrada.ano; })[0];
    var corpo = $('#c-resultado-corpo');
    limpar(corpo);
    $('#c-resultado-sub').textContent = 'Receita anual de ' + moeda(entrada.receita) + ' · valores anuais estimados.';

    append(corpo, blocoRecomendacao(res));
    append(corpo, h('div', { class: 'res-section' },
      h('h3', { text: 'Imposto anual em cada ano da transição' }),
      tabelaAnos(porAno),
      h('p', { class: 'hint', text: 'De 2027 a 2032 o ICMS/ISS diminui e o IBS aumenta; a partir de 2033 vale o modelo final. Valores com as premissas atuais, que podem mudar.' })));
    append(corpo, h('div', { class: 'res-section' },
      h('h3', { text: 'Detalhamento de ' + res.ano }),
      barras(res),
      h('div', { class: 'regimes' }, ORDEM.map(function (id) { return cartaoRegime(res, cenario(res, id)); })),
      h('p', { class: 'hint', text: textoPremissas(res) })));
    append(corpo, h('p', { class: 'disclaimer-mini', text: 'Estimativa ilustrativa com faturamento estável no ano. Não considera monofásicos, substituição tributária, regimes específicos, benefícios fiscais nem ajustes do Lucro Real. Confirme com um contador antes de decidir.' }));

    var box = $('#c-resultado');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- Inicialização ---------------- */
  function iniciar() {
    var sel = $('#c-ano');
    R.ANOS.forEach(function (ano) { append(sel, h('option', { value: ano, text: String(ano) })); });
    preencherPremissas();
    ajustarAtividade();
    $('#c-revisao').textContent = R.REVISAO;
    $('#ano').textContent = String(new Date().getFullYear());

    $('#c-anexo').addEventListener('change', ajustarAtividade);
    $('#form-comparar').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var lido = lerEntrada();
      mostrarErros(lido.erros);
      if (lido.erros.length) return;
      renderizar(lido.entrada);
    });
    $('#c-limpar').addEventListener('click', function () {
      $('#form-comparar').reset();
      preencherPremissas();
      ajustarAtividade();
      mostrarErros([]);
      $('#c-resultado').hidden = true;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
