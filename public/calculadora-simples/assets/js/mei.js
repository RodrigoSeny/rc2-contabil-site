/*
 * RC2 Contábil — MEI ou microempresa? (funções puras)
 *
 * Compara, por ano, o custo de continuar MEI com o de virar ME no Simples Nacional,
 * conforme o faturamento cresce. Dinheiro SEMPRE em centavos inteiros; percentuais em
 * centésimos de ponto (5% = 500).
 *
 *   MEI  = DAS-MEI fixo (LC 123, art. 18-A; limites da LC 238/2026).
 *          Até 20% acima do limite: DAS-MEI + DAS sobre o excesso, e vira ME em janeiro seguinte.
 *          Mais de 20% acima: desenquadramento retroativo a janeiro (não dá para ser MEI no ano).
 *   ME   = DAS do Simples (receita estável no ano: RBT12 = faturamento anual)
 *          + INSS de 11% sobre o pró-labore (+ CPP de 20% no Anexo IV)
 *          + honorários do contador.
 *          Serviço sujeito ao Fator R: escolhe o mais barato entre pró-labore de 28% (Anexo III)
 *          e pró-labore mínimo (Anexo V).
 *   Ponto de equilíbrio = faturamento a partir do qual a ME deixa no bolso o mesmo que o MEI
 *          no teto (faturamento − custo).
 *
 * Depende de tabelas.js, reforma.js e calculo.js. Também é embutido no RC2 Gestão
 * (scripts/sincronizar-simples.mjs) — a mesma conta nos dois lugares.
 */
(function (root) {
  'use strict';

  var T = root.RC2_TABELAS;
  var C = root.RC2_CALCULO;

  var PADRAO = {
    contadorMensal: 35000,   // R$ 350,00 por mês
    inssProlabore: 1100,     // 11% do pró-labore (segurado)
    cppAnexoIV: 2000,        // 20% de CPP patronal fora do DAS no Anexo IV
    partServico: 5000,       // comércio e serviços: 50% de serviços
    tolerancia: 2000         // 20% acima do limite do MEI
  };

  var ATIVIDADES = {
    comercio: 'Comércio (venda de produtos)',
    servico: 'Prestação de serviços',
    ambos: 'Comércio e serviços'
  };
  var SERVICOS = {
    III: 'Serviço comum (Anexo III)',
    FR: 'Serviço técnico ou intelectual (Fator R: Anexo III ou V)',
    V: 'Serviço do Anexo V',
    IV: 'Serviço do Anexo IV (CPP fora do DAS)'
  };

  /* percentual (centésimos de ponto) de um valor em centavos, arredondado meio-centavo para cima, só inteiros */
  function pct(valor, centesimos) { return Math.floor((valor * centesimos + 5000) / 10000); }
  function int(v, padrao) { return typeof v === 'number' && isFinite(v) ? Math.round(v) : padrao; }

  /* R$ 1.234,56 sem depender do Intl (também roda no Node da API). */
  function brl(c) {
    var neg = c < 0; c = Math.abs(Math.round(c));
    var reais = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var cent = String(c % 100); if (cent.length < 2) cent = '0' + cent;
    return (neg ? '-R$ ' : 'R$ ') + reais + ',' + cent;
  }
  /* valor arredondado para reais inteiros, para frases ("R$ 92.454") */
  function brlInteiro(c) {
    var r = Math.round(c / 100);
    return (r < 0 ? '-R$ ' : 'R$ ') + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function pctTexto(fracao, casas) {
    return (fracao * 100).toFixed(casas === undefined ? 2 : casas).replace('.', ',') + '%';
  }

  /* Normaliza a entrada e aplica os padrões. */
  function parametros(e) {
    e = e || {};
    var ano = int(e.ano, 2026);
    var M = C.meiDoAno(ano);
    var atividade = ATIVIDADES[e.atividade] ? e.atividade : 'servico';
    var anexoServico = SERVICOS[e.anexoServico] ? e.anexoServico : 'III';
    var salario = int(e.salarioMinimo, M.salarioMinimo);
    return {
      ano: ano,
      atividade: atividade,
      anexoServico: anexoServico,
      partServico: atividade === 'servico' ? 10000 : atividade === 'comercio' ? 0 : Math.min(10000, Math.max(0, int(e.partServico, PADRAO.partServico))),
      faturamentoAnual: Math.max(0, int(e.faturamentoAnual, 0)),
      contadorMensal: Math.max(0, int(e.contadorMensal, PADRAO.contadorMensal)),
      salarioMinimo: salario,
      percentualInssMei: int(e.percentualInssMei, M.percentualInss),
      prolaboreMensal: Math.max(0, int(e.prolaboreMensal, salario)),
      inssProlabore: int(e.inssProlabore, PADRAO.inssProlabore),
      empregados: Math.max(0, int(e.empregados, 0)),
      mei: M
    };
  }

  /* Parte de comércio e de serviços de um faturamento. */
  function partes(receita, p) {
    var servico = pct(receita, p.partServico);
    return { comercio: receita - servico, servico: servico };
  }

  /* DAS anual (centavos) de uma parcela da receita, com a alíquota da RBT12 total. */
  function dasParcela(anexo, parcela, rbt12, ano) {
    if (!(parcela > 0)) return { das: 0, aliquota: null };
    var ae = C.aliquotaEfetiva(anexo, rbt12 / 100, ano);
    if (!ae) return null;
    return { das: Math.round(parcela * ae.efetiva), aliquota: { anexo: anexo, faixa: ae.faixa + 1, nominal: ae.nominal, deducao: Math.round(ae.pd * 100), efetiva: ae.efetiva } };
  }

  /* ME no Simples com um anexo de serviços definido e um pró-labore mensal. */
  function opcaoME(receita, p, anexoServ, prolabore) {
    var pt = partes(receita, p);
    var dc = dasParcela('I', pt.comercio, receita, p.ano);
    var ds = dasParcela(anexoServ, pt.servico, receita, p.ano);
    if (!dc || !ds) return null;
    var prolaboreAnual = prolabore * 12;
    var inss = pct(prolaboreAnual, p.inssProlabore);
    var cpp = anexoServ === 'IV' && pt.servico > 0 ? pct(prolaboreAnual, PADRAO.cppAnexoIV) : 0;
    var contador = p.contadorMensal * 12;
    var das = dc.das + ds.das;
    return {
      anexoServico: pt.servico > 0 ? anexoServ : null,
      comercio: pt.comercio > 0 ? { receita: pt.comercio, das: dc.das, aliquota: dc.aliquota } : null,
      servico: pt.servico > 0 ? { receita: pt.servico, das: ds.das, aliquota: ds.aliquota } : null,
      dasAnual: das,
      prolaboreMensal: prolabore,
      inssAnual: inss,
      cppAnual: cpp,
      contadorAnual: contador,
      impostosAnual: das + inss + cpp,
      totalAnual: das + inss + cpp + contador,
      totalMensal: Math.round((das + inss + cpp + contador) / 12),
      fatorR: receita > 0 ? prolaboreAnual / receita : 0
    };
  }

  /* Custo anual como ME. Fator R: escolhe a opção mais barata (Anexo III com pró-labore de 28% ou Anexo V). */
  function custoME(receita, p) {
    if (receita > T.LIMITE_SIMPLES * 100) return null;
    var temServico = p.partServico > 0;
    if (!temServico || p.anexoServico !== 'FR') return opcaoME(receita, p, p.anexoServico === 'FR' ? 'III' : p.anexoServico, p.prolaboreMensal);
    var minimo28 = Math.ceil(receita * 28 / 1200); // pró-labore mensal para folha de 12 meses ≥ 28% da RBT12
    var tresC = opcaoME(receita, p, 'III', Math.max(p.prolaboreMensal, minimo28));
    var cinco = p.prolaboreMensal >= minimo28 ? null : opcaoME(receita, p, 'V', p.prolaboreMensal);
    if (!tresC || !cinco) return tresC || cinco;
    var melhor = tresC.totalAnual <= cinco.totalAnual ? tresC : cinco;
    var outra = melhor === tresC ? cinco : tresC;
    melhor.alternativa = { anexoServico: outra.anexoServico, prolaboreMensal: outra.prolaboreMensal, totalAnual: outra.totalAnual };
    return melhor;
  }

  /* Custo anual como MEI no ano (situação: dentro | tolerancia | acima). */
  function custoMEI(receita, p) {
    var M = p.mei;
    var d = C.dasMei(p.salarioMinimo, p.percentualInssMei, M.icms, M.iss);
    var mensal = p.atividade === 'comercio' ? d.comercio : p.atividade === 'ambos' ? d.ambos : d.servicos;
    var limite = M.limiteAnual;
    var tolerancia = limite + pct(limite, PADRAO.tolerancia);
    var r = {
      limiteAnual: limite, toleranciaAnual: tolerancia, empregadosMax: M.empregados, salarioOficial: M.salarioOficial,
      inssMensal: d.inss, dasMensal: mensal, dasAnual: mensal * 12,
      situacao: 'dentro', excesso: 0, dasExcesso: 0, custoAnual: mensal * 12
    };
    if (receita <= limite) return r;
    if (receita > tolerancia) { r.situacao = 'acima'; r.custoAnual = null; return r; }
    // Excesso de até 20%: DAS sobre o excesso com as alíquotas do Simples. Sem pró-labore, o Fator R leva ao Anexo V.
    r.situacao = 'tolerancia';
    r.excesso = receita - limite;
    var pt = partes(r.excesso, p);
    var servAnexo = p.anexoServico === 'FR' ? 'V' : p.anexoServico;
    var dc = dasParcela('I', pt.comercio, receita, p.ano);
    var ds = dasParcela(servAnexo, pt.servico, receita, p.ano);
    r.dasExcesso = (dc ? dc.das : 0) + (ds ? ds.das : 0);
    r.custoAnual = r.dasAnual + r.dasExcesso;
    return r;
  }

  /* Faturamento anual a partir do qual a ME deixa no bolso o mesmo que o MEI no teto. */
  function pontoEquilibrio(p) {
    var limite = p.mei.limiteAnual;
    var alvo = limite - custoMEI(limite, p).custoAnual;
    var liquido = function (x) { var m = custoME(x, p); return m ? x - m.totalAnual : -Infinity; };
    var lo = limite, hi = limite * 2;
    while (liquido(hi) < alvo) {
      if (hi >= T.LIMITE_SIMPLES * 100) return null;
      hi = Math.min(hi * 2, T.LIMITE_SIMPLES * 100);
    }
    while (hi - lo > 1) {
      var meio = Math.floor((lo + hi) / 2);
      if (liquido(meio) >= alvo) hi = meio; else lo = meio;
    }
    return hi;
  }

  /* Faturamentos de referência (anuais) para a tabela "se o faturamento crescer". */
  function curva(p, equilibrio) {
    var limite = p.mei.limiteAnual;
    var pontos = [0.25, 0.5, 0.75, 1, 1.2, 1.5, 2, 3, 4].map(function (f) {
      var mensal = Math.round(limite * f / 12 / 5000) * 5000; // R$ 50 redondos por mês
      return f === 1 ? limite : f === 1.2 ? custoMEI(limite, p).toleranciaAnual : mensal * 12;
    });
    if (equilibrio) pontos.push(Math.ceil(equilibrio / 120000) * 120000); // R$ 100 redondos por mês
    if (p.faturamentoAnual > 0) pontos.push(p.faturamentoAnual);
    pontos = pontos.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    return pontos.map(function (x) {
      var mei = custoMEI(x, p);
      var me = custoME(x, p);
      return {
        faturamentoAnual: x,
        faturamentoMensal: Math.round(x / 12),
        meiSituacao: mei.situacao,
        meiAnual: mei.custoAnual,
        meAnual: me ? me.totalAnual : null,
        meAnexoServico: me ? me.anexoServico : null,
        atual: x === p.faturamentoAnual,
        equilibrio: !!equilibrio && x === Math.ceil(equilibrio / 120000) * 120000
      };
    });
  }

  /* Resposta em linguagem simples. */
  function veredito(p, mei, me, eq) {
    var frases = [];
    var nivel, titulo;
    var proximo = C.meiDoAno(p.ano + 1);
    var meMensal = me ? brl(me.totalMensal) : null;

    if (mei.situacao === 'dentro') {
      nivel = 'ok';
      titulo = p.faturamentoAnual > 0 ? 'Sim, vale a pena continuar MEI.' : 'Informe quanto você fatura.';
      frases.push('Como MEI você paga ' + brl(mei.dasMensal) + ' por mês, sempre o mesmo valor, fature pouco ou muito (até o limite).');
      if (me) frases.push('Como microempresa (ME) pagaria cerca de ' + meMensal + ' por mês, somando impostos e contador. A diferença é de ' + brlInteiro(me.totalAnual - mei.custoAnual) + ' por ano a favor do MEI.');
      var uso = mei.limiteAnual > 0 ? p.faturamentoAnual / mei.limiteAnual : 0;
      if (uso >= 0.8) {
        nivel = 'atencao';
        frases.push('Atenção: você já usa ' + Math.round(uso * 100) + '% do limite do MEI (' + brlInteiro(mei.limiteAnual) + ' por ano, ' + brlInteiro(mei.limiteAnual / 12) + ' por mês em média).');
      }
      if (eq) frases.push('Se crescer além do limite, só compensa como empresa a partir de cerca de ' + brlInteiro(eq) + ' por ano (' + brlInteiro(eq / 12) + ' por mês).');
    } else if (mei.situacao === 'tolerancia') {
      nivel = 'atencao';
      titulo = 'Você passou um pouco do limite do MEI.';
      frases.push('Neste ano você continua pagando o DAS-MEI e mais uma guia de cerca de ' + brl(mei.dasExcesso) + ' sobre o que passou do limite (' + brl(mei.excesso) + ').');
      if (me) frases.push('A partir de janeiro de ' + (p.ano + 1) + ' você deixa de ser MEI e vira microempresa (ME): o custo passa para cerca de ' + meMensal + ' por mês (impostos + contador).');
    } else {
      nivel = 'alerta';
      titulo = 'Com esse faturamento não dá para ser MEI.';
      frases.push('Você passou mais de 20% do limite (' + brlInteiro(mei.toleranciaAnual) + ' por ano). Nesse caso a mudança para microempresa vale desde janeiro deste ano (ou desde a abertura) e os impostos do ano precisam ser acertados. Procure um contador logo.');
      if (me) frases.push('Como microempresa, o custo estimado é de ' + meMensal + ' por mês (impostos + contador).');
      else frases.push('Esse faturamento passa do limite do Simples Nacional (R$ 4,8 milhões por ano).');
    }

    if (mei.situacao !== 'dentro' && eq && p.faturamentoAnual < eq) {
      frases.push('Faturando entre ' + brlInteiro(mei.limiteAnual) + ' e ' + brlInteiro(eq) + ' por ano você fica com menos dinheiro no bolso do que no teto do MEI. Como empresa, só compensa a partir de cerca de ' + brlInteiro(eq) + ' por ano (' + brlInteiro(eq / 12) + ' por mês).');
    }
    if (proximo.limiteAnual > mei.limiteAnual && proximo.ano > p.ano) {
      frases.push('Em ' + (p.ano + 1) + ' o limite do MEI sobe para ' + brlInteiro(proximo.limiteAnual) + ' por ano (LC 238/2026). Quem já deixou de ser MEI não volta automaticamente.');
    }
    if (p.empregados > mei.empregadosMax) {
      nivel = 'alerta';
      frases.push('O MEI pode ter no máximo ' + mei.empregadosMax + (mei.empregadosMax === 1 ? ' empregado' : ' empregados') + ' em ' + p.ano + '. Com ' + p.empregados + ', é preciso ser microempresa.');
    }
    if (p.partServico > 0 && p.anexoServico === 'FR') {
      frases.push('Muitas atividades técnicas ou intelectuais (consultoria, programação, design, engenharia, marketing…) não podem ser MEI. Confira se a sua ocupação está na lista oficial.');
    }
    return { nivel: nivel, titulo: titulo, frases: frases };
  }

  /* Simulação completa. */
  function simular(entrada) {
    var p = parametros(entrada);
    var mei = custoMEI(p.faturamentoAnual, p);
    var me = custoME(p.faturamentoAnual, p);
    var eq = pontoEquilibrio(p);
    var dif = me && mei.custoAnual !== null ? me.totalAnual - mei.custoAnual : null;
    return {
      parametros: {
        ano: p.ano, atividade: p.atividade, anexoServico: p.anexoServico, partServico: p.partServico,
        faturamentoAnual: p.faturamentoAnual, contadorMensal: p.contadorMensal, salarioMinimo: p.salarioMinimo,
        percentualInssMei: p.percentualInssMei, prolaboreMensal: p.prolaboreMensal, inssProlabore: p.inssProlabore,
        empregados: p.empregados
      },
      mei: mei,
      me: me,
      diferencaAnual: dif,
      pontoEquilibrio: eq,
      curva: curva(p, eq),
      veredito: veredito(p, mei, me, eq)
    };
  }

  root.RC2_MEI = {
    PADRAO: PADRAO,
    ATIVIDADES: ATIVIDADES,
    SERVICOS: SERVICOS,
    brl: brl,
    brlInteiro: brlInteiro,
    pctTexto: pctTexto,
    parametros: parametros,
    custoMEI: custoMEI,
    custoME: custoME,
    pontoEquilibrio: pontoEquilibrio,
    simular: simular
  };
})(typeof window !== 'undefined' ? window : globalThis);
