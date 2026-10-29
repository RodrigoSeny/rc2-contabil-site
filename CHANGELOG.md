# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.2.1] - 2026-10-29

### Corrigido
- Comparativo de regimes: novo campo RBT12 (receita dos 12 meses anteriores),
  que passa a definir a faixa e a alíquota efetiva do Simples, o Fator R, o
  limite de R$ 4,8 milhões e o sublimite de R$ 3,6 milhões. Antes, a receita
  anual era usada como RBT12. Em branco, continua usando a receita anual.

## [1.2.0] - 2026-10-29

### Adicionado
- Comparativo de regimes na Reforma Tributária (`/calculadora-simples/comparar.html`):
  Simples (tudo no DAS), Simples com IBS/CBS por fora, Lucro Presumido e Lucro
  Real, de 2027 a 2033, com recomendação que considera o crédito de IBS/CBS
  aproveitado pelos clientes empresas. Tabelas dos Anexos I a V extraídas da
  LC 214/2025 (redação da LC 227/2026); premissas da CBS/IBS editáveis.
- Testes (`node --test test/calculo.test.js test/regimes.test.js`) e ferramenta
  de extração das tabelas da lei (`ferramentas/lc214/`).

### Alterado
- Calculadora do DAS: o ano do período de apuração escolhe as tabelas — até 2026
  as da LC 123/2006; a partir de 2027 as da LC 214/2025 (CBS e IBS no lugar de
  PIS/COFINS, IBS substituindo o ICMS/ISS de 2029 a 2033, 6ª faixa com 0,1 ponto
  a menos em 2027–2028). Monofásico e exportação passam a excluir CBS/IBS; acima
  do sublimite o IBS também sai do DAS; aviso sobre o Anexo II (só IPI mantido).
- Tabelas informativas mostram as alíquotas até 2026, 2027–2028 e de 2029 em diante.
- Calculadora: terceira aba com link para o comparativo.

## [1.1.0] - 2026-09-30

### Alterado
- HSTS ativo (HTTPS confirmado).
- Logs de acesso em `/var/log/nginx-rc2/` (retenção de ~13 meses para as
  estatísticas de visitas, geradas pelo `rc2-sistemas-site`).

## [1.0.0] - 2026-09-29

### Adicionado
- Site público da RC2 Contábil em `contabil.rc2sistemas.cloud`, estático e
  independente dos sistemas da VPS.
- Calculadora do Simples Nacional (versão simples e completa), migrada do
  repositório RCSystem-Racoes (onde estava em `/calculadora-simples/` até a v2.4.0).
- Configuração Nginx com CSP estrita, cabeçalhos de segurança e log de acesso
  com IP anonimizado.
