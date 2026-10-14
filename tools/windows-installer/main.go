//go:build windows

// Installateur Windows de Korvalune. Sans dépendance externe (bibliothèque standard + API Windows).
// Il télécharge le moteur Electron officiel, y place l'application (app/ : main.js + package.json),
// crée les raccourcis (bureau + menu Démarrer), enregistre le programme dans « Applications installées »
// et se copie comme désinstalleur (Desinstaller.exe).
package main

import (
	"archive/zip"
	"embed"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

//go:embed app/*
var appFiles embed.FS

const (
	nom         = "Korvalune"
	electronURL = "https://github.com/electron/electron/releases/download/v33.2.0/electron-v33.2.0-win32-x64.zip"
	minTaille   = 90 << 20 // le zip officiel fait ~115 Mo : en dessous, le téléchargement est incomplet
	uninstKey   = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Korvalune`
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	msgBox      = user32.NewProc("MessageBoxW")
	findWindow  = user32.NewProc("FindWindowW")
	postMessage = user32.NewProc("PostMessageW")
)

const (
	mbOK, mbYesNo, mbIconInfo, mbIconError, mbIconQuestion = 0x0, 0x4, 0x40, 0x10, 0x20
	idYes                                                  = 6
	wmClose                                                = 0x0010
)

func u16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }

func boite(titre, texte string, style uintptr) int {
	r, _, _ := msgBox.Call(0, uintptr(unsafe.Pointer(u16(texte))), uintptr(unsafe.Pointer(u16(titre))), style|0x10000 /* MB_SETFOREGROUND */)
	return int(r)
}

func cmdCache(name string, args ...string) error {
	c := exec.Command(name, args...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c.Run()
}

func dossierInstall() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
	}
	return filepath.Join(base, "Programs", nom)
}

func main() {
	dir := dossierInstall()
	if len(os.Args) > 1 && strings.EqualFold(os.Args[1], "/uninstall") {
		desinstaller(dir)
		return
	}
	if boite(nom+" — Installation", "Installer "+nom+" sur cet ordinateur ?\n\nLe programme sera placé dans :\n"+dir+"\n\nUne connexion internet est nécessaire (environ 115 Mo à télécharger).", mbYesNo|mbIconQuestion) != idYes {
		return
	}
	// fenêtre « patientez » : un message qui reste ouvert pendant le travail, refermé à la fin
	titreAttente := nom + " — Installation en cours"
	go func() {
		boite(titreAttente, "Installation en cours…\n\nPatientez une ou deux minutes, cette fenêtre se fermera toute seule.", mbOK|mbIconInfo)
	}()
	time.Sleep(300 * time.Millisecond)
	err := installer(dir)
	if h, _, _ := findWindow.Call(0, uintptr(unsafe.Pointer(u16(titreAttente)))); h != 0 {
		postMessage.Call(h, wmClose, 0, 0)
	}
	time.Sleep(300 * time.Millisecond)
	if err != nil {
		boite(nom+" — Erreur", "L'installation a échoué :\n\n"+err.Error()+"\n\nVérifiez votre connexion internet puis relancez l'installateur.", mbOK|mbIconError)
		return
	}
	if boite(nom+" — Installation terminée", nom+" est installé.\nUn raccourci a été créé sur le bureau.\n\nLancer le jeu maintenant ?", mbYesNo|mbIconQuestion) == idYes {
		exec.Command(filepath.Join(dir, nom+".exe")).Start()
	}
}

func installer(dir string) error {
	tmp := filepath.Join(os.TempDir(), "korvalune-electron.zip")
	if err := telecharger(electronURL, tmp); err != nil {
		return fmt.Errorf("téléchargement impossible (%v)", err)
	}
	defer os.Remove(tmp)
	_ = os.RemoveAll(dir) // réinstallation propre
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := extraire(tmp, dir); err != nil {
		return fmt.Errorf("extraction impossible (%v)", err)
	}
	if err := os.Rename(filepath.Join(dir, "electron.exe"), filepath.Join(dir, nom+".exe")); err != nil {
		return err
	}
	// l'application elle-même
	appDir := filepath.Join(dir, "resources", "app")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return err
	}
	for _, f := range []string{"main.js", "package.json"} {
		b, err := appFiles.ReadFile("app/" + f)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(appDir, f), b, 0o644); err != nil {
			return err
		}
	}
	// désinstalleur = copie de ce programme
	moi, _ := os.Executable()
	if err := copier(moi, filepath.Join(dir, "Desinstaller.exe")); err != nil {
		return err
	}
	exe := filepath.Join(dir, nom+".exe")
	ps := fmt.Sprintf(`$s=New-Object -ComObject WScript.Shell;`+
		`$d=[Environment]::GetFolderPath('Desktop');$m=Join-Path ([Environment]::GetFolderPath('Programs')) '%[1]s.lnk';`+
		`foreach($p in @((Join-Path $d '%[1]s.lnk'),$m)){$l=$s.CreateShortcut($p);$l.TargetPath='%[2]s';$l.WorkingDirectory='%[3]s';$l.IconLocation='%[2]s,0';$l.Description='%[1]s';$l.Save()}`,
		nom, exe, dir)
	_ = cmdCache("powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps)
	for _, kv := range [][2]string{
		{"DisplayName", nom}, {"Publisher", nom}, {"DisplayIcon", exe}, {"InstallLocation", dir},
		{"UninstallString", `"` + filepath.Join(dir, "Desinstaller.exe") + `" /uninstall`},
	} {
		_ = cmdCache("reg", "add", uninstKey, "/v", kv[0], "/t", "REG_SZ", "/d", kv[1], "/f")
	}
	return nil
}

func desinstaller(dir string) {
	if boite(nom+" — Désinstallation", "Désinstaller "+nom+" ?\n\nVos personnages restent sauvegardés sur votre compte.", mbYesNo|mbIconQuestion) != idYes {
		return
	}
	_ = cmdCache("taskkill", "/F", "/IM", nom+".exe")
	time.Sleep(500 * time.Millisecond)
	home := os.Getenv("USERPROFILE")
	_ = os.Remove(filepath.Join(home, "Desktop", nom+".lnk"))
	_ = cmdCache("powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
		`Remove-Item -Force ([Environment]::GetFolderPath('Desktop')+'\`+nom+`.lnk') -ErrorAction SilentlyContinue;`+
			`Remove-Item -Force ((Join-Path ([Environment]::GetFolderPath('Programs')) '`+nom+`.lnk')) -ErrorAction SilentlyContinue`)
	_ = cmdCache("reg", "delete", uninstKey, "/f")
	// le désinstalleur tourne depuis le dossier à supprimer : on le fait effacer par cmd après sa fermeture
	c := exec.Command("cmd", "/C", "ping 127.0.0.1 -n 3 >nul & rmdir /S /Q \""+dir+"\"")
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = c.Start()
	boite(nom+" — Désinstallation", nom+" a été désinstallé.", mbOK|mbIconInfo)
}

func telecharger(url, dest string) error {
	cl := &http.Client{Timeout: 25 * time.Minute}
	r, err := cl.Get(url)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return fmt.Errorf("serveur : %s", r.Status)
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	n, err := io.Copy(f, r.Body)
	f.Close()
	if err != nil {
		return err
	}
	if n < minTaille {
		return fmt.Errorf("fichier incomplet (%d Mo)", n>>20)
	}
	return nil
}

func extraire(zipPath, dest string) error {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer zr.Close()
	racine := filepath.Clean(dest) + string(os.PathSeparator)
	for _, f := range zr.File {
		cible := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(cible, racine) { // anti « ../ »
			continue
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(cible, 0o755)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(cible), 0o755); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(cible, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			in.Close()
			return err
		}
		_, err = io.Copy(out, in)
		out.Close()
		in.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func copier(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}
