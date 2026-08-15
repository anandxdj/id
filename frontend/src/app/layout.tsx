import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AuthProvider } from '@/features/auth/context/AuthContext';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const robotoMono = Roboto_Mono({ variable: '--font-roboto-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'id — Universal Login',
  description: 'Internal OpenID Connect provider',
  icons: {
    icon: '/logo/light_logo.png',
    shortcut: '/logo/light_logo.png',
    apple: '/logo/light_logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${robotoMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
            <GooeyFilterProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

const GooeyFilterProvider = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="absolute size-0 pointer-events-none"
      version="1.1"
      aria-hidden="true"
    >
      <defs>
        <filter id="gooey-global">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
};
