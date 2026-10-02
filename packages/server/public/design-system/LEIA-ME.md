# Design system da Bitnik (cópia fixa)

Cópia byte a byte de `dferreiramarques/bitnikgames-design-system`, tag **v1.0.0**, ficheiros de `src/`. Ver ADR-017. Não editar aqui: muda-se no repositório do design system e volta como nova tag.

Para atualizar para a tag `vX.Y.Z` (a partir da raiz do repo):

```bash
for f in index tokens base components game-ui; do
  curl -sL -o packages/server/public/design-system/$f.css     https://cdn.jsdelivr.net/gh/dferreiramarques/bitnikgames-design-system@vX.Y.Z/src/$f.css
done
```

Depois, corre `npm test` e atualiza a versão acima e na ADR-017.
