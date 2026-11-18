@echo off
chcp 65001 >nul
title Kie-Chan! (Electron)
echo ====================================================
echo  Iniciando Kie-Chan! via Electron
echo ====================================================
start "" /b cmd /c "npm start"
exit
