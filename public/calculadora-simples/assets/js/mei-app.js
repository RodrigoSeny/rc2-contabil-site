/*
 * RC2 Contábil — página "Ainda vale a pena ser MEI?" (interface).
 * Cálculo em mei.js; aqui só lê o formulário e mostra a resposta.
 */
(function () {
  'use strict';

  var T = window.RC2_TABELAS;
  var C = window.RC2_CALCULO;
  var M = window.RC2_MEI;

  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function radio(nome) { var el = document.querySelector('input[name="' + nome + '"]:checked'); return el ? el.value : null; }

  /* Monta elementos: h('div', { class: 'x', text: 'y' }, filhos...) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var f = arguments[i];
      if (f === null || f === undefined || f === false) continue;
      (Array.isArray(f) ? f : [f]).forEach(function (x) {
        if (x !== null && x !== undefined && x !== false) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
      });
    }
    return el;
  }

  var brl = M.brl;
  function mensal(c) { return c === null ? '—' : brl(Math.round(c / 12)); }
  function pctTexto(centesimos) { return (centesimos / 100).toFixed(2).replace('.', ',') + '%'; }

  /* Campos de dinheiro: texto → centavos inteiros (calculo.js), formatação ao sair do campo. */
  function centavos(el) {
    var s = el.value.replace(/R\$\s?/i, '').replace(/%/g, '').trim();
    if (!s) return null;
    return C.textoParaCentesimos(s);
  }
  function formatarCampo(el) {
    var v = centavos(el);
    if (v === null || isNaN(v)) return;
    if (el.id === 'm-empregados') { el.value = String(Math.round(v / 100)); return; }
    el.value = el.id === 'm-part' ? pctTexto(v) : brl(v);
  }

  var anoAtual = new Date().getFullYear();
  var anos = Object.keys(T.MEI.anos).map(Number).sort(function (a, b) { return a - b; });

  function preencherAnos() {
    var sel = $('#m-ano');
    anos.forEach(function (a) {
      var M0 = C.meiDoAno(a);
      sel.appendChild(h('option', { value: String(a), text: a + ' — limite do MEI ' + M.brlInteiro(M0.limiteAnual) + (M0.salarioOficial ? '' : ' (estimativa)') }));
    });
    var inicial = anos.indexOf(anoAtual) >= 0 ? anoAtual : anoAtual < anos[0] ? anos[0] : anos[anos.length - 1];
    sel.value = String(inicial);
  }

  function padroesDoAno() {
    var ano = Number($('#m-ano').value);
    var M0 = C.meiDoAno(ano);
    $('#m-ano-hint').textContent = 'Em ' + ano + ' o MEI pode faturar até ' + M.brlInteiro(M0.limiteAnual) + ' por ano (' + M.brlInteiro(M0.limiteAnual / 12) + ' por mês, em média) e ter até ' + M0.empregados + (M0.empregados === 1 ? ' empregado.' : ' empregados.') + (M0.salarioOficial ? '' : ' Salário mínimo estimado.');
    var pl = $('#m-prolabore');
    if (!pl.dataset.editado) pl.value = brl(M0.salarioMinimo);
  }

  function mostrarBlocos() {
    var atv = radio('atividade');
    $('#bloco-servico').hidden = atv === 'comercio';
    $('#bloco-part').hidden = atv !== 'ambos';
    $('#servico-hint').textContent = radio('servico') === 'FR'
      ? 'Ex.: consultoria, informática, design, marketing, engenharia, saúde. Atenção: muitas dessas atividades não podem ser MEI.'
      : 'Ex.: beleza, manutenção, reparos, limpeza, transporte, alimentação, fotografia.';
  }

  function lerEntrada() {
    var erros = [];
    var fat = centavos($('#m-faturamento'));
    if (fat === null || isNaN(fat) || fat <= 0) erros.push('Informe quanto você fatura (por mês ou por ano).');
    var contador = centavos($('#m-contador'));
    if (contador !== null && isNaN(contador)) erros.push('Mensalidade do contador inválida.');
    var prolabore = centavos($('#m-prolabore'));
    if (prolabore !== null && isNaN(prolabore)) erros.push('Pró-labore inválido.');
    var emp = centavos($('#m-empregados'));
    if (emp !== null && isNaN(emp)) erros.push('Número de empregados inválido.');
    var part = centavos($('#m-part'));
    if (radio('atividade') === 'ambos' && (part === null || isNaN(part) || part < 0 || part > 10000)) erros.push('Informe a parte de serviços entre 0% e 100%.');
    if (erros.length) return { erros: erros };
    return {
      entrada: {
        ano: Number($('#m-ano').value),
        atividade: radio('atividade'),
        anexoServico: radio('servico'),
        partServico: part,
        faturamentoAnual: radio('periodo') === 'mes' ? fat * 12 : fat,
        contadorMensal: contador === null ? M.PADRAO.contadorMensal : contador,
        prolaboreMensal: prolabore === null ? undefined : prolabore,
        empregados: emp === null ? 0 : Math.round(emp / 100)
      }
    };
  }

  /* ---------- Resultado ---------- */
  var ICONES = {
    ok: '<path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    atencao: '<path d="M12 3 2 20.5h20L12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/>',
    alerta: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="currentColor"/>'
  };
  var CLASSE = { ok: 'notice--ok', atencao: 'notice--warning', alerta: 'notice--error' };

  function blocoVeredito(v) {
    var icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('class', 'notice__icon');
    icone.setAttribute('viewBox', '0 0 24 24');
    icone.setAttribute('aria-hidden', 'true');
    icone.innerHTML = ICONES[v.nivel];
    return h('div', { class: 'notice veredito ' + CLASSE[v.nivel] }, icone,
      h('div', null,
        h('strong', { class: 'veredito__titulo', text: v.titulo }),
        h('ul', null, v.frases.map(function (f) { return h('li', { text: f }); }))));
  }

  function kpis(r) {
    var mei = r.mei, me = r.me;
    var meiTexto = mei.situacao === 'acima' ? 'Não pode' : brl(mei.dasMensal) + '/mês';
    var meiSub = mei.situacao === 'tolerancia' ? '+ guia de ' + brl(mei.dasExcesso) + ' no ano' : mei.situacao === 'acima' ? 'passou mais de 20% do limite' : 'valor fixo';
    var dif = r.diferencaAnual;
    return h('div', { class: 'kpis kpis--3' },
      h('div', { class: 'kpi' }, h('div', { class: 'kpi__label', text: 'Como MEI' }), h('div', { class: 'kpi__valor', text: meiTexto }), h('small', { class: 'kpi__sub', text: meiSub })),
      h('div', { class: 'kpi' }, h('div', { class: 'kpi__label', text: 'Como microempresa' }), h('div', { class: 'kpi__valor', text: me ? brl(me.totalMensal) + '/mês' : '—' }), h('small', { class: 'kpi__sub', text: 'impostos + contador' })),
      h('div', { class: 'kpi' }, h('div', { class: 'kpi__label', text: 'Diferença por ano' }), h('div', { class: 'kpi__valor', text: dif === null ? '—' : M.brlInteiro(dif) }), h('small', { class: 'kpi__sub', text: dif === null ? '' : dif >= 0 ? 'a favor do MEI' : 'a favor da microempresa' }))
    );
  }

  function tabelaCrescimento(r) {
    var linhas = r.curva.map(function (l) {
      var meiTxt = l.meiSituacao === 'acima' ? 'não pode' : mensal(l.meiAnual);
      var tag = l.atual ? h('span', { class: 'tag', text: 'você' }) : l.equilibrio ? h('span', { class: 'tag tag--ok', text: 'ME passa a compensar' }) : l.meiSituacao === 'tolerancia' ? h('span', { class: 'tag tag--warn', text: 'tolerância' }) : null;
      var melhorMei = l.meiAnual !== null && l.meAnual !== null && l.meiAnual <= l.meAnual;
      return h('tr', { class: l.atual ? 'atual' : null },
        h('td', { class: 'num' }, M.brl(l.faturamentoMensal), ' ', tag),
        h('td', { class: 'num' + (melhorMei ? ' melhor' : '') , text: meiTxt }),
        h('td', { class: 'num' + (!melhorMei && l.meAnual !== null ? ' melhor' : ''), text: mensal(l.meAnual) }));
    });
    return h('div', { class: 'res-section' },
      h('h3', { text: 'Se o faturamento crescer' }),
      h('p', { class: 'muted', text: 'Quanto sai por mês em cada caso. O destaque verde é o mais barato. Na microempresa já estão o imposto, o INSS do pró-labore e o contador. “ME passa a compensar”: a partir desse faturamento a microempresa deixa no seu bolso pelo menos o que sobrava no teto do MEI. Na faixa de tolerância o MEI só vale até o fim do ano.' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tabela-anos tabela-mei' },
        h('thead', null, h('tr', null, h('th', { class: 'num', text: 'Faturamento por mês' }), h('th', { class: 'num', text: 'MEI' }), h('th', { class: 'num', text: 'Microempresa' }))),
        h('tbody', null, linhas))));
  }

  function dl(itens) {
    return h('dl', { class: 'dl' }, itens.filter(Boolean).map(function (i) { return h('div', null, h('dt', { text: i[0] }), h('dd', { text: i[1] })); }));
  }

  function detalhes(r) {
    var p = r.parametros, mei = r.mei, me = r.me;
    var M0 = C.meiDoAno(p.ano);
    var atvMei = p.atividade === 'comercio' ? 'R$ 1,00 de ICMS' : p.atividade === 'ambos' ? 'R$ 1,00 de ICMS + R$ 5,00 de ISS' : 'R$ 5,00 de ISS';
    var corpo = [];

    corpo.push(h('h4', { text: 'MEI — DAS-MEI' }));
    corpo.push(dl([
      ['Salário mínimo ' + p.ano, brl(p.salarioMinimo) + (M0.salarioOficial ? '' : ' (estimativa)')],
      ['INSS (' + pctTexto(p.percentualInssMei) + ' do salário mínimo)', brl(mei.inssMensal)],
      ['ICMS/ISS fixos', atvMei],
      ['DAS-MEI por mês', brl(mei.dasMensal)],
      ['DAS-MEI no ano', brl(mei.dasAnual)],
      ['Limite anual', brl(mei.limiteAnual) + ' — tolerância de 20% até ' + brl(mei.toleranciaAnual)],
      mei.situacao === 'tolerancia' ? ['Excesso sobre o limite', brl(mei.excesso)] : null,
      mei.situacao === 'tolerancia' ? ['DAS sobre o excesso (alíquotas do Simples' + (p.anexoServico === 'FR' && p.partServico > 0 ? ', Anexo V sem pró-labore' : '') + ')', brl(mei.dasExcesso)] : null,
      ['Empregados permitidos', String(mei.empregadosMax)]
    ]));

    if (me) {
      corpo.push(h('h4', { text: 'Microempresa — Simples Nacional' }));
      var parte = function (rotulo, x) {
        if (!x) return [];
        var a = x.aliquota;
        return [
          [rotulo + ' — receita no ano', brl(x.receita)],
          [rotulo + ' — Anexo ' + a.anexo + ', ' + a.faixa + 'ª faixa', 'nominal ' + M.pctTexto(a.nominal) + ', dedução ' + brl(a.deducao) + ', efetiva ' + M.pctTexto(a.efetiva, 3)],
          [rotulo + ' — DAS no ano', brl(x.das)]
        ];
      };
      corpo.push(dl([].concat(
        parte('Comércio', me.comercio),
        parte('Serviços', me.servico),
        [
          ['DAS no ano', brl(me.dasAnual)],
          ['Pró-labore por mês', brl(me.prolaboreMensal) + ' (Fator R: ' + M.pctTexto(me.fatorR, 1) + ')'],
          ['INSS do pró-labore (' + pctTexto(p.inssProlabore) + ')', brl(me.inssAnual) + ' no ano'],
          me.cppAnual ? ['CPP patronal do Anexo IV (20% fora do DAS)', brl(me.cppAnual) + ' no ano'] : null,
          ['Contador', brl(p.contadorMensal) + ' por mês = ' + brl(me.contadorAnual) + ' no ano'],
          ['Total no ano', brl(me.totalAnual) + ' (' + brl(me.totalMensal) + ' por mês)']
        ])));
      if (me.alternativa) {
        corpo.push(h('p', { class: 'muted', text: 'Fator R: a outra opção seria o Anexo ' + me.alternativa.anexoServico + ' com pró-labore de ' + brl(me.alternativa.prolaboreMensal) + ' por mês, custo total de ' + brl(me.alternativa.totalAnual) + ' no ano. Escolhemos a mais barata. Com folha (pró-labore + salários) de pelo menos 28% do faturamento dos últimos 12 meses, o serviço vai para o Anexo III; abaixo disso, Anexo V.' }));
      }
    }

    if (r.pontoEquilibrio) {
      corpo.push(h('h4', { text: 'Ponto de equilíbrio' }));
      corpo.push(h('p', { text: 'No limite do MEI sobram ' + brl(mei.limiteAnual - C.dasMei(p.salarioMinimo, p.percentualInssMei, M0.icms, M0.iss)[p.atividade === 'comercio' ? 'comercio' : p.atividade === 'ambos' ? 'ambos' : 'servicos'] * 12) + ' no ano (faturamento − DAS-MEI). A microempresa deixa o mesmo valor quando fatura ' + brl(r.pontoEquilibrio) + ' por ano: faturamento − (DAS + INSS do pró-labore + contador) = mesma sobra.' }));
    }

    corpo.push(h('h4', { text: 'Regras usadas' }));
    corpo.push(h('ul', null,
      h('li', { text: 'MEI: LC 123/2006, art. 18-A, com a LC 238/2026 — limite de R$ 81 mil (2026), R$ 110 mil (2027) e R$ 140 mil (2028 em diante); 1 empregado em 2026 e 2 a partir de 2027.' }),
      h('li', { text: 'Excesso de até 20%: DAS sobre a parte excedente e desenquadramento a partir de 1º de janeiro do ano seguinte. Acima de 20%: desenquadramento retroativo a janeiro do ano (ou à abertura).' }),
      h('li', { text: 'Simples: alíquota efetiva = (receita de 12 meses × alíquota nominal − parcela a deduzir) ÷ receita de 12 meses. Consideramos o faturamento igual todos os meses.' }),
      h('li', { text: 'Com comércio e serviços, a faixa é definida pela receita total e cada parte paga pelo seu anexo.' }),
      h('li', { text: 'Pró-labore: INSS de 11% retido do sócio. O imposto de renda sobre o pró-labore não entra na conta (é isento até R$ 5 mil por mês desde 2026).' }),
      p.ano >= 2027 ? h('li', { text: 'A partir de 2027 o Simples usa os anexos na redação da LC 214/2025 (Reforma Tributária), com as mesmas alíquotas totais.' }) : null
    ));

    return h('details', { class: 'acc detalhes-tecnicos' },
      h('summary', { text: 'Ver os cálculos e as regras (para quem quer detalhes)' }),
      h('div', { class: 'stack' }, corpo));
  }

  function textoWhatsApp(r) {
    var p = r.parametros;
    return 'Olá, usei a calculadora MEI ou empresa da RC2. Faturo cerca de ' + M.brlInteiro(p.faturamentoAnual / 12) + ' por mês (' + M.ATIVIDADES[p.atividade].toLowerCase() + ') e gostaria de conversar sobre ' + (r.mei.situacao === 'dentro' ? 'o meu MEI.' : 'a passagem de MEI para microempresa.');
  }

  function mostrar(r) {
    var corpo = $('#m-resultado-corpo');
    corpo.innerHTML = '';
    var p = r.parametros;
    $('#m-resultado-sub').textContent = M.ATIVIDADES[p.atividade] + ' · faturamento de ' + brl(p.faturamentoAnual) + ' no ano (' + brl(Math.round(p.faturamentoAnual / 12)) + ' por mês) · ' + p.ano;
    var wa = 'https://wa.me/5521973839229?text=' + encodeURIComponent(textoWhatsApp(r));
    corpo.appendChild(blocoVeredito(r.veredito));
    corpo.appendChild(kpis(r));
    corpo.appendChild(tabelaCrescimento(r));
    corpo.appendChild(h('div', { class: 'res-section' }, detalhes(r)));
    corpo.appendChild(h('div', { class: 'res-actions' },
      h('a', { class: 'btn btn--accent', href: wa, target: '_blank', rel: 'noopener noreferrer', text: 'Conversar com um contador' }),
      h('button', { class: 'btn btn--secondary', type: 'button', id: 'm-imprimir', text: 'Imprimir' })));
    $('#m-imprimir').addEventListener('click', function () {
      var d = corpo.querySelector('.detalhes-tecnicos'); if (d) d.open = true;
      window.print();
    });
    $('#m-cta-whats').href = wa;
    var sec = $('#m-resultado');
    sec.hidden = false;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function calcular(ev) {
    if (ev) ev.preventDefault();
    var box = $('#m-erros');
    var lido = lerEntrada();
    $('#m-faturamento').setAttribute('aria-invalid', lido.erros && lido.erros[0].indexOf('fatura') >= 0 ? 'true' : 'false');
    if (lido.erros) {
      box.innerHTML = '';
      box.appendChild(h('ul', null, lido.erros.map(function (e) { return h('li', { text: e }); })));
      box.hidden = false;
      return;
    }
    box.hidden = true;
    mostrar(M.simular(lido.entrada));
  }

  function limpar() {
    $('#form-mei').reset();
    $('#m-prolabore').dataset.editado = '';
    $('#m-contador').value = brl(M.PADRAO.contadorMensal);
    preencherAnosValor();
    padroesDoAno();
    mostrarBlocos();
    $('#m-resultado').hidden = true;
    $('#m-erros').hidden = true;
  }
  function preencherAnosValor() {
    var sel = $('#m-ano');
    sel.value = String(anos.indexOf(anoAtual) >= 0 ? anoAtual : anoAtual < anos[0] ? anos[0] : anos[anos.length - 1]);
  }

  function iniciar() {
    $('#ano').textContent = String(anoAtual);
    $('#m-revisao').textContent = T.REVISAO;
    preencherAnos();
    $('#m-contador').value = brl(M.PADRAO.contadorMensal);
    padroesDoAno();
    mostrarBlocos();
    $all('#form-mei .money').forEach(function (el) { el.addEventListener('blur', function () { formatarCampo(el); }); });
    $('#m-prolabore').addEventListener('input', function () { this.dataset.editado = '1'; });
    $('#m-ano').addEventListener('change', function () { padroesDoAno(); if (!$('#m-resultado').hidden) calcular(); });
    $all('input[name="atividade"], input[name="servico"]').forEach(function (el) { el.addEventListener('change', mostrarBlocos); });
    $('#form-mei').addEventListener('submit', calcular);
    $('#m-limpar').addEventListener('click', limpar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
