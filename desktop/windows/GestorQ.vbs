' GestorQ Desktop - inicia o servidor local (se preciso) e abre o app numa janela propria
Option Explicit
Dim sh, fso, base, dados, porta, i, url, nodeExe, server
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
dados = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\GestorQ\dados"
nodeExe = base & "\runtime\node.exe"
server = base & "\server\server.js"

If Not fso.FolderExists(dados) Then
  CriarPasta dados
End If

porta = LerPorta()
If Not Saudavel(porta) Then
  sh.Run """" & nodeExe & """ --no-warnings """ & server & """ --dados """ & dados & """", 0, False
  For i = 1 To 240   ' até 60 s (primeira abertura após o antivírus examinar o node.exe)
    WScript.Sleep 250
    porta = LerPorta()
    If Saudavel(porta) Then Exit For
  Next
End If

If Not Saudavel(porta) Then
  MsgBox "Não foi possível iniciar o GestorQ." & vbCrLf & vbCrLf & "Veja o registro de erros em:" & vbCrLf & dados & "\logs\servidor.log", vbCritical, "GestorQ"
  WScript.Quit 1
End If

url = "http://127.0.0.1:" & porta & "/#t=" & LerToken()
AbrirJanela url

Function LerToken()
  Dim f
  LerToken = ""
  If fso.FileExists(dados & "\token") Then
    Set f = fso.OpenTextFile(dados & "\token", 1)
    LerToken = Trim(f.ReadAll)
    f.Close
  End If
End Function

Function LerPorta()
  Dim f, t
  LerPorta = "8741"
  If fso.FileExists(dados & "\porta.txt") Then
    Set f = fso.OpenTextFile(dados & "\porta.txt", 1)
    t = Trim(f.ReadAll)
    f.Close
    If IsNumeric(t) Then LerPorta = t
  End If
End Function

Function Saudavel(p)
  Dim x
  Saudavel = False
  On Error Resume Next
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 600, 600, 600, 600
  x.open "GET", "http://127.0.0.1:" & p & "/api/health", False
  x.send
  If Err.Number = 0 Then
    ' precisa ser o GestorQ DESTE usuário do Windows (outra conta pode ter o seu na mesma porta)
    If x.status = 200 And InStr(x.responseText, """gestorq""") > 0 And InStr(1, x.responseText, """dono"":""" & CreateObject("WScript.Network").UserName & """", vbTextCompare) > 0 Then Saudavel = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

Sub AbrirJanela(u)
  Dim candidatos, c, perfil
  perfil = dados & "\navegador"
  candidatos = Array( _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe")
  For Each c In candidatos
    If fso.FileExists(c) Then
      sh.Run """" & c & """ --app=" & u & " --user-data-dir=""" & perfil & """ --no-first-run --no-default-browser-check --window-size=1366,860", 1, False
      Exit Sub
    End If
  Next
  sh.Run u, 1, False
End Sub

Sub CriarPasta(p)
  If Not fso.FolderExists(fso.GetParentFolderName(p)) Then CriarPasta fso.GetParentFolderName(p)
  If Not fso.FolderExists(p) Then fso.CreateFolder p
End Sub
