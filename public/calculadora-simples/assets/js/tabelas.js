/*
 * RC2 Contábil — Tabelas do Simples Nacional
 * Base legal: Lei Complementar 123/2006 (redação da LC 155/2016), Anexos I a V,
 * e Resolução CGSN 140/2018. Tabelas vigentes desde 01/01/2018.
 *
 * ATENÇÃO: revisar este arquivo sempre que houver alteração legal
 * (ex.: Reforma Tributária — LC 214/2025, reajuste do salário mínimo p/ MEI).
 */
(function () {
  'use strict';

  var REVISAO = 'setembro/2026';

  var LIMITES = [180000, 360000, 720000, 1800000, 3600000, 4800000];
  var SUBLIMITE_ICMS_ISS = 3600000;
  var LIMITE_SIMPLES = 4800000;
  var FATOR_R_MINIMO = 0.28;
  var ISS_TETO = 0.05;

  function faixas(aliqs, deducoes) {
    return LIMITES.map(function (ate, i) {
      return { ate: ate, aliq: aliqs[i], pd: deducoes[i] };
    });
  }

  var ANEXOS = {
    I: {
      codigo: 'I',
      nome: 'Anexo I — Comércio',
      curto: 'Comércio',
      faixas: faixas([0.04, 0.073, 0.095, 0.107, 0.143, 0.19],
                     [0, 5940, 13860, 22500, 87300, 378000]),
      tributos: ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS'],
      reparticao: [
        { IRPJ: 5.5,  CSLL: 3.5,  COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34 },
        { IRPJ: 5.5,  CSLL: 3.5,  COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34 },
        { IRPJ: 5.5,  CSLL: 3.5,  COFINS: 12.74, PIS: 2.76, CPP: 42,   ICMS: 33.5 },
        { IRPJ: 5.5,  CSLL: 3.5,  COFINS: 12.74, PIS: 2.76, CPP: 42,   ICMS: 33.5 },
        { IRPJ: 5.5,  CSLL: 3.5,  COFINS: 12.74, PIS: 2.76, CPP: 42,   ICMS: 33.5 },
        { IRPJ: 13.5, CSLL: 10,   COFINS: 28.27, PIS: 6.13, CPP: 42.1, ICMS: 0 }
      ]
    },
    II: {
      codigo: 'II',
      nome: 'Anexo II — Indústria',
      curto: 'Indústria',
      faixas: faixas([0.045, 0.078, 0.10, 0.112, 0.147, 0.30],
                     [0, 5940, 13860, 22500, 85500, 720000]),
      tributos: ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'IPI', 'ICMS'],
      reparticao: [
        { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 },
        { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 },
        { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 },
        { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 },
        { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 },
        { IRPJ: 8.5, CSLL: 7.5, COFINS: 20.96, PIS: 4.54, CPP: 23.5, IPI: 35,  ICMS: 0 }
      ]
    },
    III: {
      codigo: 'III',
      nome: 'Anexo III — Serviços',
      curto: 'Serviços',
      faixas: faixas([0.06, 0.112, 0.135, 0.16, 0.21, 0.33],
                     [0, 9360, 17640, 35640, 125640, 648000]),
      tributos: ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ISS'],
      reparticao: [
        { IRPJ: 4,  CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
        { IRPJ: 4,  CSLL: 3.5, COFINS: 14.05, PIS: 3.05, CPP: 43.4, ISS: 32 },
        { IRPJ: 4,  CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
        { IRPJ: 4,  CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 },
        { IRPJ: 4,  CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 },
        { IRPJ: 35, CSLL: 15,  COFINS: 16.03, PIS: 3.47, CPP: 30.5, ISS: 0 }
      ]
    },
    IV: {
      codigo: 'IV',
      nome: 'Anexo IV — Serviços (CPP fora do DAS)',
      curto: 'Serviços IV',
      faixas: faixas([0.045, 0.09, 0.102, 0.14, 0.22, 0.33],
                     [0, 8100, 12420, 39780, 183780, 828000]),
      tributos: ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'ISS'],
      reparticao: [
        { IRPJ: 18.8, CSLL: 15.2, COFINS: 17.67, PIS: 3.83, ISS: 44.5 },
        { IRPJ: 19.8, CSLL: 15.2, COFINS: 20.55, PIS: 4.45, ISS: 40 },
        { IRPJ: 20.8, CSLL: 15.2, COFINS: 19.73, PIS: 4.27, ISS: 40 },
        { IRPJ: 17.8, CSLL: 19.2, COFINS: 18.9,  PIS: 4.1,  ISS: 40 },
        { IRPJ: 18.8, CSLL: 19.2, COFINS: 18.08, PIS: 3.92, ISS: 40 },
        { IRPJ: 53.5, CSLL: 21.5, COFINS: 20.55, PIS: 4.45, ISS: 0 }
      ]
    },
    V: {
      codigo: 'V',
      nome: 'Anexo V — Serviços',
      curto: 'Serviços V',
      faixas: faixas([0.155, 0.18, 0.195, 0.205, 0.23, 0.305],
                     [0, 4500, 9900, 17100, 62100, 540000]),
      tributos: ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ISS'],
      reparticao: [
        { IRPJ: 25, CSLL: 15,   COFINS: 14.1,  PIS: 3.05, CPP: 28.85, ISS: 14 },
        { IRPJ: 23, CSLL: 15,   COFINS: 14.1,  PIS: 3.05, CPP: 27.85, ISS: 17 },
        { IRPJ: 24, CSLL: 15,   COFINS: 14.92, PIS: 3.23, CPP: 23.85, ISS: 19 },
        { IRPJ: 21, CSLL: 15,   COFINS: 15.74, PIS: 3.41, CPP: 23.85, ISS: 21 },
        { IRPJ: 23, CSLL: 12.5, COFINS: 14.1,  PIS: 3.05, CPP: 23.85, ISS: 23.5 },
        { IRPJ: 35, CSLL: 15.5, COFINS: 16.44, PIS: 3.56, CPP: 29.5,  ISS: 0 }
      ]
    }
  };

  /* Tratamentos especiais da receita (segregação no PGDAS-D). */
  var TRATAMENTOS = {
    normal:       { rotulo: 'Tributação normal', exclui: [], anexos: ['I', 'II', 'III', 'IV', 'V'] },
    st:           { rotulo: 'ICMS por substituição tributária', exclui: ['ICMS'], anexos: ['I', 'II'] },
    mono:         { rotulo: 'PIS/COFINS monofásico', exclui: ['PIS', 'COFINS'], anexos: ['I', 'II'] },
    st_mono:      { rotulo: 'ICMS-ST + PIS/COFINS monofásico', exclui: ['ICMS', 'PIS', 'COFINS'], anexos: ['I', 'II'] },
    iss_retido:   { rotulo: 'ISS retido pelo tomador', exclui: ['ISS'], anexos: ['III', 'IV', 'V'], retido: true },
    exportacao:   { rotulo: 'Exportação', exclui: ['PIS', 'COFINS', 'ICMS', 'IPI', 'ISS'], anexos: ['I', 'II', 'III', 'IV', 'V'] }
  };

  /* MEI — valores de referência (LC 123/2006, art. 18-A). */
  var MEI = {
    ano: 2026,
    salarioMinimo: 1621.00,
    percentualInss: 0.05,
    icms: 1.00,
    iss: 5.00,
    limiteAnual: 81000
  };

  /*
   * Sugestão de enquadramento por CNAE (prefixo do código de 7 dígitos).
   * É uma SUGESTÃO — o enquadramento correto depende da atividade
   * efetivamente exercida e deve ser confirmado por um contador.
   *   anexo: 'I' | 'II' | 'III' | 'IV' | 'V' | 'FR' (Fator R) | 'VEDADO' | '?'
   */
  var OBS_TRANSP = 'Transporte intermunicipal/interestadual: Anexo III sem ISS e com ICMS.';
  var CNAE_REGRAS = {
    // Agropecuária
    '01': { anexo: '?', obs: 'Atividade rural — verificar enquadramento.' },
    '02': { anexo: '?', obs: 'Atividade florestal — verificar enquadramento.' },
    '03': { anexo: '?', obs: 'Pesca/aquicultura — verificar enquadramento.' },
    // Indústria extrativa e de transformação
    '05': { anexo: 'II' }, '06': { anexo: 'II' }, '07': { anexo: 'II' }, '08': { anexo: 'II' }, '09': { anexo: 'II' },
    '10': { anexo: 'II' }, '11': { anexo: 'II', obs: 'Bebidas alcoólicas podem ser vedadas (exceto micro e pequenas cervejarias, vinícolas, destilarias e licorerias).' },
    '12': { anexo: 'VEDADO', obs: 'Fabricação de produtos do fumo é vedada no Simples.' },
    '13': { anexo: 'II' }, '14': { anexo: 'II' }, '15': { anexo: 'II' }, '16': { anexo: 'II' }, '17': { anexo: 'II' },
    '18': { anexo: 'II' }, '19': { anexo: 'II' }, '20': { anexo: 'II' }, '21': { anexo: 'II' }, '22': { anexo: 'II' },
    '23': { anexo: 'II' }, '24': { anexo: 'II' }, '25': { anexo: 'II', obs: 'Armas e munições são vedadas.' },
    '26': { anexo: 'II' }, '27': { anexo: 'II' }, '28': { anexo: 'II' }, '29': { anexo: 'II' }, '30': { anexo: 'II' },
    '31': { anexo: 'II' }, '32': { anexo: 'II' },
    '33': { anexo: 'III', obs: 'Manutenção e reparação — serviço.' },
    // Utilidades
    '35': { anexo: 'VEDADO', obs: 'Geração, transmissão, distribuição ou comercialização de energia elétrica é vedada.' },
    '36': { anexo: '?', obs: 'Captação/distribuição de água — verificar.' },
    '37': { anexo: '?', obs: 'Esgoto — verificar enquadramento.' },
    '38': { anexo: '?', obs: 'Resíduos — verificar enquadramento.' },
    '39': { anexo: '?', obs: 'Descontaminação — verificar enquadramento.' },
    // Construção
    '4110': { anexo: '?', obs: 'Incorporação imobiliária — verificar enquadramento.' },
    '41': { anexo: 'IV', obs: 'Construção de imóveis e obras de engenharia.' },
    '42': { anexo: 'IV', obs: 'Obras de infraestrutura.' },
    '43': { anexo: 'IV', obs: 'Serviços especializados de construção.' },
    '432': { anexo: 'III', obs: 'Instalações — pode ser Anexo IV quando executadas como parte de obra de construção civil.' },
    // Comércio
    '45': { anexo: 'I' },
    '4520': { anexo: 'III', obs: 'Manutenção e reparação de veículos — serviço.' },
    '4543': { anexo: 'III', obs: 'Manutenção e reparação de motocicletas — serviço.' },
    '46': { anexo: 'I' },
    '461': { anexo: 'FR', obs: 'Representação comercial — sujeita ao Fator R.' },
    '47': { anexo: 'I' },
    // Transporte
    '49': { anexo: 'III', obs: OBS_TRANSP }, '50': { anexo: 'III', obs: OBS_TRANSP },
    '51': { anexo: 'III', obs: OBS_TRANSP }, '52': { anexo: 'III' }, '53': { anexo: 'III' },
    // Alojamento e alimentação
    '55': { anexo: 'III' },
    '56': { anexo: 'I', obs: 'Fornecimento de alimentação — tributado como comércio.' },
    // Informação e comunicação
    '58': { anexo: '?', obs: 'Edição — verificar (indústria gráfica x serviço).' },
    '59': { anexo: 'III', obs: 'Produções audiovisuais e culturais.' },
    '60': { anexo: '?', obs: 'Rádio e TV — verificar enquadramento.' },
    '61': { anexo: '?', obs: 'Telecomunicações — verificar (ICMS-comunicação).' },
    '62': { anexo: 'FR', obs: 'Tecnologia da informação — sujeita ao Fator R.' },
    '63': { anexo: 'FR', obs: 'Serviços de informação — verificar; em regra sujeita ao Fator R.' },
    // Financeiro e seguros
    '64': { anexo: 'VEDADO', obs: 'Instituições financeiras são vedadas no Simples.' },
    '65': { anexo: 'VEDADO', obs: 'Seguradoras e previdência são vedadas no Simples.' },
    '66': { anexo: '?', obs: 'Atividades auxiliares financeiras — verificar.' },
    '6622': { anexo: 'III', obs: 'Corretagem de seguros.' },
    // Imobiliárias
    '68': { anexo: 'III', obs: 'Locação de imóveis próprios e corretagem de imóveis.' },
    // Profissionais, científicas e técnicas
    '6911': { anexo: 'IV', obs: 'Serviços advocatícios.' },
    '6912': { anexo: '?', obs: 'Cartórios — verificar.' },
    '6920601': { anexo: 'III', obs: 'Escritórios contábeis — Anexo III.' },
    '6920602': { anexo: 'FR', obs: 'Consultoria e auditoria contábil/tributária — Fator R.' },
    '70': { anexo: 'FR', obs: 'Consultoria e gestão — sujeita ao Fator R.' },
    '71': { anexo: 'FR', obs: 'Arquitetura, engenharia, testes e análises técnicas — Fator R.' },
    '72': { anexo: 'FR', obs: 'Pesquisa e desenvolvimento — Fator R.' },
    '73': { anexo: 'FR', obs: 'Publicidade e pesquisa de mercado — Fator R.' },
    '74': { anexo: 'FR', obs: 'Design e atividades técnicas — em regra Fator R; verificar.' },
    '75': { anexo: 'FR', obs: 'Medicina veterinária — Fator R.' },
    // Administrativas e complementares
    '77': { anexo: 'III', obs: 'Locação de bens móveis.' },
    '78': { anexo: 'VEDADO', obs: 'Cessão/locação de mão de obra é vedada (exceto atividades do Anexo IV).' },
    '7810': { anexo: 'FR', obs: 'Seleção e agenciamento de mão de obra — Fator R; verificar.' },
    '79': { anexo: 'III', obs: 'Agências de viagem e turismo.' },
    '80': { anexo: 'IV', obs: 'Vigilância e segurança.' },
    '81': { anexo: 'IV', obs: 'Limpeza e conservação.' },
    '8130': { anexo: 'III', obs: 'Paisagismo — verificar enquadramento.' },
    '82': { anexo: 'III', obs: 'Serviços de escritório e apoio — verificar.' },
    // Administração pública
    '84': { anexo: 'VEDADO', obs: 'Administração pública.' },
    // Educação
    '85': { anexo: 'III', obs: 'Ensino — verificar se ensino superior ou atividade intelectual (Fator R).' },
    // Saúde
    '86': { anexo: 'FR', obs: 'Medicina, odontologia, psicologia etc. — Fator R.' },
    '8650004': { anexo: 'III', obs: 'Fisioterapia — Anexo III.' },
    '87': { anexo: '?', obs: 'Assistência a idosos/deficientes — verificar.' },
    '88': { anexo: '?', obs: 'Serviços sociais — verificar.' },
    // Artes, cultura, esporte
    '90': { anexo: 'III', obs: 'Atividades artísticas e culturais.' },
    '91': { anexo: 'III' },
    '92': { anexo: '?', obs: 'Jogos e apostas — verificar vedação.' },
    '93': { anexo: 'III', obs: 'Academias e atividades esportivas.' },
    // Outros serviços
    '94': { anexo: '?', obs: 'Organizações associativas — em regra não são empresas.' },
    '95': { anexo: 'III', obs: 'Reparação de equipamentos e objetos.' },
    '96': { anexo: 'III', obs: 'Serviços pessoais (cabeleireiros, lavanderias etc.).' },
    '97': { anexo: '?', obs: 'Serviços domésticos.' },
    '99': { anexo: '?', obs: 'Organismos internacionais.' }
  };

  function sugerirAnexo(cnae) {
    var codigo = String(cnae || '').replace(/\D/g, '');
    if (codigo.length < 2) return { anexo: '?', obs: 'CNAE não informado.' };
    codigo = codigo.padStart(7, '0');
    for (var n = 7; n >= 2; n--) {
      var regra = CNAE_REGRAS[codigo.slice(0, n)];
      if (regra) return { anexo: regra.anexo, obs: regra.obs || '' };
    }
    return { anexo: '?', obs: 'Sem sugestão automática — verificar.' };
  }

  window.RC2_TABELAS = {
    REVISAO: REVISAO,
    LIMITES: LIMITES,
    SUBLIMITE_ICMS_ISS: SUBLIMITE_ICMS_ISS,
    LIMITE_SIMPLES: LIMITE_SIMPLES,
    FATOR_R_MINIMO: FATOR_R_MINIMO,
    ISS_TETO: ISS_TETO,
    ANEXOS: ANEXOS,
    TRATAMENTOS: TRATAMENTOS,
    MEI: MEI,
    sugerirAnexo: sugerirAnexo
  };
})();
