# RC2 Contábil — site público

Site público da RC2 Contábil em **https://contabil.rc2sistemas.cloud**.
Hoje contém a **Calculadora do Simples Nacional** (`/calculadora-simples/`),
com versão simples e completa, e o **Comparativo de regimes na Reforma
Tributária** (`/calculadora-simples/comparar.html`: Simples, Simples com
IBS/CBS por fora, Lucro Presumido e Lucro Real, de 2027 a 2033).

Separado de propósito do sistema de gestão contábil (`controle-contabil`) e dos
sistemas da RC2 Sistemas: é conteúdo público e estático, servido direto pelo
Nginx, sem backend, banco ou login. Se qualquer sistema da VPS cair ou
reiniciar, o site continua no ar.

## Estrutura

```
public/                         ← raiz servida pelo Nginx (só isto fica exposto)
├── favicon.ico
├── robots.txt
└── calculadora-simples/
    ├── index.html
    ├── comparar.html           ← comparativo de regimes (Reforma Tributária)
    └── assets/
        ├── css/style.css
        ├── img/logo-rc2.png
        └── js/
            ├── tabelas.js      ← alíquotas, repartição, MEI e mapa CNAE → anexo
            ├── calculo.js      ← motor de cálculo (funções puras)
            ├── app.js          ← interface, abas simples/completa, consulta de CNPJ
            ├── reforma.js      ← Anexos do Simples 2027–2033 (LC 214) e premissas da reforma
            ├── regimes.js      ← cálculo dos 4 regimes (funções puras)
            └── comparar.js     ← interface do comparativo
test/                           ← testes: node --test test/calculo.test.js test/regimes.test.js
ferramentas/lc214/              ← extrai do Planalto as tabelas usadas em reforma.js
deploy/
├── nginx-contabil.conf         ← virtual host + cabeçalhos de segurança + log anônimo
└── atualizar.sh                ← git pull na VPS
```

## Publicar (primeira vez, na VPS)

1. DNS (painel Hostinger): registro **A** `contabil` → `187.127.43.130`.
2. Clonar e configurar:
   ```bash
   git clone https://github.com/RodrigoSeny/rc2-contabil-site.git /var/www/rc2-contabil-site
   cp /var/www/rc2-contabil-site/deploy/nginx-contabil.conf /etc/nginx/sites-available/rc2-contabil
   ln -s /etc/nginx/sites-available/rc2-contabil /etc/nginx/sites-enabled/rc2-contabil
   nginx -t && systemctl reload nginx
   certbot --nginx -d contabil.rc2sistemas.cloud --redirect
   ```

## Atualizar

```bash
bash /var/www/rc2-contabil-site/deploy/atualizar.sh
```

## Manutenção

- **Tabelas do Simples**: `public/calculadora-simples/assets/js/tabelas.js` (constante `REVISAO`).
- **MEI**: atualizar `MEI.salarioMinimo` todo janeiro.
- **Reforma Tributária** (LC 214/2025): a calculadora do DAS usa as tabelas da
  LC 214 quando o período de apuração é de 2027 em diante. No comparativo
  (`reforma.js`, usado também pela calculadora a partir de 2027), atualizar `PREMISSAS.cbsReferencia` quando o Senado fixar a
  alíquota da CBS (prazo 15/12/2026) e `ibsPleno` quando houver a do IBS. Se a
  lei mudar os Anexos, regerar as tabelas com `ferramentas/lc214/` e rodar os testes.
- **APIs de CNPJ**: se mudarem, ajustar `APIS` em `app.js` **e** o `connect-src` da CSP em `deploy/nginx-contabil.conf`.
- **Visitas**: o Nginx grava `/var/log/nginx-rc2/contabil.access.log` com IP anonimizado.
