@echo off
chcp 65001 >nul
title Kie-Chan! (Modo Super Leve)
echo ====================================================
echo  Iniciando Kie-Chan! via Neutralinojs (~30MB RAM)
echo ====================================================
start "" /b cmd /c "npx @neutralinojs/neu run"
exit
