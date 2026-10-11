#!/usr/bin/env python3
"""Aplica as correções estruturais sobre o GestorQ.html original (baseline).

Uso:
  git show 97618d9:GestorQ.html > /tmp/original.html
  python3 tools/build.py /tmp/original.html GestorQ.html

Cada operação confere o conteúdo da linha antes de alterar, para que o script
falhe (em vez de corromper o arquivo) caso o original seja diferente do esperado.
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
lines = open(src, encoding='utf-8').read().split('\n')
N = len(lines)
drop = set()
repl = {}

def L(n):            # linha n (1-based) do original
    return lines[n - 1]

def expect(n, text):
    assert L(n).strip().startswith(text), f'linha {n}: esperado {text!r}, obtido {L(n)[:80]!r}'

def delete(a, b, first=None, last=None):
    if first: expect(a, first)
    if last: expect(b, last)
    drop.update(range(a, b + 1))

# 1) DOCTYPE estava na linha 181 -> página renderizava em "quirks mode".
expect(181, '<!DOCTYPE html>')
repl[181] = L(181).replace('<!DOCTYPE html>', '', 1)
repl[1] = '<!DOCTYPE html>' + L(1)

# 2) Lixo de texto "</body></html>'); w.document.close(); }" exibido na página.
delete(31150, 31152, "</body></html>');", '}')

# 3) Relatório de perdas por setor (PDF/Excel): bloco de patches duplicado foi
#    injetado no meio da função; o restante dela (impressão + export Excel)
#    virou texto solto na página. Remove a cópia e religa o código.
expect(47840, 'w.document.close();')
delete(47841, 49349, '};', 'w.document.close();')      # mantém 49350.. (setTimeout print + Excel)
expect(49350, 'setTimeout(function(){ w.print(); }, 500);')

# 4) Mesmo problema no relatório de vencidos -> exportarRelatorioVencidosExcel
#    nunca era definido (botão "Relatório Excel" quebrava).
expect(49500, 'w.document.close();')
delete(49501, 51009, '};', 'w.document.close();')
expect(51010, 'setTimeout(function(){ w.print(); }, 600);')

# 5) Primeira cópia do <style id="gqfinal-style"> (a última cópia é a efetiva).
delete(30349, 30422, '<style id="gqfinal-style">', '</style>')

# 6) 4ª cópia dos patches v6/v7 (protegidos por flag -> nunca executavam).
delete(53542, 53677, '<script id="qx-v6-filiais-users-sync-patch">', '')
delete(53679, 53926, '<script id="qx-v7-economic-sync-patch">', '')

# 7) Script "GestorQ FINAL — Perdas" (PF_*) quebrava com
#    "Identifier 'D' has already been declared" e nunca executou; carregava
#    ~1 MB de dados fixos embutidos. A página dele foi substituída pelo
#    controlador v42 (pageGQFinal). Remove o script morto e o seu "booter".
delete(55923, 57054, '<!--', '</script>')

# 8) 4ª cópia dos patches v3 / v4 / v42 (protegidos por flag).
delete(57460, 57796, '<script id="gqfix-perdas-final-v3">', '')
delete(57876, 58331, '<script id="gqfinal-perdas-v4">', '')
delete(58332, 58577, '<script id="gestorq-final-controller-v42">', '')

out = []
for i, line in enumerate(lines, 1):
    if i in drop:
        continue
    out.append(repl.get(i, line))
html = '\n'.join(out)

# 9) Segurança da tela de login --------------------------------------------
def sub(old, new, count=1):
    global html
    assert html.count(old) == count, f'trecho não encontrado/ambíguo: {old[:60]!r} ({html.count(old)})'
    html = html.replace(old, new)

# 9a) Botão "🆘 Resetar acesso admin" (qualquer pessoa redefinia o admin para
#     admin/1234 e ainda sobrescrevia a filial com um valor fixo).
a = html.index("<button onclick=\"(function(){\n                localStorage.removeItem('loginFails_admin');")
b = html.index('🆘 Resetar acesso admin (emergência)\n            </button>', a) + len('🆘 Resetar acesso admin (emergência)\n            </button>')
html = html[:a] + html[b:]
# 9b) Caixa "Acesso padrão (offline): admin / 1234" exposta no login.
a = html.index('<div style="margin-top:14px;padding:10px 14px;background:rgba(43,45,131,0.12)')
assert 'Acesso padrão (offline)' in html[a:a + 400]
b = html.index('</div>', a) + len('</div>')
html = html[:a] + html[b:]
# 9c) "Redefinir admin" e "Desbloquear/recuperar" passam a usar o fluxo seguro
#     com código de recuperação (implementado no bloco gestorq-v50).
sub('onclick="resetAdminOffline()"', 'onclick="qxOpenRecovery()"', 2)
sub('♻️ Redefinir Admin (admin/1234)', '🔑 Recuperar acesso admin')
sub('                    ♻️ Redefinir admin\n', '                    🔑 Recuperar acesso\n')
sub('onclick="openAdminUnlockModal()"', 'onclick="qxOpenRecovery()"')

# 9d) Após o login, goPage('dashboard') (minúsculo) abria um placeholder vazio
#     (#pagedashboard) -> tela inicial ficava em branco até clicar no menu.
sub("if(q('pageDashboard')) goPage('dashboard');", "if(q('pageDashboard')) goPage('Dashboard', q('navDash'));")
sub("else if(q('dashboardPage')) goPage('dashboard');", "else if(q('dashboardPage')) goPage('Dashboard', q('navDash'));")

# 9e) PORTA DOS FUNDOS: o login do admin aceitava SEMPRE "1234", "admin" e
#     "1798", ignorando a senha cadastrada (e ainda revertia a senha para 1234).
#     Agora só a senha cadastrada é aceita (verifyPassword continua aceitando a
#     senha padrão enquanto ela não for trocada).
sub("""var senhasPadraoAdmin = ['1234', 'admin', '1798'];
                    if (senhasPadraoAdmin.indexOf(p) !== -1) {""",
    """// [v50] removido: senhas "padrão" eram aceitas mesmo após a troca da senha
                    if (false) {""")
sub("showNotification('❌ Senha incorreta! Tente: admin ou 1234', 'danger');",
    "showNotification('❌ Senha incorreta!', 'danger');")
sub("""var senhasPadrao = ['1234','admin','1798'];
          var loginOk = senhasPadrao.indexOf(pass) !== -1;""",
    """// [v50] removido: senhas "padrão" aceitas sempre (porta dos fundos)
          var loginOk = false;
          try { loginOk = await verifyPassword(pass, _ac.password); } catch(ex){}""")
sub("showNotification('ℹ️ Usuário padrão: Login: <b>admin</b> / Senha: <b>1798</b>', 'info');",
    "showNotification('ℹ️ Usuário padrão criado: <b>admin</b>. Use a senha inicial informada na implantação e troque-a no primeiro acesso.', 'info');")

# 9f) Instalação nova criava o admin com "1798", mas a tela de login informava
#     "1234" (só funcionava pela porta dos fundos). Padroniza a senha inicial em
#     1234; o bloco v50 exige a troca no primeiro acesso.
sub("password: 'MIGRAR_MTc5OA==', // 1798", "password: 'MIGRAR_MTIzNA==', // senha inicial 1234 (o app pede a troca)")

# 9g) Botão duplicado "Desbloquear tentativas / recuperar acesso" (mesma função
#     do botão "Recuperar acesso" logo acima).
a = html.index('<button class="btn" onclick="qxOpenRecovery()" style="width:100%;padding:10px;font-size:.92rem;margin-top:10px;')
b = html.index('</button>', a) + len('</button>')
assert 'Desbloquear tentativas' in html[a:b]
html = html[:a] + html[b:]

# 10) Camada final de correções/melhorias (CSS + JS)
extra = open(__file__.replace('build.py', 'gestorq-v50.html'), encoding='utf-8').read()
idx = html.rstrip().rfind('</body>')
html = html[:idx] + extra.rstrip('\n') + '\n\n' + html[idx:]

# 10b) XSS antigo: Plano de ação (5W2H) e log de auditoria exibiam textos sem escape
#      (as pendências da v51 e importações de sensores também aparecem ali).
sub("+' '+a.what+'</div>'", "+' '+sanitize(a.what)+'</div>'")
sub("'<div class=\"pa-meta\">👤 '+a.who+' · 📅 '+dtFmt+(a.where?' · 📍'+a.where:'')+(a.why?' · 💡'+a.why.substring(0,40):'')+'</div>'",
    "'<div class=\"pa-meta\">👤 '+sanitize(a.who)+' · 📅 '+dtFmt+(a.where?' · 📍'+sanitize(a.where):'')+(a.why?' · 💡'+sanitize(String(a.why).substring(0,40)):'')+'</div>'")
sub("🛠️ '+a.how.substring(0,80)", "🛠️ '+sanitize(String(a.how).substring(0,80))")
sub("' + l.user + '</span><span>' + l.action + (l.detail ? ' — ' + l.detail.substring(0, 60) : '')",
    "' + sanitize(l.user) + '</span><span>' + sanitize(l.action) + (l.detail ? ' — ' + sanitize(String(l.detail).substring(0, 60)) : '')")

# 11) Marca única: relatórios impressos e manifesto diziam "Qualtrix"
import re as _re
_n = 0
def _brand_line(m):
    global _n
    line = m.group(0)
    if 'Qualtrix' in line:
        _n += line.count('Qualtrix')
        line = line.replace('Qualtrix Platform', 'GestorQ').replace('Qualtrix', 'GestorQ')
    return line
html = _re.sub(r'^.*(?:document\.write\(|rel="manifest"|<title>|<h[1-6][^>]*>|doc\.text\(|showNotification\(|alert\(|document\.title|\.textContent|\.innerHTML|ensureHero\(|title=").*$', _brand_line, html, flags=_re.M)
html = html.replace("Qualtrix Platform", "GestorQ").replace("|| 'Qualtrix'", "|| 'GestorQ'")
for _a in ['Gerado pelo Qualtrix', 'relatório do Qualtrix', 'Resumo Semanal Qualtrix', 'Qualtrix Alert', '*Auditoria Qualtrix*', 'Buscar no Qualtrix', 'Qualtrix Ultimate']:
    html = html.replace(_a, _a.replace('Qualtrix', 'GestorQ'))
print('marca:', _n, 'ocorrências em relatórios/manifesto')

# 12) Camada v51 (melhorias da análise de mercado)
v51_css = open(__file__.replace('build.py', 'gestorq-v51.html'), encoding='utf-8').read().rstrip('\n')
v51_js = open(__file__.replace('build.py', 'gestorq-v51.js'), encoding='utf-8').read().rstrip('\n')
assert '</script' not in v51_js
idx = html.rstrip().rfind('</body>')
html = html[:idx] + v51_css + '\n<script id="gestorq-v51">\n' + v51_js + '\n</script>\n\n' + html[idx:]

open(dst, 'w', encoding='utf-8').write(html)
print('ok:', N, '->', html.count('\n') + 1, 'linhas;', len(html.encode()) // 1024, 'KB')
