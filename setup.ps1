# PulseIQ Frontend Setup Script
# Run this script to set up your development environment

Write-Host "🚀 Setting up PulseIQ Frontend..." -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "`n📦 Checking Node.js installation..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion is installed" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "✅ npm $npmVersion is installed" -ForegroundColor Green
} else {
    Write-Host "❌ npm is not installed" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`n📥 Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "`n📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env file created. Please update it with your configuration." -ForegroundColor Green
} else {
    Write-Host "`n✅ .env file already exists" -ForegroundColor Green
}

# Display next steps
Write-Host "`n✨ Setup complete!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env file with your backend URL and Supabase credentials (optional)"
Write-Host "2. Run 'npm run dev' to start the development server"
Write-Host "3. Visit http://localhost:8080 in your browser"
Write-Host "4. Follow BACKEND_SETUP.md to set up your FastAPI backend"
Write-Host "`n📚 Documentation:" -ForegroundColor Yellow
Write-Host "- README.md - Frontend documentation"
Write-Host "- BACKEND_SETUP.md - Backend setup guide"
Write-Host "- MIGRATION_COMPLETE.md - Migration summary"
Write-Host "`n🎉 Happy coding!" -ForegroundColor Cyan
