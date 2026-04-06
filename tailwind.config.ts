import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: ['class', 'class'],
    theme: {
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			nerve: 'hsl(var(--nerve))',
    			cortex: 'hsl(var(--cortex))',
    			oracle: 'hsl(var(--oracle))',
    			reflex: 'hsl(var(--reflex))',
    			'health-good': 'hsl(var(--health-good))',
    			'health-warn': 'hsl(var(--health-warn))',
    			'health-critical': 'hsl(var(--health-critical))',
    			'health-unknown': 'hsl(var(--health-unknown))',
    			'surface-0': 'hsl(var(--surface-0))',
    			'surface-1': 'hsl(var(--surface-1))',
    			'surface-2': 'hsl(var(--surface-2))',
    			'surface-3': 'hsl(var(--surface-3))',
    			dark: {
    				'50': '#f8fafc',
    				'100': '#f1f5f9',
    				'200': '#e2e8f0',
    				'300': '#cbd5e1',
    				'400': '#94a3b8',
    				'500': '#64748b',
    				'600': '#475569',
    				'700': '#334155',
    				'800': '#1e293b',
    				'900': '#0f172a',
    				'950': '#020617'
    			},
    			'primary-extend': {
    				'50': '#ecfdf5',
    				'100': '#d1fae5',
    				'200': '#a7f3d0',
    				'300': '#6ee7b7',
    				'400': '#34d399',
    				'500': '#00E5C8',
    				'600': '#00C4AA',
    				'700': '#009E89',
    				'800': '#007A6A',
    				'900': '#005A4E'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		fontSize: {
    			'2xs': [
    				'0.625rem',
    				{
    					lineHeight: '0.875rem'
    				}
    			]
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'fade-in': 'fade-in 0.3s ease-out forwards',
    			'slide-up': 'slide-up 0.3s ease-out forwards',
    			'slide-in': 'slide-in 0.3s ease-out',
    			'risk-pulse': 'risk-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    			glow: 'glow 2s ease-in-out infinite',
    			'spin-slow': 'spin-slow 8s linear infinite'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			'fade-in': {
    				from: {
    					opacity: '0'
    				},
    				to: {
    					opacity: '1'
    				}
    			},
    			'slide-up': {
    				from: {
    					opacity: '0',
    					transform: 'translateY(8px)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'slide-in': {
    				from: {
    					transform: 'translateY(10px)',
    					opacity: '0'
    				},
    				to: {
    					transform: 'translateY(0)',
    					opacity: '1'
    				}
    			},
    			'risk-pulse': {
    				'0%, 100%': {
    					opacity: '1'
    				},
    				'50%': {
    					opacity: '0.6'
    				}
    			},
    			glow: {
    				'0%, 100%': {
    					boxShadow: '0 0 8px hsl(var(--primary) / 0.2)'
    				},
    				'50%': {
    					boxShadow: '0 0 20px hsl(var(--primary) / 0.4)'
    				}
    			},
    			'spin-slow': {
    				from: {
    					transform: 'rotate(0deg)'
    				},
    				to: {
    					transform: 'rotate(360deg)'
    				}
    			}
    		},
    		spacing: {
    			'18': '4.5rem',
    			'88': '22rem',
    			'128': '32rem'
    		}
    	}
    },
    plugins: [],
};

export default config;
