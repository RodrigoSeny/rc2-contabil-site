#!/bin/bash
# Atualiza o site da RC2 Contábil na VPS — rodar após git push.
# Site estático: basta puxar o código; não há processo para reiniciar.
set -e
cd /var/www/rc2-contabil-site
git pull --ff-only origin main
git fetch -q --tags origin
sudo nginx -t && sudo systemctl reload nginx
echo "✅ RC2 Contábil atualizado — versão $(git describe --tags --always)."
