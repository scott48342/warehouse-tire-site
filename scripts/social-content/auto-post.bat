@echo off
REM Facebook Auto-Post Script
REM Generates wheel content and posts to both Facebook pages

cd /d "C:\Users\Scott-Pc\backup clawd\warehouse-tire-site\scripts\social-content"

echo [%date% %time%] Starting auto-post... >> auto-post.log

REM Generate content for page 1
echo Generating content for Page 1...
node generate.js --count=1 >> auto-post.log 2>&1

REM Post to page 1 (Warehouse Tire)
echo Posting to Page 1...
node post-facebook.js >> auto-post.log 2>&1

REM Small delay between posts
timeout /t 5 /nobreak > nul

REM Generate content for page 2
echo Generating content for Page 2...
node generate.js --count=1 >> auto-post.log 2>&1

REM Post to page 2 (Warehouse Tire 1)
echo Posting to Page 2...
node post-facebook.js --page=2 >> auto-post.log 2>&1

echo [%date% %time%] Auto-post complete >> auto-post.log
echo Done!
