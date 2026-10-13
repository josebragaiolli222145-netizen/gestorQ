#!/usr/bin/env python3
"""Gera os pacotes instaláveis do GestorQ Desktop (Windows e Linux).

Uso (na raiz do repositório, depois de `npm install`):
    python3 desktop/build_desktop.py [--node-modules caminho] [--saida dist]

Resultado em dist/:
    GestorQ-Desktop-Windows-v<versão>.zip   (Instalar.bat + programa/)
    GestorQ-Desktop-Linux-v<versão>.tar.gz  (instalar.sh + programa/)

O pacote leva junto o Node.js oficial (baixado de nodejs.org e conferido por
SHA-256), então o computador não precisa ter nada instalado.
"""
import argparse, hashlib, io, json, os, re, shutil, sys, tarfile, urllib.request, zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESK = RAIZ / 'desktop'
NODE_VER = 'v22.22.0'   # precisa ter node:sqlite sem flag (>= 22.13)
NODE_SHA = {
    'win': ('node-%s-win-x64.zip' % NODE_VER, 'c97fa376d2becdc8863fcd3ca2dd9a83a9f3468ee7ccf7a6d076ec66a645c77a'),
    'linux': ('node-%s-linux-x64.tar.xz' % NODE_VER, '9aa8e9d2298ab68c600bd6fb86a6c13bce11a4eca1ba9b39d79fa021755d7c37'),
}
VENDOR = {  # CDN usada no GestorQ.html -> arquivo no node_modules
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js': 'chart.js/dist/chart.umd.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js': 'html2canvas/dist/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js': 'jszip/dist/jszip.min.js',
    'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js': '@zxing/library/umd/index.min.js',
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js': 'qrcodejs/qrcode.min.js',
}
FIREBASE = ['firebase-app-compat.js', 'firebase-firestore-compat.js', 'firebase-auth-compat.js']


def baixar_node(plataforma, cache):
    nome, sha = NODE_SHA[plataforma]
    arq = cache / nome
    if not arq.exists() or hashlib.sha256(arq.read_bytes()).hexdigest() != sha:
        url = 'https://nodejs.org/dist/%s/%s' % (NODE_VER, nome)
        print('  baixando', url)
        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=300) as r:
            arq.write_bytes(r.read())
    if hashlib.sha256(arq.read_bytes()).hexdigest() != sha:
        sys.exit('ERRO: SHA-256 do Node.js não confere (%s)' % nome)
    return arq


def montar_frontend(nm, destino, versao):
    html = (RAIZ / 'GestorQ.html').read_text(encoding='utf-8')
    vend = destino / 'vendor'
    (vend / 'firebase').mkdir(parents=True, exist_ok=True)
    (vend / 'fonts').mkdir(parents=True, exist_ok=True)
    # 1) bibliotecas locais (funciona sem internet)
    for url, rel in VENDOR.items():
        assert html.count('src="%s"' % url) == 1, 'CDN não encontrada: ' + url
        local = 'vendor/' + Path(rel).name
        shutil.copy(nm / rel, vend / Path(rel).name)
        html = html.replace('src="%s"' % url, 'src="%s"' % local)
    for f in FIREBASE:
        shutil.copy(nm / 'firebase' / f, vend / 'firebase' / f)
    alvo = "      var CDNS = [\n        'https://www.gstatic.com/firebasejs/' + FB_VER + '/',"
    assert html.count(alvo) == 1, 'carregador do Firebase não encontrado'
    html = html.replace(alvo, "      var CDNS = [\n        'vendor/firebase/',\n        'https://www.gstatic.com/firebasejs/' + FB_VER + '/',")
    # 1b) O app força o modo nuvem (Firebase) sempre que não está em file://.
    #     No desktop o banco é local: as mesmas regras passam a tratar o app como
    #     local, a menos que o usuário escolha "Online (Firebase)" no login.
    # Atenção: file:/desktop decide só o modo local x nuvem. Não use para controle de segurança.
    n = html.count("window.location.protocol === 'file:'")
    assert n == 5, 'esperadas 5 regras de modo local, encontradas %d (revisar antes de trocar)' % n
    html = html.replace("window.location.protocol === 'file:'", "(window.location.protocol === 'file:' || window.GQ_DESKTOP_LOCAL === true)")
    # 2) fonte Inter local (reserva quando não há internet)
    css = []
    for peso in (400, 500, 600, 700, 800, 900):
        n = 'inter-latin-%d-normal.woff2' % peso
        shutil.copy(nm / '@fontsource/inter/files' / n, vend / 'fonts' / n)
        css.append("@font-face{font-family:'Inter';font-style:normal;font-display:swap;font-weight:%d;src:local('Inter'),url(vendor/fonts/%s) format('woff2')}" % (peso, n))
    # 3) ponte com o banco (antes de qualquer script) + painel do banco em Configurações
    ponte = (DESK / 'frontend' / 'ponte.js').read_text(encoding='utf-8')
    painel = (DESK / 'frontend' / 'painel-desktop.js').read_text(encoding='utf-8')
    assert '</script' not in ponte and '</script' not in painel
    assert html.startswith('<!DOCTYPE html>')
    inicio = ('<!DOCTYPE html>\n<meta charset="UTF-8">\n<script id="gestorq-desktop-ponte">\n' + ponte + '\n</script>\n'
              '<style id="gestorq-desktop-fontes">' + ''.join(css) + '</style>\n')
    html = inicio + html[len('<!DOCTYPE html>'):]
    fim = html.rstrip().rfind('</body>')
    html = html[:fim] + '<script id="gestorq-desktop-painel">\n' + painel + '\n</script>\n' + html[fim:]
    html = html.replace('<title>GestorQ</title>', '<title>GestorQ %s</title>' % versao, 1)
    (destino / 'index.html').write_text(html, encoding='utf-8')
    return html


def gerar_icone(destino):
    from PIL import Image, ImageDraw
    S = 512
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(S):  # degradê azul → verde-azulado
        t = y / S
        cor = (int(79 + (13 - 79) * t), int(70 + (148 - 70) * t), int(229 + (136 - 229) * t), 255)
        d.line([(0, y), (S, y)], fill=cor)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=110, fill=255)
    im.putalpha(mask)
    d = ImageDraw.Draw(im)
    d.ellipse([110, 100, 370, 360], outline='white', width=42)          # lupa
    d.line([(335, 330), (420, 415)], fill='white', width=52)
    d.line([(170, 235), (225, 290), (320, 180)], fill='white', width=40, joint='curve')  # check
    im.save(destino / 'gestorq.png')
    im.save(destino / 'gestorq.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def crlf(origem, destino, encoding='utf-8', bom=False):
    txt = Path(origem).read_text(encoding='utf-8').replace('\r\n', '\n').replace('\n', '\r\n')
    data = txt.encode(encoding)
    if bom: data = b'\xef\xbb\xbf' + data
    Path(destino).write_bytes(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--node-modules', default=str(RAIZ / 'node_modules'))
    ap.add_argument('--saida', default=str(RAIZ / 'dist'))
    ap.add_argument('--so', choices=['win', 'linux', 'ambos'], default='ambos')
    a = ap.parse_args()
    nm, saida, cache = Path(a.node_modules), Path(a.saida), DESK / '.cache'
    versao = json.loads((DESK / 'server' / 'versao.json').read_text())['versao']
    if not (RAIZ / 'GestorQ.html').exists(): sys.exit('GestorQ.html não encontrado')
    shutil.rmtree(saida / 'build', ignore_errors=True)

    def programa_base(raiz):
        prog = raiz / 'programa'
        (prog / 'app').mkdir(parents=True)
        montar_frontend(nm, prog / 'app', versao)
        shutil.copytree(DESK / 'server', prog / 'server', ignore=shutil.ignore_patterns('__pycache__', '*.db*'))
        gerar_icone(prog)
        return prog

    feitos = []
    if a.so in ('win', 'ambos'):
        print('Windows:')
        raiz = saida / 'build' / 'win' / 'GestorQ'
        prog = programa_base(raiz)
        (prog / 'runtime').mkdir()
        with zipfile.ZipFile(baixar_node('win', cache)) as z:
            nome = 'node-%s-win-x64/node.exe' % NODE_VER
            (prog / 'runtime' / 'node.exe').write_bytes(z.read(nome))
            (prog / 'runtime' / 'LICENSE-node.txt').write_bytes(z.read('node-%s-win-x64/LICENSE' % NODE_VER))
        crlf(DESK / 'windows' / 'Instalar.bat', raiz / 'Instalar.bat')
        crlf(DESK / 'windows' / 'LEIA-ME.txt', raiz / 'LEIA-ME.txt', 'cp1252')
        crlf(DESK / 'windows' / 'instalar.ps1', prog / 'instalar.ps1', bom=True)
        crlf(DESK / 'windows' / 'Desinstalar.bat', prog / 'Desinstalar.bat')
        crlf(DESK / 'windows' / 'desinstalar.ps1', prog / 'desinstalar.ps1', bom=True)
        crlf(DESK / 'windows' / 'iniciar.ps1', prog / 'iniciar.ps1', bom=True)
        crlf(DESK / 'windows' / 'GestorQ.vbs', prog / 'GestorQ.vbs', 'cp1252')
        destino = saida / ('GestorQ-Desktop-Windows-v%s.zip' % versao)
        with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for f in sorted(raiz.rglob('*')):
                if f.is_file(): z.write(f, 'GestorQ/' + f.relative_to(raiz).as_posix())
        feitos.append(destino)
    if a.so in ('linux', 'ambos'):
        print('Linux:')
        raiz = saida / 'build' / 'linux' / 'GestorQ'
        prog = programa_base(raiz)
        (prog / 'runtime').mkdir()
        with tarfile.open(baixar_node('linux', cache)) as t:
            m = t.getmember('node-%s-linux-x64/bin/node' % NODE_VER)
            (prog / 'runtime' / 'node').write_bytes(t.extractfile(m).read())
            (prog / 'runtime' / 'LICENSE-node.txt').write_bytes(t.extractfile(t.getmember('node-%s-linux-x64/LICENSE' % NODE_VER)).read())
        os.chmod(prog / 'runtime' / 'node', 0o755)
        shutil.copy(DESK / 'linux' / 'gestorq.sh', prog / 'gestorq.sh'); os.chmod(prog / 'gestorq.sh', 0o755)
        shutil.copy(DESK / 'linux' / 'instalar.sh', raiz / 'instalar.sh'); os.chmod(raiz / 'instalar.sh', 0o755)
        shutil.copy(DESK / 'linux' / 'desinstalar.sh', prog / 'desinstalar.sh'); os.chmod(prog / 'desinstalar.sh', 0o755)
        shutil.copy(DESK / 'linux' / 'LEIA-ME.txt', raiz / 'LEIA-ME.txt')
        destino = saida / ('GestorQ-Desktop-Linux-v%s.tar.gz' % versao)
        with tarfile.open(destino, 'w:gz') as t:
            t.add(raiz, arcname='GestorQ')
        feitos.append(destino)
    for f in feitos:
        try: nome = f.resolve().relative_to(RAIZ.resolve())
        except ValueError: nome = f
        print('  ->', nome, '(%.1f MB)' % (f.stat().st_size / 1048576))


if __name__ == '__main__':
    main()
