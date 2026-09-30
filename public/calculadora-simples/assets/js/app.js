/*
 * RC2 Contábil — Calculadora do Simples Nacional (interface).
 * Todo conteúdo externo é inserido via textContent (nunca innerHTML).
 */
(function () {
  'use strict';

  var T = window.RC2_TABELAS;
  var C = window.RC2_CALCULO;

  var APIS = {
    brasilapi: 'https://brasilapi.com.br/api/cnpj/v1/',
    cnpjws: 'https://publica.cnpj.ws/cnpj/'
  };
  var TIMEOUT_MS = 12000;
  var INTERVALO_CONSULTAS_MS = 5000;
  var ORDEM_TRIBUTOS = ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'IPI', 'ICMS', 'ISS'];
  var OPCOES_ANEXO = [
    ['', 'Selecione…'],
    ['I', 'Anexo I — Comércio'],
    ['II', 'Anexo II — Indústria'],
    ['III', 'Anexo III — Serviços'],
    ['IV', 'Anexo IV — Serviços (construção, limpeza, vigilância, advocacia)'],
    ['V', 'Anexo V — Serviços'],
    ['FR', 'Serviço sujeito ao Fator R (III ou V)']
  ];

  var state = { cnaes: [], ultimaConsulta: 0, consultando: false, seq: 0, modo: 'simples' };
  var ANEXOS_CALCULAVEIS = ['I', 'II', 'III', 'IV', 'V', 'FR'];

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
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
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
    return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas === undefined ? 2 : casas, maximumFractionDigits: casas === undefined ? 4 : casas }) + '%';
  }
  function numeroBR(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function parseMoeda(str) {
    var s = String(str || '').trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 && n < 1e12 ? n : NaN;
  }

  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
  function mascaraCNPJ(d) {
    d = soDigitos(d).slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
  }
  function cnpjValido(d) {
    if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
    function dv(base) {
      var pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var soma = 0;
      for (var i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
      var r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    }
    var d1 = dv(d.slice(0, 12));
    var d2 = dv(d.slice(0, 12) + d1);
    return d1 === Number(d[12]) && d2 === Number(d[13]);
  }
  function formatarCNAE(c) {
    c = soDigitos(c).padStart(7, '0');
    return c.slice(0, 4) + '-' + c.slice(4, 5) + '/' + c.slice(5);
  }
  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '—';
  }
  function mesesEntre(iso, ref) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
    if (!m) return null;
    return (ref.getFullYear() - Number(m[1])) * 12 + (ref.getMonth() + 1 - Number(m[2]));
  }
  function txt(v, max) {
    var s = v === null || v === undefined ? '' : String(v).trim();
    return max && s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
  function simNao(v) {
    if (v === true || /^sim$/i.test(String(v))) return true;
    if (v === false || /^n[ãa]o$/i.test(String(v))) return false;
    return null;
  }

  /* ---------------- Consulta de CNPJ ---------------- */
  function fetchJSON(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) return { status: r.status, data: null };
      return r.json().then(function (data) { return { status: r.status, data: data }; });
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function normalizarBrasilAPI(d) {
    var sec = Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios : [];
    return {
      fonte: 'BrasilAPI',
      cnpj: soDigitos(d.cnpj),
      razao: txt(d.razao_social, 200),
      fantasia: txt(d.nome_fantasia, 200),
      situacao: txt(d.descricao_situacao_cadastral, 40),
      abertura: txt(d.data_inicio_atividade, 10),
      natureza: txt(d.natureza_juridica, 120),
      porte: txt(d.porte, 60),
      simples: simNao(d.opcao_pelo_simples),
      dataSimples: txt(d.data_opcao_pelo_simples, 10),
      mei: simNao(d.opcao_pelo_mei),
      municipio: txt(d.municipio, 80),
      uf: txt(d.uf, 2),
      principal: { codigo: soDigitos(d.cnae_fiscal), descricao: txt(d.cnae_fiscal_descricao, 250) },
      secundarios: sec.filter(function (c) { return c && Number(c.codigo) > 0; })
        .map(function (c) { return { codigo: soDigitos(c.codigo), descricao: txt(c.descricao, 250) }; })
    };
  }

  function normalizarCnpjWs(d) {
    var e = d.estabelecimento || {};
    var s = d.simples || {};
    var sec = Array.isArray(e.atividades_secundarias) ? e.atividades_secundarias : [];
    var p = e.atividade_principal || {};
    return {
      fonte: 'CNPJ.ws',
      cnpj: soDigitos(e.cnpj),
      razao: txt(d.razao_social, 200),
      fantasia: txt(e.nome_fantasia, 200),
      situacao: txt(e.situacao_cadastral, 40),
      abertura: txt(e.data_inicio_atividade, 10),
      natureza: txt(d.natureza_juridica && d.natureza_juridica.descricao, 120),
      porte: txt(d.porte && d.porte.descricao, 60),
      simples: d.simples ? simNao(s.simples) : null,
      dataSimples: txt(s.data_opcao_simples, 10),
      mei: d.simples ? simNao(s.mei) : null,
      municipio: txt(e.cidade && e.cidade.nome, 80),
      uf: txt(e.estado && e.estado.sigla, 2),
      principal: { codigo: soDigitos(p.id || p.subclasse), descricao: txt(p.descricao, 250) },
      secundarios: sec.map(function (c) { return { codigo: soDigitos(c.id || c.subclasse), descricao: txt(c.descricao, 250) }; })
        .filter(function (c) { return c.codigo; })
    };
  }

  function consultarCNPJ(cnpj) {
    return fetchJSON(APIS.brasilapi + cnpj).then(function (r) {
      if (r.data && typeof r.data === 'object') return normalizarBrasilAPI(r.data);
      if (r.status === 404 || r.status === 400) {
        var e = new Error('nao_encontrado'); e.code = 404; throw e;
      }
      throw new Error('falha_brasilapi');
    }).catch(function (err) {
      if (err && err.code === 404) throw err;
      return fetchJSON(APIS.cnpjws + cnpj).then(function (r) {
        if (r.data && typeof r.data === 'object') return normalizarCnpjWs(r.data);
        var e = new Error(r.status === 404 ? 'nao_encontrado' : r.status === 429 ? 'limite' : 'indisponivel');
        e.code = r.status;
        throw e;
      });
    });
  }

  function status(msg, tipo) {
    var el = $('#cnpj-status');
    el.textContent = msg || '';
    el.className = 'field-status' + (tipo ? ' is-' + tipo : '');
  }

  function aoConsultar(ev) {
    ev.preventDefault();
    if (state.consultando) return;
    var input = $('#cnpj');
    var cnpj = soDigitos(input.value);
    input.removeAttribute('aria-invalid');

    if (!cnpjValido(cnpj)) {
      input.setAttribute('aria-invalid', 'true');
      status('CNPJ inválido. Confira os 14 dígitos.', 'error');
      return;
    }
    var agora = Date.now();
    if (agora - state.ultimaConsulta < INTERVALO_CONSULTAS_MS) {
      status('Aguarde alguns segundos antes de uma nova consulta.', 'error');
      return;
    }
    state.ultimaConsulta = agora;
    state.consultando = true;

    var btn = $('#btn-cnpj');
    btn.disabled = true;
    limpar(btn);
    append(btn, [h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { text: 'Consultando…' })]);
    status('Consultando bases públicas…');

    consultarCNPJ(cnpj).then(function (emp) {
      status('Dados encontrados (fonte: ' + emp.fonte + ').', 'ok');
      renderEmpresa(emp);
    }).catch(function (err) {
      var msg = 'Não foi possível consultar agora. Tente novamente em instantes ou preencha os dados manualmente.';
      if (err && err.code === 404) msg = 'CNPJ não encontrado na base pública da Receita Federal.';
      else if (err && err.code === 429) msg = 'Limite de consultas do serviço público atingido. Aguarde um minuto e tente de novo.';
      status(msg, 'error');
    }).then(function () {
      state.consultando = false;
      btn.disabled = false;
      limpar(btn);
      append(btn, h('span', { class: 'btn__label', text: 'Consultar' }));
    });
  }

  /* ---------------- Render: empresa ---------------- */
  function tagAnexo(sug) {
    var mapa = { I: 'Anexo I', II: 'Anexo II', III: 'Anexo III', IV: 'Anexo IV', V: 'Anexo V', FR: 'Fator R (III/V)', VEDADO: 'Possivelmente vedada', '?': 'Verificar' };
    var cls = sug.anexo === 'VEDADO' ? 'tag tag--err' : sug.anexo === '?' ? 'tag tag--warn' : 'tag';
    return h('span', { class: cls, text: mapa[sug.anexo] || 'Verificar' });
  }

  function renderEmpresa(emp) {
    var box = $('#empresa');
    limpar(box);

    state.cnaes = [];
    if (emp.principal.codigo) state.cnaes.push({ codigo: emp.principal.codigo, descricao: emp.principal.descricao, principal: true });
    emp.secundarios.slice(0, 60).forEach(function (c) { state.cnaes.push({ codigo: c.codigo, descricao: c.descricao, principal: false }); });
    state.cnaes.forEach(function (c) { c.sug = T.sugerirAnexo(c.codigo); });

    var ativa = /ativa/i.test(emp.situacao) && !/inativa/i.test(emp.situacao);
    var tags = h('div', { class: 'tags' },
      h('span', { class: ativa ? 'tag tag--ok' : 'tag tag--err', text: 'Situação: ' + (emp.situacao || 'não informada') }),
      emp.simples === true ? h('span', { class: 'tag tag--ok', text: 'Optante pelo Simples' }) :
        emp.simples === false ? h('span', { class: 'tag tag--warn', text: 'Não optante pelo Simples' }) :
          h('span', { class: 'tag tag--warn', text: 'Opção pelo Simples não informada' }),
      emp.mei === true ? h('span', { class: 'tag', text: 'MEI' }) : null,
      emp.porte ? h('span', { class: 'tag', text: emp.porte }) : null
    );

    var meses = mesesEntre(emp.abertura, new Date());
    var tempo = meses === null ? '' : meses < 12 ? ' (' + Math.max(meses, 0) + ' meses)' : ' (' + Math.floor(meses / 12) + ' anos)';

    function item(rotulo, valor) { return h('div', null, h('dt', { text: rotulo }), h('dd', { text: valor || '—' })); }
    var dl = h('dl', { class: 'dl' },
      item('CNPJ', mascaraCNPJ(emp.cnpj)),
      item('Início de atividade', dataBR(emp.abertura) + tempo),
      item('Natureza jurídica', emp.natureza),
      item('Município / UF', [emp.municipio, emp.uf].filter(Boolean).join(' / ')),
      item('Opção pelo Simples', emp.simples === true ? 'Desde ' + dataBR(emp.dataSimples) : emp.simples === false ? 'Não' : 'Não informado'),
      item('MEI', emp.mei === true ? 'Sim' : emp.mei === false ? 'Não' : 'Não informado')
    );

    var tbody = h('tbody');
    state.cnaes.forEach(function (c) {
      tbody.appendChild(h('tr', null,
        h('td', null, h('span', { class: 'cnae-code', text: formatarCNAE(c.codigo) }), c.principal ? h('span', { class: 'cnae-obs', text: 'Principal' }) : null),
        h('td', null, c.descricao, c.sug.obs ? h('span', { class: 'cnae-obs', text: c.sug.obs }) : null),
        h('td', null, tagAnexo(c.sug))
      ));
    });
    var tabela = h('div', { class: 'table-wrap' },
      h('table', null,
        h('thead', null, h('tr', null, h('th', { text: 'CNAE' }), h('th', { text: 'Atividade' }), h('th', { text: 'Sugestão' }))),
        tbody));

    var avisos = [];
    if (!ativa) avisos.push(h('div', { class: 'notice notice--error' }, 'A situação cadastral não está ativa. Verifique a regularidade da empresa antes de qualquer apuração.'));
    if (emp.simples === false) avisos.push(h('div', { class: 'notice notice--warning' }, 'A empresa não consta como optante pelo Simples Nacional. A simulação abaixo será apenas hipotética (por exemplo, para avaliar uma futura opção).'));
    if (emp.mei === true) avisos.push(renderMEI());

    if (meses !== null && meses >= 0 && meses < 12) {
      $('input[name="atividade"][value="inicio"]').checked = true;
      $('#meses').value = String(Math.min(Math.max(meses, 0), 11));
      atualizarModo();
      avisos.push(h('div', { class: 'notice notice--info' }, 'Empresa com menos de 12 meses de atividade: a receita de 12 meses (RBT12) deve ser proporcional (média mensal × 12). A versão completa faz esse ajuste automaticamente e já está com os meses de atividade preenchidos.'));
    }

    append(box, [
      h('div', null, h('div', { class: 'empresa__nome', text: emp.razao || 'Razão social não informada' }),
        emp.fantasia ? h('div', { class: 'empresa__fantasia', text: emp.fantasia }) : null),
      tags, dl, avisos,
      h('div', null, h('h3', { class: 'label', text: 'Atividades cadastradas e sugestão de anexo' }), tabela,
        h('p', { class: 'hint', text: 'Sugestão automática com base no CNAE. Confirme se corresponde à atividade efetivamente exercida.' }))
    ]);
    box.hidden = false;

    // Recria as linhas de receita, começando pela atividade principal
    limpar($('#linhas'));
    adicionarLinha(state.cnaes.length ? state.cnaes[0].codigo : '');
    atualizarAtividadeSimples();
  }

  /* Versão simples: toda a receita vai para a atividade principal do CNPJ. */
  function atividadeSimples() {
    var c = state.cnaes[0];
    if (!c) return null;
    return { cnae: c, anexo: c.sug.anexo, calculavel: ANEXOS_CALCULAVEIS.indexOf(c.sug.anexo) >= 0 };
  }

  function atualizarAtividadeSimples() {
    var box = $('#simples-atividade');
    limpar(box);
    var a = atividadeSimples();
    if (!a) { box.hidden = true; return; }
    var nomeAnexo = a.anexo === 'FR' ? 'Anexo III ou V, conforme o Fator R' : a.calculavel ? T.ANEXOS[a.anexo].nome : '';
    var linhas = [
      h('strong', { text: 'Atividade principal: ' + formatarCNAE(a.cnae.codigo) + ' — ' + txt(a.cnae.descricao, 90) }),
      a.calculavel
        ? h('p', { text: 'Enquadramento usado no cálculo: ' + nomeAnexo + '.' })
        : h('p', { text: a.anexo === 'VEDADO'
            ? 'Esta atividade é possivelmente vedada no Simples Nacional, por isso a versão simples não calcula. Use a versão completa para escolher o anexo manualmente, se for o caso.'
            : 'Esta atividade precisa de análise para definir o anexo. Use a versão completa para escolher o anexo manualmente.' })
    ];
    var outros = state.cnaes.slice(1).some(function (c) {
      var an = c.sug.anexo;
      return an !== a.anexo && !(a.anexo === 'FR' && (an === 'III' || an === 'V'));
    });
    if (a.calculavel && outros) {
      linhas.push(h('p', { text: 'A empresa tem atividades secundárias em outro enquadramento. Se houver faturamento delas, use a versão completa para separar as receitas.' }));
    }
    append(box, h('div', { class: 'stack' }, linhas));
    box.className = 'notice atividade-box ' + (a.calculavel ? 'notice--info' : 'notice--warning');
    box.hidden = false;
  }

  function renderMEI() {
    var M = T.MEI;
    var inss = C.arred(M.salarioMinimo * M.percentualInss);
    var tb = h('tbody', null,
      h('tr', null, h('td', { text: 'Comércio ou indústria' }), h('td', { class: 'num', text: moeda(inss + M.icms) })),
      h('tr', null, h('td', { text: 'Prestação de serviços' }), h('td', { class: 'num', text: moeda(inss + M.iss) })),
      h('tr', null, h('td', { text: 'Comércio e serviços' }), h('td', { class: 'num', text: moeda(inss + M.icms + M.iss) }))
    );
    return h('div', { class: 'notice notice--info' },
      h('div', { class: 'stack' },
        h('strong', { text: 'Esta empresa consta como MEI.' }),
        h('p', { text: 'O MEI recolhe um valor fixo mensal (DAS-MEI), independente do faturamento, desde que a receita anual não ultrapasse ' + moeda(M.limiteAnual) + '. Valores de referência para ' + M.ano + ' (5% do salário mínimo de ' + moeda(M.salarioMinimo) + ' + ICMS/ISS):' }),
        h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Atividade' }), h('th', { class: 'num', text: 'DAS-MEI/mês' }))), tb)),
        h('p', { text: 'A calculadora abaixo mostra quanto a empresa pagaria como ME/EPP no Simples Nacional, útil para comparar caso o limite do MEI seja ultrapassado.' })
      ));
  }

  /* ---------------- Linhas de receita ---------------- */
  function opcoesTratamento(select, anexo, atual) {
    limpar(select);
    var anexos = anexo === 'FR' ? ['III', 'V'] : anexo ? [anexo] : ['I', 'II', 'III', 'IV', 'V'];
    Object.keys(T.TRATAMENTOS).forEach(function (k) {
      var t = T.TRATAMENTOS[k];
      var ok = anexos.every(function (a) { return t.anexos.indexOf(a) >= 0; });
      if (ok) select.appendChild(h('option', { value: k, text: t.rotulo }));
    });
    select.value = atual && select.querySelector('option[value="' + atual + '"]') ? atual : 'normal';
  }

  function adicionarLinha(cnaeInicial) {
    var id = ++state.seq;
    var selCnae = h('select', { class: 'input', id: 'cnae-' + id });
    selCnae.appendChild(h('option', { value: '', text: state.cnaes.length ? 'Outra atividade (informar anexo)' : 'Informe o anexo ao lado' }));
    state.cnaes.forEach(function (c) {
      selCnae.appendChild(h('option', { value: c.codigo, text: formatarCNAE(c.codigo) + ' — ' + txt(c.descricao, 70) }));
    });
    if (!state.cnaes.length) selCnae.disabled = true;

    var selAnexo = h('select', { class: 'input', id: 'anexo-' + id, required: true });
    OPCOES_ANEXO.forEach(function (o) { selAnexo.appendChild(h('option', { value: o[0], text: o[1] })); });

    var selTrat = h('select', { class: 'input', id: 'trat-' + id });
    var valor = h('input', { class: 'input money', id: 'valor-' + id, type: 'text', inputmode: 'decimal', placeholder: '0,00' });
    var obs = h('p', { class: 'linha__obs', 'aria-live': 'polite' });
    var btnRem = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Remover atividade', title: 'Remover atividade', text: '×' });

    var linha = h('div', { class: 'linha' },
      h('div', { class: 'field field--cnae' }, h('label', { class: 'label', for: 'cnae-' + id, text: 'Atividade (CNAE)' }), selCnae),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'anexo-' + id, text: 'Anexo' }), selAnexo),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'trat-' + id, text: 'Tratamento' }), selTrat),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'valor-' + id, text: 'Faturamento do mês' }), valor),
      btnRem,
      obs
    );

    function aplicarCnae() {
      var c = state.cnaes.filter(function (x) { return x.codigo === selCnae.value; })[0];
      if (!c) { obs.textContent = ''; return; }
      var a = c.sug.anexo;
      selAnexo.value = ['I', 'II', 'III', 'IV', 'V', 'FR'].indexOf(a) >= 0 ? a : '';
      var prefixo = a === 'VEDADO' ? 'Atenção: atividade possivelmente vedada no Simples. ' : a === '?' ? 'Selecione o anexo manualmente. ' : 'Sugestão automática. ';
      obs.textContent = prefixo + (c.sug.obs || '');
      opcoesTratamento(selTrat, selAnexo.value, selTrat.value);
    }
    selCnae.addEventListener('change', aplicarCnae);
    selAnexo.addEventListener('change', function () {
      selAnexo.removeAttribute('aria-invalid');
      opcoesTratamento(selTrat, selAnexo.value, selTrat.value);
    });
    valor.addEventListener('blur', formatarCampoMoeda);
    valor.addEventListener('input', function () { valor.removeAttribute('aria-invalid'); });
    btnRem.addEventListener('click', function () {
      linha.parentNode.removeChild(linha);
      atualizarBotoesRemover();
    });

    $('#linhas').appendChild(linha);
    opcoesTratamento(selTrat, '', 'normal');
    if (cnaeInicial) { selCnae.value = cnaeInicial; aplicarCnae(); }
    atualizarBotoesRemover();
    return linha;
  }

  function atualizarBotoesRemover() {
    var linhas = $all('#linhas .linha');
    linhas.forEach(function (l) { $('.btn--icon', l).hidden = linhas.length < 2; });
  }

  function formatarCampoMoeda(ev) {
    var el = ev.target;
    var v = parseMoeda(el.value);
    if (!isNaN(v)) el.value = numeroBR(v);
  }

  /* ---------------- Modo (início de atividade) ---------------- */
  function atualizarModo() {
    var inicio = $('input[name="atividade"]:checked').value === 'inicio';
    $('#bloco-normal').hidden = inicio;
    $('#bloco-inicio').hidden = !inicio;
    var meses = parseInt($('#meses').value, 10) || 0;
    var primeiro = meses <= 0;
    $('#receita-acum').disabled = primeiro;
    $('#receita-acum').closest('.field').hidden = primeiro;
    $('#label-folha-acum').textContent = primeiro ? 'Folha de salários do próprio mês' : 'Folha acumulada nesses meses';
  }

  /* ---------------- Cálculo ---------------- */
  function marcarErro(el, erros, msg) {
    el.setAttribute('aria-invalid', 'true');
    erros.push({ el: el, msg: msg });
  }

  function aoCalcular(ev) {
    ev.preventDefault();
    var erros = [];
    $all('#form-calc [aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });

    var receitas = [];
    $all('#linhas .linha').forEach(function (l, i) {
      var selAnexo = $('select[id^="anexo-"]', l);
      var selCnae = $('select[id^="cnae-"]', l);
      var inp = $('input[id^="valor-"]', l);
      var v = parseMoeda(inp.value);
      if (!selAnexo.value) marcarErro(selAnexo, erros, 'Selecione o anexo da atividade ' + (i + 1) + '.');
      if (isNaN(v) || v <= 0) marcarErro(inp, erros, 'Informe o faturamento do mês da atividade ' + (i + 1) + '.');
      var c = state.cnaes.filter(function (x) { return x.codigo === selCnae.value; })[0];
      receitas.push({
        anexo: selAnexo.value,
        tratamento: $('select[id^="trat-"]', l).value,
        valor: isNaN(v) ? 0 : v,
        rotulo: c ? formatarCNAE(c.codigo) + ' — ' + txt(c.descricao, 60) : 'Atividade ' + (i + 1)
      });
    });
    if (!receitas.length) erros.push({ el: $('#btn-add'), msg: 'Adicione ao menos uma atividade.' });

    var totalMes = receitas.reduce(function (s, r) { return s + r.valor; }, 0);
    var inicio = $('input[name="atividade"]:checked').value === 'inicio';
    var rbt12, folha12, folhaInformada;

    if (!inicio) {
      rbt12 = parseMoeda($('#rbt12').value);
      if (isNaN(rbt12)) marcarErro($('#rbt12'), erros, 'Informe a receita bruta dos últimos 12 meses (RBT12).');
      var f = $('#folha12').value.trim();
      folhaInformada = f !== '';
      folha12 = folhaInformada ? parseMoeda(f) : 0;
      if (isNaN(folha12)) marcarErro($('#folha12'), erros, 'Valor da folha inválido.');
    } else {
      var meses = parseInt($('#meses').value, 10);
      if (isNaN(meses) || meses < 0 || meses > 11) marcarErro($('#meses'), erros, 'Meses de atividade devem estar entre 0 e 11.');
      var acum = meses > 0 ? parseMoeda($('#receita-acum').value) : 0;
      if (meses > 0 && isNaN(acum)) marcarErro($('#receita-acum'), erros, 'Informe a receita acumulada dos meses anteriores.');
      var fa = $('#folha-acum').value.trim();
      folhaInformada = fa !== '';
      var folhaBase = folhaInformada ? parseMoeda(fa) : 0;
      if (isNaN(folhaBase)) marcarErro($('#folha-acum'), erros, 'Valor da folha inválido.');
      rbt12 = C.proporcionalizar(meses || 0, acum || 0, totalMes);
      folha12 = C.proporcionalizar(meses || 0, folhaBase || 0, folhaBase || 0);
    }

    if (mostrarErros($('#form-erros'), erros)) return;

    var res = C.apurar({ rbt12: rbt12, folha12: folha12, receitas: receitas });
    if (res.fatorR && !folhaInformada) {
      res.alertas.unshift('Folha de salários não informada: o Fator R foi considerado 0% e as receitas sujeitas a ele foram tributadas no Anexo V.');
    }
    if (inicio) {
      res.alertas.unshift('Início de atividade: RBT12 proporcionalizado em ' + moeda(rbt12) + ' e folha em ' + moeda(folha12) + '.');
    }
    renderResultado(res);
  }

  /* Mostra a lista de erros na caixa indicada; retorna true se houver erro. */
  function mostrarErros(box, erros) {
    limpar(box);
    if (!erros.length) { box.hidden = true; return false; }
    var ul = h('ul');
    erros.forEach(function (e) { ul.appendChild(h('li', { text: e.msg })); });
    append(box, [h('strong', { text: 'Revise os campos:' }), ul]);
    box.hidden = false;
    if (erros[0].el && erros[0].el.focus) erros[0].el.focus();
    return true;
  }

  function aoCalcularSimples(ev) {
    ev.preventDefault();
    var erros = [];
    $all('#form-simples [aria-invalid], #cnpj[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });

    var a = atividadeSimples();
    if (!a) {
      marcarErro($('#cnpj'), erros, 'Consulte o CNPJ da empresa (etapa 1) para identificarmos a atividade.');
    } else if (!a.calculavel) {
      erros.push({ el: $('#link-completa'), msg: 'A atividade principal não tem enquadramento automático. Use a versão completa.' });
    }
    var rbt12 = parseMoeda($('#rbt12-s').value);
    if (isNaN(rbt12)) marcarErro($('#rbt12-s'), erros, 'Informe a receita bruta dos últimos 12 meses (RBT12).');
    var fat = parseMoeda($('#fat-s').value);
    if (isNaN(fat) || fat <= 0) marcarErro($('#fat-s'), erros, 'Informe o faturamento do mês.');
    var f = $('#folha-s').value.trim();
    var folha12 = f ? parseMoeda(f) : 0;
    if (isNaN(folha12)) marcarErro($('#folha-s'), erros, 'Valor da folha de pagamento inválido.');

    if (mostrarErros($('#form-erros-s'), erros)) return;

    var res = C.apurar({
      rbt12: rbt12,
      folha12: folha12,
      receitas: [{ anexo: a.anexo, tratamento: 'normal', valor: fat, rotulo: formatarCNAE(a.cnae.codigo) + ' — ' + txt(a.cnae.descricao, 60) }]
    });
    if (res.fatorR && !f) {
      res.alertas.unshift('Folha de pagamento não informada: o Fator R foi considerado 0% e a receita foi tributada no Anexo V.');
    }
    res.alertas.push('Versão simples: toda a receita foi considerada na atividade principal, com tributação normal (sem substituição tributária, monofásico, ISS retido ou exportação).');
    renderResultado(res);
  }

  /* ---------------- Abas simples / completa ---------------- */
  function setModo(modo, focar) {
    state.modo = modo === 'completa' ? 'completa' : 'simples';
    var simples = state.modo === 'simples';
    $('#tab-simples').setAttribute('aria-selected', String(simples));
    $('#tab-completa').setAttribute('aria-selected', String(!simples));
    $('#card-simples').hidden = !simples;
    $('#card-completo').hidden = simples;
    $('#cnpj-obrigatorio').textContent = simples ? '(obrigatório)' : '(opcional)';
    resetarResultado();
    try { history.replaceState(null, '', simples ? location.pathname + location.search : '#completa'); } catch (e) { /* sem history */ }
    if (focar) $(simples ? '#tab-simples' : '#tab-completa').focus();
  }

  function resetarResultado() {
    var corpo = $('#resultado-corpo');
    limpar(corpo);
    corpo.appendChild(h('div', { class: 'placeholder' }, h('p', { text: 'O valor estimado do DAS e a repartição dos tributos aparecerão aqui.' })));
    $('#resultado-sub').textContent = 'Preencha os dados e clique em “Calcular estimativa”.';
  }

  /* ---------------- Render: resultado ---------------- */
  function rotuloFaixa(i) {
    var ate = T.LIMITES[i];
    return i === 0 ? 'até ' + moeda(ate) : 'de ' + moeda(T.LIMITES[i - 1] + 0.01) + ' a ' + moeda(ate);
  }

  function periodoInfo() {
    var p = $('#periodo').value;
    var m = /^(\d{4})-(\d{2})$/.exec(p);
    if (!m) return { rotulo: 'não informado', venc: '' };
    var ano = Number(m[1]), mes = Number(m[2]);
    var vm = mes === 12 ? 1 : mes + 1, va = mes === 12 ? ano + 1 : ano;
    return { rotulo: m[2] + '/' + m[1], venc: '20/' + String(vm).padStart(2, '0') + '/' + va };
  }

  function renderResultado(res) {
    var corpo = $('#resultado-corpo');
    limpar(corpo);
    var per = periodoInfo();
    $('#resultado-sub').textContent = 'Simulação gerada em ' + new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '.';

    var cab = h('div', { class: 'print-only print-head' },
      h('img', { src: 'assets/img/logo-rc2.png', alt: 'RC2 Contábil', width: '48', height: '48' }),
      h('div', null, h('strong', { text: 'RC2 Contábil — Simulação do Simples Nacional' }),
        h('div', { class: 'hint', text: 'Cálculo ilustrativo, sem valor fiscal. Período: ' + per.rotulo })));
    corpo.appendChild(cab);

    if (res.erro) {
      corpo.appendChild(h('div', { class: 'notice notice--error' }, res.erro));
      corpo.appendChild(h('p', { class: 'disclaimer-mini', text: 'Procure um contador para avaliar a migração para o Lucro Presumido ou Lucro Real.' }));
      rolarParaResultado();
      return;
    }

    corpo.appendChild(h('div', { class: 'total' },
      h('div', { class: 'total__label', text: 'DAS estimado do mês' }),
      h('div', { class: 'total__valor', text: moeda(res.totalDas) }),
      h('div', { class: 'total__meta', text: 'Período ' + per.rotulo + (per.venc ? ' · vencimento em regra até ' + per.venc : '') })
    ));

    function kpi(l, v) { return h('div', { class: 'kpi' }, h('div', { class: 'kpi__label', text: l }), h('div', { class: 'kpi__valor', text: v })); }
    corpo.appendChild(h('div', { class: 'kpis' },
      kpi('Faturamento do mês', moeda(res.totalReceita)),
      kpi('Alíquota efetiva', pct(res.aliquotaMedia, 2)),
      kpi('RBT12 considerado', moeda(res.rbt12)),
      kpi('Faixa', res.faixa + 'ª faixa')
    ));

    if (res.fatorR) corpo.appendChild(renderFatorR(res.fatorR));

    // Por atividade
    var tb = h('tbody');
    res.linhas.forEach(function (l) {
      var sub = T.ANEXOS[l.anexo].nome + (l.viaFatorR ? ' (via Fator R)' : '') +
        (l.tratamento !== 'normal' ? ' · ' + T.TRATAMENTOS[l.tratamento].rotulo : '');
      tb.appendChild(h('tr', null,
        h('td', null, l.rotulo, h('span', { class: 'cnae-obs', text: sub })),
        h('td', { class: 'num', text: moeda(l.valor) }),
        h('td', { class: 'num' }, moeda(l.das), h('span', { class: 'cnae-obs', text: pct(l.aliquotaDas, 2) }))
      ));
    });
    corpo.appendChild(h('div', { class: 'res-section' }, h('h3', { text: 'Por atividade' }),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', { text: 'Atividade' }), h('th', { class: 'num', text: 'Receita' }), h('th', { class: 'num', text: 'DAS' }))), tb))));

    // Repartição
    var max = 0;
    ORDEM_TRIBUTOS.forEach(function (t) { var p = res.porTributo[t]; if (p) max = Math.max(max, p.das, p.fora); });
    var bars = h('div', { class: 'bars' });
    ORDEM_TRIBUTOS.forEach(function (t) {
      var p = res.porTributo[t];
      if (!p || (p.das === 0 && p.fora === 0)) return;
      var fill = h('span', { class: 'bar__fill' + (p.das === 0 ? ' bar__fill--fora' : '') });
      fill.style.width = (max > 0 ? Math.max(2, ((p.das || p.fora) / max) * 100) : 0) + '%';
      bars.appendChild(h('div', { class: 'bar' },
        h('span', { class: 'bar__nome', text: t }),
        h('span', { class: 'bar__track' }, fill),
        h('span', { class: 'bar__valor' }, moeda(p.das), p.fora > 0 ? h('small', { text: moeda(p.fora) + ' fora do DAS' }) : null)
      ));
    });
    corpo.appendChild(h('div', { class: 'res-section' }, h('h3', { text: 'Repartição dos tributos no DAS' }), bars));

    // Avisos
    var alertas = res.alertas.slice();
    if (res.totalRetido > 0) alertas.push('ISS retido pelo tomador: ' + moeda(res.totalRetido) + ' (recolhido pelo tomador do serviço, não compõe o DAS).');
    if (res.totalExcluido > 0) alertas.push(moeda(res.totalExcluido) + ' em tributos não compõem o DAS por substituição tributária, tributação monofásica, exportação ou sublimite.');
    if (alertas.length) {
      var st = h('div', { class: 'stack' });
      alertas.forEach(function (a) { st.appendChild(h('div', { class: 'notice notice--info' }, a)); });
      corpo.appendChild(h('div', { class: 'res-section' }, h('h3', { text: 'Observações' }), st));
    }

    // Memória de cálculo
    var vistos = {};
    var linhasMem = [];
    res.linhas.forEach(function (l) {
      if (vistos[l.anexo]) return;
      vistos[l.anexo] = true;
      linhasMem.push(T.ANEXOS[l.anexo].nome + ' · ' + l.faixa + 'ª faixa (' + rotuloFaixa(l.faixa - 1) + ')\n' +
        'Alíquota nominal ' + pct(l.nominal, 2) + ' · Parcela a deduzir ' + moeda(l.pd) + '\n' +
        (res.rbt12 > 0
          ? '(' + moeda(res.rbt12) + ' × ' + pct(l.nominal, 2) + ' − ' + moeda(l.pd) + ') ÷ ' + moeda(res.rbt12) + ' = ' + pct(l.efetiva)
          : 'RBT12 zerado: aplica-se a alíquota nominal = ' + pct(l.efetiva)));
    });
    corpo.appendChild(h('div', { class: 'res-section' }, h('h3', { text: 'Memória de cálculo' }),
      h('div', { class: 'memoria', text: linhasMem.join('\n\n') })));

    corpo.appendChild(h('div', { class: 'res-actions' },
      h('button', { class: 'btn btn--primary', type: 'button', text: 'Imprimir / salvar PDF', onclick: function () { window.print(); } }),
      h('a', { class: 'btn btn--secondary', href: 'https://wa.me/5521973839229?text=' + encodeURIComponent('Olá, fiz uma simulação na calculadora do Simples Nacional (DAS estimado de ' + moeda(res.totalDas) + ') e gostaria de falar com um contador.'), target: '_blank', rel: 'noopener noreferrer', text: 'Falar no WhatsApp' })
    ));
    corpo.appendChild(h('p', { class: 'disclaimer-mini', text: 'Estimativa ilustrativa baseada nas tabelas da LC 123/2006 (revisão ' + T.REVISAO + ') e nos dados informados. Não substitui a apuração oficial no PGDAS-D nem a orientação de um contador.' }));

    rolarParaResultado();
  }

  function renderFatorR(fr) {
    var noIII = fr.anexo === 'III';
    var meter = h('div', { class: 'fr-meter' + (noIII ? '' : ' fr-meter--baixo') });
    var fill = h('span');
    fill.style.width = Math.min(100, (fr.fator / T.FATOR_R_MINIMO) * 100) + '%';
    meter.appendChild(fill);
    var texto = noIII
      ? 'Folha igual ou superior a 28% da receita: receitas sujeitas ao Fator R tributadas no Anexo III. No Anexo V, o DAS dessas receitas seria ' + moeda(fr.dasAnexoV) + ' (economia estimada de ' + moeda(fr.diferenca) + ' no mês).'
      : 'Folha abaixo de 28% da receita: receitas sujeitas ao Fator R tributadas no Anexo V. Com folha de 12 meses de pelo menos ' + moeda(fr.folhaNecessaria) + ' (faltam ' + moeda(fr.faltante) + '), o DAS dessas receitas cairia para ' + moeda(fr.dasAnexoIII) + ' no Anexo III (diferença de ' + moeda(fr.diferenca) + ' no mês).';
    return h('div', { class: 'res-section notice ' + (noIII ? 'notice--ok' : 'notice--warning') + ' fr-box' },
      h('div', { class: 'stack' },
        h('strong', { text: 'Fator R: ' + pct(fr.fator, 2) + ' → Anexo ' + fr.anexo }),
        h('div', null, meter, h('div', { class: 'fr-scale' }, h('span', { text: '0%' }), h('span', { text: '28% (mínimo p/ Anexo III)' }))),
        h('p', { text: texto })
      ));
  }

  function rolarParaResultado() {
    if (window.matchMedia('(max-width: 980px)').matches) {
      $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------------- Tabelas informativas ---------------- */
  function renderTabelas() {
    var wrap = $('#tabelas-anexos');
    Object.keys(T.ANEXOS).forEach(function (k) {
      var a = T.ANEXOS[k];
      var tb = h('tbody');
      a.faixas.forEach(function (f, i) {
        tb.appendChild(h('tr', null,
          h('td', { text: (i + 1) + 'ª' }),
          h('td', { text: rotuloFaixa(i) }),
          h('td', { class: 'num', text: pct(f.aliq, 2) }),
          h('td', { class: 'num', text: moeda(f.pd) })));
      });
      wrap.appendChild(h('div', null, h('h3', { text: a.nome }),
        h('div', { class: 'table-wrap' }, h('table', null,
          h('thead', null, h('tr', null, h('th', { text: 'Faixa' }), h('th', { text: 'Receita bruta em 12 meses' }), h('th', { class: 'num', text: 'Alíquota' }), h('th', { class: 'num', text: 'Valor a deduzir' }))),
          tb))));
    });
  }

  /* ---------------- Inicialização ---------------- */
  function limparTudo() {
    $('#form-calc').reset();
    $('#form-simples').reset();
    $('#form-cnpj').reset();
    $('#simples-atividade').hidden = true;
    $('#form-erros-s').hidden = true;
    status('');
    $('#empresa').hidden = true;
    limpar($('#empresa'));
    state.cnaes = [];
    limpar($('#linhas'));
    adicionarLinha('');
    $('#form-erros').hidden = true;
    definirPeriodoPadrao();
    atualizarModo();
    resetarResultado();
  }

  function definirPeriodoPadrao() {
    var d = new Date();
    $('#periodo').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function init() {
    if (!T || !C) return;
    $('#ano').textContent = String(new Date().getFullYear());
    $('#revisao').textContent = T.REVISAO;
    definirPeriodoPadrao();

    var cnpj = $('#cnpj');
    cnpj.addEventListener('input', function () {
      cnpj.value = mascaraCNPJ(cnpj.value);
      cnpj.removeAttribute('aria-invalid');
    });
    $('#form-cnpj').addEventListener('submit', aoConsultar);

    $all('input[name="atividade"]').forEach(function (r) { r.addEventListener('change', atualizarModo); });
    $('#meses').addEventListener('input', atualizarModo);
    $all('#form-calc .money, #form-simples .money').forEach(function (el) { el.addEventListener('blur', formatarCampoMoeda); });

    $('#tab-simples').addEventListener('click', function () { setModo('simples'); });
    $('#tab-completa').addEventListener('click', function () { setModo('completa'); });
    $('.modos').addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      setModo(state.modo === 'simples' ? 'completa' : 'simples', true);
    });
    $('#link-completa').addEventListener('click', function () {
      setModo('completa');
      $('#card-completo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#form-simples').addEventListener('submit', aoCalcularSimples);
    $('#btn-limpar-s').addEventListener('click', limparTudo);

    $('#btn-add').addEventListener('click', function () {
      var l = adicionarLinha('');
      var alvo = $('select:not([disabled])', l);
      if (alvo) alvo.focus();
    });
    $('#form-calc').addEventListener('submit', aoCalcular);
    $('#btn-limpar').addEventListener('click', limparTudo);

    adicionarLinha('');
    atualizarModo();
    renderTabelas();
    setModo(location.hash === '#completa' ? 'completa' : 'simples');
    window.addEventListener('hashchange', function () {
      if (location.hash === '#completa' && state.modo !== 'completa') setModo('completa');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
