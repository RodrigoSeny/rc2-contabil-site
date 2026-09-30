# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

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
