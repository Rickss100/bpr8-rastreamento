# BPR-8 · Bastão Poligonal de Rastreamento
**PMES / Batalhão de Ações com Cães (BAC)**
Análise Biomecânica Forense — v3 PWA

---

## Como publicar no GitHub Pages (5 minutos)

### 1. Criar repositório no GitHub
1. Acesse **github.com** → botão **New**
2. Nome: `bpr8-rastreamento` (ou qualquer nome)
3. Marque **Public**
4. Clique **Create repository**

### 2. Subir os arquivos
Arraste todos os arquivos desta pasta para a página do repositório:
```
index.html
app.js
manifest.json
sw.js
icon-192.png
icon-512.png
```
Clique **Commit changes**.

### 3. Ativar GitHub Pages
1. No repositório → aba **Settings**
2. Menu lateral → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** · Folder: **/ (root)**
5. Clique **Save**
6. Aguarde ~2 minutos

Seu app estará disponível em:
```
https://SEU_USUARIO.github.io/bpr8-rastreamento/
```

---

## Como instalar no celular Android

1. Abra o link acima no **Chrome** (não Firefox, não Samsung Browser)
2. Aguarde carregar completamente
3. O Chrome exibirá um banner: **"Adicionar BPR-8 à tela inicial"**
4. Se não aparecer: menu (⋮) → **Adicionar à tela inicial**
5. Confirme → o ícone aparecerá na tela inicial como app nativo

**O app funciona offline após a primeira abertura.**

---

## Como testar no segundo celular durante o desenvolvimento

### Opção A — GitHub Pages (mais fácil)
1. Edite qualquer arquivo no GitHub (botão ✏️)
2. Commit → aguarda 30 segundos
3. Recarrega o Chrome no celular de teste → atualização automática

### Opção B — Rede local Wi-Fi (instantâneo)
No computador com Python instalado:
```bash
# Na pasta do projeto:
python3 -m http.server 8080
```
No celular de teste (mesma rede Wi-Fi):
```
http://IP_DO_COMPUTADOR:8080
```
Para descobrir o IP:
```bash
# Windows:
ipconfig
# Linux/Mac:
ip addr | grep inet
```

---

## Próximo passo — Gerar APK real com Capacitor

Quando o app estiver validado em campo:

### 1. Instalar Node.js + Capacitor
```bash
npm install -g @ionic/cli
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "BPR-8 Rastreamento" "br.pm.es.bac.bpr8"
npx cap add android
```

### 2. Copiar arquivos PWA
```bash
# Adicionar ao capacitor.config.json:
# "webDir": "."
npx cap copy android
```

### 3. Gerar APK
```bash
npx cap open android
# Abre o Android Studio
# Build → Generate Signed APK
```

### Ou direto via terminal (sem Android Studio):
```bash
cd android
./gradlew assembleDebug
# APK gerado em: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Permissões necessárias no Android

O app solicita automaticamente:
- **Localização precisa** — para GPS da trilha
- **Câmera** — para fotos de pegadas (próxima versão)
- **Armazenamento** — para salvar dados offline

---

## Estrutura de arquivos

```
bpr8-pwa/
├── index.html      ← Shell PWA + registro Service Worker
├── app.js          ← App React completo (JSX)
├── manifest.json   ← Configurações PWA (nome, ícone, cor)
├── sw.js           ← Service Worker (offline + cache de mapas)
├── icon-192.png    ← Ícone Android
├── icon-512.png    ← Ícone splash / Play Store
└── README.md       ← Este arquivo
```

---

## Referência científica

Baseado no livro:
**"Análise Biomecânica Forense e Engenharia de Precisão:
O Desenvolvimento do Bastão de Rastreamento Poligonal Articulado"**

Equações implementadas (Cap.3):
- ♂ Pé Dir: `Ht = 86,89 + 3,49 × RFPL` (SEE ±7,2cm)
- ♂ Pé Esq: `Ht = 90,15 + 3,34 × LFPL` (SEE ±7,2cm)
- ♀ Pé Dir: `Ht = 58,93 + 4,42 × RFPL` (SEE ±8,7cm)
- ♀ Pé Esq: `Ht = 63,20 + 4,28 × LFPL` (SEE ±8,7cm)
- Velocidade: `V = SL × 58,5 / 60` (cadência 117 pass/min)
