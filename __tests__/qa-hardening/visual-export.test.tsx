import { render } from '@/lib/test-utils'
import SignupPage from '@/app/signup/page'
import LoginPage from '@/app/login/page'
import ForgotPasswordPage from '@/app/forgot-password/page'
import Loading from '@/app/workspaces/[id]/loading'
import ErrorBoundary from '@/app/workspaces/[id]/error'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Mocking some extra things that might be needed
jest.mock('next/link', () => {
    return ({ children, href }: any) => <a href={href}>{children}</a>
})

const ARTIFACTS_DIR = '/home/h_khalid/.gemini/antigravity/brain/9f442ff0-c2b8-4cff-a362-4036d2dec708/visual-qa'
if (!existsSync(ARTIFACTS_DIR)) {
    mkdirSync(ARTIFACTS_DIR, { recursive: true })
}

function exportVisual(name: string, ui: React.ReactElement) {
    const { container } = render(ui)
    const html = `
<!DOCTYPE html>
<html class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual QA - ${name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        health: {
                            good: '#00E5C8',
                            warning: '#FFB800',
                            critical: '#FF4136'
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { background-color: #020617; color: #f8fafc; }
    </style>
</head>
<body class="bg-slate-950 text-slate-50 min-h-screen">
    <div class="p-8">
        <h1 class="text-2xl font-bold mb-8 text-slate-400 border-b border-slate-800 pb-2">Visual QA: ${name}</h1>
        <div id="render-root">
            ${container.innerHTML}
        </div>
    </div>
</body>
</html>
`
    writeFileSync(join(ARTIFACTS_DIR, `${name.toLowerCase().replace(/\s+/g, '-')}.html`), html)
}

describe('Visual QA Export', () => {
    it('exports signup page', () => {
        exportVisual('Signup Page', <SignupPage />)
    })

    it('exports login page', () => {
        exportVisual('Login Page', <LoginPage />)
    })

    it('exports forgot password page', () => {
        exportVisual('Forgot Password Page', <ForgotPasswordPage />)
    })

    it('exports loading skeleton', () => {
        exportVisual('Loading Skeleton', <Loading />)
    })

    it('exports error boundary', () => {
        exportVisual('Error Boundary', <ErrorBoundary error={new Error('Test Error')} reset={() => { }} />)
    })
})
