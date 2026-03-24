import '@testing-library/jest-dom';
import { render, screen } from '@/lib/test-utils'
import { DashboardNav } from '../DashboardNav'

// Override the default pathname mock for DashboardNav tests
jest.mock('next/navigation', () => ({
    usePathname: jest.fn(() => '/dashboard'),
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
        refresh: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        prefetch: jest.fn(),
    })),
    useSearchParams: jest.fn(() => new URLSearchParams()),
    useParams: jest.fn(() => ({})),
}))

describe('DashboardNav', () => {
    it('renders navigation links', () => {
        render(<DashboardNav />)

        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Mission Control')).toBeInTheDocument()
        expect(screen.getByText('Remote')).toBeInTheDocument()
        expect(screen.getByText('Insights')).toBeInTheDocument()
    })

    it('renders user name when authenticated', () => {
        render(<DashboardNav />)

        // Session mock from jest.setup.js provides "Test User"
        expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('renders sign out button', () => {
        render(<DashboardNav />)

        const signOutButton = screen.getByText('Sign Out')
        expect(signOutButton).toBeInTheDocument()
    })
})
