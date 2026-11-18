@echo off
title Desktop Waifu AI - DeepSeek V4-1-Flash (Kie.ai)
echo ====================================================
echo  Iniciando sua Waifu IA para Desktop...
echo  Modelo 3D: 3d_anime_character_girl_for_blender_c1.glb
echo  API: DeepSeek V4-1-Flash via Kie.ai
echo  Endpoint: POST /openai/v1/responses
echo ====================================================
npm.cmd start
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro ao iniciar. Tentando com npx electron...
    npx.cmd electron .
)
pause
