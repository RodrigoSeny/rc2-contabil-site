# RC2 Contábil — site público

Site público da RC2 Contábil em **https://contabil.rc2sistemas.cloud**.
Hoje contém a **Calculadora do Simples Nacional** (`/calculadora-simples/`),
com versão simples e completa.

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
    └── assets/
        ├── css/style.css
        ├── img/logo-rc2.png
        └── js/
            ├── tabelas.js      ← alíquotas, repartição, MEI e mapa CNAE → anexo
            ├── calculo.js      ← motor de cálculo (funções puras)
            └── app.js          ← interface, abas simples/completa, consulta de CNPJ
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
- **Reforma Tributária** (LC 214/2025): revisar antes de janeiro/2027.
- **APIs de CNPJ**: se mudarem, ajustar `APIS` em `app.js` **e** o `connect-src` da CSP em `deploy/nginx-contabil.conf`.
- **Visitas**: o Nginx grava `/var/log/nginx-rc2/contabil.access.log` com IP anonimizado.
